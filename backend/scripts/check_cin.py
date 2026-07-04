"""
Script rapide pour vérifier si un CIN existe en base.

Usage:
    python scripts/check_cin.py <CIN>
"""
import asyncio
import sys
from pathlib import Path

# Ajouter le répertoire parent au path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.models import Etudiant


async def check_cin(cin: str):
    """Vérifie un CIN en base"""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Etudiant).where(Etudiant.mat_cin == cin.upper())
        )
        etudiant = result.scalar_one_or_none()
        
        if not etudiant:
            print(f"❌ Étudiant introuvable : {cin}")
            return False
        
        print(f"✅ Étudiant trouvé : {etudiant.prenom_fr} {etudiant.nom_fr}")
        print(f"   CIN : {etudiant.mat_cin}")
        print(f"   Email : {etudiant.email}")
        print(f"   Email vérifié : {etudiant.email_verified}")
        return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/check_cin.py <CIN>")
        sys.exit(1)
    
    cin = sys.argv[1]
    asyncio.run(check_cin(cin))
