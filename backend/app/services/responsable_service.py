"""Service pour les responsables de niveau — v3."""
import asyncio
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.models import Etudiant, Inscription, PieceJointe, UserResponsable
from app.schemas.schemas import InscriptionDecision
from app.services.email_service import EmailService
from app.services.etudiant_service import EDITABLE_FIELDS, build_rejection_message_with_pieces


def _etudiant_opts():
    return [
        selectinload(Etudiant.inscriptions).selectinload(Inscription.pieces_jointes),
        selectinload(Etudiant.niveau),
    ]


class ResponsableService:

    @staticmethod
    async def get_profile(db: AsyncSession, email: str) -> dict:
        result = await db.execute(
            select(UserResponsable).options(selectinload(UserResponsable.niveau))
            .where(UserResponsable.email == str(email).lower())
        )
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="Responsable introuvable")
        return {
            "id": user.id, "email": user.email,
            "nom": user.nom, "prenom": user.prenom,
            "niveau_id": user.niveau_id,
            "niveau": {
                "id": user.niveau.id, "code": user.niveau.code,
                "libelle": user.niveau.libelle, "libelle_ar": user.niveau.libelle_ar,
            } if user.niveau else None,
        }

    @staticmethod
    async def get_etudiant_du_niveau(db: AsyncSession, etudiant_id: int, niveau_id: int) -> Etudiant:
        result = await db.execute(
            select(Etudiant).options(*_etudiant_opts())
            .where(Etudiant.id == etudiant_id, Etudiant.niveau_id == niveau_id)
        )
        e = result.scalar_one_or_none()
        if not e:
            raise HTTPException(status_code=404, detail="Etudiant introuvable ou hors de votre niveau")
        return e

    @staticmethod
    async def decide_inscription(
        db: AsyncSession,
        inscription_id: int,
        body: InscriptionDecision,
        responsable_email: str,
        niveau_id: int,
    ) -> Etudiant:
        # Charger inscription + etudiant
        result = await db.execute(
            select(Inscription)
            .options(
                selectinload(Inscription.etudiant).options(*_etudiant_opts()),
                selectinload(Inscription.pieces_jointes),
            )
            .where(Inscription.id == inscription_id)
        )
        insc = result.scalar_one_or_none()
        if not insc:
            raise HTTPException(status_code=404, detail="Inscription introuvable")
        if insc.niveau_id != niveau_id:
            raise HTTPException(status_code=403, detail="Cette inscription n'appartient pas a votre niveau")
        if insc.statut not in ("soumis", "en_attente"):
            raise HTTPException(status_code=409, detail=f"Inscription deja traitee (statut: {insc.statut})")

        # Charger le responsable
        resp = (await db.execute(
            select(UserResponsable).where(UserResponsable.email == responsable_email.lower())
        )).scalar_one_or_none()

        now = datetime.now(timezone.utc)
        e = insc.etudiant

        if body.decision == "valider":
            # Appliquer les modifications proposées par l'étudiant sur Etudiant
            # (c'est uniquement à ce moment que les changements deviennent officiels).
            for k, v in (insc.proposed_data or {}).items():
                if k in EDITABLE_FIELDS and hasattr(e, k):
                    setattr(e, k, v)
            insc.proposed_data = {}

            insc.statut        = "validee"
            insc.message_rejet = None
            insc.traite_par_id = resp.id if resp else None
            insc.traite_le     = now
            e.is_inscription_complete = True
            e.completed_at = now

            if e.email:
                asyncio.create_task(asyncio.to_thread(
                    EmailService.send_validation_notification,
                    e.email, f"{e.prenom_fr} {e.nom_fr}", insc.annee_universitaire,
                ))

        else:  # rejeter
            if not body.message_rejet or not body.message_rejet.strip():
                raise HTTPException(status_code=422, detail="Un message de rejet est obligatoire")
            full_message = build_rejection_message_with_pieces(insc, body.message_rejet)
            insc.statut        = "rejetee"
            insc.message_rejet = full_message
            insc.traite_par_id = resp.id if resp else None
            insc.traite_le     = now
            e.is_inscription_complete = False

            if e.email:
                asyncio.create_task(asyncio.to_thread(
                    EmailService.send_rejection_notification,
                    e.email, f"{e.prenom_fr} {e.nom_fr}",
                    full_message, insc.annee_universitaire,
                ))

        await db.flush()
        return await db.get(Etudiant, e.id)
