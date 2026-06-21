"""
Script to create a new establishment schema with cloned table structure.

Usage:
    python scripts/create_establishment.py faculty_sciences
"""
import asyncio
import sys

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.config import settings
from app.core.schema_manager import sanitize_schema_name, clone_schema_structure


async def create_establishment(etablissement_id: str):
    """
    Create a new establishment schema with cloned table structure.
    
    Args:
        etablissement_id: Establishment identifier (e.g., "faculty_sciences")
    """
    schema_name = sanitize_schema_name(etablissement_id)
    
    print(f"Creating establishment schema: {schema_name}")
    print(f"From source: public (current schema)")
    
    # Create database connection
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    
    async with AsyncSessionLocal() as session:
        try:
            # Clone structure from public schema
            await clone_schema_structure(session, "public", schema_name)
            print(f"✓ Successfully created schema '{schema_name}' with cloned table structure")
            print(f"✓ You can now use this establishment with: X-Etablissement: {etablissement_id}")
        except Exception as e:
            print(f"✗ Error creating establishment: {str(e)}")
            sys.exit(1)
    
    await engine.dispose()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python scripts/create_establishment.py <etablissement_id>")
        print("Example: python scripts/create_establishment.py faculty_sciences")
        sys.exit(1)
    
    etablissement_id = sys.argv[1]
    asyncio.run(create_establishment(etablissement_id))
