"""Migration v6 — ajout du statut 'brouillon' pour les inscriptions

Permet de distinguer un dossier en cours de constitution (PJ uploadées
avant soumission) d'un dossier réellement soumis (en_attente).

Revision ID: 0006_brouillon_status
Revises: 0005_pieces_jointes_type
Create Date: 2026-05-16 10:30:00
"""
from typing import Union

from alembic import op

revision: str = "0006_brouillon_status"
down_revision: Union[str, None] = "0005_pieces_jointes_type"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL exige ALTER TYPE pour étendre un enum.
    # IF NOT EXISTS protège contre une ré-exécution accidentelle.
    op.execute(
        "ALTER TYPE inscription_statut_enum ADD VALUE IF NOT EXISTS 'brouillon'"
    )


def downgrade() -> None:
    # PostgreSQL ne permet pas de retirer une valeur d'un enum sans recréer le type.
    # On le fait proprement : renommer l'ancien type, créer un nouveau sans 'brouillon',
    # convertir les valeurs 'brouillon' restantes en 'en_attente', puis supprimer
    # l'ancien type.
    op.execute("UPDATE inscriptions SET statut = 'en_attente' WHERE statut = 'brouillon'")
    op.execute("ALTER TYPE inscription_statut_enum RENAME TO inscription_statut_enum_old")
    op.execute(
        "CREATE TYPE inscription_statut_enum AS ENUM ('en_attente', 'validee', 'rejetee')"
    )
    op.execute(
        "ALTER TABLE inscriptions "
        "ALTER COLUMN statut TYPE inscription_statut_enum "
        "USING statut::text::inscription_statut_enum"
    )
    op.execute("DROP TYPE inscription_statut_enum_old")
