"""Migration v8 — ajout du statut 'soumis' pour les inscriptions

Distingue la PREMIÈRE soumission ('soumis') d'une RE-soumission après rejet
('en_attente'). Les deux états attendent une décision du responsable.

Revision ID: 0008_soumis_status
Revises: 0007_inscription_proposed_data
Create Date: 2026-05-16 23:05:00
"""
from typing import Union

from alembic import op

revision: str = "0008_soumis_status"
down_revision: Union[str, None] = "0007_inscription_proposed_data"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TYPE inscription_statut_enum ADD VALUE IF NOT EXISTS 'soumis'"
    )


def downgrade() -> None:
    # PostgreSQL ne permet pas de retirer une valeur d'un enum sans recréer le type.
    op.execute("UPDATE inscriptions SET statut = 'en_attente' WHERE statut = 'soumis'")
    op.execute("ALTER TYPE inscription_statut_enum RENAME TO inscription_statut_enum_old")
    op.execute(
        "CREATE TYPE inscription_statut_enum AS ENUM ('brouillon', 'en_attente', 'validee', 'rejetee')"
    )
    op.execute(
        "ALTER TABLE inscriptions "
        "ALTER COLUMN statut TYPE inscription_statut_enum "
        "USING statut::text::inscription_statut_enum"
    )
    op.execute("DROP TYPE inscription_statut_enum_old")
