"""Configuration centralisee des pieces jointes d'inscription."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import HTTPException


CONFIG_PATH = Path(__file__).resolve().parents[3] / "config" / "pieces_jointes.json"


def normalize_piece_type(type_document: str) -> str:
    return str(type_document or "").strip().lower()


@lru_cache(maxsize=1)
def load_pieces_jointes_config() -> dict[str, Any]:
    try:
        with CONFIG_PATH.open("r", encoding="utf-8") as fh:
            config = json.load(fh)
    except FileNotFoundError as exc:
        raise RuntimeError(f"Configuration pieces jointes introuvable: {CONFIG_PATH}") from exc

    cases = config.get("cases") or {}
    default_case = config.get("default_case")
    if not default_case or default_case not in cases:
        raise RuntimeError("Configuration pieces jointes invalide: default_case absent ou inconnu")

    for case_key, case in cases.items():
        seen = set()
        for piece in case.get("pieces") or []:
            type_document = normalize_piece_type(piece.get("type"))
            if not type_document:
                raise RuntimeError(f"Piece sans type dans le cas {case_key}")
            if type_document in seen:
                raise RuntimeError(f"Type de piece duplique dans le cas {case_key}: {type_document}")
            seen.add(type_document)
            if piece.get("slot") not in {"single", "multiple"}:
                raise RuntimeError(f"Slot invalide pour {type_document}: {piece.get('slot')}")
            if piece.get("format") not in {"image", "pdf"}:
                raise RuntimeError(f"Format invalide pour {type_document}: {piece.get('format')}")

    return config


def get_default_case() -> dict[str, Any]:
    config = load_pieces_jointes_config()
    return config["cases"][config["default_case"]]


def get_piece_definition(type_document: str) -> dict[str, Any]:
    normalized = normalize_piece_type(type_document or "autre")
    for piece in get_default_case().get("pieces") or []:
        if normalize_piece_type(piece.get("type")) == normalized:
            return piece
    allowed = ", ".join(sorted(normalize_piece_type(piece["type"]) for piece in get_default_case().get("pieces") or []))
    raise HTTPException(
        status_code=400,
        detail=f"Type de piece inconnu. Valeurs acceptees : {allowed}.",
    )


def get_required_piece_types() -> list[str]:
    return [
        normalize_piece_type(piece["type"])
        for piece in get_default_case().get("pieces") or []
        if piece.get("required")
    ]
