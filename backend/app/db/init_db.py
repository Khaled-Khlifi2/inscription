"""
Initialisation au démarrage :
  1. Crée les 3 niveaux (ingenieur, master, licence)
  2. Crée le compte scolarité admin
  3. Crée les 3 comptes responsables (un par niveau)
"""
from sqlalchemy import select
from passlib.context import CryptContext

from app.db.session import AsyncSessionLocal
from app.models.models import Niveau, UserResponsable, UserScolarite
from app.core.config import settings

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

NIVEAUX_DEFAUT = [
    {"code": "ingenieur", "libelle": "Ingénieur", "libelle_ar": "مهندس"},
    {"code": "master",    "libelle": "Master",    "libelle_ar": "ماستر"},
    {"code": "licence",   "libelle": "Licence",   "libelle_ar": "إجازة"},
]


async def init_db() -> None:
    async with AsyncSessionLocal() as db:
        try:
            # ── 1. Niveaux ─────────────────────────────────────────────────────
            niveau_ids = {}
            for niv in NIVEAUX_DEFAUT:
                r = await db.execute(select(Niveau).where(Niveau.code == niv["code"]))
                existing = r.scalar_one_or_none()
                if not existing:
                    n = Niveau(**niv)
                    db.add(n)
                    await db.flush()
                    niveau_ids[niv["code"]] = n.id
                    print(f"[INIT] Niveau créé : {niv['code']}")
                else:
                    niveau_ids[niv["code"]] = existing.id
                    print(f"[INIT] Niveau existant : {niv['code']} (id={existing.id})")

            # ── 2. Compte scolarité admin ──────────────────────────────────────
            r = await db.execute(
                select(UserScolarite).where(UserScolarite.email == settings.SCOLARITE_DEFAULT_EMAIL)
            )
            if not r.scalar_one_or_none():
                db.add(UserScolarite(
                    email=settings.SCOLARITE_DEFAULT_EMAIL,
                    nom="Admin", prenom="Scolarite",
                    hashed_password=_pwd.hash(settings.SCOLARITE_DEFAULT_PASSWORD),
                    is_active=True,
                ))
                print(f"[INIT] Scolarité créée : {settings.SCOLARITE_DEFAULT_EMAIL}")
            else:
                print(f"[INIT] Scolarité existante : {settings.SCOLARITE_DEFAULT_EMAIL}")

            # ── 3. Responsables par niveau ─────────────────────────────────────
            responsables_defaut = [
                {
                    "email":    settings.RESP_INGENIEUR_EMAIL,
                    "password": settings.RESP_INGENIEUR_PASSWORD,
                    "nom": "Responsable", "prenom": "Ingénieur",
                    "niveau_code": "ingenieur",
                },
                {
                    "email":    settings.RESP_MASTER_EMAIL,
                    "password": settings.RESP_MASTER_PASSWORD,
                    "nom": "Responsable", "prenom": "Master",
                    "niveau_code": "master",
                },
                {
                    "email":    settings.RESP_LICENCE_EMAIL,
                    "password": settings.RESP_LICENCE_PASSWORD,
                    "nom": "Responsable", "prenom": "Licence",
                    "niveau_code": "licence",
                },
            ]

            for resp in responsables_defaut:
                r = await db.execute(
                    select(UserResponsable).where(UserResponsable.email == resp["email"])
                )
                if not r.scalar_one_or_none():
                    nid = niveau_ids.get(resp["niveau_code"])
                    if nid:
                        db.add(UserResponsable(
                            email=resp["email"],
                            nom=resp["nom"],
                            prenom=resp["prenom"],
                            hashed_password=_pwd.hash(resp["password"]),
                            niveau_id=nid,
                            is_active=True,
                        ))
                        print(f"[INIT] Responsable créé : {resp['email']} → niveau {resp['niveau_code']}")
                else:
                    print(f"[INIT] Responsable existant : {resp['email']}")

            await db.commit()

        except Exception as e:
            await db.rollback()
            print(f"[INIT ERROR] {e}")
