"""
Espace Responsable de niveau — v4.

Chaque responsable est scopé à un seul niveau (ingenieur | master | licence).
Il gère UNIQUEMENT les étudiants de ce niveau.

Fonctionnalités :
  - Consulter et rechercher ses étudiants (kanban par statut d'inscription)
  - Ajouter manuellement un étudiant (niveau forcé automatiquement)
  - Modifier les champs modifiables d'un étudiant (CIN, filière, code filière,
    num_inscription et email sont IMMUTABLES)
  - Valider ou rejeter une inscription
  - Télécharger les pièces jointes d'un dossier
  - Importer des étudiants depuis Excel (niveau_id forcé à son niveau)
  - Exporter ses étudiants vers Excel
  - Statistiques de son niveau
"""
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_responsable, has_permission
from app.db.session import get_db
from app.models.models import Etudiant, Inscription
from app.schemas.schemas import (
    EtudiantAdminRead, EtudiantCreate, EtudiantUpdate,
    ExportRequest, ImportPreviewResponse, ImportResult,
    InscriptionDecision, PaginatedEtudiants,
)
from app.services.etudiant_service import EtudiantService, ANNEE_EN_COURS
from app.services.export_service import ExportService
from app.services.file_service import FileService, build_content_disposition
from app.services.import_service import ImportService
from app.services.responsable_service import ResponsableService

router = APIRouter(prefix="/responsable", tags=["Responsable de niveau"])


# ═══════════════════════════════════════════════════════════
#  PROFIL
# ═══════════════════════════════════════════════════════════

@router.get("/me", summary="Mon profil et mon niveau")
async def get_my_profile(
    current_user: dict = Depends(has_permission("niveau:read_all")),
    db: AsyncSession = Depends(get_db),
):
    """Retourne les informations du responsable connecté et son niveau assigné."""
    return await ResponsableService.get_profile(db, current_user["id"])


# ═══════════════════════════════════════════════════════════
#  ÉTUDIANTS — lecture
# ═══════════════════════════════════════════════════════════

@router.get(
    "/etudiants",
    response_model=PaginatedEtudiants,
    summary="Étudiants de mon niveau classés par statut d'inscription",
)
async def list_my_etudiants(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=500),
    search: Optional[str] = Query(None, description="Nom, CIN, arabique..."),
    statut_inscription: Optional[str] = Query(
        None, description="en_attente | validee | rejetee (vide = tous)"
    ),
    current_user: dict = Depends(has_permission("inscription:read_level")),
    db: AsyncSession = Depends(get_db),
):
    niveau_id = current_user.get("niveau_id")
    if niveau_id is None:
        raise HTTPException(
            status_code=400,
            detail="Ce compte responsable n'a pas de niveau assigné. Contactez l'administrateur.",
        )
    return await EtudiantService.list_etudiants(
        db, page=page, size=size, search=search,
        niveau_id=niveau_id, statut_inscription=statut_inscription,
    )


@router.get(
    "/etudiants/{etudiant_id}",
    response_model=EtudiantAdminRead,
    summary="Dossier complet d'un étudiant (avec pièces jointes)",
)
async def get_etudiant(
    etudiant_id: int,
    current_user: dict = Depends(has_permission("inscription:read_level")),
    db: AsyncSession = Depends(get_db),
):
    niveau_id = current_user.get("niveau_id")
    return await ResponsableService.get_etudiant_du_niveau(db, etudiant_id, niveau_id)


# ═══════════════════════════════════════════════════════════
#  ÉTUDIANTS — création & modification
# ═══════════════════════════════════════════════════════════

@router.post(
    "/etudiants",
    response_model=EtudiantAdminRead,
    status_code=201,
    summary="Ajouter un étudiant dans mon niveau",
)
async def create_etudiant(
    data: EtudiantCreate,
    current_user: dict = Depends(has_permission("note:create_level")),
    db: AsyncSession = Depends(get_db),
):
    """
    Crée un étudiant et l'assigne automatiquement au niveau du responsable.
    Le champ `niveau_id` de la requête est ignoré — le niveau est forcé.
    """
    niveau_id = current_user.get("niveau_id")
    # Forcer le niveau_id au niveau du responsable
    payload = data.model_dump()
    payload["niveau_id"] = niveau_id
    forced_data = EtudiantCreate(**payload)
    return await EtudiantService.create_etudiant(db, forced_data)


@router.patch(
    "/etudiants/{etudiant_id}",
    response_model=EtudiantAdminRead,
    summary="Modifier les champs modifiables d'un étudiant",
)
async def update_etudiant(
    etudiant_id: int,
    data: EtudiantUpdate,
    current_user: dict = Depends(has_permission("note:update_level")),
    db: AsyncSession = Depends(get_db),
):
    """
    Met à jour uniquement les champs autorisés.

    **Immutables — jamais modifiables :**
    `mat_cin`, `cfil`, `lib_filiere`, `lib_filiere_ar`, `num_inscription`, `email`

    Ces champs ne sont pas acceptés dans le body et sont ignorés même s'ils sont envoyés.
    """
    niveau_id = current_user.get("niveau_id")
    # Vérifier que l'étudiant appartient au niveau du responsable
    await ResponsableService.get_etudiant_du_niveau(db, etudiant_id, niveau_id)
    return await EtudiantService.update_etudiant(db, etudiant_id, data)


# ═══════════════════════════════════════════════════════════
#  INSCRIPTIONS — décision
# ═══════════════════════════════════════════════════════════

@router.post(
    "/inscriptions/{inscription_id}/decision",
    response_model=EtudiantAdminRead,
    summary="Valider ou rejeter une inscription",
)
async def decide_inscription(
    inscription_id: int,
    body: InscriptionDecision,
    current_user: dict = Depends(has_permission("inscription:approve_level")),
    db: AsyncSession = Depends(get_db),
):
    """
    **Valider** : `{"decision": "valider"}`
    → Inscription validée. Email de confirmation envoyé. Étudiant = INSCRIT.

    **Rejeter** : `{"decision": "rejeter", "message_rejet": "Dossier incomplet..."}`
    → Inscription refusée. Email avec message envoyé.
    → L'étudiant peut corriger et resoumettre.
    """
    return await ResponsableService.decide_inscription(
        db, inscription_id, body,
        current_user["id"],          # email du responsable (JWT sub)
        current_user.get("niveau_id"),
    )


# ═══════════════════════════════════════════════════════════
#  PIÈCES JOINTES
# ═══════════════════════════════════════════════════════════

@router.get(
    "/pieces-jointes/{piece_jointe_id}/download",
    summary="Télécharger une pièce jointe pour vérification",
)
async def download_piece(
    piece_jointe_id: int,
    current_user: dict = Depends(has_permission("piece_jointe:read_level")),
    db: AsyncSession = Depends(get_db),
):
    pj, content = await FileService.get_piece_jointe(db, piece_jointe_id)
    media_type = pj.mime_type or "application/octet-stream"
    disposition = "inline" if media_type.startswith("image/") else "attachment"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": build_content_disposition(disposition, pj.nom_fichier)},
    )


# ═══════════════════════════════════════════════════════════
#  STATISTIQUES
# ═══════════════════════════════════════════════════════════

@router.get("/stats", summary="Statistiques de mon niveau par statut")
async def get_stats(
    current_user: dict = Depends(has_permission("inscription:read_level")),
    db: AsyncSession = Depends(get_db),
):
    niveau_id = current_user.get("niveau_id")
    counts = {}
    for s in ("brouillon", "soumis", "en_attente", "validee", "rejetee"):
        r = await db.execute(
            select(Inscription).where(
                Inscription.niveau_id == niveau_id,
                Inscription.statut == s,
                Inscription.annee_universitaire == ANNEE_EN_COURS,
            )
        )
        counts[s] = len(r.scalars().all())

    total_etudiants_r = await db.execute(
        select(Etudiant).where(
            Etudiant.niveau_id == niveau_id,
            Etudiant.is_active == True,
        )
    )
    total_etudiants = len(total_etudiants_r.scalars().all())

    return {
        "niveau_id":       niveau_id,
        "annee":           ANNEE_EN_COURS,
        "total_etudiants": total_etudiants,
        "total":           sum(counts.values()),
        "brouillon":       counts["brouillon"],
        "soumis":          counts["soumis"],
        "en_attente":      counts["en_attente"],
        "validee":         counts["validee"],
        "rejetee":         counts["rejetee"],
    }


# ═══════════════════════════════════════════════════════════
#  IMPORT / EXPORT (scopés au niveau du responsable)
# ═══════════════════════════════════════════════════════════

def _ensure_niveau(current_user: dict) -> int:
    niveau_id = current_user.get("niveau_id")
    if niveau_id is None:
        raise HTTPException(
            status_code=400,
            detail="Ce compte responsable n'a pas de niveau assigné. Contactez l'administrateur.",
        )
    return niveau_id


# ── IMPORT flexible (scopé au niveau du responsable) ──────────────

@router.get("/import/fields", summary="Catalogue des champs cibles importables")
async def import_fields_resp(current_user: dict = Depends(has_permission("inscription:read_level"))):
    return {"fields": ImportService.get_target_fields()}


@router.post(
    "/import/preview",
    response_model=ImportPreviewResponse,
    summary="Analyse d'un fichier (colonnes + échantillon + suggestion de mapping)",
)
async def import_preview_resp(
    file: UploadFile = File(...),
    current_user: dict = Depends(has_permission("inscription:read_level")),
):
    name = (file.filename or "").lower()
    if not name.endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="Fichier .xlsx, .xls ou .csv requis")
    content = await file.read()
    try:
        return ImportService.preview(content, file.filename or "import")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/import/execute",
    response_model=ImportResult,
    summary="Import flexible avec mapping (niveau forcé au niveau du responsable)",
)
async def import_execute_resp(
    file: UploadFile = File(...),
    mapping: str = Query(..., description="JSON {nom_colonne_fichier: clé_champ_cible}"),
    update_existing: bool = Query(True),
    current_user: dict = Depends(has_permission("note:create_level")),
    db: AsyncSession = Depends(get_db),
):
    name = (file.filename or "").lower()
    if not name.endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="Fichier .xlsx, .xls ou .csv requis")

    import json as _json
    try:
        mapping_dict = _json.loads(mapping)
        if not isinstance(mapping_dict, dict):
            raise ValueError("mapping doit être un objet")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Mapping JSON invalide : {e}")

    niveau_id = _ensure_niveau(current_user)
    content = await file.read()
    return await ImportService.import_with_mapping(
        db, content, file.filename or "import",
        mapping=mapping_dict,
        update_existing=update_existing,
        force_niveau_id=niveau_id,
    )


# Compat legacy : auto-détection (existant)
@router.post(
    "/import/xlsx",
    response_model=ImportResult,
    summary="[Legacy] Import auto-détecté (niveau forcé automatiquement)",
)
async def import_xlsx(
    file: UploadFile = File(...),
    update_existing: bool = Query(True, description="Mettre à jour si le CIN existe déjà"),
    current_user: dict = Depends(has_permission("note:create_level")),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename.lower().endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="Fichier .xlsx, .xls ou .csv requis")
    niveau_id = _ensure_niveau(current_user)
    content = await file.read()
    return await ImportService.import_from_xlsx(
        db, content,
        update_existing=update_existing,
        force_niveau_id=niveau_id,
        filename=file.filename or "import.xlsx",
    )


# ── EXPORT flexible (scopé au niveau du responsable) ──────────────

@router.get("/export/fields", summary="Catalogue des champs exportables + presets")
async def export_fields_resp(current_user: dict = Depends(has_permission("inscription:read_level"))):
    return ExportService.get_catalog()


@router.post(
    "/export/custom",
    summary="Export flexible (niveau forcé au niveau du responsable)",
)
async def export_custom_resp(
    payload: ExportRequest,
    current_user: dict = Depends(has_permission("inscription:read_level")),
    db: AsyncSession = Depends(get_db),
):
    fmt = (payload.format or "xlsx").lower()
    if fmt not in ("xlsx", "csv"):
        raise HTTPException(status_code=400, detail="format doit être 'xlsx' ou 'csv'")

    niveau_id = _ensure_niveau(current_user)
    # Le responsable ne peut exporter QUE son niveau — on force la valeur
    try:
        data, mime, ext = await ExportService.export_custom(
            db,
            columns=[c.model_dump() for c in payload.columns],
            fmt=fmt,
            cfil=payload.cfil,
            niveau_id=niveau_id,
            inscription_only=payload.inscription_only,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    base = (payload.filename or "etudiants").strip().replace("/", "_") or "etudiants"
    filename = f"{base}.{ext}"
    return StreamingResponse(
        iter([data]),
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# Compat legacy : export SALIMA simple (existant)
@router.get(
    "/export/xlsx",
    summary="[Legacy] Exporter les étudiants de mon niveau au format SALIMA",
)
async def export_xlsx(
    inscription_only: bool = Query(True, description="Exporter seulement les inscrits (validés)"),
    current_user: dict = Depends(has_permission("inscription:read_level")),
    db: AsyncSession = Depends(get_db),
):
    niveau_id = _ensure_niveau(current_user)
    xlsx_bytes = await ExportService.export_to_xlsx(
        db,
        niveau_id=niveau_id,
        inscription_only=inscription_only,
    )
    label = "inscrits" if inscription_only else "tous"
    filename = f"etudiants_niveau_{niveau_id}_{label}_{ANNEE_EN_COURS.replace('/', '-')}.xlsx"
    return StreamingResponse(
        iter([xlsx_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
