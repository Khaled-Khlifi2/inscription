"""
Tests d'intégration — Authentification.
"""
import pytest
from httpx import AsyncClient, ASGITransport

from main import app


@pytest.mark.asyncio
async def test_login_etudiant_not_found():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/auth/etudiant/login", json={"mat_cin": "INCONNU"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_login_scolarite_wrong_password():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/v1/auth/scolarite/login",
            json={"email": "scolarite@universite.tn", "password": "mauvais"},
        )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_etudiant_route_requires_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/v1/etudiant/me")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_scolarite_route_requires_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/v1/scolarite/etudiants")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_health():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
