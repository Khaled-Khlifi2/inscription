"""
Schema Management Utility for Multi-Tenancy

Handles schema creation, deletion, and validation for establishment-based schemas.
"""
import re
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.config import settings


def sanitize_schema_name(etablissement_id: str) -> str:
    """
    Convert establishment ID to a valid PostgreSQL schema name.
    
    Args:
        etablissement_id: Establishment identifier (e.g., "isi_ariana", "faculty_sciences")
    
    Returns:
        Sanitized schema name (e.g., "etablissement_isi_ariana")
    
    Examples:
        >>> sanitize_schema_name("isi_ariana")
        'etablissement_isi_ariana'
        >>> sanitize_schema_name("faculty-of-sciences")
        'etablissement_faculty_of_sciences'
    """
    # Remove invalid characters, replace with underscore
    sanitized = re.sub(r'[^a-zA-Z0-9_]', '_', etablissement_id.lower())
    # Remove consecutive underscores
    sanitized = re.sub(r'_+', '_', sanitized)
    # Remove leading/trailing underscores
    sanitized = sanitized.strip('_')
    
    # Add prefix
    return f"{settings.ETABLISSEMENT_SCHEMA_PREFIX}_{sanitized}"


def get_shared_schema() -> str:
    """Return the shared schema name for common data (niveaux, roles, etc.)."""
    return "shared"


def get_default_schema() -> str:
    """Return the default establishment schema name."""
    return sanitize_schema_name(settings.DEFAULT_ETABLISSEMENT)


async def create_schema(session: AsyncSession, schema_name: str) -> bool:
    """
    Create a new schema in the database.
    
    Args:
        session: Async database session
        schema_name: Name of the schema to create
    
    Returns:
        True if schema was created, False if it already exists
    """
    try:
        await session.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema_name}"))
        await session.commit()
        return True
    except Exception as e:
        await session.rollback()
        raise Exception(f"Failed to create schema {schema_name}: {str(e)}")


async def drop_schema(session: AsyncSession, schema_name: str, cascade: bool = False) -> bool:
    """
    Drop a schema from the database.
    
    Args:
        session: Async database session
        schema_name: Name of the schema to drop
        cascade: If True, drop all objects in the schema
    
    Returns:
        True if schema was dropped
    """
    try:
        cascade_clause = "CASCADE" if cascade else ""
        await session.execute(text(f"DROP SCHEMA IF EXISTS {schema_name} {cascade_clause}"))
        await session.commit()
        return True
    except Exception as e:
        await session.rollback()
        raise Exception(f"Failed to drop schema {schema_name}: {str(e)}")


async def schema_exists(session: AsyncSession, schema_name: str) -> bool:
    """
    Check if a schema exists in the database.
    
    Args:
        session: Async database session
        schema_name: Name of the schema to check
    
    Returns:
        True if schema exists
    """
    try:
        result = await session.execute(
            text("SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = :schema_name)"),
            {"schema_name": schema_name}
        )
        return result.scalar()
    except Exception:
        return False


async def list_schemas(session: AsyncSession, prefix: Optional[str] = None) -> list[str]:
    """
    List all schemas in the database, optionally filtered by prefix.
    
    Args:
        session: Async database session
        prefix: Optional prefix to filter schemas (e.g., "etablissement_")
    
    Returns:
        List of schema names
    """
    try:
        if prefix:
            result = await session.execute(
                text("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE :prefix"),
                {"prefix": f"{prefix}%"}
            )
        else:
            result = await session.execute(
                text("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema')")
            )
        return [row[0] for row in result.fetchall()]
    except Exception as e:
        raise Exception(f"Failed to list schemas: {str(e)}")


async def set_search_path(session: AsyncSession, schema_name: str) -> None:
    """
    Set the search path for the current session.
    
    Args:
        session: Async database session
        schema_name: Schema name to set as primary in search path
    """
    try:
        # Set search path to: specified schema, then shared, then public
        await session.execute(
            text(f"SET search_path TO {schema_name}, shared, public")
        )
    except Exception as e:
        raise Exception(f"Failed to set search path to {schema_name}: {str(e)}")


async def clone_schema_structure(
    session: AsyncSession, 
    source_schema: str, 
    target_schema: str
) -> bool:
    """
    Clone table structure from source schema to target schema.
    
    This creates all tables from the source schema in the target schema
    with the same structure but without data.
    
    Args:
        session: Async database session
        source_schema: Source schema name (e.g., "public" or "etablissement_isi_ariana")
        target_schema: Target schema name (e.g., "etablissement_faculty_sciences")
    
    Returns:
        True if successful
    """
    try:
        # Create target schema
        await create_schema(session, target_schema)
        
        # Get all tables from source schema (excluding system tables)
        result = await session.execute(
            text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = :schema 
                AND table_type = 'BASE TABLE'
                ORDER BY table_name
            """),
            {"schema": source_schema}
        )
        tables = [row[0] for row in result.fetchall()]
        
        # Clone each table structure
        for table in tables:
            # Create table in target schema with same structure
            await session.execute(
                text(f"CREATE TABLE {target_schema}.{table} (LIKE {source_schema}.{table} INCLUDING ALL)")
            )
        
        await session.commit()
        return True
        
    except Exception as e:
        await session.rollback()
        raise Exception(f"Failed to clone schema structure: {str(e)}")
