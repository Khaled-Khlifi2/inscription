from typing import AsyncGenerator, Optional
from contextvars import ContextVar

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text

from app.core.config import settings
from app.core.schema_manager import get_default_schema, set_search_path

# ── Context variable for current schema ───────────────────────────────────────
current_schema: ContextVar[Optional[str]] = ContextVar('current_schema', default=None)

# ── Engine async ───────────────────────────────────────────────────────────────
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


# ── Déclarative base ───────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


# ── Schema-aware session management ───────────────────────────────────────────
async def get_schema_aware_db(schema: Optional[str] = None) -> AsyncGenerator[AsyncSession, None]:
    """
    Create a database session with schema-specific search path.
    
    Args:
        schema: Schema name to use. If None, uses default schema.
    
    Yields:
        AsyncSession with search_path set to the specified schema
    """
    schema_name = schema or get_default_schema()
    
    async with AsyncSessionLocal() as session:
        try:
            # Set search path for this session
            await set_search_path(session, schema_name)
            # Store schema in context for potential use in queries
            current_schema.set(schema_name)
            
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
            current_schema.set(None)


# ── Standard dependency (uses default schema) ───────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Standard database dependency using default schema."""
    async for session in get_schema_aware_db():
        yield session


# ── Schema-aware dependency factory ───────────────────────────────────────────
def get_schema_db(schema: str):
    """
    Factory function to create a database dependency for a specific schema.
    
    Args:
        schema: Schema name to use for database operations
    
    Returns:
        AsyncGenerator dependency that yields a session with the specified schema
    """
    async def dependency() -> AsyncGenerator[AsyncSession, None]:
        async for session in get_schema_aware_db(schema):
            yield session
    return dependency


# ── Get current schema from context ───────────────────────────────────────────
def get_current_schema() -> Optional[str]:
    """Get the current schema from context."""
    return current_schema.get()
