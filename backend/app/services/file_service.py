"""
Service de gestion des pièces jointes (photos d'identité, CIN, autres PDF).

Trois types pris en charge :
  - `photo` : image (jpg/png/webp), max 5 MB — UN seul slot par inscription
  - `cin`   : image (jpg/png/webp), max 5 MB — UN seul slot par inscription, vérifié OCR
  - `autre` : PDF, max 10 MB — illimité

Stockage local dans uploads/pieces_jointes/
"""
import os
import uuid
from pathlib import Path
from urllib.parse import quote

from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Inscription, PieceJointe, Etudiant
from app.services.ocr_service import verify_cin_image
from app.services.face_service import verify_photo_face

UPLOAD_DIR = Path("uploads/pieces_jointes")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_PDF_SIZE   = 10 * 1024 * 1024   # 10 MB
MAX_IMAGE_SIZE =  5 * 1024 * 1024   # 5 MB

ALLOWED_TYPES = {"photo", "cin", "autre"}
SINGLE_SLOT_TYPES = {"photo", "cin"}      # un seul exemplaire par inscription

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
IMAGE_MIMES = {
    "image/jpeg":  ".jpg",
    "image/jpg":   ".jpg",
    "image/png":   ".png",
    "image/webp":  ".webp",
}
PDF_EXTENSIONS = {".pdf"}
PDF_MIMES = {"application/pdf", "application/x-pdf"}


def _ext(name: str) -> str:
    return os.path.splitext(name or "")[1].lower()


def build_content_disposition(disposition: str, filename: str | None) -> str:
    """
    Construit un en-tête Content-Disposition compatible latin-1 (HTTP/1.1) tout
    en supportant les noms de fichier Unicode (arabe, accents…) via RFC 5987.
    """
    name = filename or "fichier"
    ascii_fallback = name.encode("ascii", "ignore").decode("ascii") or "fichier"
    quoted = quote(name, safe="")
    return f'{disposition}; filename="{ascii_fallback}"; filename*=UTF-8\'\'{quoted}'


class FileService:

    @staticmethod
    async def upload_piece_jointe(
        db: AsyncSession,
        inscription_id: int,
        etudiant_id: int,
        file: UploadFile,
        type_document: str = "autre",
    ) -> PieceJointe:
        # ── Validation du type de pièce ───────────────────────────────────────
        type_document = (type_document or "autre").lower().strip()
        if type_document not in ALLOWED_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Type de pièce inconnu. Valeurs acceptées : {', '.join(sorted(ALLOWED_TYPES))}.",
            )

        # ── Vérifier que l'inscription appartient à l'étudiant ────────────────
        result = await db.execute(
            select(Inscription).where(
                Inscription.id == inscription_id,
                Inscription.etudiant_id == etudiant_id,
            )
        )
        inscription = result.scalar_one_or_none()
        if not inscription:
            raise HTTPException(status_code=404, detail="Inscription introuvable")
        if inscription.statut == "validee":
            raise HTTPException(status_code=409, detail="Impossible de modifier une inscription validee")

        # ── Validation extension / taille selon le type ───────────────────────
        ext = _ext(file.filename or "")
        if type_document in {"photo", "cin"}:
            if ext not in IMAGE_EXTENSIONS:
                raise HTTPException(
                    status_code=400,
                    detail="Format invalide : pour ce type, seules les images JPG, JPEG, PNG ou WEBP sont acceptées.",
                )
            max_size = MAX_IMAGE_SIZE
            mime_default = "image/jpeg"
        else:  # autre → PDF
            if ext not in PDF_EXTENSIONS:
                raise HTTPException(
                    status_code=400,
                    detail="Format invalide : seuls les fichiers PDF sont acceptés pour les autres documents.",
                )
            max_size = MAX_PDF_SIZE
            mime_default = "application/pdf"

        # ── Lire le contenu (vérification taille) ─────────────────────────────
        content = await file.read()
        if len(content) > max_size:
            mb = max_size // (1024 * 1024)
            raise HTTPException(status_code=413, detail=f"Fichier trop volumineux (max {mb} MB)")
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Fichier vide")

        # ── OCR sur la CIN : vérification de cohérence ────────────────────────
        ocr_verified = False
        ocr_message: str | None = None
        if type_document == "cin":
            etu_res = await db.execute(select(Etudiant).where(Etudiant.id == etudiant_id))
            etu = etu_res.scalar_one_or_none()
            if etu:
                ocr = verify_cin_image(
                    image_bytes=content,
                    expected_cin=etu.mat_cin or "",
                    expected_nom=etu.nom_fr or "",
                    expected_prenom=etu.prenom_fr or "",
                    expected_nom_ar=etu.nom_ar or "",
                    expected_prenom_ar=etu.prenom_ar or "",
                )
                ocr_verified = ocr.verified
                ocr_message  = ocr.message

                # Politique stricte : le CIN DOIT matcher ET (nom OU prénom) DOIT
                # matcher. Toute autre combinaison → rejet ferme (HTTP 422). Si
                # l'OCR est indispo, on laisse passer pour vérification manuelle.
                if ocr.available and not ocr.verified:
                    raise HTTPException(
                        status_code=422,
                        detail=ocr.message,
                    )

        # ── Détection de visage sur la photo d'identité ───────────────────────
        if type_document == "photo":
            face = verify_photo_face(content)
            ocr_verified = face.verified
            ocr_message  = face.message

            # Politique stricte : on n'accepte QUE les photos contenant
            # exactement UN visage humain clair (net, de face). Toute autre
            # situation (aucun visage, plusieurs visages, image floue) est
            # rejetée. Si la détection est indisponible, on laisse passer
            # pour vérification manuelle.
            if face.available and not face.verified:
                raise HTTPException(
                    status_code=422,
                    detail=face.message,
                )

        # ── Si type à slot unique : remplacer l'ancien fichier ────────────────
        if type_document in SINGLE_SLOT_TYPES:
            old_res = await db.execute(
                select(PieceJointe).where(
                    PieceJointe.inscription_id == inscription_id,
                    PieceJointe.type_document == type_document,
                )
            )
            for old in old_res.scalars().all():
                try:
                    if os.path.exists(old.chemin):
                        os.remove(old.chemin)
                except OSError:
                    pass
                await db.delete(old)
            await db.flush()

        # ── Sauvegarder sur disque ───────────────────────────────────────────
        unique_name = f"{inscription_id}_{type_document}_{uuid.uuid4().hex[:8]}_{file.filename}"
        file_path = UPLOAD_DIR / unique_name
        with open(file_path, "wb") as f:
            f.write(content)

        pj = PieceJointe(
            inscription_id=inscription_id,
            type_document=type_document,
            mime_type=file.content_type or mime_default,
            nom_fichier=file.filename,
            chemin=str(file_path),
            taille_octets=len(content),
            ocr_verified=ocr_verified,
            ocr_message=ocr_message,
        )
        db.add(pj)
        await db.flush()
        await db.refresh(pj)
        return pj

    @staticmethod
    async def delete_piece_jointe(
        db: AsyncSession,
        piece_jointe_id: int,
        etudiant_id: int,
    ) -> None:
        result = await db.execute(
            select(PieceJointe)
            .join(Inscription)
            .where(
                PieceJointe.id == piece_jointe_id,
                Inscription.etudiant_id == etudiant_id,
            )
        )
        pj = result.scalar_one_or_none()
        if not pj:
            raise HTTPException(status_code=404, detail="Piece jointe introuvable")

        try:
            if os.path.exists(pj.chemin):
                os.remove(pj.chemin)
        except OSError:
            pass

        await db.delete(pj)
        await db.flush()

    @staticmethod
    async def get_piece_jointe(
        db: AsyncSession,
        piece_jointe_id: int,
        requester_etudiant_id: int | None = None,
    ) -> tuple[PieceJointe, bytes]:
        """Retourne la pièce jointe et son contenu binaire."""
        query = select(PieceJointe).join(Inscription).where(PieceJointe.id == piece_jointe_id)
        if requester_etudiant_id is not None:
            query = query.where(Inscription.etudiant_id == requester_etudiant_id)

        result = await db.execute(query)
        pj = result.scalar_one_or_none()
        if not pj:
            raise HTTPException(status_code=404, detail="Piece jointe introuvable")

        if not os.path.exists(pj.chemin):
            raise HTTPException(status_code=404, detail="Fichier introuvable sur le serveur")

        with open(pj.chemin, "rb") as f:
            content = f.read()

        return pj, content
