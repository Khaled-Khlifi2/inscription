# Student Portal

Full-stack student management application with Python FastAPI backend and React frontend.

## Multi-Tenancy Architecture (Scalable - Optional)

This project includes a **scalable schema-per-establishment architecture** for multi-tenancy. The infrastructure is ready to support multiple educational establishments (e.g., ISI Ariana, Faculty of Sciences) sharing the same database with complete data isolation.

**Current State**: All tables remain in the `public` schema - no changes to your existing database.

**When Ready**: When you want to add a new establishment, you can enable the multi-tenancy features.

### Schema Structure (When Enabled)

- **`shared` schema**: Contains common data shared across all establishments (niveaux, roles, permissions)
- **`etablissement_*` schemas**: Each establishment has its own schema (e.g., `etablissement_isi_ariana`, `etablissement_faculty_sciences`)
- **`public` schema**: Default PostgreSQL schema (current location of all tables)

### How It Works (When Enabled)

1. **Request Context**: Each API request includes the establishment identifier via:
   - HTTP Header: `X-Etablissement: isi_ariana`
   - JWT Token: `etablissement` claim in the payload

2. **Schema Switching**: The database session automatically sets the PostgreSQL `search_path` to the correct schema based on the establishment context.

3. **Data Isolation**: All establishment-specific tables (students, inscriptions, etc.) are completely isolated per schema.

### Enabling Multi-Tenancy (When You're Ready)

When you want to add a new establishment (e.g., Faculty of Sciences):

**Option 1: Quick Setup (Recommended for new establishments)**

1. **Use the provided script** to create a new establishment with cloned table structure:
   ```bash
   cd backend
   python scripts/create_establishment.py faculty_sciences
   ```
   This automatically:
   - Creates the schema `etablissement_faculty_sciences`
   - Clones all table structures from `public` schema
   - Sets up indexes, constraints, and defaults

2. **Use the new establishment** in API requests:
   ```bash
   curl -H "X-Etablissement: faculty_sciences" http://localhost:8000/api/v1/etudiant/me
   ```

**Option 2: Manual Setup**

1. **Edit the migration** `backend/alembic/versions/0012_multi_schema_setup.py`:
   - Uncomment the code in the `upgrade()` function
   - This will create schemas and move existing data

2. **Run the migration**:
   ```bash
   cd backend
   alembic upgrade head
   ```

3. **Create additional establishment schemas** as needed:
   ```sql
   CREATE SCHEMA etablissement_faculty_sciences;
   ```

4. **Clone table structure** (or use the script above):
   ```python
   from app.core.schema_manager import clone_schema_structure
   await clone_schema_structure(session, "public", "etablissement_faculty_sciences")
   ```

**Note**: Until you enable the migration, the system continues to work exactly as it does now with all tables in the `public` schema.

## Prerequisites

- Python 3.9+
- Node.js 18+
- PostgreSQL database

## Installation

### Backend

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
```

3. Activate the virtual environment:
- Windows: `venv\Scripts\activate`
- Linux/Mac: `source venv/bin/activate`

4. Install dependencies:
```bash
pip install -r requirements.txt
```

5. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials and settings
```

6. Run database migrations:
```bash
alembic upgrade head
```

7. Start the backend server:
```bash
uvicorn main:app --reload
```

### Frontend

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

## Project Structure

```
student-portal-v6/
├── backend/          # FastAPI backend
│   ├── app/         # Application modules
│   ├── alembic/     # Database migrations
│   ├── tests/       # Backend tests
│   └── requirements.txt
├── frontend/        # React frontend
│   ├── src/        # React components
│   └── package.json
└── .gitignore
```

## Development

- Backend runs on `http://localhost:8000`
- Frontend runs on `http://localhost:5173`
- API documentation available at `http://localhost:8000/docs`

## Deployment

See individual README files in `backend/` and `frontend/` for deployment instructions.
