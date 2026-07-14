"""
Modèles SQLAlchemy — v3

Nouveautés :
  - PieceJointe  : fichiers PDF attachés à une inscription
  - Inscription  : statuts enrichis + pièces jointes
"""
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, DateTime, Enum as SAEnum, Float, ForeignKey,
    Index, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

# Codes de niveau "historiques" — purement informatif (suggérés à la création).
# La colonne accepte désormais N'IMPORTE QUEL code (doctorat, prepa, mastere_pro, ...)
# pour rester flexible.
NIVEAU_CODES = ("ingenieur", "master", "licence")
# Statuts d'une inscription :
#   brouillon  → en cours de saisie par l'étudiant (PJ uploadables, pas soumis)
#   soumis     → PREMIÈRE soumission, en attente de décision du responsable
#   en_attente → RE-soumission après rejet, en attente de nouvelle décision
#   validee    → acceptée
#   rejetee    → refusée (étudiant peut corriger et re-soumettre → en_attente)
INSCRIPTION_STATUTS = ("brouillon", "soumis", "en_attente", "validee", "rejetee")


class Niveau(Base):
    __tablename__ = "niveaux"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # VARCHAR libre (slug) — permet à la scolarité d'ajouter de nouveaux codes
    # (doctorat, prepa, mastere_pro, ...) sans migration enum.
    code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    libelle: Mapped[str] = mapped_column(String(100), nullable=False)
    libelle_ar: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    responsables: Mapped[list["UserResponsable"]] = relationship("UserResponsable", back_populates="niveau")
    etudiants: Mapped[list["Etudiant"]] = relationship("Etudiant", back_populates="niveau")


class UserResponsable(Base):
    __tablename__ = "users_responsables"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    prenom: Mapped[str] = mapped_column(String(100), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    niveau_id: Mapped[int] = mapped_column(Integer, ForeignKey("niveaux.id"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    niveau: Mapped["Niveau"] = relationship("Niveau", back_populates="responsables")


class UserScolarite(Base):
    __tablename__ = "users_scolarite"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    prenom: Mapped[str] = mapped_column(String(100), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class OtpVerification(Base):
    __tablename__ = "otp_verifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    mat_cin: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(10), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Etudiant(Base):
    __tablename__ = "etudiants"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    mat_cin: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    num_inscription: Mapped[str | None] = mapped_column(String(30), unique=True, nullable=True, index=True)
    nom_fr: Mapped[str] = mapped_column(String(100), nullable=False)
    prenom_fr: Mapped[str] = mapped_column(String(100), nullable=False)
    nom_ar: Mapped[str | None] = mapped_column(String(200), nullable=True)
    prenom_ar: Mapped[str | None] = mapped_column(String(200), nullable=True)
    sexe: Mapped[str | None] = mapped_column(String(20), nullable=True)
    situation_familiale: Mapped[str | None] = mapped_column(String(50), nullable=True)
    date_naissance: Mapped[str | None] = mapped_column(String(20), nullable=True)
    lieu_naiss_fr: Mapped[str | None] = mapped_column(String(150), nullable=True)
    lieu_naiss_ar: Mapped[str | None] = mapped_column(String(300), nullable=True)
    statut: Mapped[str | None] = mapped_column(String(50), nullable=True)
    code_gouvernorat: Mapped[str | None] = mapped_column(String(50), nullable=True)
    code_type_bac: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Baccalauréat details
    bac_annee: Mapped[str | None] = mapped_column(String(10), nullable=True, comment="Année du baccalauréat")
    bac_session: Mapped[str | None] = mapped_column(String(20), nullable=True, comment="Session du baccalauréat")
    bac_moyenne: Mapped[float | None] = mapped_column(Float, nullable=True, comment="Moyenne du baccalauréat")
    bac_mention: Mapped[str | None] = mapped_column(String(50), nullable=True, comment="Mention du baccalauréat")
    bac_section: Mapped[str | None] = mapped_column(String(100), nullable=True, comment="Section du baccalauréat")
    num_cnss: Mapped[str | None] = mapped_column(String(30), nullable=True)
    passeport: Mapped[str | None] = mapped_column(String(30), nullable=True)
    cfil: Mapped[str | None] = mapped_column(String(20), nullable=True)
    lib_filiere: Mapped[str | None] = mapped_column(String(300), nullable=True)
    lib_filiere_ar: Mapped[str | None] = mapped_column(String(300), nullable=True)
    niveau_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("niveaux.id"), nullable=True)
    niveau: Mapped["Niveau | None"] = relationship("Niveau", back_populates="etudiants")
    email: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    telephone_portable: Mapped[str | None] = mapped_column(String(20), nullable=True)
    telephone_fixe: Mapped[str | None] = mapped_column(String(20), nullable=True)
    adresse_fr: Mapped[str | None] = mapped_column(Text, nullable=True)
    adresse_ar: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Contact en cas de besoin
    contact_nom: Mapped[str | None] = mapped_column(String(100), nullable=True)
    contact_prenom: Mapped[str | None] = mapped_column(String(100), nullable=True)
    contact_affiliation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    contact_adresse: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_tel: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_inscription_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    notes: Mapped[list["Note"]] = relationship("Note", back_populates="etudiant", cascade="all, delete-orphan")
    inscriptions: Mapped[list["Inscription"]] = relationship("Inscription", back_populates="etudiant", cascade="all, delete-orphan")


class Note(Base):
    __tablename__ = "notes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    etudiant_id: Mapped[int] = mapped_column(Integer, ForeignKey("etudiants.id", ondelete="CASCADE"), nullable=False)
    matiere: Mapped[str] = mapped_column(String(150), nullable=False)
    note: Mapped[float] = mapped_column(Float, nullable=False)
    coefficient: Mapped[float] = mapped_column(Float, default=1.0)
    semestre: Mapped[str | None] = mapped_column(String(20), nullable=True)
    annee_universitaire: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    etudiant: Mapped["Etudiant"] = relationship("Etudiant", back_populates="notes")
    __table_args__ = (Index("ix_notes_etudiant_matiere", "etudiant_id", "matiere"),)


class Inscription(Base):
    """
    Statuts :
      brouillon   → dossier en cours de constitution par l'étudiant (PJ uploadables, pas encore soumis)
      en_attente  → soumise, en attente de décision du responsable
      validee     → acceptée → étudiant = INSCRIT
      rejetee     → refusée, étudiant doit corriger et resoumettre
    """
    __tablename__ = "inscriptions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    etudiant_id: Mapped[int] = mapped_column(Integer, ForeignKey("etudiants.id", ondelete="CASCADE"), nullable=False)
    annee_universitaire: Mapped[str] = mapped_column(String(20), nullable=False)
    cfil: Mapped[str | None] = mapped_column(String(20), nullable=True)
    lib_filiere: Mapped[str | None] = mapped_column(String(300), nullable=True)
    lib_filiere_ar: Mapped[str | None] = mapped_column(String(300), nullable=True)
    niveau_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("niveaux.id"), nullable=True)
    statut: Mapped[str] = mapped_column(
        SAEnum(*INSCRIPTION_STATUTS, name="inscription_statut_enum"),
        default="en_attente", nullable=False,
    )
    message_rejet: Mapped[str | None] = mapped_column(Text, nullable=True)
    traite_par_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users_responsables.id"), nullable=True)
    traite_le: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    date_inscription: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    observations: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Snapshot : données au moment de la soumission ─────────────────────────
    # Permet au responsable de voir ce que l'étudiant a soumis exactement
    snap_nom_fr:          Mapped[str | None] = mapped_column(String(100), nullable=True)
    snap_prenom_fr:       Mapped[str | None] = mapped_column(String(100), nullable=True)
    snap_nom_ar:          Mapped[str | None] = mapped_column(String(200), nullable=True)
    snap_prenom_ar:       Mapped[str | None] = mapped_column(String(200), nullable=True)
    snap_date_naissance:  Mapped[str | None] = mapped_column(String(20),  nullable=True)
    snap_lieu_naiss_fr:   Mapped[str | None] = mapped_column(String(150), nullable=True)

    # ── Données d'origine (importées SALIMA) — référence pour comparaison ─────
    orig_nom_fr:          Mapped[str | None] = mapped_column(String(100), nullable=True)
    orig_prenom_fr:       Mapped[str | None] = mapped_column(String(100), nullable=True)
    orig_nom_ar:          Mapped[str | None] = mapped_column(String(200), nullable=True)
    orig_prenom_ar:       Mapped[str | None] = mapped_column(String(200), nullable=True)
    orig_date_naissance:  Mapped[str | None] = mapped_column(String(20),  nullable=True)

    # ── Modifications proposées par l'étudiant (en attente de validation) ─────
    # Dictionnaire {champ: nouvelle_valeur} contenant toutes les modifications
    # souhaitées par l'étudiant. Les valeurs ne sont JAMAIS appliquées sur le
    # modèle Etudiant tant que le responsable n'a pas validé l'inscription.
    # Validation → fusion dans Etudiant + clear. Rejet/reset → simplement ignoré.
    proposed_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=dict)

    etudiant: Mapped["Etudiant"] = relationship("Etudiant", back_populates="inscriptions")
    niveau: Mapped["Niveau | None"] = relationship("Niveau")
    traite_par: Mapped["UserResponsable | None"] = relationship("UserResponsable")
    pieces_jointes: Mapped[list["PieceJointe"]] = relationship(
        "PieceJointe", back_populates="inscription", cascade="all, delete-orphan"
    )

    __table_args__ = (UniqueConstraint("etudiant_id", "annee_universitaire", name="uq_inscription_annee"),)


class PieceJointe(Base):
    """
    Pièce jointe (image ou PDF) liée à une inscription.

    Trois types possibles (`type_document`) :
      - `photo` : photo d'identité de l'étudiant (image)
      - `cin`   : scan / photo de la carte d'identité nationale (image)
      - `autre` : autre document (PDF — relevé, diplôme, etc.)

    Contrainte applicative : au plus UN `photo` et UN `cin` par inscription.
    Stocké dans uploads/pieces_jointes/{filename}
    """
    __tablename__ = "pieces_jointes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    inscription_id: Mapped[int] = mapped_column(Integer, ForeignKey("inscriptions.id", ondelete="CASCADE"), nullable=False)
    type_document: Mapped[str] = mapped_column(String(20), nullable=False, server_default="autre",
                                               comment="Type : photo | cin | autre")
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    nom_fichier: Mapped[str] = mapped_column(String(255), nullable=False, comment="Nom original du fichier")
    chemin: Mapped[str] = mapped_column(String(500), nullable=False, comment="Chemin relatif sur disque")
    taille_octets: Mapped[int] = mapped_column(Integer, nullable=False)
    ocr_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false",
                                               comment="True si OCR a confirmé la cohérence (CIN uniquement)")
    ocr_message: Mapped[str | None] = mapped_column(String(500), nullable=True,
                                                    comment="Message diagnostic OCR (CIN)")
    statut: Mapped[str] = mapped_column(String(20), nullable=False, server_default="en_attente",
                                        comment="Statut : en_attente | acceptee | refusee")
    motif_refus: Mapped[str | None] = mapped_column(Text, nullable=True,
                                                    comment="Motif de refus communique a l'etudiant")
    refused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    inscription: Mapped["Inscription"] = relationship("Inscription", back_populates="pieces_jointes")


# ── RBAC : Rôles et Permissions ────────────────────────────────────────────────

class Role(Base):
    """Rôle utilisateur (ex: etudiant, scolarite, responsable)"""
    __tablename__ = "roles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    permissions: Mapped[list["Permission"]] = relationship(
        "Permission", secondary="role_permissions", back_populates="roles"
    )


class Permission(Base):
    """Permission (ex: etudiant:read, inscription:create, note:update)"""
    __tablename__ = "permissions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(200), nullable=True)
    resource: Mapped[str] = mapped_column(String(50), nullable=False, index=True, comment="Ressource : etudiant, inscription, note, etc.")
    action: Mapped[str] = mapped_column(String(50), nullable=False, comment="Action : create, read, update, delete")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    roles: Mapped[list["Role"]] = relationship(
        "Role", secondary="role_permissions", back_populates="permissions"
    )


class RolePermission(Base):
    """Table de liaison Role-Permission (many-to-many)"""
    __tablename__ = "role_permissions"
    role_id: Mapped[int] = mapped_column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    permission_id: Mapped[int] = mapped_column(Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class UserRole(Base):
    """Table de liaison User-Role (many-to-many)"""
    __tablename__ = "user_roles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_type: Mapped[str] = mapped_column(String(20), nullable=False, comment="etudiant, scolarite, responsable")
    user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    role_id: Mapped[int] = mapped_column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    __table_args__ = (
        Index("ix_user_roles_user", "user_type", "user_id"),
        UniqueConstraint("user_type", "user_id", "role_id", name="uq_user_role"),
    )
