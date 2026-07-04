"""
Script de test pour vérifier la configuration SMTP.

Usage:
    python scripts/test_smtp.py votre.email@exemple.com
"""
import sys
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

# Ajouter le répertoire parent au path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import settings


def test_smtp(to_email: str):
    """Teste l'envoi d'un email avec la configuration SMTP actuelle"""
    print("=" * 60)
    print("📧 Test de configuration SMTP")
    print("=" * 60)
    
    print(f"\n📋 Configuration :")
    print(f"  Serveur   : {settings.MAIL_SERVER}")
    print(f"  Port      : {settings.MAIL_PORT}")
    print(f"  Username  : {settings.MAIL_USERNAME}")
    print(f"  From      : {settings.MAIL_FROM}")
    print(f"  SSL/TLS   : SSL={settings.MAIL_SSL_TLS}, STARTTLS={settings.MAIL_STARTTLS}")
    
    print(f"\n📧 Envoi à : {to_email}")
    
    # Créer le message
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Test SMTP - Portail Étudiant ISI"
    msg["From"] = f"{settings.MAIL_FROM_NAME} <{settings.MAIL_FROM}>"
    msg["To"] = to_email
    
    html_body = """
    <html>
    <body>
        <h2>Test de configuration SMTP</h2>
        <p>Si vous recevez cet email, la configuration SMTP est correcte.</p>
        <p>Le système d'envoi d'OTP fonctionne correctement.</p>
        <p><strong>Portail Étudiant ISI Tunis</strong></p>
    </body>
    </html>
    """
    msg.attach(MIMEText(html_body, "html", "utf-8"))
    
    try:
        # Connexion SMTP
        print(f"\n🔌 Connexion au serveur SMTP...")
        if settings.MAIL_SSL_TLS:
            server = smtplib.SMTP_SSL(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=10)
        else:
            server = smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=10)
            if settings.MAIL_STARTTLS:
                print(f"🔐 Activation STARTTLS...")
                server.starttls()
        
        # Authentification
        if settings.MAIL_USERNAME:
            print(f"🔑 Authentification avec {settings.MAIL_USERNAME}...")
            server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
        
        # Envoi
        print(f"📤 Envoi de l'email...")
        server.sendmail(settings.MAIL_FROM, to_email, msg.as_string())
        server.quit()
        
        print(f"\n✅ SUCCÈS ! Email envoyé à {to_email}")
        print(f"💡 Vérifiez votre boîte de réception (et les spams)")
        print("=" * 60)
        return True
        
    except smtplib.SMTPAuthenticationError as e:
        print(f"\n❌ ERREUR d'authentification : {e}")
        print(f"💡 Vérifiez MAIL_USERNAME et MAIL_PASSWORD dans .env")
        print(f"💡 Pour Gmail, utilisez un 'Mot de passe d'application'")
        return False
        
    except smtplib.SMTPException as e:
        print(f"\n❌ ERREUR SMTP : {e}")
        return False
        
    except Exception as e:
        print(f"\n❌ ERREUR inattendue : {e}")
        return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/test_smtp.py votre.email@exemple.com")
        sys.exit(1)
    
    to_email = sys.argv[1]
    test_smtp(to_email)
