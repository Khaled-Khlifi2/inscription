# Student Portal

Full-stack student management application with Python FastAPI backend and React frontend.

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
