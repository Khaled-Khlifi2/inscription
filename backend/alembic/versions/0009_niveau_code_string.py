"""Convert niveau.code from enum to free VARCHAR (flexibility)

Revision ID: 0009_niveau_code_string
Revises: 0008_soumis_status
Create Date: 2026-05-16

But: permettre à la scolarité de créer des niveaux libres (doctorat,
prépa, mastère pro, etc.) sans avoir à modifier l'enum PostgreSQL.
"""
from alembic import op


revision = "0009_niveau_code_string"
down_revision = "0008_soumis_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Convertir la colonne en VARCHAR
    op.execute("ALTER TABLE niveaux ALTER COLUMN code TYPE VARCHAR(40) USING code::text")
    # 2. Supprimer l'ancien type enum (il n'est plus référencé)
    op.execute("DROP TYPE IF EXISTS niveau_code_enum")


def downgrade() -> None:
    # Re-créer l'enum avec les valeurs historiques + valeurs existantes en base.
    # Si des valeurs hors-enum existent, elles bloqueront le downgrade : c'est voulu.
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE niveau_code_enum AS ENUM ('ingenieur','master','licence');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)
    op.execute(
        "ALTER TABLE niveaux ALTER COLUMN code TYPE niveau_code_enum "
        "USING code::niveau_code_enum"
    )
