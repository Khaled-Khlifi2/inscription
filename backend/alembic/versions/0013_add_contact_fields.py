"""Add contact fields to etudiants table

Revision ID: 0013
Revises: 0012
Create Date: 2026-06-27
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add contact fields to etudiants table
    op.add_column('etudiants', sa.Column('contact_nom', sa.String(100), nullable=True))
    op.add_column('etudiants', sa.Column('contact_prenom', sa.String(100), nullable=True))
    op.add_column('etudiants', sa.Column('contact_affiliation', sa.String(100), nullable=True))
    op.add_column('etudiants', sa.Column('contact_adresse', sa.Text(), nullable=True))
    op.add_column('etudiants', sa.Column('contact_tel', sa.String(20), nullable=True))


def downgrade() -> None:
    # Remove contact fields from etudiants table
    op.drop_column('etudiants', 'contact_tel')
    op.drop_column('etudiants', 'contact_adresse')
    op.drop_column('etudiants', 'contact_affiliation')
    op.drop_column('etudiants', 'contact_prenom')
    op.drop_column('etudiants', 'contact_nom')
