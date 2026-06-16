"""Migration v7 — ajout de la colonne `proposed_data` sur inscriptions

Stocke les modifications proposées par l'étudiant (JSON {champ: nouvelle_valeur})
en attente de validation par le responsable. Tant que la décision n'est pas
prise, les données de l'Etudiant restent figées sur celles de SALIMA.

Revision ID: 0007_inscription_proposed_data
Revises: 0006_brouillon_status
Create Date: 2026-05-16 22:50:00
"""
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0007_inscription_proposed_data"
down_revision: Union[str, None] = "0006_brouillon_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "inscriptions",
        sa.Column("proposed_data", JSONB, nullable=True, server_default=sa.text("'{}'::jsonb")),
    )


def downgrade() -> None:
    op.drop_column("inscriptions", "proposed_data")
