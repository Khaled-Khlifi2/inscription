from fastapi import APIRouter
from app.api.v1.endpoints import auth, etudiant, scolarite, responsable

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(etudiant.router)
api_router.include_router(scolarite.router)
api_router.include_router(responsable.router)
