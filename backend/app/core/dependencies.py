from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials

from app.core.security import decode_access_token, bearer_scheme


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token manquant — ajoutez 'Authorization: Bearer <token>'",
        )
    payload = decode_access_token(credentials.credentials)
    sub  = payload.get("sub")
    role = payload.get("role")
    if not sub or not role:
        raise HTTPException(status_code=401, detail="Token invalide")
    result = {"id": sub, "role": role, "permissions": payload.get("permissions", [])}
    # Ajouter niveau_id pour les responsables
    if role == "responsable" and "niveau_id" in payload:
        result["niveau_id"] = payload["niveau_id"]
    return result


async def require_etudiant(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "etudiant":
        raise HTTPException(status_code=403, detail="Accès réservé aux étudiants")
    return current_user


async def require_scolarite(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "scolarite":
        raise HTTPException(status_code=403, detail="Accès réservé au service scolarité")
    return current_user


async def require_responsable(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "responsable":
        raise HTTPException(status_code=403, detail="Accès réservé aux responsables de niveau")
    return current_user


async def require_scolarite_or_responsable(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] not in ("scolarite", "responsable"):
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    return current_user


def has_permission(permission: str):
    """Factory function pour vérifier si l'utilisateur a une permission spécifique"""
    async def check(current_user: dict = Depends(get_current_user)) -> dict:
        permissions = current_user.get("permissions", [])
        if permission not in permissions:
            raise HTTPException(
                status_code=403,
                detail=f"Permission requise : {permission}"
            )
        return current_user
    return check


def require_any_permission(*permissions: str):
    """Factory function pour vérifier si l'utilisateur a au moins une des permissions requises"""
    async def check(current_user: dict = Depends(get_current_user)) -> dict:
        user_permissions = current_user.get("permissions", [])
        if not any(perm in user_permissions for perm in permissions):
            raise HTTPException(
                status_code=403,
                detail=f"Permission requise : une de {', '.join(permissions)}"
            )
        return current_user
    return check


def require_all_permissions(*permissions: str):
    """Factory function pour vérifier si l'utilisateur a toutes les permissions requises"""
    async def check(current_user: dict = Depends(get_current_user)) -> dict:
        user_permissions = current_user.get("permissions", [])
        if not all(perm in user_permissions for perm in permissions):
            raise HTTPException(
                status_code=403,
                detail=f"Permissions requises : {', '.join(permissions)}"
            )
        return current_user
    return check
