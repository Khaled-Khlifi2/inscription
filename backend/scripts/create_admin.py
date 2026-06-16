#!/usr/bin/env python3
"""
Crée un compte scolarité manuellement depuis la ligne de commande.

Usage :
  python scripts/create_admin.py --email admin@isi.tn --nom Dupont --prenom Jean --password MonMotDePasse
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from passlib.context import CryptContext
from sqlalchemy import select

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.models import UserScolarite

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def create_admin(email: str, nom: str, prenom: str, password: str) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(UserScolarite).where(UserScolarite.email == email.lower())
        )
        if result.scalar_one_or_none():
            print(f"[ERREUR] Un compte avec l'email {email} existe déjà.")
            return

        db.add(
            UserScolarite(
                email=email.lower(),
                nom=nom,
                prenom=prenom,
                hashed_password=_pwd.hash(password),
                is_active=True,
            )
        )
        await db.commit()
        print(f"[OK] Compte scolarité créé : {email}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Créer un compte scolarité")
    parser.add_argument("--email",    required=True)
    parser.add_argument("--nom",      required=True)
    parser.add_argument("--prenom",   required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    asyncio.run(create_admin(args.email, args.nom, args.prenom, args.password))
