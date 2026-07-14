"""
Service d'envoi d'emails via SMTP standard (smtplib — pas de dépendance externe).
Génère et envoie un OTP à 6 chiffres pour la vérification de l'email étudiant.
"""
import random
import smtplib
import string
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.models import OtpVerification


def _generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def _send_smtp(to_email: str, subject: str, html_body: str) -> None:
    """Envoi synchrone SMTP (appelé dans un thread via run_in_executor)."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"{settings.MAIL_FROM_NAME} <{settings.MAIL_FROM}>"
    msg["To"]      = to_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    if settings.MAIL_SSL_TLS:
        server = smtplib.SMTP_SSL(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=10)
    else:
        server = smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=10)
        if settings.MAIL_STARTTLS:
            server.starttls()

    if settings.MAIL_USERNAME:
        server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)

    server.sendmail(settings.MAIL_FROM, to_email, msg.as_string())
    server.quit()


def _otp_html(code: str, nom: str, expire_minutes: int) -> str:
    return f"""
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><style>
  body {{ font-family: 'DM Sans', Arial, sans-serif; background: #EDF0F4; margin: 0; padding: 40px 0; }}
  .card {{ background: white; max-width: 480px; margin: 0 auto; border-radius: 16px;
           padding: 40px; box-shadow: 0 4px 24px rgba(13,17,23,0.10); }}
  .logo {{ display: flex; align-items: center; gap: 12px; margin-bottom: 32px; }}
  .logo-icon {{ width: 44px; height: 44px; background: #0D1117; border-radius: 10px;
                display: inline-flex; align-items: center; justify-content: center;
                color: white; font-weight: 800; font-size: 16px; }}
  h1 {{ font-size: 22px; color: #0D1117; margin: 0 0 8px; }}
  p  {{ color: #8896A8; font-size: 15px; line-height: 1.6; margin: 0 0 24px; }}
  .otp {{ background: #EBF2FF; border-radius: 12px; padding: 24px; text-align: center;
           letter-spacing: 0.25em; font-size: 36px; font-weight: 800; color: #1A56DB;
           margin: 24px 0; }}
  .note {{ font-size: 13px; color: #C8D0DC; text-align: center; }}
</style></head>
<body>
<div class="card">
  <div class="logo">
    <div class="logo-icon">ISI</div>
    <strong style="color:#0D1117;font-size:17px;">ISI Tunis</strong>
  </div>
  <h1>Vérification de votre email</h1>
  <p>Bonjour <strong>{nom}</strong>, utilisez le code ci-dessous pour vérifier votre adresse email
  et accéder à votre espace étudiant.</p>
  <div class="otp">{code}</div>
  <p class="note">Ce code expire dans <strong>{expire_minutes} minutes</strong>.<br>
  Si vous n'avez pas demandé cette vérification, ignorez cet email.</p>
</div>
</body>
</html>"""


def _rejection_html(nom: str, message: str, annee: str) -> str:
    return f"""
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><style>
  body {{ font-family: Arial, sans-serif; background: #EDF0F4; margin: 0; padding: 40px 0; }}
  .card {{ background: white; max-width: 520px; margin: 0 auto; border-radius: 16px;
           padding: 40px; box-shadow: 0 4px 24px rgba(13,17,23,0.10); }}
  h1 {{ color: #DC2626; font-size: 20px; margin-bottom: 16px; }}
  p  {{ color: #4A5568; font-size: 15px; line-height: 1.6; }}
  .msg {{ background: #FEF2F2; border-left: 4px solid #DC2626; padding: 16px;
          border-radius: 8px; margin: 16px 0; color: #991B1B; font-size: 14px; }}
</style></head>
<body>
<div class="card">
  <h1>Inscription refusée</h1>
  <p>Bonjour <strong>{nom}</strong>,</p>
  <p>Votre demande d'inscription pour l'année universitaire <strong>{annee}</strong>
  a été refusée pour les raisons suivantes :</p>
  <div class="msg">{message}</div>
  <p>Veuillez corriger votre dossier et soumettre à nouveau votre inscription.</p>
  <p>— Service scolarité ISI Tunis</p>
</div>
</body>
</html>"""


def _validation_html(nom: str, annee: str) -> str:
    return f"""
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><style>
  body {{ font-family: Arial, sans-serif; background: #EDF0F4; margin: 0; padding: 40px 0; }}
  .card {{ background: white; max-width: 520px; margin: 0 auto; border-radius: 16px;
           padding: 40px; box-shadow: 0 4px 24px rgba(13,17,23,0.10); }}
  h1 {{ color: #0D9488; font-size: 20px; margin-bottom: 16px; }}
  p  {{ color: #4A5568; font-size: 15px; line-height: 1.6; }}
  .badge {{ background: #F0FDF9; border-left: 4px solid #0D9488; padding: 16px;
            border-radius: 8px; margin: 16px 0; color: #065F5A; font-weight: 600; }}
</style></head>
<body>
<div class="card">
  <h1>✓ Inscription validée</h1>
  <p>Bonjour <strong>{nom}</strong>,</p>
  <p>Votre inscription pour l'année universitaire <strong>{annee}</strong> a été <strong>validée</strong>
  par le service scolarité.</p>
  <div class="badge">Vous êtes officiellement inscrit(e) à l'ISI Tunis.</div>
  <p>— Service scolarité ISI Tunis</p>
</div>
</body>
</html>"""


def _reset_html(nom: str, annee: str) -> str:
    return f"""
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><style>
  body {{ font-family: Arial, sans-serif; background: #EDF0F4; margin: 0; padding: 40px 0; }}
  .card {{ background: white; max-width: 520px; margin: 0 auto; border-radius: 16px;
           padding: 40px; box-shadow: 0 4px 24px rgba(13,17,23,0.10); }}
  h1 {{ color: #B45309; font-size: 20px; margin-bottom: 16px; }}
  p  {{ color: #4A5568; font-size: 15px; line-height: 1.6; }}
  .badge {{ background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px;
            border-radius: 8px; margin: 16px 0; color: #78350F; font-weight: 600; }}
</style></head>
<body>
<div class="card">
  <h1>↻ Inscription réinitialisée</h1>
  <p>Bonjour <strong>{nom}</strong>,</p>
  <p>Votre inscription pour l'année universitaire <strong>{annee}</strong> a été
  <strong>réinitialisée</strong> par le service scolarité.</p>
  <div class="badge">Vous pouvez à présent vous reconnecter au portail et soumettre
  à nouveau votre dossier d'inscription.</div>
  <p>Si vous avez des questions, contactez le service scolarité.</p>
  <p>— Service scolarité ISI Tunis</p>
</div>
</body>
</html>"""


def _piece_rejection_html(nom: str, nom_fichier: str, motif: str, annee: str) -> str:
    return f"""
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><style>
  body {{ font-family: Arial, sans-serif; background: #EDF0F4; margin: 0; padding: 40px 0; }}
  .card {{ background: white; max-width: 520px; margin: 0 auto; border-radius: 16px;
           padding: 40px; box-shadow: 0 4px 24px rgba(13,17,23,0.10); }}
  h1 {{ color: #DC2626; font-size: 20px; margin-bottom: 16px; }}
  p  {{ color: #4A5568; font-size: 15px; line-height: 1.6; }}
  .file {{ background: #F8FAFC; border: 1px solid #E2E8F0; padding: 12px 14px;
           border-radius: 8px; margin: 14px 0; color: #0F172A; font-weight: 600; }}
  .msg {{ background: #FEF2F2; border-left: 4px solid #DC2626; padding: 16px;
          border-radius: 8px; margin: 16px 0; color: #991B1B; font-size: 14px; }}
</style></head>
<body>
<div class="card">
  <h1>Piece jointe refusee</h1>
  <p>Bonjour <strong>{nom}</strong>,</p>
  <p>Une piece jointe de votre dossier d'inscription pour l'annee universitaire
  <strong>{annee}</strong> a ete refusee.</p>
  <div class="file">{nom_fichier}</div>
  <p>Motif du refus :</p>
  <div class="msg">{motif}</div>
  <p>Veuillez remplacer ou corriger cette piece depuis votre espace etudiant, puis resoumettre votre dossier si necessaire.</p>
  <p>-- Service scolarite ISI Tunis</p>
</div>
</body>
</html>"""


class EmailService:

    @staticmethod
    async def send_otp(
        db: AsyncSession,
        mat_cin: str,
        email: str,
        nom_prenom: str,
    ) -> str:
        """
        Génère un OTP, le persiste en base et envoie l'email.
        Retourne le code (pour les tests — ne pas exposer en prod).
        """
        import asyncio

        code = _generate_otp()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

        # Invalider les anciens OTP pour ce CIN
        from sqlalchemy import update
        await db.execute(
            update(OtpVerification)
            .where(OtpVerification.mat_cin == mat_cin.upper(), OtpVerification.is_used == False)
            .values(is_used=True)
        )

        otp = OtpVerification(
            mat_cin=mat_cin.upper(),
            email=email.lower(),
            code=code,
            expires_at=expires_at,
        )
        db.add(otp)
        await db.flush()

        # Envoi email dans un thread pour ne pas bloquer la boucle async
        html = _otp_html(code, nom_prenom, settings.OTP_EXPIRE_MINUTES)
        loop = asyncio.get_event_loop()
        try:
            await loop.run_in_executor(
                None,
                lambda: _send_smtp(email, "Code de vérification ISI", html),
            )
        except Exception as exc:
            # Log mais ne pas faire échouer la requête si SMTP mal configuré
            print(f"[EMAIL ERROR] {exc}")

        return code

    @staticmethod
    async def verify_otp(
        db: AsyncSession,
        mat_cin: str,
        email: str,
        code: str,
    ) -> bool:
        """Vérifie le code OTP. Retourne True si valide et le marque utilisé."""
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(OtpVerification).where(
                OtpVerification.mat_cin == mat_cin.upper(),
                OtpVerification.email  == email.lower(),
                OtpVerification.code   == code,
                OtpVerification.is_used == False,
                OtpVerification.expires_at > now,
            )
        )
        otp = result.scalar_one_or_none()
        if not otp:
            return False
        otp.is_used = True
        await db.flush()
        return True

    @staticmethod
    def send_rejection_notification(
        to_email: str,
        nom: str,
        message_rejet: str,
        annee: str,
    ) -> None:
        """Notification de rejet — appelé en background."""
        try:
            html = _rejection_html(nom, message_rejet, annee)
            _send_smtp(to_email, "Inscription refusée — ISI Tunis", html)
        except Exception as exc:
            print(f"[EMAIL ERROR rejection] {exc}")

    @staticmethod
    def send_validation_notification(
        to_email: str,
        nom: str,
        annee: str,
    ) -> None:
        """Notification de validation — appelé en background."""
        try:
            html = _validation_html(nom, annee)
            _send_smtp(to_email, "Inscription validée — ISI Tunis", html)
        except Exception as exc:
            print(f"[EMAIL ERROR validation] {exc}")

    @staticmethod
    def send_reset_notification(
        to_email: str,
        nom: str,
        annee: str,
    ) -> None:
        """Notification de réinitialisation d'inscription — appelé en background."""
        try:
            html = _reset_html(nom, annee)
            _send_smtp(to_email, "Inscription réinitialisée — ISI Tunis", html)
        except Exception as exc:
            print(f"[EMAIL ERROR reset] {exc}")

    @staticmethod
    def send_piece_rejection_notification(
        to_email: str,
        nom: str,
        nom_fichier: str,
        motif_refus: str,
        annee: str,
    ) -> None:
        """Notification de refus d'une piece jointe."""
        try:
            html = _piece_rejection_html(nom, nom_fichier, motif_refus, annee)
            _send_smtp(to_email, "Piece jointe refusee - ISI Tunis", html)
        except Exception as exc:
            print(f"[EMAIL ERROR piece rejection] {exc}")
