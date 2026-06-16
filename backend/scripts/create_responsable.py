#!/usr/bin/env python3
"""
Crée un compte responsable de niveau depuis la ligne de commande.

Usage :
  python scripts/create_responsable.py \
    --email resp.ingenieur@isi.tn \
    --nom Ben_Ali --prenom Mohamed \
    --password MonMotDePasse \
    --niveau ingenieur
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from passlib.context import CryptContext
from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.models import Niveau, UserResponsable

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def create(email: str, nom: str, prenom: str, password: str, niveau_code: str) -> None:
    async with AsyncSessionLocal() as db:
        # Vérifier que le niveau existe
        niv_result = await db.execute(select(Niveau).where(Niveau.code == niveau_code.lower()))
        niveau = niv_result.scalar_one_or_none()
        if not niveau:
            print(f"[ERREUR] Niveau '{niveau_code}' introuvable. Valeurs: ingenieur, master, licence")
            return

        # Vérifier si l'email est déjà pris
        existing = await db.execute(select(UserResponsable).where(UserResponsable.email == email.lower()))
        if existing.scalar_one_or_none():
            print(f"[ERREUR] Un responsable avec l'email {email} existe déjà.")
            return

        db.add(UserResponsable(
            email=email.lower(),
            nom=nom, prenom=prenom,
            hashed_password=_pwd.hash(password),
            niveau_id=niveau.id,
        ))
        await db.commit()
        print(f"[OK] Responsable {prenom} {nom} créé pour le niveau '{niveau.libelle}'")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Créer un responsable de niveau")
    parser.add_argument("--email",    required=True)
    parser.add_argument("--nom",      required=True)
    parser.add_argument("--prenom",   required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--niveau",   required=True, choices=["ingenieur", "master", "licence"])
    args = parser.parse_args()

    asyncio.run(create(args.email, args.nom, args.prenom, args.password, args.niveau))
