import math
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

import asyncio

from app.models.models import Etudiant, Inscription, PieceJointe, Role, UserRole
from app.core.pieces_jointes_config import get_piece_definition, get_required_piece_types
from app.schemas.schemas import (
    EtudiantCreate, EtudiantSelfComplete,
    EtudiantSubmitInscription, EtudiantUpdate, InscriptionDecision,
    PaginatedEtudiants,
)
from app.services.email_service import EmailService

ANNEE_EN_COURS = "2025/2026"

# Champs que l'étudiant peut modifier mais qui restent en attente de validation
# par le responsable. Tant que la décision n'est pas prise, les modifications
# sont stockées dans Inscription.proposed_data et NON propagées vers Etudiant.*.
# La fusion proposed_data → Etudiant n'a lieu qu'à la validation.
EDITABLE_FIELDS = frozenset({
    "nom_fr", "prenom_fr", "nom_ar", "prenom_ar",
    "date_naissance", "lieu_naiss_fr", "lieu_naiss_ar",
    "sexe", "situation_familiale",
    "code_gouvernorat", "code_type_bac",
    "bac_annee", "bac_session", "bac_moyenne", "bac_mention", "bac_section",
    "num_cnss", "passeport",
    "telephone_portable", "telephone_fixe",
    "adresse_fr", "adresse_ar",
    "contact_nom", "contact_prenom", "contact_affiliation",
    "contact_adresse", "contact_tel",
})


def _compute_proposed(e: Etudiant, current_proposed: dict | None, payload: dict) -> dict:
    """Fusionne le payload de l'étudiant dans le dict des modifications proposées.

    Règles :
      - Seuls les champs présents dans `EDITABLE_FIELDS` sont pris en compte.
      - Si la valeur du champ est identique à celle déjà présente sur Etudiant,
        on n'enregistre PAS la modification (pas de faux "MODIFIÉ").
      - Sinon, on l'enregistre dans proposed_data.
      - Les champs vides (None / "") sont ignorés.
    """
    out = dict(current_proposed or {})
    for k, v in payload.items():
        if k not in EDITABLE_FIELDS:
            continue
        if v is None or v == "":
            continue
        if getattr(e, k, None) == v:
            # Identique à Etudiant → pas une modification proposée
            out.pop(k, None)
        else:
            out[k] = v
    return out


def _load_opts():
    return [
        selectinload(Etudiant.inscriptions).selectinload(Inscription.pieces_jointes),
        selectinload(Etudiant.niveau),
    ]


def _piece_slot_label(piece: PieceJointe) -> str:
    try:
        return get_piece_definition(piece.type_document).get("label") or piece.type_document
    except Exception:
        return piece.type_document or "Piece jointe"


def build_rejection_message_with_pieces(insc: Inscription, message_rejet: str) -> str:
    parts = [message_rejet.strip()]
    refused_pieces = [
        p for p in (insc.pieces_jointes or [])
        if p.statut == "refusee" and p.motif_refus
    ]
    if refused_pieces:
        details = "\n".join(
            f"- {_piece_slot_label(p)}: {p.motif_refus.strip()}"
            for p in refused_pieces
        )
        parts.append(f"Pieces jointes refusees:\n{details}")
    return "\n\n".join(parts)


class EtudiantService:

    @staticmethod
    async def get_by_mat_cin(db: AsyncSession, mat_cin: str) -> Etudiant:
        result = await db.execute(
            select(Etudiant).options(*_load_opts())
            .where(Etudiant.mat_cin == mat_cin.upper(), Etudiant.is_active == True)
        )
        e = result.scalar_one_or_none()
        if not e:
            raise HTTPException(status_code=404, detail="Etudiant introuvable")
        return e

    @staticmethod
    async def get_by_id(db: AsyncSession, etudiant_id: int) -> Etudiant:
        result = await db.execute(
            select(Etudiant).options(*_load_opts()).where(Etudiant.id == etudiant_id)
        )
        e = result.scalar_one_or_none()
        if not e:
            raise HTTPException(status_code=404, detail="Etudiant introuvable")
        return e

    @staticmethod
    async def list_etudiants(
        db: AsyncSession,
        page: int = 1,
        size: int = 20,
        search: Optional[str] = None,
        cfil: Optional[str] = None,
        sexe: Optional[str] = None,
        statut: Optional[str] = None,
        inscription_complete: Optional[bool] = None,
        niveau_id: Optional[int] = None,
        statut_inscription: Optional[str] = None,
    ) -> PaginatedEtudiants:
        query = select(Etudiant).options(selectinload(Etudiant.niveau))
        if search:
            t = f"%{search}%"
            query = query.where(or_(
                Etudiant.nom_fr.ilike(t), Etudiant.prenom_fr.ilike(t),
                Etudiant.nom_ar.ilike(t), Etudiant.mat_cin.ilike(t),
                Etudiant.num_inscription.ilike(t), Etudiant.email.ilike(t),
            ))
        if cfil:
            query = query.where(Etudiant.cfil.ilike(f"%{cfil}%"))
        if sexe:
            query = query.where(Etudiant.sexe == sexe.upper())
        if statut:
            query = query.where(Etudiant.statut == statut)
        if inscription_complete is not None:
            query = query.where(Etudiant.is_inscription_complete == inscription_complete)
        if niveau_id is not None:
            query = query.where(Etudiant.niveau_id == niveau_id)
        if statut_inscription:
            if statut_inscription == "sans_dossier":
                # Étudiants sans dossier soumis : aucune ligne, OU uniquement un brouillon
                # (le brouillon n'est pas considéré comme une soumission).
                sub_soumises = select(Inscription.etudiant_id).where(
                    Inscription.annee_universitaire == ANNEE_EN_COURS,
                    Inscription.statut != "brouillon",
                )
                query = query.where(~Etudiant.id.in_(sub_soumises))
            else:
                query = query.join(
                    Inscription,
                    (Inscription.etudiant_id == Etudiant.id) &
                    (Inscription.statut == statut_inscription) &
                    (Inscription.annee_universitaire == ANNEE_EN_COURS)
                )

        total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
        offset = (page - 1) * size
        rows = (await db.execute(query.order_by(Etudiant.nom_fr).offset(offset).limit(size))).scalars().all()

        # Enrichir chaque item avec le statut_inscription actif
        items = []
        for e in rows:
            # Chercher l'inscription de l'année en cours
            insc_r = await db.execute(
                select(Inscription).where(
                    Inscription.etudiant_id == e.id,
                    Inscription.annee_universitaire == ANNEE_EN_COURS,
                )
            )
            insc = insc_r.scalar_one_or_none()
            item = {
                "id": e.id, "mat_cin": e.mat_cin, "num_inscription": e.num_inscription,
                "nom_fr": e.nom_fr, "prenom_fr": e.prenom_fr, "nom_ar": e.nom_ar, "prenom_ar": e.prenom_ar,
                "sexe": e.sexe, "cfil": e.cfil, "lib_filiere": e.lib_filiere,
                "statut": e.statut, "email": e.email, "email_verified": e.email_verified,
                "telephone_portable": e.telephone_portable, "is_inscription_complete": e.is_inscription_complete,
                "is_active": e.is_active, "niveau_id": e.niveau_id, "niveau": e.niveau,
                "statut_inscription": insc.statut if insc else None,
                "message_rejet": insc.message_rejet if insc else None,
            }
            items.append(item)

        return PaginatedEtudiants(
            total=total, page=page, size=size,
            pages=math.ceil(total / size) if total else 1,
            items=items,
        )

    @staticmethod
    async def create_etudiant(db: AsyncSession, data: EtudiantCreate) -> Etudiant:
        if (await db.execute(select(Etudiant).where(Etudiant.mat_cin == data.mat_cin.upper()))).scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f"CIN {data.mat_cin} existe deja")
        e = Etudiant(**data.model_dump(), hashed_password="NO_PASSWORD")
        db.add(e)
        await db.flush()
        
        # Assigner automatiquement le rôle étudiant
        role_result = await db.execute(select(Role).where(Role.name == "etudiant"))
        role = role_result.scalar_one_or_none()
        if role:
            user_role = UserRole(user_type="etudiant", user_id=e.id, role_id=role.id)
            db.add(user_role)
            await db.flush()
        
        return await EtudiantService.get_by_id(db, e.id)

    @staticmethod
    async def update_etudiant(db: AsyncSession, etudiant_id: int, data: EtudiantUpdate) -> Etudiant:
        e = await EtudiantService.get_by_id(db, etudiant_id)
        for k, v in data.model_dump(exclude_none=True).items():
            setattr(e, k, v)
        await db.flush()
        return await EtudiantService.get_by_id(db, e.id)

    @staticmethod
    async def self_complete(db: AsyncSession, mat_cin: str, data: EtudiantSelfComplete) -> Etudiant:
        """
        Édition par l'étudiant de son propre dossier.

        Les modifications ne sont PAS appliquées immédiatement sur Etudiant.* :
        elles sont stockées dans `inscriptions.proposed_data` et attendent la
        validation du responsable. Cela permet à l'admin de réinitialiser ou au
        responsable de rejeter sans que les vraies données de l'étudiant aient
        été altérées.
        """
        e = await EtudiantService.get_by_mat_cin(db, mat_cin)
        if not e.email_verified:
            # On garde la possibilité d'enregistrer en local-only avant vérif email,
            # mais sans inscription tant que pas vérifié on ne peut rien proposer.
            return await EtudiantService.get_by_id(db, e.id)

        # Récupérer (ou créer) l'inscription brouillon pour l'année en cours
        insc = (await db.execute(
            select(Inscription).options(selectinload(Inscription.pieces_jointes)).where(
                Inscription.etudiant_id == e.id,
                Inscription.annee_universitaire == ANNEE_EN_COURS,
            )
        )).scalar_one_or_none()
        if not insc:
            insc = Inscription(
                etudiant_id=e.id, annee_universitaire=ANNEE_EN_COURS,
                cfil=e.cfil, lib_filiere=e.lib_filiere,
                lib_filiere_ar=e.lib_filiere_ar, niveau_id=e.niveau_id,
                statut="brouillon",
                proposed_data={},
            )
            db.add(insc)
            await db.flush()

        # Inscription validée, soumise ou en attente : pas d'édition possible
        if insc.statut in ("validee", "soumis", "en_attente"):
            raise HTTPException(
                status_code=409,
                detail=f"Inscription non éditable (statut: {insc.statut})",
            )

        # Fusionner la nouvelle proposition dans proposed_data
        payload = data.model_dump(exclude_none=True)
        insc.proposed_data = _compute_proposed(e, insc.proposed_data, payload)

        await db.flush()
        await db.refresh(e, attribute_names=["inscriptions"])
        return await EtudiantService.get_by_id(db, e.id)

    @staticmethod
    async def prepare_inscription(db: AsyncSession, mat_cin: str) -> Etudiant:
        """
        Crée l'inscription brouillon de l'année en cours si elle n'existe pas,
        pour permettre l'upload de pièces jointes AVANT la soumission formelle.
        """
        e = await EtudiantService.get_by_mat_cin(db, mat_cin)
        if not e.email_verified:
            raise HTTPException(status_code=400, detail="Verifiez votre email avant de préparer l'inscription")

        insc = (await db.execute(
            select(Inscription).options(selectinload(Inscription.pieces_jointes)).where(
                Inscription.etudiant_id == e.id,
                Inscription.annee_universitaire == ANNEE_EN_COURS,
            )
        )).scalar_one_or_none()

        if insc and insc.statut == "validee":
            raise HTTPException(status_code=409, detail="Inscription déjà validée")

        if not insc:
            db.add(Inscription(
                etudiant_id=e.id, annee_universitaire=ANNEE_EN_COURS,
                cfil=e.cfil, lib_filiere=e.lib_filiere,
                lib_filiere_ar=e.lib_filiere_ar, niveau_id=e.niveau_id,
                statut="brouillon",
                proposed_data={},
            ))
            await db.flush()
            await db.refresh(e, attribute_names=["inscriptions"])

        return await EtudiantService.get_by_id(db, e.id)

    @staticmethod
    async def submit_inscription(db: AsyncSession, mat_cin: str, data: EtudiantSubmitInscription) -> Etudiant:
        """
        Soumission du dossier par l'étudiant.

        Les modifications proposées sont consolidées dans `proposed_data`
        (fusion du dernier état du formulaire) ; le statut passe à `en_attente`.
        Les données de l'Etudiant ne sont PAS modifiées : la fusion vers
        Etudiant.* aura lieu uniquement lorsque le responsable validera.
        """
        e = await EtudiantService.get_by_mat_cin(db, mat_cin)
        if not e.email_verified:
            raise HTTPException(status_code=400, detail="Verifiez votre email avant de soumettre l'inscription")
        if not data.reglement_interne_accepte:
            raise HTTPException(
                status_code=422,
                detail="Vous devez lire et accepter le reglement interne avant de soumettre l'inscription",
            )

        insc = (await db.execute(
            select(Inscription).options(selectinload(Inscription.pieces_jointes)).where(
                Inscription.etudiant_id == e.id,
                Inscription.annee_universitaire == ANNEE_EN_COURS,
            )
        )).scalar_one_or_none()

        if insc and insc.statut == "validee":
            raise HTTPException(status_code=409, detail="Inscription deja validee")
        if insc and insc.statut in ("soumis", "en_attente"):
            raise HTTPException(status_code=409, detail="Inscription déjà soumise (en attente de décision)")

        required_piece_types = set(get_required_piece_types())
        provided_piece_types = {
            p.type_document
            for p in (insc.pieces_jointes if insc else [])
            if p.statut != "refusee"
        }
        missing_piece_types = sorted(required_piece_types - provided_piece_types)
        if missing_piece_types:
            raise HTTPException(
                status_code=422,
                detail=f"Pieces jointes obligatoires manquantes : {', '.join(missing_piece_types)}",
            )

        payload = data.model_dump(exclude_none=True)
        new_proposed = _compute_proposed(e, insc.proposed_data if insc else None, payload)

        # Choix du statut :
        #   - 1ère soumission (pas d'inscription, ou brouillon)    → 'soumis'
        #   - re-soumission après rejet                            → 'en_attente'
        new_statut = "en_attente" if (insc and insc.statut == "rejetee") else "soumis"

        if insc:
            insc.statut = new_statut
            insc.message_rejet = None
            insc.traite_par_id = None
            insc.traite_le = None
            insc.proposed_data = new_proposed
        else:
            db.add(Inscription(
                etudiant_id=e.id, annee_universitaire=ANNEE_EN_COURS,
                cfil=e.cfil, lib_filiere=e.lib_filiere,
                lib_filiere_ar=e.lib_filiere_ar, niveau_id=e.niveau_id,
                statut=new_statut,
                proposed_data=new_proposed,
            ))

        e.is_inscription_complete = False
        e.completed_at = datetime.now(timezone.utc)
        await db.flush()
        return await EtudiantService.get_by_id(db, e.id)

    @staticmethod
    async def reset_inscription(db: AsyncSession, etudiant_id: int) -> Etudiant:
        """
        Réinitialise complètement l'inscription de l'étudiant pour l'année en cours :
          - SUPPRIME l'enregistrement Inscription (et ses pièces jointes via cascade)
          - efface les fichiers PJ du disque
          - libère le verrou (is_inscription_complete = False, completed_at = None)
          - envoie un email à l'étudiant pour l'avertir

        Après ce reset, l'étudiant est considéré comme un nouveau étudiant
        SANS DOSSIER pour cette année — il pourra reprendre un cycle d'inscription
        complet depuis le début (snap/orig réinitialisés à la prochaine soumission).
        """
        import os
        e = await EtudiantService.get_by_id(db, etudiant_id)

        # 1. Récupérer l'inscription active avec ses pièces jointes
        insc = (await db.execute(
            select(Inscription)
            .where(
                Inscription.etudiant_id == e.id,
                Inscription.annee_universitaire == ANNEE_EN_COURS,
            )
            .options(selectinload(Inscription.pieces_jointes))
        )).scalar_one_or_none()

        # 2. Supprimer les fichiers physiques + la ligne Inscription
        if insc:
            for pj in insc.pieces_jointes:
                try:
                    if pj.chemin and os.path.exists(pj.chemin):
                        os.remove(pj.chemin)
                except OSError:
                    pass
            await db.delete(insc)  # cascade → pieces_jointes (DB)

        # 3. Réinitialiser l'étudiant à l'état "sans dossier"
        e.is_inscription_complete = False
        e.completed_at = None
        await db.flush()

        # 4. Notifier l'étudiant
        if e.email:
            asyncio.create_task(asyncio.to_thread(
                EmailService.send_reset_notification,
                e.email, f"{e.prenom_fr} {e.nom_fr}", ANNEE_EN_COURS,
            ))

        return await EtudiantService.get_by_id(db, e.id)

    @staticmethod
    async def decide_inscription(
        db: AsyncSession,
        inscription_id: int,
        body: InscriptionDecision,
    ) -> Etudiant:
        """Valide ou rejette une inscription (accès scolarité : tous niveaux)."""
        result = await db.execute(
            select(Inscription)
            .options(
                selectinload(Inscription.etudiant).options(*_load_opts()),
                selectinload(Inscription.pieces_jointes),
            )
            .where(Inscription.id == inscription_id)
        )
        insc = result.scalar_one_or_none()
        if not insc:
            raise HTTPException(status_code=404, detail="Inscription introuvable")
        if insc.statut not in ("soumis", "en_attente"):
            raise HTTPException(
                status_code=409,
                detail=f"Inscription deja traitee (statut: {insc.statut})",
            )

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
            insc.traite_par_id = None  # scolarité (pas de responsable)
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
            insc.traite_par_id = None
            insc.traite_le     = now
            e.is_inscription_complete = False

            if e.email:
                asyncio.create_task(asyncio.to_thread(
                    EmailService.send_rejection_notification,
                    e.email, f"{e.prenom_fr} {e.nom_fr}",
                    full_message, insc.annee_universitaire,
                ))

        await db.flush()
        return await EtudiantService.get_by_id(db, e.id)

    @staticmethod
    async def deactivate_etudiant(db: AsyncSession, etudiant_id: int) -> None:
        e = await EtudiantService.get_by_id(db, etudiant_id)
        e.is_active = False
        await db.flush()
