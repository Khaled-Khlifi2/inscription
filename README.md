# Student Portal

Full-stack student management application with Python FastAPI backend and React frontend.

## Quick Start

### Prerequisites

- Python 3.9+
- Node.js 18+
- PostgreSQL database

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create and activate a virtual environment:
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/Mac
python -m venv venv
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment variables:
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your database credentials and settings
# Required variables:
# - DATABASE_URL: PostgreSQL connection string
# - SECRET_KEY: JWT secret key
# - ALGORITHM: JWT algorithm (default: HS256)
# - ACCESS_TOKEN_EXPIRE_MINUTES: Token expiration time
```

5. Initialize the database:
```bash
# Run database migrations
alembic upgrade head

# Optional: Create an admin user
python scripts/create_admin.py
```

6. Start the backend server:
```bash
# Development mode (with auto-reload)
uvicorn main:app --reload

# Production mode
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables (if needed):
```bash
# Create .env file if it doesn't exist
# VITE_API_URL=http://localhost:8000
```

4. Start the development server:
```bash
npm run dev
```

5. Build for production:
```bash
npm run build
npm run preview
```

### Running the Application

**Development Mode:**
- Open two terminal windows
- Terminal 1: Start backend (`cd backend && uvicorn main:app --reload`)
- Terminal 2: Start frontend (`cd frontend && npm run dev`)
- Access the app at `http://localhost:5173`
- API docs at `http://localhost:8000/docs`

**Production Mode:**
- Build the frontend: `cd frontend && npm run build`
- Serve the frontend with a web server (nginx, apache, etc.)
- Start the backend: `cd backend && uvicorn main:app --host 0.0.0.0 --port 8000`
- Configure your web server to proxy API requests to the backend

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
