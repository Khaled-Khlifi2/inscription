"""Widen short VARCHAR columns on etudiants

Revision ID: 0010_widen_short_columns
Revises: 0009_niveau_code_string
Create Date: 2026-05-18

But: certaines colonnes étaient dimensionnées pour des codes courts (5-10 car.)
mais reçoivent en pratique des libellés saisis par les utilisateurs (ex.
situation_familiale = "Divorcé(e)"). On élargit prudemment pour éviter
les StringDataRightTruncationError.
"""
from alembic import op


revision = "0010_widen_short_columns"
down_revision = "0009_niveau_code_string"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # situation_familiale : "Célibataire", "Divorcé(e)", "Veuf/Veuve" → 50 OK.
    op.execute("ALTER TABLE etudiants ALTER COLUMN situation_familiale TYPE VARCHAR(50)")
    # statut civil : libellés libres saisis par la scolarité.
    op.execute("ALTER TABLE etudiants ALTER COLUMN statut TYPE VARCHAR(50)")
    # codes administratifs (gouvernorat, type bac) : on garde de la marge pour
    # accueillir aussi bien un code court (« 11 », « S ») qu'un libellé.
    op.execute("ALTER TABLE etudiants ALTER COLUMN code_gouvernorat TYPE VARCHAR(50)")
    op.execute("ALTER TABLE etudiants ALTER COLUMN code_type_bac    TYPE VARCHAR(50)")
    # sexe : on tolère "Masculin"/"Féminin" en plus de M/F.
    op.execute("ALTER TABLE etudiants ALTER COLUMN sexe TYPE VARCHAR(20)")


def downgrade() -> None:
    # Re-réduire : risque de troncature si des données dépassent.
    op.execute("ALTER TABLE etudiants ALTER COLUMN sexe                TYPE VARCHAR(10) USING substring(sexe                FROM 1 FOR 10)")
    op.execute("ALTER TABLE etudiants ALTER COLUMN code_type_bac       TYPE VARCHAR(10) USING substring(code_type_bac       FROM 1 FOR 10)")
    op.execute("ALTER TABLE etudiants ALTER COLUMN code_gouvernorat    TYPE VARCHAR(10) USING substring(code_gouvernorat    FROM 1 FOR 10)")
    op.execute("ALTER TABLE etudiants ALTER COLUMN statut              TYPE VARCHAR(5)  USING substring(statut              FROM 1 FOR 5)")
    op.execute("ALTER TABLE etudiants ALTER COLUMN situation_familiale TYPE VARCHAR(5)  USING substring(situation_familiale FROM 1 FOR 5)")
