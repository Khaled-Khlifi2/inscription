"""
Service de vérification OCR des cartes d'identité (CIN).

Moteur par défaut : **EasyOCR** (deep-learning, nettement plus précis sur
l'arabe que Tesseract pour les CIN tunisiennes). Tesseract reste utilisable
en définissant la variable d'environnement OCR_ENGINE=tesseract.

Le service extrait le texte d'une image de CIN et vérifie qu'il contient :
  - Le numéro CIN tel que saisi
  - Le nom et le prénom en arabe (اللقب / الاسم)

Si le moteur OCR n'est pas disponible, l'upload est accepté avec un message
diagnostic « OCR indisponible » pour vérification manuelle.

Politique d'acceptation :
  - 2/3 critères OK ou plus → accepté (verified=True)
  - 1/3 critère OK          → accepté avec avertissement (verified=False)
  - 0/3                     → refusé (HTTP 422 côté appelant)
"""
from __future__ import annotations

import io
import logging
import os
import re
import shutil
import unicodedata
from dataclasses import dataclass

logger = logging.getLogger(__name__)


def _resolve_tesseract_cmd() -> str | None:
    """
    Résout le chemin du binaire `tesseract` :
      1. Variable d'environnement TESSERACT_CMD (si définie)
      2. PATH système via shutil.which
      3. Chemins d'installation par défaut sous Windows
    """
    env_cmd = os.environ.get("TESSERACT_CMD")
    if env_cmd and os.path.isfile(env_cmd):
        return env_cmd

    found = shutil.which("tesseract")
    if found:
        return found

    for candidate in (
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ):
        if os.path.isfile(candidate):
            return candidate
    return None


@dataclass
class OcrResult:
    available: bool          # True si Tesseract est dispo
    verified: bool           # True si au moins 2 critères sur 3 matchent
    message: str             # Message lisible pour le frontend
    matches: dict            # { 'cin': bool, 'nom': bool, 'prenom': bool }
    raw_text: str = ""       # Pour debug


# Tashkeel (diacritiques arabes) à supprimer avant comparaison
_AR_DIACRITICS = re.compile(r"[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]")


def _normalize_ar(s: str) -> str:
    """Normalisation spécifique arabe : supprime tashkeel + unifie variantes
    (alef ا/أ/إ/آ → ا, ya ي/ى → ي, ta marbuta ة → ه, hamza isolée)."""
    if not s:
        return ""
    s = unicodedata.normalize("NFC", s)
    s = _AR_DIACRITICS.sub("", s)
    # Unification des variantes
    s = s.translate(str.maketrans({
        "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
        "ى": "ي", "ئ": "ي",
        "ؤ": "و",
        "ة": "ه",
    }))
    # Garder uniquement lettres arabes + espaces
    s = re.sub(r"[^\u0600-\u06FF\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _normalize(s: str) -> str:
    """Normalise pour comparaison FR : NFD, sans diacritiques, uppercase."""
    if not s:
        return ""
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.upper()
    s = re.sub(r"[^A-Z0-9\u0600-\u06FF\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _fuzzy_best_ratio(needle: str, haystack: str) -> float:
    """Meilleur ratio de similarité (SequenceMatcher) entre `needle` et
    une fenêtre glissante de `haystack`. Teste des fenêtres de taille
    n-1, n, n+1 pour absorber les caractères en trop/manquants."""
    from difflib import SequenceMatcher
    if not needle or not haystack:
        return 0.0
    n = len(needle)
    if n < 3 or len(haystack) < n:
        return 1.0 if needle in haystack else 0.0
    best = 0.0
    for w_size in (n - 1, n, n + 1):
        if w_size <= 0 or w_size > len(haystack):
            continue
        for i in range(0, len(haystack) - w_size + 1):
            window = haystack[i:i + w_size]
            ratio = SequenceMatcher(None, needle, window).ratio()
            if ratio > best:
                best = ratio
    return best


def _match_arabic(expected: str, ocr_text_ar: str) -> bool:
    """Match arabe tolérant aux erreurs OCR :
      1. Match exact (chaîne complète présente)
      2. Match par tokens (au moins 1 mot >= 2 lettres présent tel quel)
      3. Match fuzzy (similarité >= 60% sur fenêtre glissante)
    """
    exp = _normalize_ar(expected)
    txt = _normalize_ar(ocr_text_ar)
    if not exp or not txt:
        return False

    # 1. Match exact complet
    if exp in txt:
        return True

    # 2. Match par tokens significatifs
    tokens = [t for t in exp.split() if len(t) >= 2]
    if any(t in txt for t in tokens):
        return True

    # 3. Match fuzzy (tolère 1-2 lettres mal lues par l'OCR)
    for token in tokens:
        ratio = _fuzzy_best_ratio(token, txt)
        print(f"[OCR CIN] Fuzzy ratio pour {token!r} : {ratio:.2f}", flush=True)
        if ratio >= 0.60:
            return True
    return False


def _match_french(expected: str, ocr_text: str) -> bool:
    """Match FR : chaîne complète OU au moins 1 token de >=3 lettres présent."""
    exp = _normalize(expected)
    txt = _normalize(ocr_text)
    if not exp or not txt or len(exp) < 3:
        return False
    if exp in txt:
        return True
    tokens = [t for t in exp.split() if len(t) >= 3]
    return any(t in txt for t in tokens)


# ── Backend EasyOCR (deep-learning, meilleur sur l'arabe) ─────────────────────
# Reader mis en cache au niveau module : l'initialisation (~5s) ne se fait
# qu'une seule fois au premier upload.
_easyocr_reader_ar = None
_easyocr_reader_fr = None


def _get_easyocr_readers():
    """Initialise paresseusement les Reader EasyOCR (arabe + latin).
    Note : le premier appel télécharge les modèles (~150 Mo). Les appels
    suivants sont quasi instantanés."""
    global _easyocr_reader_ar, _easyocr_reader_fr
    if _easyocr_reader_ar is None or _easyocr_reader_fr is None:
        import easyocr  # type: ignore
        if _easyocr_reader_ar is None:
            print("[OCR CIN] Initialisation EasyOCR (arabe)…", flush=True)
            _easyocr_reader_ar = easyocr.Reader(["ar"], gpu=False, verbose=False)
        if _easyocr_reader_fr is None:
            print("[OCR CIN] Initialisation EasyOCR (français)…", flush=True)
            _easyocr_reader_fr = easyocr.Reader(["fr", "en"], gpu=False, verbose=False)
    return _easyocr_reader_ar, _easyocr_reader_fr


def _ocr_with_easyocr(img) -> tuple[str, str]:
    """OCR via EasyOCR. Retourne (texte_arabe, texte_latin)."""
    import numpy as np  # type: ignore
    reader_ar, reader_fr = _get_easyocr_readers()
    arr = np.array(img)
    # detail=0 → retourne juste les chaînes ; paragraph=False → 1 chaîne par ligne
    ar_lines = reader_ar.readtext(arr, detail=0, paragraph=False)
    fr_lines = reader_fr.readtext(arr, detail=0, paragraph=False)
    return "\n".join(ar_lines), "\n".join(fr_lines)


def verify_cin_image(
    image_bytes: bytes,
    expected_cin: str,
    expected_nom: str,
    expected_prenom: str,
    expected_nom_ar: str = "",
    expected_prenom_ar: str = "",
) -> OcrResult:
    """
    Vérifie qu'une image de CIN contient le numéro, le nom et le prénom attendus.
    Lève uniquement en cas d'erreur d'image (pas en cas de mismatch — c'est l'appelant qui décide).
    """
    # ── Tentative d'import paresseux (Tesseract peut être indisponible) ────────
    try:
        from PIL import Image  # type: ignore
        import pytesseract     # type: ignore
    except ImportError:
        logger.warning("OCR: pytesseract/PIL non installés, vérification désactivée")
        return OcrResult(
            available=False, verified=False,
            message="OCR indisponible (Tesseract non installé) — vérification manuelle requise.",
            matches={"cin": False, "nom": False, "prenom": False},
        )

    # Forcer le chemin du binaire si présent (utile sur Windows quand le PATH
    # n'a pas été rechargé après installation de Tesseract).
    cmd = _resolve_tesseract_cmd()
    if cmd:
        pytesseract.pytesseract.tesseract_cmd = cmd

    try:
        from PIL import ImageOps, ImageFilter  # type: ignore
        img = Image.open(io.BytesIO(image_bytes))
        # Convertir en greyscale
        if img.mode != "L":
            img = img.convert("L")
        # Upscale agressif : la CIN tunisienne a du texte petit, il faut viser ~2000px
        target = 2000
        if max(img.size) < target:
            ratio = target / max(img.size)
            img = img.resize(
                (int(img.size[0] * ratio), int(img.size[1] * ratio)),
                Image.LANCZOS,
            )
        # Autocontraste pour booster la lisibilité
        img = ImageOps.autocontrast(img, cutoff=2)
        # Sharpen léger pour les caractères arabes fins
        img = img.filter(ImageFilter.SHARPEN)
    except Exception as e:
        logger.exception("OCR: impossible d'ouvrir l'image")
        return OcrResult(
            available=True, verified=False,
            message=f"Image illisible : {e}",
            matches={"cin": False, "nom": False, "prenom": False},
        )

    # ── Lancer Tesseract en arabe d'abord (CIN tunisienne = nom/prénom en AR) ──
    # On exécute deux passes pour maximiser la fiabilité :
    #   - ara         → reconnaissance optimale du nom/prénom arabe
    #   - fra         → reconnaissance des chiffres CIN (et latin éventuel)
    # Si seules certaines langues sont dispo, on tombe sur la suivante.
    raw_text_ar = ""
    raw_text_fr = ""

    # ── Choix du moteur OCR ───────────────────────────────────────────────────
    # Par défaut on utilise EasyOCR (meilleur sur l'arabe). On ne bascule sur
    # Tesseract que si OCR_ENGINE=tesseract est explicitement défini, OU si
    # EasyOCR échoue (fallback automatique).
    engine = (os.environ.get("OCR_ENGINE") or "easyocr").lower().strip()
    if engine == "easyocr":
        try:
            ar_text, fr_text = _ocr_with_easyocr(img)
            raw_text_ar = ar_text
            raw_text_fr = fr_text
        except Exception as e:
            logger.exception("OCR: EasyOCR a échoué, fallback Tesseract")
            print(f"[OCR CIN] EasyOCR erreur : {e} — fallback Tesseract", flush=True)
            # On bascule sur Tesseract pour cette requête
            engine = "tesseract"

    def _ocr(lang: str | None, psm: int = 3) -> str:
        """OCR avec mode de segmentation configurable.
        PSM courants :
          - 3  : auto (défaut)
          - 4  : colonne unique de tailles variables
          - 6  : bloc unique de texte uniforme
          - 11 : texte épars (bon pour cartes d'identité)
          - 12 : texte épars + OSD
        """
        config = f"--psm {psm}"
        try:
            return pytesseract.image_to_string(img, lang=lang, config=config) if lang \
                else pytesseract.image_to_string(img, config=config)
        except pytesseract.TesseractNotFoundError:
            raise
        except Exception:
            return ""

    if engine == "tesseract":
        try:
            # Passe arabe : on combine plusieurs PSM pour capturer texte épars (noms)
            # ET texte en bloc (entête). On concatène tous les résultats.
            ar_pieces = []
            for lang in ("ara", "ara+fra"):
                for psm in (6, 11, 4, 3):
                    txt = _ocr(lang, psm=psm)
                    if txt.strip():
                        ar_pieces.append(txt)
            raw_text_ar = "\n".join(ar_pieces)

            # Passe latine pour le numéro CIN
            fr_pieces = []
            for lang in ("fra", "eng", None):
                for psm in (6, 11, 3):
                    txt = _ocr(lang, psm=psm)
                    if txt.strip():
                        fr_pieces.append(txt)
                        break  # une PSM suffit par langue
                if fr_pieces:
                    break
            raw_text_fr = "\n".join(fr_pieces)
        except pytesseract.TesseractNotFoundError:
            logger.warning("OCR: binaire tesseract non installé sur le système")
            return OcrResult(
                available=False, verified=False,
                message="Moteur OCR non installé sur le serveur — vérification manuelle requise.",
                matches={"cin": False, "nom": False, "prenom": False},
            )

    raw_text = (raw_text_ar + "\n" + raw_text_fr).strip()

    # Log diagnostic : permet de voir ce que Tesseract a réellement extrait.
    # On utilise print() pour garantir la sortie console quelle que soit la
    # config de logging d'uvicorn.
    print("=" * 70, flush=True)
    print(f"[OCR CIN] Attendu  : cin={expected_cin!r}", flush=True)
    print(f"[OCR CIN] Attendu  : nom_ar={expected_nom_ar!r} prenom_ar={expected_prenom_ar!r}", flush=True)
    print(f"[OCR CIN] Texte AR brut       : {raw_text_ar.strip()!r}", flush=True)
    print(f"[OCR CIN] Texte FR brut       : {raw_text_fr.strip()!r}", flush=True)
    print(f"[OCR CIN] AR normalisé        : {_normalize_ar(raw_text_ar)!r}", flush=True)
    print(f"[OCR CIN] nom_ar normalisé    : {_normalize_ar(expected_nom_ar)!r}", flush=True)
    print(f"[OCR CIN] prenom_ar normalisé : {_normalize_ar(expected_prenom_ar)!r}", flush=True)
    print("=" * 70, flush=True)

    # ── Comparer chaque critère ────────────────────────────────────────────────
    # CIN : suite de chiffres → utiliser la passe latine (plus fiable pour les chiffres)
    cin_clean = re.sub(r"\D", "", expected_cin or "")
    text_digits = re.sub(r"\D", "", raw_text_fr + raw_text_ar)
    cin_ok = bool(cin_clean) and cin_clean in text_digits

    # Nom / prénom : vérification UNIQUEMENT en arabe.
    # La CIN tunisienne imprime l'identité en arabe — on ne compare donc qu'avec
    # les champs AR saisis par l'étudiant (اللقب / الاسم). Si l'étudiant n'a pas
    # rempli ces champs, on retourne un message explicite.
    if not (expected_nom_ar and expected_prenom_ar):
        return OcrResult(
            available=True, verified=False,
            message="Nom et prénom en arabe (اللقب / الاسم) manquants dans votre profil. "
                    "Veuillez les renseigner avant de téléverser votre carte d'identité.",
            matches={"cin": cin_ok, "nom": False, "prenom": False},
            raw_text=raw_text,
        )

    nom_ok    = _match_arabic(expected_nom_ar,    raw_text_ar)
    prenom_ok = _match_arabic(expected_prenom_ar, raw_text_ar)

    matches = {"cin": cin_ok, "nom": nom_ok, "prenom": prenom_ok}

    # ── Politique stricte ─────────────────────────────────────────────────
    # Pour valider : le numéro CIN DOIT correspondre, ET au moins l'un des
    # deux (nom OU prénom) en arabe DOIT correspondre aussi. Sinon → rejet.
    verified = cin_ok and (nom_ok or prenom_ok)

    if verified:
        score = sum(matches.values())
        return OcrResult(
            available=True, verified=True,
            message=f"Vérification réussie ({score}/3 éléments confirmés).",
            matches=matches, raw_text=raw_text,
        )

    # Construire un message explicite selon ce qui manque
    if not cin_ok:
        msg = ("Le numéro de CIN sur l'image ne correspond pas à celui de votre profil. "
               "Vérifiez que vous téléversez bien VOTRE carte d'identité.")
    else:
        msg = ("Ni le nom ni le prénom n'ont pu être reconnus sur la carte. "
               "Vérifiez la lisibilité de l'image et que les champs اللقب / الاسم "
               "de votre profil sont corrects.")

    return OcrResult(
        available=True, verified=False,
        message=msg,
        matches=matches, raw_text=raw_text,
    )
