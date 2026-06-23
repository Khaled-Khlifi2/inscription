"""
Endpoints d'authentification.

Étudiant :
  POST /auth/etudiant/login
    CAS A : email vérifié ET correspond  → connexion directe (LoginDirectResponse)
    CAS B : email différent du vérifié   → 400 refus
    CAS C : première connexion           → OTP envoyé (OtpRequiredResponse)

  POST /auth/etudiant/verify-otp
    → code OTP → email enregistré en base → JWT (OtpVerifyResponse + is_first_login)

Scolarité / Responsable :
  POST /auth/scolarite/login   → email + password → JWT
  POST /auth/responsable/login → email + password → JWT (+ niveau_id)
"""
from typing import Union

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.schemas import (
    EtudiantLoginRequest,
    EtudiantOtpVerifyRequest,
    LoginDirectResponse,
    LoginRequest,
    OtpRequiredResponse,
    OtpVerifyResponse,
    TokenResponse,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentification"])


@router.post(
    "/etudiant/login",
    summary="Connexion étudiant — CIN ou passeport + email",
)
async def login_etudiant(
    credentials: EtudiantLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    **CAS A** — Email déjà vérifié et correspond au CIN/passeport :
    → Connexion directe, pas d'OTP.
    → Retourne `{ require_otp: false, access_token, role, expires_in, is_first_login: false }`.

    **CAS B** — Email différent de celui enregistré :
    → Erreur 400 — l'étudiant doit utiliser son email vérifié.

    **CAS C** — Première connexion (aucun email en base) :
    → OTP envoyé à l'email fourni.
    → Retourne `{ require_otp: true, message }`.
    """
    result = await AuthService.login_etudiant_request(
        db, credentials.identifier, credentials.email,
        credentials.nom_fr.strip(), credentials.prenom_fr.strip()
    )

    if result["require_otp"]:
        return OtpRequiredResponse(
            require_otp=True,
            message="Code de vérification envoyé à votre adresse email.",
        )
    else:
        # Connexion directe — CAS A
        t = result["token"]
        return LoginDirectResponse(
            require_otp=False,
            access_token=t.access_token,
            token_type="bearer",
            role=t.role,
            expires_in=t.expires_in,
            is_first_login=False,
        )


@router.post(
    "/etudiant/verify-otp",
    response_model=OtpVerifyResponse,
    summary="Vérification OTP → JWT + email enregistré en base",
)
async def verify_otp(
    body: EtudiantOtpVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Vérifie le code OTP reçu par email.
    Si correct :
    - Enregistre l'email en base de données (verrouillé)
    - Retourne le JWT + `is_first_login: true`
    - Le frontend redirige vers `/etudiant/inscription`
    """
    result = await AuthService.login_etudiant_verify_otp(
        db, body.identifier, body.email, body.code
    )
    return OtpVerifyResponse(
        access_token=result["token"].access_token,
        token_type="bearer",
        role="etudiant",
        expires_in=result["token"].expires_in,
        is_first_login=result["is_first_login"],
    )


@router.post(
    "/scolarite/login",
    response_model=TokenResponse,
    summary="Connexion scolarité (admin global)",
)
async def login_scolarite(
    credentials: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    return await AuthService.login_scolarite(db, credentials.email, credentials.password)


@router.post(
    "/responsable/login",
    response_model=TokenResponse,
    summary="Connexion responsable de niveau",
)
async def login_responsable(
    credentials: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    return await AuthService.login_responsable(db, credentials.email, credentials.password)
