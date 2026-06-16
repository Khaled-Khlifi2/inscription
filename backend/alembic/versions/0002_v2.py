"""Migration v2 — niveaux, responsables, OTP, nouveaux champs

Revision ID: 0002_v2
Revises: 0001_initial
Create Date: 2025-01-01 00:01:00

IMPORTANT : Cette migration est entièrement écrite en SQL brut (op.execute)
pour garantir l'idempotence avec asyncpg. On n'utilise PAS op.create_table
avec des colonnes Enum car SQLAlchemy tente de recréer le type même avec
create_type=False dans certaines versions.
"""
from typing import Sequence, Union
from alembic import op

revision: str = "0002_v2"
down_revision: Union[str, None] = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Types ENUM (IF NOT EXISTS via PL/pgSQL) ─────────────────────────────
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE niveau_code_enum AS ENUM ('ingenieur','master','licence');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE inscription_statut_enum AS ENUM ('en_attente','validee','rejetee');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    # ── 2. Table niveaux ───────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS niveaux (
            id         SERIAL PRIMARY KEY,
            code       niveau_code_enum NOT NULL UNIQUE,
            libelle    VARCHAR(100) NOT NULL,
            libelle_ar VARCHAR(200),
            is_active  BOOLEAN NOT NULL DEFAULT TRUE
        );
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_niveaux_id ON niveaux (id);
    """)

    # ── 3. Table users_responsables ────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS users_responsables (
            id              SERIAL PRIMARY KEY,
            email           VARCHAR(200) NOT NULL,
            nom             VARCHAR(100) NOT NULL,
            prenom          VARCHAR(100) NOT NULL,
            hashed_password VARCHAR(255) NOT NULL,
            niveau_id       INTEGER NOT NULL REFERENCES niveaux(id),
            is_active       BOOLEAN NOT NULL DEFAULT TRUE,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_users_responsables_id ON users_responsables (id);
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ix_users_responsables_email ON users_responsables (email);
    """)

    # ── 4. Table otp_verifications ─────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS otp_verifications (
            id         SERIAL PRIMARY KEY,
            mat_cin    VARCHAR(20)  NOT NULL,
            email      VARCHAR(200) NOT NULL,
            code       VARCHAR(10)  NOT NULL,
            expires_at TIMESTAMPTZ  NOT NULL,
            is_used    BOOLEAN      NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
        );
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_otp_id      ON otp_verifications (id);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_otp_mat_cin ON otp_verifications (mat_cin);
    """)

    # ── 5. Nouveaux champs sur etudiants ───────────────────────────────────────
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE etudiants ADD COLUMN niveau_id INTEGER REFERENCES niveaux(id);
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE etudiants ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE etudiants ADD COLUMN email_verified_at TIMESTAMPTZ;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """)

    # ── 6. Nouveaux champs sur inscriptions ────────────────────────────────────
    # Remplacer la colonne statut VARCHAR par l'enum (si elle est encore VARCHAR)
    op.execute("""
        DO $$
        DECLARE col_type TEXT;
        BEGIN
            SELECT data_type INTO col_type
            FROM information_schema.columns
            WHERE table_name = 'inscriptions' AND column_name = 'statut';

            IF col_type = 'character varying' OR col_type = 'character' THEN
                ALTER TABLE inscriptions DROP COLUMN statut;
                ALTER TABLE inscriptions
                    ADD COLUMN statut inscription_statut_enum NOT NULL DEFAULT 'en_attente';
            END IF;
        END $$;
    """)
    # Si la colonne statut n'existe pas du tout, la créer
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE inscriptions
                ADD COLUMN statut inscription_statut_enum NOT NULL DEFAULT 'en_attente';
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE inscriptions ADD COLUMN niveau_id INTEGER REFERENCES niveaux(id);
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE inscriptions ADD COLUMN message_rejet TEXT;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE inscriptions
                ADD COLUMN traite_par_id INTEGER REFERENCES users_responsables(id);
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE inscriptions ADD COLUMN traite_le TIMESTAMPTZ;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE inscriptions DROP COLUMN IF EXISTS traite_le")
    op.execute("ALTER TABLE inscriptions DROP COLUMN IF EXISTS traite_par_id")
    op.execute("ALTER TABLE inscriptions DROP COLUMN IF EXISTS message_rejet")
    op.execute("ALTER TABLE inscriptions DROP COLUMN IF EXISTS niveau_id")
    op.execute("ALTER TABLE inscriptions DROP COLUMN IF EXISTS statut")
    op.execute("""
        ALTER TABLE inscriptions
            ADD COLUMN IF NOT EXISTS statut VARCHAR(30) NOT NULL DEFAULT 'inscrit'
    """)
    op.execute("ALTER TABLE etudiants DROP COLUMN IF EXISTS email_verified_at")
    op.execute("ALTER TABLE etudiants DROP COLUMN IF EXISTS email_verified")
    op.execute("ALTER TABLE etudiants DROP COLUMN IF EXISTS niveau_id")
    op.execute("DROP TABLE IF EXISTS otp_verifications")
    op.execute("DROP TABLE IF EXISTS users_responsables")
    op.execute("DROP TABLE IF EXISTS niveaux")
    op.execute("DROP TYPE IF EXISTS inscription_statut_enum")
    op.execute("DROP TYPE IF EXISTS niveau_code_enum")
