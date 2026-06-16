# Student Portal API — v2

API de gestion des étudiants ISI Tunis avec vérification email OTP,
gestion par niveaux et workflow d'inscription.

## Nouveautés v2

- **Auth étudiant** : CIN + email → OTP → JWT (email verrouillé après vérification)
- **Niveaux** : Ingénieur / Master / Licence
- **Responsables** : un responsable par niveau, voit uniquement ses étudiants
- **Workflow inscription** : `en_attente` → `validee` / `rejetee` (avec message)
- **Notifications email** : rejet et validation envoyés automatiquement

## Architecture

```
app/
├── api/v1/endpoints/
│   ├── auth.py          # Login étudiant (2 étapes OTP), scolarité, responsable
│   ├── etudiant.py      # Espace personnel étudiant
│   ├── scolarite.py     # Admin global : niveaux, responsables, étudiants, import/export
│   └── responsable.py   # Responsable de niveau : validation/rejet inscriptions
├── models/models.py     # Niveau, UserResponsable, OtpVerification, Etudiant, Inscription
├── services/
│   ├── auth_service.py        # Logique OTP + JWT
│   ├── email_service.py       # SMTP natif, OTP HTML, notifications
│   ├── etudiant_service.py    # CRUD + soumission inscription
│   ├── responsable_service.py # Décision inscription + notifications
│   ├── import_service.py      # Import Excel SALIMA
│   └── export_service.py      # Export Excel SALIMA
└── core/
    ├── config.py      # Settings avec variables SMTP
    ├── security.py    # JWT avec champ extra (niveau_id)
    └── dependencies.py # Guards : etudiant, scolarite, responsable
```

## Démarrage rapide

```bash
# 1. Copier et configurer
cp .env.example .env
# Remplir MAIL_USERNAME, MAIL_PASSWORD dans .env

# 2. Installer
pip install -r requirements.txt

# 3. Migrer la base (depuis zéro)
alembic upgrade head

# 4. Lancer
uvicorn main:app --reload --port 8000
```

Au démarrage, les 3 niveaux et le compte scolarité admin sont créés automatiquement.

## Flux étudiant

```
1. POST /api/v1/auth/etudiant/login
   { "mat_cin": "12345678", "email": "etudiant@gmail.com" }
   → { "require_otp": true, "message": "Code envoyé par email" }

2. POST /api/v1/auth/etudiant/verify-otp
   { "mat_cin": "12345678", "email": "etudiant@gmail.com", "code": "482916" }
   → { "access_token": "...", "role": "etudiant" }

3. PATCH /api/v1/etudiant/me          (avec Bearer token)
   { "telephone_portable": "22334455", "adresse_fr": "..." }

4. POST /api/v1/etudiant/me/inscription
   { "telephone_portable": "22334455" }
   → Inscription créée avec statut "en_attente"
```

## Flux responsable

```bash
# Login responsable
POST /api/v1/auth/responsable/login
{ "email": "resp@isi.tn", "password": "..." }

# Voir ses étudiants (filtrés par son niveau automatiquement)
GET /api/v1/responsable/etudiants?statut_inscription=en_attente

# Valider une inscription
POST /api/v1/responsable/inscriptions/42/decision
{ "decision": "valider" }

# Rejeter avec message
POST /api/v1/responsable/inscriptions/42/decision
{
  "decision": "rejeter",
  "message_rejet": "Adresse incomplète. Numéro de téléphone manquant."
}
```

## Créer un responsable

```bash
# Via script
python scripts/create_responsable.py \
  --email resp.ingenieur@isi.tn \
  --nom BenAli --prenom Mohamed \
  --password MonMotDePasse \
  --niveau ingenieur

# Ou via API (scolarité connectée)
POST /api/v1/scolarite/responsables
{
  "email": "resp@isi.tn",
  "nom": "BenAli", "prenom": "Mohamed",
  "password": "MonMotDePasse",
  "niveau_id": 1
}
```

## Configuration SMTP (Gmail)

1. Activez la validation en 2 étapes sur votre compte Gmail
2. Allez dans **Compte Google → Sécurité → Mots de passe d'application**
3. Créez un mot de passe pour "Mail"
4. Dans `.env` :
```
MAIL_USERNAME=votre.email@gmail.com
MAIL_PASSWORD=xxxx-xxxx-xxxx-xxxx   # mot de passe d'application
MAIL_FROM=noreply@isi.tn
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_STARTTLS=True
```

## Comptes par défaut

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Scolarité | scolarite@universite.tn | Admin@2024 |
| Étudiant | CIN (après import) | — (OTP email) |
| Responsable | À créer via script | À définir |

## Documentation API

http://localhost:8000/docs
