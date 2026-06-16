"""Migration v3 — table pieces_jointes

Revision ID: 0003_pieces_jointes
Revises: 0002_v2
Create Date: 2025-01-01 00:02:00
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0003_pieces_jointes"
down_revision: Union[str, None] = "0002_v2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pieces_jointes",
        sa.Column("id",             sa.Integer(),   primary_key=True),
        sa.Column("inscription_id", sa.Integer(),
                  sa.ForeignKey("inscriptions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("nom_fichier",    sa.String(255), nullable=False),
        sa.Column("chemin",         sa.String(500), nullable=False),
        sa.Column("taille_octets",  sa.Integer(),   nullable=False),
        sa.Column("uploaded_at",    sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_pieces_jointes_id",             "pieces_jointes", ["id"])
    op.create_index("ix_pieces_jointes_inscription_id", "pieces_jointes", ["inscription_id"])


def downgrade() -> None:
    op.drop_table("pieces_jointes")
