"""inscription snapshot fields — données sensibles au moment de la soumission

Revision ID: 0004_inscription_snapshot
Revises: 0003_pieces_jointes
Create Date: 2025-01-01 00:00:00
"""
from typing import Union
import sqlalchemy as sa
from alembic import op

revision: str = "0004_inscription_snapshot"
down_revision: Union[str, None] = "0003_pieces_jointes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Snapshot des données sensibles au moment de la soumission
    # Permet de détecter si l'étudiant a modifié ces champs vs la base initiale
    op.add_column("inscriptions", sa.Column("snap_nom_fr",         sa.String(100), nullable=True))
    op.add_column("inscriptions", sa.Column("snap_prenom_fr",      sa.String(100), nullable=True))
    op.add_column("inscriptions", sa.Column("snap_nom_ar",         sa.String(200), nullable=True))
    op.add_column("inscriptions", sa.Column("snap_prenom_ar",      sa.String(200), nullable=True))
    op.add_column("inscriptions", sa.Column("snap_date_naissance",  sa.String(20),  nullable=True))
    op.add_column("inscriptions", sa.Column("snap_lieu_naiss_fr",   sa.String(150), nullable=True))
    # Données d'origine (importées de SALIMA) — pour comparaison
    op.add_column("inscriptions", sa.Column("orig_nom_fr",          sa.String(100), nullable=True))
    op.add_column("inscriptions", sa.Column("orig_prenom_fr",       sa.String(100), nullable=True))
    op.add_column("inscriptions", sa.Column("orig_nom_ar",          sa.String(200), nullable=True))
    op.add_column("inscriptions", sa.Column("orig_prenom_ar",       sa.String(200), nullable=True))
    op.add_column("inscriptions", sa.Column("orig_date_naissance",  sa.String(20),  nullable=True))


def downgrade() -> None:
    for col in [
        "snap_nom_fr", "snap_prenom_fr", "snap_nom_ar", "snap_prenom_ar",
        "snap_date_naissance", "snap_lieu_naiss_fr",
        "orig_nom_fr", "orig_prenom_fr", "orig_nom_ar", "orig_prenom_ar",
        "orig_date_naissance",
    ]:
        op.drop_column("inscriptions", col)
