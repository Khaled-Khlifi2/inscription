"""Add rejection fields to pieces_jointes

Revision ID: 0015
Revises: 0014
Create Date: 2026-07-06
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "pieces_jointes",
        sa.Column("statut", sa.String(20), nullable=False, server_default="en_attente"),
    )
    op.add_column("pieces_jointes", sa.Column("motif_refus", sa.Text(), nullable=True))
    op.add_column("pieces_jointes", sa.Column("refused_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("pieces_jointes", "refused_at")
    op.drop_column("pieces_jointes", "motif_refus")
    op.drop_column("pieces_jointes", "statut")
