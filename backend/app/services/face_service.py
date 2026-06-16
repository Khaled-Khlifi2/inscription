"""
Service de vérification des photos d'identité.

Utilise OpenCV (Haar Cascade) pour détecter la présence d'un visage humain
clair dans la photo téléversée par l'étudiant.

Politique stricte (appliquée par `FileService.upload_piece_jointe`) :
  - Photo floue (Laplacian var < 60)            → REJET
  - Aucun visage détecté                        → REJET
  - Plusieurs visages détectés                  → REJET (photo non individuelle)
  - Exactement 1 visage humain net, de face     → ACCEPTÉ

OpenCV est déjà installé via EasyOCR (dépendance transitive). Si OpenCV n'est
pas dispo, la vérification est désactivée et la photo est acceptée pour
revue manuelle.
"""
from __future__ import annotations

import io
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class FaceResult:
    available: bool          # True si OpenCV est dispo
    verified: bool           # True si EXACTEMENT 1 visage détecté
    message: str             # Message lisible pour le frontend
    faces_count: int = 0     # Nombre de visages détectés


def verify_photo_face(image_bytes: bytes) -> FaceResult:
    """
    Vérifie qu'une image contient au moins un visage humain.

    Politique :
      - 0 visage   → refus (HTTP 422 côté appelant)
      - 1 visage   → accepté (verified=True)
      - 2+ visages → accepté mais flaggé (verified=False, revue manuelle)
    """
    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore
        from PIL import Image  # type: ignore
    except ImportError:
        logger.warning("FACE: opencv-python/PIL non installés, vérification désactivée")
        return FaceResult(
            available=False, verified=False,
            message="Détection de visage indisponible — vérification manuelle requise.",
        )

    # ── Charger l'image et convertir en greyscale pour Haar Cascade ────────
    try:
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode != "RGB":
            img = img.convert("RGB")
        arr = np.array(img)
        gray_raw = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
        # ── Contrôle de netteté (Laplacian variance) ────────────────────────
        # Une image floue a une variance < ~80. On rejette en dessous de 60
        # pour laisser passer les photos un peu compressées mais lisibles.
        sharpness = float(cv2.Laplacian(gray_raw, cv2.CV_64F).var())
        print(f"[PHOTO] Netteté (Laplacian var) : {sharpness:.1f}", flush=True)
        if sharpness < 60:
            return FaceResult(
                available=True, verified=False,
                message="Photo trop floue. Veuillez téléverser une image nette "
                        "de votre visage (bien éclairée, mise au point correcte).",
                faces_count=0,
            )
        # Égalisation d'histogramme pour améliorer le contraste de la détection
        gray = cv2.equalizeHist(gray_raw)
    except Exception as e:
        logger.exception("FACE: impossible d'ouvrir l'image")
        return FaceResult(
            available=True, verified=False,
            message=f"Image illisible : {e}",
        )

    # ── Charger le classifieur Haar Cascade (livré avec opencv-python) ─────
    try:
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        face_cascade = cv2.CascadeClassifier(cascade_path)
        if face_cascade.empty():
            raise RuntimeError("Cascade Haar non chargée")
    except Exception as e:
        logger.exception("FACE: cascade Haar indisponible")
        return FaceResult(
            available=False, verified=False,
            message="Modèle de détection de visage non disponible — vérification manuelle requise.",
        )

    # ── Détection ──────────────────────────────────────────────────────────
    # Paramètres ajustés pour photos d'identité (gros visage centré) :
    #   scaleFactor  = 1.1   → bonne précision
    #   minNeighbors = 5     → réduit les faux positifs
    #   minSize      = 80×80 → ignore les visages minuscules
    h, w = gray.shape
    min_dim = max(80, min(h, w) // 8)
    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(min_dim, min_dim),
    )

    count = len(faces)
    print(f"[PHOTO] Visages détectés : {count}", flush=True)

    if count == 0:
        # Tentative en mode plus permissif (profil, faible contraste) avant rejet
        faces_loose = face_cascade.detectMultiScale(
            gray, scaleFactor=1.05, minNeighbors=3, minSize=(60, 60),
        )
        count = len(faces_loose)
        print(f"[PHOTO] Visages détectés (mode permissif) : {count}", flush=True)

    if count == 0:
        return FaceResult(
            available=True, verified=False,
            message="Aucun visage détecté sur l'image. Veuillez téléverser une photo "
                    "d'identité claire montrant votre visage de face.",
            faces_count=0,
        )

    if count == 1:
        return FaceResult(
            available=True, verified=True,
            message="Photo d'identité vérifiée : 1 visage détecté.",
            faces_count=1,
        )

    # Plusieurs visages → on accepte mais on flag
    return FaceResult(
        available=True, verified=False,
        message=f"Veuillez téléverser une photo individuelle "
                "(un seul visage). La pièce sera revue manuellement.",
        faces_count=count,
    )
