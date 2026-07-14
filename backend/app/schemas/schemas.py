from datetime import datetime
from typing import List, Optional
import re
from pydantic import BaseModel, field_validator


# ── Auth ───────────────────────────────────────────────────────────────────────
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    expires_in: int


class LoginDirectResponse(BaseModel):
    """Réponse quand l'email est déjà vérifié → connexion directe sans OTP."""
    require_otp: bool = False
    access_token: str
    token_type: str = "bearer"
    role: str
    expires_in: int
    is_first_login: bool = False


class OtpRequiredResponse(BaseModel):
    """Réponse quand OTP est nécessaire."""
    require_otp: bool = True
    message: str


class OtpVerifyResponse(BaseModel):
    """Réponse après vérification OTP réussie."""
    access_token: str
    token_type: str = "bearer"
    role: str
    expires_in: int
    is_first_login: bool  # True → rediriger vers /etudiant/inscription


class EtudiantLoginRequest(BaseModel):
    identifier: str  # CIN ou passeport
    email: str
    nom_fr: str = ""
    prenom_fr: str = ""


class EtudiantOtpVerifyRequest(BaseModel):
    identifier: str  # CIN ou passeport
    email: str
    code: str


class LoginRequest(BaseModel):
    email: str
    password: str


# ── Email change (depuis formulaire inscription) ──────────────────────────────
class EmailChangeRequest(BaseModel):
    nouvel_email: str

    @field_validator("nouvel_email")
    @classmethod
    def check(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Adresse email invalide")
        return v


class EmailChangeConfirm(BaseModel):
    nouvel_email: str
    code: str


# ── Niveau ─────────────────────────────────────────────────────────────────────
class NiveauRead(BaseModel):
    id: int
    code: str
    libelle: str
    libelle_ar: Optional[str]
    is_active: bool
    model_config = {"from_attributes": True}


class NiveauCreate(BaseModel):
    code: str
    libelle: str
    libelle_ar: Optional[str] = None


# ── Responsable ────────────────────────────────────────────────────────────────
class ResponsableCreate(BaseModel):
    email: str
    nom: str
    prenom: str
    password: str
    niveau_id: int


class ResponsableRead(BaseModel):
    id: int
    email: str
    nom: str
    prenom: str
    niveau_id: int
    niveau: Optional[NiveauRead]
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Note ───────────────────────────────────────────────────────────────────────
class NoteRead(BaseModel):
    id: int
    etudiant_id: int
    matiere: str
    note: float
    coefficient: float
    semestre: Optional[str]
    annee_universitaire: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Pièce jointe ───────────────────────────────────────────────────────────────
class PieceJointeRead(BaseModel):
    id: int
    type_document: str = "autre"   # "photo" | "cin" | "autre"
    mime_type: Optional[str] = None
    nom_fichier: str
    taille_octets: int
    ocr_verified: bool = False
    ocr_message: Optional[str] = None
    statut: str = "en_attente"
    motif_refus: Optional[str] = None
    refused_at: Optional[datetime] = None
    uploaded_at: datetime
    model_config = {"from_attributes": True}


class PieceJointeReject(BaseModel):
    motif_refus: str

    @field_validator("motif_refus")
    @classmethod
    def check_motif(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Le motif de refus est obligatoire")
        return v


# ── Inscription ────────────────────────────────────────────────────────────────
class InscriptionRead(BaseModel):
    id: int
    annee_universitaire: str
    cfil: Optional[str]
    lib_filiere: Optional[str]
    lib_filiere_ar: Optional[str]
    niveau_id: Optional[int]
    statut: str
    message_rejet: Optional[str]
    date_inscription: datetime
    traite_le: Optional[datetime]
    observations: Optional[str]
    pieces_jointes: List[PieceJointeRead] = []
    # Snapshot au moment de la soumission
    snap_nom_fr:          Optional[str] = None
    snap_prenom_fr:       Optional[str] = None
    snap_nom_ar:          Optional[str] = None
    snap_prenom_ar:       Optional[str] = None
    snap_date_naissance:  Optional[str] = None
    snap_lieu_naiss_fr:   Optional[str] = None
    # Données d'origine SALIMA (avant modification étudiant)
    orig_nom_fr:          Optional[str] = None
    orig_prenom_fr:       Optional[str] = None
    orig_nom_ar:          Optional[str] = None
    orig_prenom_ar:       Optional[str] = None
    orig_date_naissance:  Optional[str] = None
    # Modifications proposées par l'étudiant en attente de validation
    # (dict {champ: nouvelle_valeur}). Vide = pas de modifications proposées.
    proposed_data:        Optional[dict] = None
    model_config = {"from_attributes": True}


class InscriptionDecision(BaseModel):
    decision: str
    message_rejet: Optional[str] = None

    @field_validator("decision")
    @classmethod
    def check(cls, v: str) -> str:
        if v not in ("valider", "rejeter"):
            raise ValueError("decision doit etre 'valider' ou 'rejeter'")
        return v


# ── Étudiant ───────────────────────────────────────────────────────────────────
class EtudiantBase(BaseModel):
    mat_cin: str
    num_inscription: Optional[str] = None
    nom_fr: str
    prenom_fr: str
    nom_ar: Optional[str] = None
    prenom_ar: Optional[str] = None
    sexe: Optional[str] = None
    situation_familiale: Optional[str] = None
    date_naissance: Optional[str] = None
    lieu_naiss_fr: Optional[str] = None
    lieu_naiss_ar: Optional[str] = None
    statut: Optional[str] = None
    code_gouvernorat: Optional[str] = None
    code_type_bac: Optional[str] = None
    # Baccalauréat details
    bac_annee: Optional[str] = None
    bac_session: Optional[str] = None
    bac_moyenne: Optional[float] = None
    bac_mention: Optional[str] = None
    bac_section: Optional[str] = None
    num_cnss: Optional[str] = None
    passeport: Optional[str] = None
    cfil: Optional[str] = None
    lib_filiere: Optional[str] = None
    lib_filiere_ar: Optional[str] = None
    niveau_id: Optional[int] = None

    @field_validator("mat_cin")
    @classmethod
    def cin_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("MAT_CIN ne peut pas etre vide")
        return v.upper()

    @field_validator("nom_ar", "prenom_ar", "lieu_naiss_ar", "lib_filiere_ar")
    @classmethod
    def validate_arabic(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v.strip() == "":
            return v
        # Vérifie que le champ contient principalement des caractères arabes
        # Permet aussi les espaces, chiffres, et ponctuation arabe
        arabic_pattern = re.compile(r'^[\u0600-\u06FF\s0-9.,\-]+$')
        if not arabic_pattern.match(v):
            raise ValueError("Ce champ ne doit contenir que des caractères arabes")
        return v


class EtudiantCreate(EtudiantBase):
    pass


class EtudiantUpdate(BaseModel):
    nom_fr: Optional[str] = None
    prenom_fr: Optional[str] = None
    nom_ar: Optional[str] = None
    prenom_ar: Optional[str] = None
    sexe: Optional[str] = None
    situation_familiale: Optional[str] = None
    date_naissance: Optional[str] = None
    lieu_naiss_fr: Optional[str] = None
    lieu_naiss_ar: Optional[str] = None
    statut: Optional[str] = None
    code_gouvernorat: Optional[str] = None
    code_type_bac: Optional[str] = None
    # Baccalauréat details
    bac_annee: Optional[str] = None
    bac_session: Optional[str] = None
    bac_moyenne: Optional[float] = None
    bac_mention: Optional[str] = None
    bac_section: Optional[str] = None
    num_cnss: Optional[str] = None
    passeport: Optional[str] = None
    telephone_portable: Optional[str] = None
    telephone_fixe: Optional[str] = None
    adresse_fr: Optional[str] = None
    adresse_ar: Optional[str] = None
    # Contact en cas de besoin
    contact_nom: Optional[str] = None
    contact_prenom: Optional[str] = None
    contact_affiliation: Optional[str] = None
    contact_adresse: Optional[str] = None
    contact_tel: Optional[str] = None
    niveau_id: Optional[int] = None

    @field_validator("nom_ar", "prenom_ar", "lieu_naiss_ar", "adresse_ar")
    @classmethod
    def validate_arabic(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v.strip() == "":
            return v
        arabic_pattern = re.compile(r'^[\u0600-\u06FF\s0-9.,\-]+$')
        if not arabic_pattern.match(v):
            raise ValueError("Ce champ ne doit contenir que des caractères arabes")
        return v


class EtudiantSelfComplete(BaseModel):
    situation_familiale: Optional[str] = None
    code_gouvernorat: Optional[str] = None
    code_type_bac: Optional[str] = None
    # Baccalauréat details
    bac_annee: Optional[str] = None
    bac_session: Optional[str] = None
    bac_moyenne: Optional[float] = None
    bac_mention: Optional[str] = None
    bac_section: Optional[str] = None
    num_cnss: Optional[str] = None
    telephone_portable: Optional[str] = None
    telephone_fixe: Optional[str] = None
    adresse_fr: Optional[str] = None
    adresse_ar: Optional[str] = None
    # Contact en cas de besoin
    contact_nom: Optional[str] = None
    contact_prenom: Optional[str] = None
    contact_affiliation: Optional[str] = None
    contact_adresse: Optional[str] = None
    contact_tel: Optional[str] = None


class EtudiantSubmitInscription(EtudiantSelfComplete):
    telephone_portable: str
    nom_fr: Optional[str] = None
    prenom_fr: Optional[str] = None
    nom_ar: Optional[str] = None
    prenom_ar: Optional[str] = None
    telephone_fixe: Optional[str] = None
    adresse_fr: Optional[str] = None
    adresse_ar: Optional[str] = None
    # Contact fields required for submission
    contact_nom: str
    contact_prenom: str
    contact_tel: str
    reglement_interne_accepte: bool = False


class EtudiantPublicRead(BaseModel):
    id: int
    mat_cin: str
    num_inscription: Optional[str]
    nom_fr: str
    prenom_fr: str
    nom_ar: Optional[str]
    prenom_ar: Optional[str]
    sexe: Optional[str]
    situation_familiale: Optional[str]
    date_naissance: Optional[str]
    lieu_naiss_fr: Optional[str]
    lieu_naiss_ar: Optional[str]
    statut: Optional[str]
    code_gouvernorat: Optional[str]
    code_type_bac: Optional[str]
    # Baccalauréat details
    bac_annee: Optional[str]
    bac_session: Optional[str]
    bac_moyenne: Optional[float]
    bac_mention: Optional[str]
    bac_section: Optional[str]
    num_cnss: Optional[str]
    passeport: Optional[str]
    cfil: Optional[str]
    lib_filiere: Optional[str]
    lib_filiere_ar: Optional[str]
    niveau_id: Optional[int]
    niveau: Optional[NiveauRead]
    email: Optional[str]
    email_verified: bool
    telephone_portable: Optional[str]
    telephone_fixe: Optional[str]
    adresse_fr: Optional[str]
    adresse_ar: Optional[str]
    # Contact en cas de besoin
    contact_nom: Optional[str]
    contact_prenom: Optional[str]
    contact_affiliation: Optional[str]
    contact_adresse: Optional[str]
    contact_tel: Optional[str]
    is_inscription_complete: bool
    completed_at: Optional[datetime]
    inscriptions: List[InscriptionRead] = []
    created_at: datetime
    model_config = {"from_attributes": True}


class EtudiantAdminRead(EtudiantPublicRead):
    is_active: bool
    updated_at: datetime
    model_config = {"from_attributes": True}


class EtudiantListItem(BaseModel):
    id: int
    mat_cin: str
    num_inscription: Optional[str]
    nom_fr: str
    prenom_fr: str
    nom_ar: Optional[str]
    prenom_ar: Optional[str]
    sexe: Optional[str]
    cfil: Optional[str]
    lib_filiere: Optional[str]
    statut: Optional[str]
    email: Optional[str]
    email_verified: bool
    telephone_portable: Optional[str]
    is_inscription_complete: bool
    is_active: bool
    niveau_id: Optional[int]
    niveau: Optional[NiveauRead]
    statut_inscription: Optional[str] = None
    message_rejet: Optional[str] = None
    model_config = {"from_attributes": True}


# ── Import / Export / Pagination ───────────────────────────────────────────────
class ImportResult(BaseModel):
    total_rows: int
    imported: int
    updated: int
    skipped: int
    errors: List[str]


class ScolariteCreate(BaseModel):
    email: str
    nom: str
    prenom: str
    password: str


class ScolariteRead(BaseModel):
    id: int
    email: str
    nom: str
    prenom: str
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class PaginatedEtudiants(BaseModel):
    total: int
    page: int
    size: int
    pages: int
    items: List[EtudiantListItem]


# ── Export flexible ────────────────────────────────────────────────
class ExportColumn(BaseModel):
    key: str
    label: Optional[str] = None  # None → libellé par défaut du catalogue


class ExportRequest(BaseModel):
    columns: List[ExportColumn]
    format: str = "xlsx"          # "xlsx" | "csv"
    filename: Optional[str] = None
    cfil: Optional[str] = None
    niveau_id: Optional[int] = None
    inscription_only: bool = False


# ── Import flexible ────────────────────────────────────────────────
class ImportPreviewResponse(BaseModel):
    columns: List[str]
    sample_rows: List[dict]
    total_rows: int
    suggested_mapping: dict  # {file_column: target_key}
