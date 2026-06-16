"""
Service d'importation flexible d'étudiants.

Architecture
────────────
1. **IMPORT_TARGETS** : catalogue des champs importables (clé, libellé, groupe, requis).
2. **preview()** : analyse un fichier (.xlsx / .xls / .csv), retourne :
     - la liste des colonnes détectées
     - les premières lignes (échantillon)
     - le nombre total de lignes
     - une suggestion de mapping (auto-détection par similarité de nom)
3. **import_with_mapping()** : importe en utilisant un mapping
     `{nom_colonne_fichier: clé_champ_cible}` fourni par l'utilisateur.
4. **import_from_xlsx()** : raccourci legacy → mapping auto-détecté (compat).
"""
from __future__ import annotations

import io
import re
from typing import IO, Any, Optional, Union

import pandas as pd
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Etudiant, Role, UserRole
from app.schemas.schemas import ImportResult

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _hash(password: str) -> str:
    return _pwd.hash(password)


# ──────────────────────────────────────────────────────────────────
#  Catalogue des champs importables
# ──────────────────────────────────────────────────────────────────
# Chaque entrée :
#   - key            : nom d'attribut sur Etudiant (sauf '_password' = spécial)
#   - label          : libellé lisible
#   - group          : section (pour grouper côté UI)
#   - required       : champ obligatoire pour créer un étudiant
#   - aliases        : variantes de noms de colonnes utilisées pour l'auto-détection

IMPORT_TARGETS: list[dict[str, Any]] = [
    # ─── Identité administrative ───
    {"key": "mat_cin",            "label": "Matricule / CIN",        "group": "Identité administrative", "required": True,
     "aliases": ["mat_cin", "matcin", "cin", "matricule", "mat", "n_cin", "num_cin"]},
    {"key": "num_inscription",    "label": "N° d'inscription",       "group": "Identité administrative", "required": False,
     "aliases": ["num_inscription", "numinscription", "n_inscription", "inscription"]},

    # ─── Identité civile ───
    {"key": "nom_fr",             "label": "Nom (FR)",               "group": "Identité civile", "required": True,
     "aliases": ["nom_fr", "nom", "lastname", "last_name", "nom_famille"]},
    {"key": "prenom_fr",          "label": "Prénom (FR)",            "group": "Identité civile", "required": True,
     "aliases": ["prenom_fr", "prenom", "firstname", "first_name"]},
    {"key": "nom_ar",             "label": "Nom (AR)",               "group": "Identité civile", "required": False,
     "aliases": ["nom_ar", "nom_arabe"]},
    {"key": "prenom_ar",          "label": "Prénom (AR)",            "group": "Identité civile", "required": False,
     "aliases": ["prenom_ar", "prenom_arabe"]},
    {"key": "sexe",               "label": "Sexe",                   "group": "Identité civile", "required": False,
     "aliases": ["sexe", "genre", "gender"]},
    {"key": "situation_familiale","label": "Situation familiale",    "group": "Identité civile", "required": False,
     "aliases": ["situation_familiale", "situation", "etat_civil"]},

    # ─── Naissance ───
    {"key": "date_naissance",     "label": "Date de naissance",      "group": "Naissance", "required": False,
     "aliases": ["date_naissance", "datenaissance", "naissance", "ddn", "birth_date"]},
    {"key": "lieu_naiss_fr",      "label": "Lieu de naissance (FR)", "group": "Naissance", "required": False,
     "aliases": ["lieu_naiss_fr", "lieu_naissance_fr", "lieu_naissance", "lieu"]},
    {"key": "lieu_naiss_ar",      "label": "Lieu de naissance (AR)", "group": "Naissance", "required": False,
     "aliases": ["lieu_naiss_ar", "lieu_naissance_ar"]},

    # ─── Coordonnées ───
    {"key": "email",              "label": "Email",                  "group": "Coordonnées", "required": False,
     "aliases": ["email", "mail", "e_mail", "adresse_mail"]},
    {"key": "telephone_portable", "label": "Téléphone portable",     "group": "Coordonnées", "required": False,
     "aliases": ["telephone_portable", "telephone", "tel", "tel_portable", "mobile", "gsm", "phone"]},
    {"key": "telephone_fixe",     "label": "Téléphone fixe",         "group": "Coordonnées", "required": False,
     "aliases": ["telephone_fixe", "tel_fixe", "fixe"]},
    {"key": "adresse_fr",         "label": "Adresse (FR)",           "group": "Coordonnées", "required": False,
     "aliases": ["adresse_fr", "adresse", "address"]},
    {"key": "adresse_ar",         "label": "Adresse (AR)",           "group": "Coordonnées", "required": False,
     "aliases": ["adresse_ar"]},

    # ─── Données administratives ───
    {"key": "code_gouvernorat",   "label": "Code gouvernorat",       "group": "Administratif", "required": False,
     "aliases": ["code_gouvernorat", "gouvernorat", "code_gouv"]},
    {"key": "code_type_bac",      "label": "Code type bac",          "group": "Administratif", "required": False,
     "aliases": ["code_type_bac", "code_de_type_de_bac", "type_bac", "bac"]},
    {"key": "num_cnss",           "label": "N° CNSS",                "group": "Administratif", "required": False,
     "aliases": ["num_cnss", "cnss"]},
    {"key": "passeport",          "label": "Passeport",              "group": "Administratif", "required": False,
     "aliases": ["passeport", "passport"]},
    {"key": "statut",             "label": "Statut",                 "group": "Administratif", "required": False,
     "aliases": ["statut", "status"]},

    # ─── Cursus académique ───
    {"key": "cfil",               "label": "Code filière",           "group": "Cursus académique", "required": False,
     "aliases": ["cfil", "code_filiere", "filiere_code"]},
    {"key": "lib_filiere",        "label": "Libellé filière (FR)",   "group": "Cursus académique", "required": False,
     "aliases": ["lib_filiere", "filiere", "libelle_filiere"]},
    {"key": "lib_filiere_ar",     "label": "Libellé filière (AR)",   "group": "Cursus académique", "required": False,
     "aliases": ["lib_filiere_ar", "filiere_ar"]},

    # ─── Spécial : mot de passe initial ───
    {"key": "_password",          "label": "Mot de passe initial",   "group": "Sécurité", "required": False,
     "aliases": ["password", "mot_de_passe", "mdp", "passwd"]},
]

TARGETS_BY_KEY: dict[str, dict[str, Any]] = {t["key"]: t for t in IMPORT_TARGETS}

# Pré-calcul des aliases normalisés → clé cible
_ALIAS_INDEX: dict[str, str] = {}
for t in IMPORT_TARGETS:
    for a in t["aliases"]:
        _ALIAS_INDEX[a] = t["key"]


# ──────────────────────────────────────────────────────────────────
#  Helpers
# ──────────────────────────────────────────────────────────────────
def _normalize(name: str) -> str:
    """'Code de Type de BAC ' → 'code_de_type_de_bac'"""
    s = str(name).strip().lower()
    s = re.sub(r"[°º\.\(\)/\\:;,'\"]+", "", s)
    s = re.sub(r"[\s\-]+", "_", s)
    s = re.sub(r"_+", "_", s)
    return s.strip("_")


def _suggest_mapping(file_columns: list[str]) -> dict[str, str]:
    """
    Pour chaque colonne du fichier, propose une clé cible si on la reconnaît.
    Retourne {nom_colonne_fichier: clé_cible}.
    """
    suggestion: dict[str, str] = {}
    for col in file_columns:
        norm = _normalize(col)
        if norm in _ALIAS_INDEX:
            suggestion[col] = _ALIAS_INDEX[norm]
            continue
        # match partiel : un alias contenu dans la colonne normalisée
        for alias, key in _ALIAS_INDEX.items():
            if alias == norm or alias in norm.split("_"):
                suggestion[col] = key
                break
    return suggestion


def _read_dataframe(content: bytes, filename: str) -> pd.DataFrame:
    """Lit un fichier .xlsx / .xls / .csv en DataFrame de chaînes."""
    name = (filename or "").lower()
    buf = io.BytesIO(content)
    if name.endswith(".csv"):
        # Auto-détection séparateur
        try:
            return pd.read_csv(buf, dtype=str, sep=None, engine="python", encoding="utf-8-sig")
        except UnicodeDecodeError:
            buf.seek(0)
            return pd.read_csv(buf, dtype=str, sep=None, engine="python", encoding="latin-1")
    return pd.read_excel(buf, dtype=str, engine="openpyxl")


def _clean(value: Any, field: str = "") -> Optional[str]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    v = str(value).strip()
    if not v or v.lower() == "nan":
        return None
    return v.upper() if field == "mat_cin" else v


# ──────────────────────────────────────────────────────────────────
#  Service
# ──────────────────────────────────────────────────────────────────
class ImportService:

    # --------- Catalogue ---------
    @staticmethod
    def get_target_fields() -> list[dict[str, Any]]:
        return [
            {"key": t["key"], "label": t["label"], "group": t["group"], "required": t["required"]}
            for t in IMPORT_TARGETS
        ]

    # --------- Preview ---------
    @staticmethod
    def preview(content: bytes, filename: str, sample_size: int = 5) -> dict[str, Any]:
        try:
            df = _read_dataframe(content, filename)
        except Exception as exc:
            raise ValueError(f"Impossible de lire le fichier : {exc}")

        df.dropna(how="all", inplace=True)
        columns = [str(c) for c in df.columns]
        total_rows = int(len(df))

        sample = []
        for _, row in df.head(sample_size).iterrows():
            sample.append({
                str(c): (None if pd.isna(row[c]) else str(row[c]))
                for c in df.columns
            })

        return {
            "columns": columns,
            "sample_rows": sample,
            "total_rows": total_rows,
            "suggested_mapping": _suggest_mapping(columns),
        }

    # --------- Import avec mapping personnalisé ---------
    @classmethod
    async def import_with_mapping(
        cls,
        db: AsyncSession,
        content: bytes,
        filename: str,
        mapping: dict[str, str],          # {file_column: target_key}
        update_existing: bool = True,
        force_niveau_id: Optional[int] = None,
    ) -> ImportResult:
        errors: list[str] = []
        imported = updated = skipped = 0

        # ── Lecture ───────────────────────────────────────────────
        try:
            df = _read_dataframe(content, filename)
        except Exception as exc:
            return ImportResult(total_rows=0, imported=0, updated=0, skipped=0,
                                errors=[f"Impossible de lire le fichier : {exc}"])

        df.dropna(how="all", inplace=True)
        total_rows = int(len(df))
        if total_rows == 0:
            return ImportResult(total_rows=0, imported=0, updated=0, skipped=0,
                                errors=["Le fichier est vide"])

        # ── Récupérer le rôle étudiant pour l'assignation automatique ──
        role_result = await db.execute(select(Role).where(Role.name == "etudiant"))
        etudiant_role = role_result.scalar_one_or_none()

        # ── Validation du mapping ─────────────────────────────────
        # Filtrer les paires invalides
        clean_mapping: dict[str, str] = {}
        for src, dst in mapping.items():
            if not dst:
                continue
            if dst not in TARGETS_BY_KEY:
                errors.append(f"Champ cible inconnu ignoré : « {dst} »")
                continue
            if src not in df.columns:
                errors.append(f"Colonne source absente du fichier : « {src} »")
                continue
            clean_mapping[src] = dst

        # Vérifier les colonnes obligatoires
        mapped_targets = set(clean_mapping.values())
        required_missing = [
            t["label"] for t in IMPORT_TARGETS
            if t["required"] and t["key"] not in mapped_targets
        ]
        if required_missing:
            return ImportResult(
                total_rows=total_rows, imported=0, updated=0, skipped=0,
                errors=[f"Champs obligatoires non mappés : {', '.join(required_missing)}"],
            )

        # ── Renommage colonnes selon mapping ──────────────────────
        df = df.rename(columns=clean_mapping)

        # ── Traitement ligne par ligne ────────────────────────────
        for row_num, (_, row) in enumerate(df.iterrows(), start=2):
            try:
                mat_cin = _clean(row.get("mat_cin"), "mat_cin")
                if not mat_cin:
                    errors.append(f"Ligne {row_num} : Matricule/CIN manquant — ignorée")
                    skipped += 1
                    continue

                nom_fr = _clean(row.get("nom_fr"))
                prenom_fr = _clean(row.get("prenom_fr"))
                if not nom_fr or not prenom_fr:
                    errors.append(f"Ligne {row_num} (CIN={mat_cin}) : Nom ou Prénom manquant")
                    skipped += 1
                    continue

                password_raw = _clean(row.get("_password"))
                password = password_raw or mat_cin

                # Préparer les champs (uniquement ceux mappés)
                fields: dict[str, Optional[str]] = {}
                for tgt in TARGETS_BY_KEY.keys():
                    if tgt in ("_password",):
                        continue
                    if tgt in df.columns:
                        fields[tgt] = _clean(row.get(tgt))

                # ── Upsert par MAT_CIN ───────────────────────────
                res = await db.execute(select(Etudiant).where(Etudiant.mat_cin == mat_cin))
                existing: Optional[Etudiant] = res.scalar_one_or_none()

                if existing:
                    if not update_existing:
                        skipped += 1
                        continue
                    for attr, val in fields.items():
                        if val is not None:
                            setattr(existing, attr, val)
                    if force_niveau_id is not None:
                        existing.niveau_id = force_niveau_id
                    if password_raw:
                        existing.hashed_password = _hash(password)
                    updated += 1
                else:
                    create_fields = {k: v for k, v in fields.items() if v is not None}
                    create_fields["mat_cin"] = mat_cin
                    create_fields["nom_fr"] = nom_fr
                    create_fields["prenom_fr"] = prenom_fr
                    etudiant = Etudiant(
                        hashed_password=_hash(password),
                        niveau_id=force_niveau_id,
                        **create_fields,
                    )
                    db.add(etudiant)
                    await db.flush()
                    
                    # Assigner automatiquement le rôle étudiant
                    if etudiant_role:
                        user_role = UserRole(user_type="etudiant", user_id=etudiant.id, role_id=etudiant_role.id)
                        db.add(user_role)
                    
                    imported += 1

            except Exception as exc:
                errors.append(f"Ligne {row_num} : erreur inattendue — {exc}")
                skipped += 1

        await db.flush()
        return ImportResult(
            total_rows=total_rows,
            imported=imported,
            updated=updated,
            skipped=skipped,
            errors=errors,
        )

    # --------- Legacy : auto-détection (compat) ---------
    @classmethod
    async def import_from_xlsx(
        cls,
        db: AsyncSession,
        file_content: Union[bytes, IO],
        update_existing: bool = True,
        force_niveau_id: Optional[int] = None,
        filename: str = "import.xlsx",
    ) -> ImportResult:
        """Mode legacy : utilise les aliases pour auto-détecter le mapping."""
        content = file_content if isinstance(file_content, bytes) else file_content.read()
        try:
            df = _read_dataframe(content, filename)
        except Exception as exc:
            return ImportResult(total_rows=0, imported=0, updated=0, skipped=0,
                                errors=[f"Impossible de lire le fichier : {exc}"])
        mapping = _suggest_mapping([str(c) for c in df.columns])
        return await cls.import_with_mapping(
            db, content, filename, mapping,
            update_existing=update_existing,
            force_niveau_id=force_niveau_id,
        )
