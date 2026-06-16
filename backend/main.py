from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Démarrage ──────────────────────────────────────────────────────────────
    from app.db.init_db import init_db
    await init_db()
    yield
    # ── Arrêt ──────────────────────────────────────────────────────────────────
    from app.db.session import engine
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "API de gestion des étudiants — ISI Tunis.\n\n"
            "**Rôles :**\n"
            "- `scolarite` : import Excel, export SALIMA, CRUD étudiants\n"
            "- `etudiant` : consultation du dossier, complétion des champs manquants, "
            "soumission de l'inscription\n\n"
            "**Authentification :** Bearer JWT — obtenez votre token via `/auth/etudiant/login` "
            "ou `/auth/scolarite/login`, puis cliquez sur **Authorize** ci-dessus."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
        swagger_ui_init_oauth={},
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],   # Restreindre en production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routes ────────────────────────────────────────────────────────────────
    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    # ── Health check ──────────────────────────────────────────────────────────
    @app.get("/health", tags=["Health"], summary="Vérification de l'état de l'API")
    async def health():
        return JSONResponse({"status": "ok", "version": settings.APP_VERSION})

    # ── OpenAPI — Bearer JWT dans Swagger ─────────────────────────────────────
    def custom_openapi():
        if app.openapi_schema:
            return app.openapi_schema
        schema = get_openapi(
            title=app.title,
            version=app.version,
            description=app.description,
            routes=app.routes,
        )
        schema["components"]["securitySchemes"] = {
            "BearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
                "description": (
                    "Collez ici le token JWT obtenu via "
                    "`/api/v1/auth/etudiant/login` ou `/api/v1/auth/scolarite/login`"
                ),
            }
        }
        for path in schema.get("paths", {}).values():
            for operation in path.values():
                if isinstance(operation, dict) and "security" in operation:
                    operation["security"] = [{"BearerAuth": []}]
        app.openapi_schema = schema
        return schema

    app.openapi = custom_openapi
    return app


app = create_app()
