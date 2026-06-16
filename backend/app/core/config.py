from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Student Portal API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    DATABASE_URL: str
    DATABASE_URL_SYNC: str

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # SMTP
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = "noreply@isi.tn"
    MAIL_FROM_NAME: str = "ISI Tunis"
    MAIL_PORT: int = 587
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False
    OTP_EXPIRE_MINUTES: int = 10

    # Comptes par défaut
    SCOLARITE_DEFAULT_EMAIL: str = "scolarite@universite.tn"
    SCOLARITE_DEFAULT_PASSWORD: str = "Admin@2024"

    # Responsables par défaut (créés automatiquement au démarrage)
    RESP_INGENIEUR_EMAIL: str = "resp.ingenieur@isi.tn"
    RESP_INGENIEUR_PASSWORD: str = "Ingenieur@2024"
    RESP_MASTER_EMAIL: str = "resp.master@isi.tn"
    RESP_MASTER_PASSWORD: str = "Master@2024"
    RESP_LICENCE_EMAIL: str = "resp.licence@isi.tn"
    RESP_LICENCE_PASSWORD: str = "Licence@2024"

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
