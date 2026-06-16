"""Initial migration — création de toutes les tables

Revision ID: 0001_initial
Revises:
Create Date: 2025-01-01 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── etudiants ──────────────────────────────────────────────────────────────
    op.create_table(
        "etudiants",
        sa.Column("id",                   sa.Integer(),     primary_key=True),
        sa.Column("mat_cin",              sa.String(20),    nullable=False),
        sa.Column("num_inscription",      sa.String(30),    nullable=True),
        sa.Column("nom_fr",               sa.String(100),   nullable=False),
        sa.Column("prenom_fr",            sa.String(100),   nullable=False),
        sa.Column("nom_ar",               sa.String(200),   nullable=True),
        sa.Column("prenom_ar",            sa.String(200),   nullable=True),
        sa.Column("sexe",                 sa.String(10),    nullable=True),
        sa.Column("situation_familiale",  sa.String(5),     nullable=True),
        sa.Column("date_naissance",       sa.String(20),    nullable=True),
        sa.Column("lieu_naiss_fr",        sa.String(150),   nullable=True),
        sa.Column("lieu_naiss_ar",        sa.String(300),   nullable=True),
        sa.Column("statut",               sa.String(5),     nullable=True),
        sa.Column("code_gouvernorat",     sa.String(10),    nullable=True),
        sa.Column("code_type_bac",        sa.String(10),    nullable=True),
        sa.Column("num_cnss",             sa.String(30),    nullable=True),
        sa.Column("passeport",            sa.String(30),    nullable=True),
        sa.Column("cfil",                 sa.String(20),    nullable=True),
        sa.Column("lib_filiere",          sa.String(300),   nullable=True),
        sa.Column("lib_filiere_ar",       sa.String(300),   nullable=True),
        # Champs étudiant
        sa.Column("email",                sa.String(200),   nullable=True),
        sa.Column("telephone_portable",   sa.String(20),    nullable=True),
        sa.Column("telephone_fixe",       sa.String(20),    nullable=True),
        sa.Column("adresse_fr",           sa.Text(),        nullable=True),
        sa.Column("adresse_ar",           sa.Text(),        nullable=True),
        # Inscription
        sa.Column("is_inscription_complete", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("completed_at",         sa.DateTime(timezone=True), nullable=True),
        # Auth
        sa.Column("hashed_password",      sa.String(255),   nullable=False),
        sa.Column("is_active",            sa.Boolean(),     nullable=False, server_default="true"),
        # Timestamps
        sa.Column("created_at",           sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at",           sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_etudiants_id",             "etudiants", ["id"])
    op.create_index("ix_etudiants_mat_cin",        "etudiants", ["mat_cin"], unique=True)
    op.create_index("ix_etudiants_num_inscription","etudiants", ["num_inscription"], unique=True)
    op.create_index("ix_etudiants_email",          "etudiants", ["email"])

    # ── users_scolarite ────────────────────────────────────────────────────────
    op.create_table(
        "users_scolarite",
        sa.Column("id",              sa.Integer(),    primary_key=True),
        sa.Column("email",           sa.String(200),  nullable=False),
        sa.Column("nom",             sa.String(100),  nullable=False),
        sa.Column("prenom",          sa.String(100),  nullable=False),
        sa.Column("hashed_password", sa.String(255),  nullable=False),
        sa.Column("is_active",       sa.Boolean(),    nullable=False, server_default="true"),
        sa.Column("created_at",      sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_users_scolarite_id",    "users_scolarite", ["id"])
    op.create_index("ix_users_scolarite_email", "users_scolarite", ["email"], unique=True)

    # ── notes ──────────────────────────────────────────────────────────────────
    op.create_table(
        "notes",
        sa.Column("id",                  sa.Integer(), primary_key=True),
        sa.Column("etudiant_id",         sa.Integer(), sa.ForeignKey("etudiants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("matiere",             sa.String(150), nullable=False),
        sa.Column("note",                sa.Float(),   nullable=False),
        sa.Column("coefficient",         sa.Float(),   nullable=False, server_default="1.0"),
        sa.Column("semestre",            sa.String(20),  nullable=True),
        sa.Column("annee_universitaire", sa.String(20),  nullable=True),
        sa.Column("created_at",          sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_notes_id",               "notes", ["id"])
    op.create_index("ix_notes_etudiant_matiere", "notes", ["etudiant_id", "matiere"])

    # ── inscriptions ───────────────────────────────────────────────────────────
    op.create_table(
        "inscriptions",
        sa.Column("id",                  sa.Integer(), primary_key=True),
        sa.Column("etudiant_id",         sa.Integer(), sa.ForeignKey("etudiants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("annee_universitaire", sa.String(20), nullable=False),
        sa.Column("cfil",                sa.String(20), nullable=True),
        sa.Column("lib_filiere",         sa.String(300), nullable=True),
        sa.Column("lib_filiere_ar",      sa.String(300), nullable=True),
        sa.Column("date_inscription",    sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("statut",              sa.String(30), nullable=False, server_default="inscrit"),
        sa.Column("observations",        sa.Text(),     nullable=True),
        sa.UniqueConstraint("etudiant_id", "annee_universitaire", name="uq_inscription_annee"),
    )
    op.create_index("ix_inscriptions_id", "inscriptions", ["id"])


def downgrade() -> None:
    op.drop_table("inscriptions")
    op.drop_table("notes")
    op.drop_table("users_scolarite")
    op.drop_table("etudiants")
