"""Espace personnel étudiant — dossier, inscription, email, pièces jointes."""
from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_etudiant, has_permission
from app.db.session import get_db
from app.schemas.schemas import (
    EmailChangeConfirm, EmailChangeRequest,
    EtudiantPublicRead, EtudiantSelfComplete,
    EtudiantSubmitInscription, PieceJointeRead,
)
from app.services.auth_service import AuthService
from app.services.etudiant_service import EtudiantService
from app.services.file_service import FileService, build_content_disposition

router = APIRouter(prefix="/etudiant", tags=["Etudiant — Espace personnel"])


# ── Dossier ────────────────────────────────────────────────────────────────────
@router.get("/me", response_model=EtudiantPublicRead, summary="Mon dossier complet")
async def get_my_profile(
    current_user: dict = Depends(has_permission("etudiant:read_own")),
    db: AsyncSession = Depends(get_db),
):
    return await EtudiantService.get_by_mat_cin(db, current_user["id"])


@router.patch("/me", response_model=EtudiantPublicRead, summary="Mettre à jour mes coordonnées")
async def update_my_profile(
    data: EtudiantSelfComplete,
    current_user: dict = Depends(has_permission("etudiant:update_own")),
    db: AsyncSession = Depends(get_db),
):
    return await EtudiantService.self_complete(db, current_user["id"], data)


# ── Changement d'email (vérification obligatoire) ─────────────────────────────
@router.post(
    "/me/email/request-change",
    status_code=200,
    summary="Demander un changement d'email — envoie OTP au nouvel email",
)
async def request_email_change(
    body: EmailChangeRequest,
    current_user: dict = Depends(has_permission("etudiant:update_own")),
    db: AsyncSession = Depends(get_db),
):
    """
    Envoie un OTP au **nouvel** email pour vérifier qu'il est valide.
    L'email actuel reste inchangé jusqu'à confirmation.
    """
    await AuthService.request_email_change(db, current_user["id"], body.nouvel_email)
    return {
        "message": f"Code de vérification envoyé à {body.nouvel_email}",
        "require_otp": True,
    }


@router.post(
    "/me/email/confirm-change",
    response_model=EtudiantPublicRead,
    summary="Confirmer le changement d'email avec le code OTP",
)
async def confirm_email_change(
    body: EmailChangeConfirm,
    current_user: dict = Depends(has_permission("etudiant:update_own")),
    db: AsyncSession = Depends(get_db),
):
    """
    Vérifie le code OTP reçu au nouvel email.
    Si correct → met à jour l'email en base de données.
    L'email est ensuite verrouillé à cette nouvelle valeur.
    """
    etudiant = await AuthService.confirm_email_change(
        db, current_user["id"], body.nouvel_email, body.code
    )
    return await EtudiantService.get_by_id(db, etudiant.id)


@router.post(
    "/me/inscription/preparer",
    response_model=EtudiantPublicRead,
    summary="Préparer mon inscription (crée le dossier pour pouvoir joindre des pièces avant soumission)",
)
async def prepare_inscription(
    current_user: dict = Depends(has_permission("inscription:create_own")),
    db: AsyncSession = Depends(get_db),
):
    """
    Crée ou récupère l'inscription de l'année en cours.
    Permet d'uploader des pièces jointes AVANT la soumission formelle du dossier.
    """
    return await EtudiantService.prepare_inscription(db, current_user["id"])


# ── Inscription ────────────────────────────────────────────────────────────────
@router.post(
    "/me/inscription",
    response_model=EtudiantPublicRead,
    summary="Soumettre mon inscription",
)
async def submit_inscription(
    data: EtudiantSubmitInscription,
    current_user: dict = Depends(has_permission("inscription:update_own")),
    db: AsyncSession = Depends(get_db),
):
    return await EtudiantService.submit_inscription(db, current_user["id"], data)


# ── Pièces jointes ─────────────────────────────────────────────────────────────
@router.post(
    "/me/inscriptions/{inscription_id}/pieces-jointes",
    response_model=PieceJointeRead,
    summary="Joindre une pièce jointe (photo / CIN / autre)",
)
async def upload_piece_jointe(
    inscription_id: int,
    file: UploadFile = File(...),
    type_document: str = Form("autre"),
    current_user: dict = Depends(has_permission("piece_jointe:create_own")),
    db: AsyncSession = Depends(get_db),
):
    """
    Téléverse une pièce jointe à une inscription.

    `type_document` ∈ {`photo`, `cin`, `autre`} :
      - `photo` : photo d'identité (image, max 5 MB) — un seul slot
      - `cin`   : carte d'identité (image, max 5 MB) — un seul slot, vérifiée par OCR
      - `autre` : autre document (PDF, max 10 MB) — illimité
    """
    etudiant = await EtudiantService.get_by_mat_cin(db, current_user["id"])
    return await FileService.upload_piece_jointe(
        db, inscription_id, etudiant.id, file, type_document=type_document,
    )


@router.delete(
    "/me/pieces-jointes/{piece_jointe_id}",
    status_code=204,
    summary="Supprimer une pièce jointe",
)
async def delete_piece_jointe(
    piece_jointe_id: int,
    current_user: dict = Depends(has_permission("piece_jointe:create_own")),
    db: AsyncSession = Depends(get_db),
):
    etudiant = await EtudiantService.get_by_mat_cin(db, current_user["id"])
    await FileService.delete_piece_jointe(db, piece_jointe_id, etudiant.id)


@router.get(
    "/me/pieces-jointes/{piece_jointe_id}/download",
    summary="Télécharger une pièce jointe",
)
async def download_piece_jointe(
    piece_jointe_id: int,
    current_user: dict = Depends(has_permission("piece_jointe:read_own")),
    db: AsyncSession = Depends(get_db),
):
    etudiant = await EtudiantService.get_by_mat_cin(db, current_user["id"])
    pj, content = await FileService.get_piece_jointe(db, piece_jointe_id, etudiant.id)
    media_type = pj.mime_type or "application/octet-stream"
    # Images affichables inline, PDF en attachment
    disposition = "inline" if media_type.startswith("image/") else "attachment"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": build_content_disposition(disposition, pj.nom_fichier)},
    )
