import os
import logging
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger("medvigyaan")

class Settings(BaseModel):
    PROJECT_NAME: str = "The MedVigyaan API"
    ENVIRONMENT: str = Field(default_factory=lambda: os.getenv("ENVIRONMENT", os.getenv("NODE_ENV", "development")).lower())
    
    MONGO_URL: str = Field(default_factory=lambda: os.getenv("MONGO_URL", "mongodb://localhost:27017"))
    DB_NAME: str = Field(default_factory=lambda: os.getenv("DB_NAME", "medvigyaan"))
    
    # JWT Configuration
    JWT_SECRET_RAW: Optional[str] = Field(default_factory=lambda: os.getenv("JWT_SECRET"))
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_DAYS: int = 30
    
    # Main Admin Bootstrapping & Protected Email
    FIRST_ADMIN_EMAIL: str = Field(default_factory=lambda: os.getenv("FIRST_ADMIN_EMAIL", "").strip().lower())
    MAIN_ADMIN_EMAIL: str = Field(default_factory=lambda: (os.getenv("MAIN_ADMIN_EMAIL") or os.getenv("FIRST_ADMIN_EMAIL") or "").strip().lower())

    @field_validator("FIRST_ADMIN_EMAIL", "MAIN_ADMIN_EMAIL", mode="before")
    @classmethod
    def normalize_admin_email(cls, v: Optional[str]) -> str:
        return (v or "").strip().lower()
    
    CORS_ORIGINS_RAW: str = Field(default_factory=lambda: os.getenv("CORS_ORIGINS", "*"))
    
    # Optional Third-Party Integration Credentials
    GOOGLE_CLIENT_ID: Optional[str] = Field(default_factory=lambda: os.getenv("GOOGLE_CLIENT_ID", "946733501616-m6a2vmmg9l1ejs185d6a0hqr8ds0bi1m.apps.googleusercontent.com"))
    GOOGLE_CLIENT_SECRET: Optional[str] = Field(default_factory=lambda: os.getenv("GOOGLE_CLIENT_SECRET", ""))
    CLOUDINARY_CLOUD_NAME: Optional[str] = Field(default_factory=lambda: os.getenv("CLOUDINARY_CLOUD_NAME", ""))
    CLOUDINARY_API_KEY: Optional[str] = Field(default_factory=lambda: os.getenv("CLOUDINARY_API_KEY", ""))
    CLOUDINARY_API_SECRET: Optional[str] = Field(default_factory=lambda: os.getenv("CLOUDINARY_API_SECRET", ""))
    GMAIL_USER: Optional[str] = Field(default_factory=lambda: os.getenv("GMAIL_USER", ""))
    GMAIL_APP_PASSWORD: Optional[str] = Field(default_factory=lambda: os.getenv("GMAIL_APP_PASSWORD", ""))
    GOOGLE_CALENDAR_API_KEY: Optional[str] = Field(default_factory=lambda: os.getenv("GOOGLE_CALENDAR_API_KEY", ""))

    @property
    def is_production(self) -> bool:
        return (
            self.ENVIRONMENT in ["production", "prod"]
            or os.getenv("RENDER") == "true"
            or os.getenv("RAILWAY_ENVIRONMENT") is not None
        )

    @property
    def JWT_SECRET(self) -> str:
        secret = (self.JWT_SECRET_RAW or "").strip()
        insecure_default = "medvigyaan-secret-key-change-in-production-2024"
        
        if self.is_production:
            if not secret or secret == insecure_default:
                raise ValueError(
                    "CRITICAL SECURITY CONFIGURATION ERROR: JWT_SECRET environment variable is missing or using an insecure default in production! "
                    "You MUST configure a cryptographically random JWT_SECRET in your hosting provider's dashboard (e.g. run: openssl rand -hex 32)."
                )
            return secret
        
        # Development / test mode fallback
        if not secret or secret == insecure_default:
            return secret or insecure_default
        return secret

    @property
    def cors_origins(self) -> List[str]:
        raw = self.CORS_ORIGINS_RAW.strip()
        if not raw or raw == "*":
            return [
                "https://themedvigyaan.vercel.app",
                "http://localhost:3000",
                "http://127.0.0.1:3000"
            ]
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

settings = Settings()
