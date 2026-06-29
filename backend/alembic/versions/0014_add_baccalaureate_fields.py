"""Add baccalaureate fields to etudiants table

Revision ID: 0014
Revises: 0013
Create Date: 2026-06-27
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add baccalaureate fields to etudiants table
    op.add_column('etudiants', sa.Column('bac_annee', sa.String(10), nullable=True, comment="Année du baccalauréat (ex: 2024)"))
    op.add_column('etudiants', sa.Column('bac_session', sa.String(20), nullable=True, comment="Session du baccalauréat (principale/contrôle)"))
    op.add_column('etudiants', sa.Column('bac_moyenne', sa.Float(), nullable=True, comment="Moyenne du baccalauréat"))
    op.add_column('etudiants', sa.Column('bac_mention', sa.String(50), nullable=True, comment="Mention du baccalauréat"))
    op.add_column('etudiants', sa.Column('bac_section', sa.String(100), nullable=True, comment="Section du baccalauréat"))


def downgrade() -> None:
    # Remove baccalaureate fields from etudiants table
    op.drop_column('etudiants', 'bac_section')
    op.drop_column('etudiants', 'bac_mention')
    op.drop_column('etudiants', 'bac_moyenne')
    op.drop_column('etudiants', 'bac_session')
    op.drop_column('etudiants', 'bac_annee')
