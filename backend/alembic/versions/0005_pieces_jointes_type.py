"""Migration v5 — typage des pièces jointes (photo / cin / autre) + statut OCR

Revision ID: 0005_pieces_jointes_type
Revises: 0004_inscription_snapshot
Create Date: 2026-05-03 19:00:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_pieces_jointes_type"
down_revision: Union[str, None] = "0004_inscription_snapshot"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ajout des nouvelles colonnes (toutes avec defaults pour les lignes existantes)
    op.add_column(
        "pieces_jointes",
        sa.Column("type_document", sa.String(length=20), nullable=False, server_default="autre"),
    )
    op.add_column(
        "pieces_jointes",
        sa.Column("mime_type", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "pieces_jointes",
        sa.Column("ocr_verified", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "pieces_jointes",
        sa.Column("ocr_message", sa.String(length=500), nullable=True),
    )

    # Index pour filtrage rapide par type
    op.create_index(
        "ix_pieces_jointes_inscription_type",
        "pieces_jointes",
        ["inscription_id", "type_document"],
    )


def downgrade() -> None:
    op.drop_index("ix_pieces_jointes_inscription_type", table_name="pieces_jointes")
    op.drop_column("pieces_jointes", "ocr_message")
    op.drop_column("pieces_jointes", "ocr_verified")
    op.drop_column("pieces_jointes", "mime_type")
    op.drop_column("pieces_jointes", "type_document")
