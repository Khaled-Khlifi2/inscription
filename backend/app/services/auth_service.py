"""
Service d'authentification — v4

Flux étudiant LOGIN :
  1. POST /auth/etudiant/login  (CIN + email)
     Cas A — email déjà vérifié ET correspond au CIN :
               → connexion directe, PAS d'OTP, retourne JWT immédiatement
               → { require_otp: false, token: {...} }
     Cas B — email différent d'un email déjà vérifié :
               → refus : "compte lié à une autre adresse"
     Cas C — aucun email enregistré (première connexion) :
               → envoi OTP
               → { require_otp: true }

  2. POST /auth/etudiant/verify-otp  (CIN + email + code)
     → Vérifie OTP → enregistre email en base → retourne JWT
     → { token, is_first_login: true }  (toujours true ici car c'est la 1re vérif)

Flux étudiant CHANGEMENT EMAIL (dans le formulaire d'inscription) :
  3. POST /etudiant/me/email/request-change  (nouvel_email)
     → Envoie OTP au nouvel email
  4. POST /etudiant/me/email/confirm-change  (code)
     → Vérifie OTP → met à jour l'email en base → retourne profil mis à jour
"""
from datetime import datetime, timezone

from fastapi import HTTPException, status
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token
from app.models.models import Etudiant, UserResponsable, UserScolarite, Permission, RolePermission, UserRole
from app.schemas.schemas import TokenResponse
from app.services.email_service import EmailService

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def get_user_permissions(db: AsyncSession, user_type: str, user_id: int) -> list[str]:
    """
    Récupère toutes les permissions d'un utilisateur via ses rôles.
    Fallback : si pas de rôle RBAC, retourne les permissions par défaut basées sur le type d'utilisateur.
    """
    # Essayer de récupérer les permissions via RBAC
    result = await db.execute(
        select(Permission.name)
        .join(RolePermission, Permission.id == RolePermission.permission_id)
        .join(UserRole, RolePermission.role_id == UserRole.role_id)
        .where(
            UserRole.user_type == user_type,
            UserRole.user_id == user_id,
        )
    )
    permissions = result.scalars().all()
    
    if permissions:
        return list(permissions)
    
    # Fallback : permissions par défaut basées sur le type d'utilisateur
    # (pour compatibilité avec l'ancien système pendant la transition)
    default_perms = {
        "etudiant": [
            "etudiant:read_own", "etudiant:update_own",
            "inscription:create_own", "inscription:read_own", "inscription:update_own",
            "note:read_own", "piece_jointe:create_own", "piece_jointe:read_own",
            "niveau:read_all",
        ],
        "responsable": [
            "inscription:read_level", "inscription:approve_level",
            "note:read_level", "note:create_level", "note:update_level",
            "piece_jointe:read_level", "niveau:read_all",
        ],
        "scolarite": [
            "inscription:read_all", "inscription:approve_all",
            "note:read_all", "note:manage_all",
            "niveau:read_all", "niveau:manage_all",
            "user:manage_responsable", "user:manage_scolarite",
        ],
    }
    return default_perms.get(user_type, [])


class AuthService:

    # ── LOGIN étape 1 : CIN + email ────────────────────────────────────────────
    @staticmethod
    async def login_etudiant_request(
        db: AsyncSession,
        mat_cin: str,
        email: str,
        nom_fr: str = "",
        prenom_fr: str = "",
    ) -> dict:
        """
        CAS A : email déjà vérifié et CORRESPOND   → connexion directe (pas d'OTP)
        CAS B : email déjà vérifié et DIFFÉRENT    → refus
        CAS C : pas encore d'email vérifié          → envoi OTP

        Vérification nom/prénom : si fournis, ils doivent correspondre à l'étudiant en base.
        """
        mat_cin = mat_cin.upper().strip()
        email   = email.lower().strip()

        result = await db.execute(
            select(Etudiant).where(
                Etudiant.mat_cin  == mat_cin,
                Etudiant.is_active == True,
            )
        )
        # Message générique commun : ne révèle pas quel champ est incorrect
        # (confidentialité + conformité avec la demande utilisateur).
        GENERIC_CREDENTIALS_ERROR = (
            "Les informations saisies sont incorrectes. "
            "Vérifiez votre CIN, votre nom, votre prénom et votre email puis réessayez."
        )

        etudiant = result.scalar_one_or_none()
        if not etudiant:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=GENERIC_CREDENTIALS_ERROR,
            )

        # ── Vérification nom/prénom si fournis ─────────────────────────────
        if nom_fr or prenom_fr:
            def normalize(s: str) -> str:
                """Normalise pour comparaison: strip, collapse espaces, insensible casse, sans tirets/apostrophes"""
                import unicodedata
                s = (s or "").strip()
                s = unicodedata.normalize("NFC", s)
                s = s.upper().replace("-", " ").replace("'", "").replace("  ", " ")
                return s

            db_nom    = normalize(etudiant.nom_fr)
            db_prenom = normalize(etudiant.prenom_fr)
            in_nom    = normalize(nom_fr)
            in_prenom = normalize(prenom_fr)

            nom_ok    = not in_nom    or db_nom    == in_nom
            prenom_ok = not in_prenom or db_prenom == in_prenom

            if not (nom_ok and prenom_ok):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=GENERIC_CREDENTIALS_ERROR,
                )

        # CAS A — email vérifié et correspond → connexion directe
        if etudiant.email_verified and etudiant.email and etudiant.email == email:
            permissions = await get_user_permissions(db, "etudiant", etudiant.id)
            token = create_access_token(subject=etudiant.mat_cin, role="etudiant", permissions=permissions)
            return {
                "require_otp": False,
                "token": TokenResponse(
                    access_token=token,
                    role="etudiant",
                    expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                ),
                "is_first_login": False,
            }

        # CAS B — email vérifié DIFFÉRENT → refus
        if etudiant.email_verified and etudiant.email and etudiant.email != email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Ce compte est déjà associé à l'adresse "
                    f"{etudiant.email[:3]}***{etudiant.email[etudiant.email.index('@'):]}. "
                    "Utilisez cette adresse ou contactez la scolarité."
                ),
            )

        # CAS C — première connexion → envoi OTP
        nom_prenom = f"{etudiant.prenom_fr} {etudiant.nom_fr}"
        await EmailService.send_otp(db, mat_cin, email, nom_prenom)
        return {"require_otp": True, "token": None, "is_first_login": True}

    # ── LOGIN étape 2 : vérification OTP ──────────────────────────────────────
    @staticmethod
    async def login_etudiant_verify_otp(
        db: AsyncSession,
        mat_cin: str,
        email: str,
        code: str,
    ) -> dict:
        """
        Vérifie l'OTP.
        Si correct → enregistre l'email en base (verrouillé) → retourne JWT.
        """
        mat_cin = mat_cin.upper().strip()
        email   = email.lower().strip()

        result = await db.execute(
            select(Etudiant).where(
                Etudiant.mat_cin   == mat_cin,
                Etudiant.is_active == True,
            )
        )
        etudiant = result.scalar_one_or_none()
        if not etudiant:
            raise HTTPException(status_code=404, detail="Étudiant introuvable")

        valid = await EmailService.verify_otp(db, mat_cin, email, code.strip())
        if not valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Code OTP invalide ou expiré. Vérifiez votre email.",
            )

        # Enregistrer l'email vérifié en base
        etudiant.email             = email
        etudiant.email_verified    = True
        etudiant.email_verified_at = datetime.now(timezone.utc)
        await db.flush()

        permissions = await get_user_permissions(db, "etudiant", etudiant.id)
        token = create_access_token(subject=etudiant.mat_cin, role="etudiant", permissions=permissions)
        return {
            "token": TokenResponse(
                access_token=token,
                role="etudiant",
                expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            ),
            "is_first_login": True,
        }

    # ── CHANGEMENT EMAIL (depuis le formulaire d'inscription) ─────────────────
    @staticmethod
    async def request_email_change(
        db: AsyncSession,
        mat_cin: str,
        nouvel_email: str,
    ) -> None:
        """
        Envoie un OTP au NOUVEAU email pour vérifier qu'il est valide.
        Appelé depuis le formulaire d'inscription quand l'étudiant veut changer son email.
        """
        mat_cin      = mat_cin.upper().strip()
        nouvel_email = nouvel_email.lower().strip()

        result = await db.execute(
            select(Etudiant).where(
                Etudiant.mat_cin   == mat_cin,
                Etudiant.is_active == True,
            )
        )
        etudiant = result.scalar_one_or_none()
        if not etudiant:
            raise HTTPException(status_code=404, detail="Étudiant introuvable")

        # Interdire de changer si inscription déjà validée
        from app.models.models import Inscription
        from app.services.etudiant_service import ANNEE_EN_COURS
        insc_r = await db.execute(
            select(Inscription).where(
                Inscription.etudiant_id       == etudiant.id,
                Inscription.annee_universitaire == ANNEE_EN_COURS,
                Inscription.statut            == "validee",
            )
        )
        if insc_r.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail="Impossible de changer l'email : inscription déjà validée.",
            )

        nom_prenom = f"{etudiant.prenom_fr} {etudiant.nom_fr}"
        await EmailService.send_otp(db, mat_cin, nouvel_email, nom_prenom)

    # ── CONFIRMER le changement d'email ────────────────────────────────────────
    @staticmethod
    async def confirm_email_change(
        db: AsyncSession,
        mat_cin: str,
        nouvel_email: str,
        code: str,
    ) -> Etudiant:
        """
        Vérifie l'OTP pour le nouveau email.
        Si correct → met à jour l'email en base → retourne l'étudiant.
        """
        mat_cin      = mat_cin.upper().strip()
        nouvel_email = nouvel_email.lower().strip()

        result = await db.execute(
            select(Etudiant).where(
                Etudiant.mat_cin   == mat_cin,
                Etudiant.is_active == True,
            )
        )
        etudiant = result.scalar_one_or_none()
        if not etudiant:
            raise HTTPException(status_code=404, detail="Étudiant introuvable")

        valid = await EmailService.verify_otp(db, mat_cin, nouvel_email, code.strip())
        if not valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Code OTP invalide ou expiré.",
            )

        # Mettre à jour l'email en base
        etudiant.email             = nouvel_email
        etudiant.email_verified    = True
        etudiant.email_verified_at = datetime.now(timezone.utc)
        await db.flush()
        return etudiant

    # ── Scolarité ──────────────────────────────────────────────────────────────
    @staticmethod
    async def login_scolarite(db: AsyncSession, email: str, password: str) -> TokenResponse:
        result = await db.execute(
            select(UserScolarite).where(
                UserScolarite.email    == email.lower(),
                UserScolarite.is_active == True,
            )
        )
        user = result.scalar_one_or_none()
        if not user or not pwd_context.verify(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email ou mot de passe incorrect",
            )
        permissions = await get_user_permissions(db, "scolarite", user.id)
        token = create_access_token(subject=user.email, role="scolarite", permissions=permissions)
        return TokenResponse(
            access_token=token, role="scolarite",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    # ── Responsable ────────────────────────────────────────────────────────────
    @staticmethod
    async def login_responsable(db: AsyncSession, email: str, password: str) -> TokenResponse:
        result = await db.execute(
            select(UserResponsable).where(
                UserResponsable.email    == email.lower(),
                UserResponsable.is_active == True,
            )
        )
        user = result.scalar_one_or_none()
        if not user or not pwd_context.verify(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email ou mot de passe incorrect",
            )
        permissions = await get_user_permissions(db, "responsable", user.id)
        token = create_access_token(
            subject=user.email,
            role="responsable",
            permissions=permissions,
            extra={"niveau_id": user.niveau_id},
        )
        return TokenResponse(
            access_token=token, role="responsable",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
