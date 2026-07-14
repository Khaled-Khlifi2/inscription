"""
Espace Administration Scolarité (admin global).
Gère aussi les niveaux et les responsables.
"""
from typing import Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from passlib.context import CryptContext

from app.core.dependencies import require_scolarite, has_permission
from app.core.pieces_jointes_config import load_pieces_jointes_config
from app.db.session import get_db
from sqlalchemy import func
from app.models.models import Etudiant, Inscription, Niveau, UserResponsable
from app.schemas.schemas import (
    EtudiantAdminRead, EtudiantCreate, EtudiantUpdate,
    ExportRequest, ImportPreviewResponse, ImportResult, InscriptionDecision,
    NiveauCreate, NiveauRead,
    PaginatedEtudiants, PieceJointeRead, PieceJointeReject,
    ResponsableCreate, ResponsableRead,
)
from app.services.etudiant_service import EtudiantService, ANNEE_EN_COURS
from app.services.export_service import ExportService
from app.services.file_service import FileService, build_content_disposition
from app.services.import_service import ImportService

router = APIRouter(prefix="/scolarite", tags=["Scolarite — Administration"])
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ═══════════════════════════════════════════════════════════
#  NIVEAUX
# ═══════════════════════════════════════════════════════════

@router.get("/niveaux", response_model=list[NiveauRead], summary="Liste des niveaux")
async def list_niveaux(
    current_user: dict = Depends(has_permission("niveau:read_all")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Niveau).order_by(Niveau.code))
    return result.scalars().all()


@router.post("/niveaux", response_model=NiveauRead, status_code=201, summary="Creer un niveau")
async def create_niveau(
    data: NiveauCreate,
    current_user: dict = Depends(has_permission("niveau:manage_all")),
    db: AsyncSession = Depends(get_db),
):
    import re
    # Normaliser le code en slug : minuscules, espaces/tirets → underscore, alphanumérique uniquement.
    code = re.sub(r"[^a-z0-9_]", "_", data.code.strip().lower())
    code = re.sub(r"_+", "_", code).strip("_")
    if not code:
        raise HTTPException(status_code=400, detail="Code de niveau invalide")
    if len(code) > 40:
        raise HTTPException(status_code=400, detail="Code trop long (max 40 caracteres)")
    libelle = data.libelle.strip()
    if not libelle:
        raise HTTPException(status_code=400, detail="Libelle obligatoire")

    existing = await db.execute(select(Niveau).where(Niveau.code == code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Niveau '{code}' existe deja")
    n = Niveau(code=code, libelle=libelle, libelle_ar=(data.libelle_ar or None))
    db.add(n)
    await db.flush()
    await db.refresh(n)
    return n


@router.patch("/niveaux/{niveau_id}", response_model=NiveauRead, summary="Modifier un niveau")
async def update_niveau(
    niveau_id: int,
    data: dict,
    current_user: dict = Depends(has_permission("niveau:manage_all")),
    db: AsyncSession = Depends(get_db),
):
    n = (await db.execute(select(Niveau).where(Niveau.id == niveau_id))).scalar_one_or_none()
    if not n:
        raise HTTPException(status_code=404, detail="Niveau introuvable")
    # Le code n'est PAS modifiable une fois créé (référencé par étudiants/responsables).
    if "libelle" in data and data["libelle"] is not None:
        v = str(data["libelle"]).strip()
        if v:
            n.libelle = v
    if "libelle_ar" in data:
        n.libelle_ar = (str(data["libelle_ar"]).strip() or None) if data["libelle_ar"] is not None else None
    if "is_active" in data and data["is_active"] is not None:
        n.is_active = bool(data["is_active"])
    await db.flush()
    await db.refresh(n)
    return n


# ═══════════════════════════════════════════════════════════
#  RESPONSABLES
# ═══════════════════════════════════════════════════════════

@router.get("/responsables", response_model=list[ResponsableRead], summary="Liste des responsables")
async def list_responsables(
    current_user: dict = Depends(has_permission("user:manage_responsable")),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(UserResponsable).options(selectinload(UserResponsable.niveau)).order_by(UserResponsable.nom)
    )
    return result.scalars().all()


@router.post("/responsables", response_model=ResponsableRead, status_code=201, summary="Creer un responsable")
async def create_responsable(
    data: ResponsableCreate,
    current_user: dict = Depends(has_permission("user:manage_responsable")),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy.orm import selectinload
    existing = await db.execute(select(UserResponsable).where(UserResponsable.email == data.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email deja utilise")
    niveau = (await db.execute(select(Niveau).where(Niveau.id == data.niveau_id))).scalar_one_or_none()
    if not niveau:
        raise HTTPException(status_code=404, detail="Niveau introuvable")
    r = UserResponsable(
        email=data.email.lower(), nom=data.nom, prenom=data.prenom,
        hashed_password=pwd.hash(data.password), niveau_id=data.niveau_id,
    )
    db.add(r)
    await db.flush()
    result = await db.execute(
        select(UserResponsable).options(selectinload(UserResponsable.niveau)).where(UserResponsable.id == r.id)
    )
    return result.scalar_one()


@router.patch("/responsables/{responsable_id}", response_model=ResponsableRead, summary="Modifier un responsable")
async def update_responsable(
    responsable_id: int,
    data: dict,
    current_user: dict = Depends(has_permission("user:manage_responsable")),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy.orm import selectinload
    r = (await db.execute(select(UserResponsable).where(UserResponsable.id == responsable_id))).scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Responsable introuvable")
    for k in ("nom", "prenom", "email", "niveau_id"):
        if k in data and data[k] is not None:
            if k == "email":
                r.email = data[k].lower()
            else:
                setattr(r, k, data[k])
    if "password" in data and data["password"]:
        r.hashed_password = pwd.hash(data["password"])
    await db.flush()
    result = await db.execute(
        select(UserResponsable).options(selectinload(UserResponsable.niveau)).where(UserResponsable.id == r.id)
    )
    return result.scalar_one()


@router.post("/responsables/{responsable_id}/reactivate", response_model=ResponsableRead, summary="Réactiver un responsable")
async def reactivate_responsable(
    responsable_id: int,
    current_user: dict = Depends(has_permission("user:manage_responsable")),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy.orm import selectinload
    r = (await db.execute(select(UserResponsable).where(UserResponsable.id == responsable_id))).scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Responsable introuvable")
    r.is_active = True
    await db.flush()
    result = await db.execute(
        select(UserResponsable).options(selectinload(UserResponsable.niveau)).where(UserResponsable.id == r.id)
    )
    return result.scalar_one()


@router.delete("/responsables/{responsable_id}", status_code=204, summary="Desactiver un responsable")
async def deactivate_responsable(
    responsable_id: int,
    current_user: dict = Depends(has_permission("user:manage_responsable")),
    db: AsyncSession = Depends(get_db),
):
    r = (await db.execute(select(UserResponsable).where(UserResponsable.id == responsable_id))).scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Responsable introuvable")
    r.is_active = False
    await db.flush()


# ═══════════════════════════════════════════════════════════
#  IMPORT / EXPORT
# ═══════════════════════════════════════════════════════════

@router.get("/import/fields", summary="Catalogue des champs cibles importables")
async def import_fields(current_user: dict = Depends(has_permission("inscription:read_all"))):
    return {"fields": ImportService.get_target_fields()}


@router.post(
    "/import/preview",
    response_model=ImportPreviewResponse,
    summary="Analyse d'un fichier (colonnes + échantillon + suggestion de mapping)",
)
async def import_preview(
    file: UploadFile = File(...),
    current_user: dict = Depends(has_permission("inscription:read_all")),
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
    summary="Import flexible avec mapping personnalisé",
)
async def import_execute(
    file: UploadFile = File(...),
    mapping: str = Query(..., description="JSON {nom_colonne_fichier: clé_champ_cible}"),
    niveau_id: int = Query(..., description="ID du niveau à assigner aux étudiants importés"),
    update_existing: bool = Query(True),
    current_user: dict = Depends(has_permission("note:manage_all")),
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

    # Vérifier le niveau
    niveau = (await db.execute(select(Niveau).where(Niveau.id == niveau_id))).scalar_one_or_none()
    if not niveau:
        raise HTTPException(status_code=404, detail=f"Niveau introuvable (id={niveau_id})")

    content = await file.read()
    return await ImportService.import_with_mapping(
        db, content, file.filename or "import",
        mapping=mapping_dict,
        update_existing=update_existing,
        force_niveau_id=niveau_id,
    )


@router.post(
    "/import/xlsx",
    response_model=ImportResult,
    summary="[Legacy] Import auto-détecté depuis Excel SALIMA",
)
async def import_xlsx(
    file: UploadFile = File(...),
    niveau_id: int = Query(..., description="ID du niveau à assigner aux étudiants importés"),
    update_existing: bool = Query(True),
    current_user: dict = Depends(has_permission("note:manage_all")),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename.lower().endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="Fichier .xlsx, .xls ou .csv requis")

    niveau = (await db.execute(select(Niveau).where(Niveau.id == niveau_id))).scalar_one_or_none()
    if not niveau:
        raise HTTPException(status_code=404, detail=f"Niveau introuvable (id={niveau_id})")

    content = await file.read()
    return await ImportService.import_from_xlsx(
        db, content,
        update_existing=update_existing,
        force_niveau_id=niveau_id,
        filename=file.filename or "import.xlsx",
    )


@router.get("/export/fields", summary="Catalogue des champs exportables + presets")
async def export_fields(
    current_user: dict = Depends(has_permission("inscription:read_all")),
):
    return ExportService.get_catalog()


@router.post("/export/custom", summary="Export flexible (colonnes + libellés personnalisés)")
async def export_custom(
    payload: ExportRequest,
    current_user: dict = Depends(has_permission("inscription:read_all")),
    db: AsyncSession = Depends(get_db),
):
    fmt = (payload.format or "xlsx").lower()
    if fmt not in ("xlsx", "csv"):
        raise HTTPException(status_code=400, detail="format doit être 'xlsx' ou 'csv'")
    try:
        data, mime, ext = await ExportService.export_custom(
            db,
            columns=[c.model_dump() for c in payload.columns],
            fmt=fmt,
            cfil=payload.cfil,
            niveau_id=payload.niveau_id,
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


@router.get("/export/xlsx", summary="Exporter vers Excel SALIMA")
async def export_xlsx(
    cfil: Optional[str] = Query(None),
    inscription_only: bool = Query(True),
    current_user: dict = Depends(has_permission("inscription:read_all")),
    db: AsyncSession = Depends(get_db),
):
    xlsx_bytes = await ExportService.export_to_xlsx(db, cfil=cfil, inscription_only=inscription_only)
    filename = f"etudiants_salima_{inscription_only and 'inscrits' or 'tous'}.xlsx"
    return StreamingResponse(
        iter([xlsx_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ═══════════════════════════════════════════════════════════
#  ETUDIANTS
# ═══════════════════════════════════════════════════════════

@router.get("/etudiants", response_model=PaginatedEtudiants, summary="Liste paginee")
async def list_etudiants(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    cfil: Optional[str] = Query(None),
    sexe: Optional[str] = Query(None),
    statut: Optional[str] = Query(None),
    inscription_complete: Optional[bool] = Query(None),
    niveau_id: Optional[int] = Query(None),
    statut_inscription: Optional[str] = Query(None, description="en_attente | validee | rejetee"),
    current_user: dict = Depends(has_permission("inscription:read_all")),
    db: AsyncSession = Depends(get_db),
):
    return await EtudiantService.list_etudiants(
        db, page=page, size=size, search=search, cfil=cfil, sexe=sexe,
        statut=statut, inscription_complete=inscription_complete,
        niveau_id=niveau_id, statut_inscription=statut_inscription,
    )


@router.get("/etudiants/stats", summary="Compteurs par statut d'inscription (filtrables par niveau)")
async def stats_etudiants(
    niveau_id: Optional[int] = Query(None),
    current_user: dict = Depends(has_permission("inscription:read_all")),
    db: AsyncSession = Depends(get_db),
):
    """
    Renvoie le nombre d'étudiants pour chaque statut d'inscription
    (année universitaire en cours), filtré optionnellement par niveau.
    Sert à alimenter les badges de filtre dans la liste scolarité.
    """
    base_etu = select(func.count(Etudiant.id)).where(Etudiant.is_active == True)
    if niveau_id is not None:
        base_etu = base_etu.where(Etudiant.niveau_id == niveau_id)
    total = (await db.execute(base_etu)).scalar_one()

    counts: dict[str, int] = {}
    for s in ("brouillon", "soumis", "en_attente", "validee", "rejetee"):
        q = (
            select(func.count(Inscription.id))
            .join(Etudiant, Etudiant.id == Inscription.etudiant_id)
            .where(
                Etudiant.is_active == True,
                Inscription.annee_universitaire == ANNEE_EN_COURS,
                Inscription.statut == s,
            )
        )
        if niveau_id is not None:
            q = q.where(Etudiant.niveau_id == niveau_id)
        counts[s] = (await db.execute(q)).scalar_one()

    avec_dossier = sum(counts.values())
    return {
        "total":        total,
        "brouillon":    counts["brouillon"],
        "soumis":       counts["soumis"],
        "en_attente":   counts["en_attente"],
        "validee":      counts["validee"],
        "rejetee":      counts["rejetee"],
        "sans_dossier": max(total - avec_dossier, 0),
    }


@router.get("/etudiants/{etudiant_id}", response_model=EtudiantAdminRead)
async def get_etudiant(
    etudiant_id: int,
    current_user: dict = Depends(has_permission("inscription:read_all")),
    db: AsyncSession = Depends(get_db),
):
    return await EtudiantService.get_by_id(db, etudiant_id)


@router.post("/etudiants", response_model=EtudiantAdminRead, status_code=201)
async def create_etudiant(
    data: EtudiantCreate,
    current_user: dict = Depends(has_permission("note:manage_all")),
    db: AsyncSession = Depends(get_db),
):
    return await EtudiantService.create_etudiant(db, data)


@router.patch("/etudiants/{etudiant_id}", response_model=EtudiantAdminRead)
async def update_etudiant(
    etudiant_id: int,
    data: EtudiantUpdate,
    current_user: dict = Depends(has_permission("note:manage_all")),
    db: AsyncSession = Depends(get_db),
):
    return await EtudiantService.update_etudiant(db, etudiant_id, data)


@router.post("/etudiants/{etudiant_id}/reset-inscription", response_model=EtudiantAdminRead)
async def reset_inscription(
    etudiant_id: int,
    current_user: dict = Depends(has_permission("inscription:approve_all")),
    db: AsyncSession = Depends(get_db),
):
    return await EtudiantService.reset_inscription(db, etudiant_id)


@router.delete("/etudiants/{etudiant_id}", status_code=204)
async def deactivate_etudiant(
    etudiant_id: int,
    current_user: dict = Depends(has_permission("note:manage_all")),
    db: AsyncSession = Depends(get_db),
):
    await EtudiantService.deactivate_etudiant(db, etudiant_id)


# ═══════════════════════════════════════════════════════════
#  INSCRIPTIONS — décision (scolarité : tous niveaux)
# ═══════════════════════════════════════════════════════════
@router.post(
    "/inscriptions/{inscription_id}/decision",
    response_model=EtudiantAdminRead,
    summary="Valider ou rejeter une inscription (scolarité)",
)
async def decide_inscription(
    inscription_id: int,
    body: InscriptionDecision,
    current_user: dict = Depends(has_permission("inscription:approve_all")),
    db: AsyncSession = Depends(get_db),
):
    """
    **Valider** : `{"decision": "valider"}` → inscription validée, email envoyé.

    **Rejeter** : `{"decision": "rejeter", "message_rejet": "..."}` → inscription
    refusée, email avec motif envoyé. L'étudiant peut corriger et resoumettre.

    Contrairement au responsable, la scolarité peut traiter les dossiers de
    **tous les niveaux**.
    """
    return await EtudiantService.decide_inscription(db, inscription_id, body)


# ═══════════════════════════════════════════════════════════
#  PIÈCES JOINTES (lecture pour scolarité)
# ═══════════════════════════════════════════════════════════
@router.get(
    "/pieces-jointes/config",
    summary="Configuration des pieces jointes demandees",
)
async def pieces_jointes_config(
    current_user: dict = Depends(has_permission("note:read_all")),
):
    return load_pieces_jointes_config()


@router.get(
    "/pieces-jointes/{piece_jointe_id}/download",
    summary="Télécharger / visualiser une pièce jointe",
)
async def download_piece(
    piece_jointe_id: int,
    current_user: dict = Depends(has_permission("note:read_all")),
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


@router.post(
    "/pieces-jointes/{piece_jointe_id}/refuser",
    response_model=PieceJointeRead,
    summary="Refuser une piece jointe et notifier l'etudiant",
)
async def reject_piece(
    piece_jointe_id: int,
    body: PieceJointeReject,
    current_user: dict = Depends(has_permission("inscription:approve_all")),
    db: AsyncSession = Depends(get_db),
):
    return await FileService.reject_piece_jointe(db, piece_jointe_id, body.motif_refus)
