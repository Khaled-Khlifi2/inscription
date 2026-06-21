from typing import Optional, AsyncGenerator
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token, bearer_scheme
from app.core.schema_manager import sanitize_schema_name, get_default_schema
from app.db.session import get_schema_aware_db


async def get_etablissement_from_header(
    x_etablissement: Optional[str] = Header(None, alias="X-Etablissement")
) -> str:
    """
    Extract establishment identifier from request header.
    
    Args:
        x_etablissement: Establishment identifier from header (e.g., "isi_ariana", "faculty_sciences")
    
    Returns:
        Schema name for the establishment
    
    Raises:
        HTTPException: If establishment header is invalid
    """
    if not x_etablissement:
        return get_default_schema()
    
    # Validate and sanitize the establishment identifier
    schema_name = sanitize_schema_name(x_etablissement)
    
    return schema_name


async def get_etablissement_from_token(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
) -> str:
    """
    Extract establishment identifier from JWT token.
    
    Args:
        credentials: Authorization credentials
    
    Returns:
        Schema name for the establishment
    """
    if not credentials:
        return get_default_schema()
    
    payload = decode_access_token(credentials.credentials)
    etablissement = payload.get("etablissement")
    
    if not etablissement:
        return get_default_schema()
    
    return sanitize_schema_name(etablissement)


async def get_etablissement(
    header_etablissement: str = Depends(get_etablissement_from_header),
    token_etablissement: str = Depends(get_etablissement_from_token)
) -> str:
    """
    Get establishment schema name from header (priority) or token.
    
    Args:
        header_etablissement: Schema from header
        token_etablissement: Schema from token
    
    Returns:
        Schema name to use for the request
    """
    # Header takes priority over token
    return header_etablissement if header_etablissement != get_default_schema() else token_etablissement


async def get_db_with_etablissement(
    etablissement: str = Depends(get_etablissement)
) -> AsyncGenerator[AsyncSession, None]:
    """
    Database dependency that uses the establishment-specific schema.
    
    This dependency automatically sets the search path to the correct schema
    based on the establishment context from the request header or token.
    
    Args:
        etablissement: Schema name to use for database operations
    
    Yields:
        AsyncSession with search_path set to the establishment schema
    """
    async for session in get_schema_aware_db(etablissement):
        yield session


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
