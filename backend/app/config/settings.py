"""
AIComplianceGuard - Configuration Module
Handles environment variables and application settings
"""

from pydantic_settings import BaseSettings
from typing import List
from pathlib import Path
from pydantic import model_validator


class Settings(BaseSettings):
    """Application settings from environment variables"""
    
    # Application
    APP_NAME: str = "AIComplianceGuard"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    
    # Backend API
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    API_PREFIX: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = "dev-secret-do-not-use-in-production"
    AES_ENCRYPTION_KEY: str = "dev-32-byte-key-change-prod!!"
    JWT_SECRET: str = "dev-jwt-secret-do-not-use-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 12
    
    # Firebase
    FIREBASE_API_KEY: str = ""
    FIREBASE_AUTH_DOMAIN: str = ""
    FIREBASE_PROJECT_ID: str = ""
    FIREBASE_CREDENTIALS_PATH: str = "./firebase-credentials.json"
    
    # AI/ML Configuration
    MODEL_CACHE_DIR: str = "./data/models"
    USE_GPU: bool = False
    MAX_DOCUMENT_SIZE_MB: int = 10
    SUPPORTED_FORMATS: List[str] = ["pdf", "docx"]

    # LLM Configuration
    LLM_PROVIDER: str = "gemini"           # "gemini", "llama_cpp", "transformers", or "none" (rule-based fallback)
    
    # Gemini Configuration
    GEMINI_API_KEY: str = ""               # Set via environment variable
    GEMINI_API_KEY_SECONDARY: str = ""     # Optional second key for user-based routing
    GEMINI_KEY_SELECTION_MODE: str = "hash"  # hash | primary
    GEMINI_MODEL: str = "gemini-2.5-flash"  # Gemini model name
    GEMINI_MAX_TOKENS: int = 4096
    GEMINI_TEMPERATURE: float = 0.3
    GEMINI_TOP_P: float = 0.9
    
    # Llama Configuration (alternative local LLM)
    LLAMA_MODEL_PATH: str = ""             # Path to .gguf model file (for llama_cpp)
    LLAMA_MODEL_REPO: str = "TheBloke/Llama-2-7B-Chat-GGUF"   # HF repo to auto-download from
    LLAMA_MODEL_FILE: str = "llama-2-7b-chat.Q4_K_M.gguf"     # Specific GGUF file name
    LLAMA_HF_MODEL: str = "meta-llama/Llama-2-7b-chat-hf"     # For transformers provider
    LLAMA_CONTEXT_LENGTH: int = 4096
    LLAMA_MAX_TOKENS: int = 1024
    LLAMA_TEMPERATURE: float = 0.3
    LLAMA_TOP_P: float = 0.9
    LLAMA_N_GPU_LAYERS: int = 0            # Number of layers to offload to GPU (0 = CPU only)
    LLAMA_N_THREADS: int = 4               # CPU threads for inference
    
    # Document Processing
    TEMP_UPLOAD_DIR: str = "./temp_uploads"
    USER_UPLOADS_DIR: str = "./user_uploads"
    AUTO_DELETE_AFTER_MINUTES: int = 5
    
    # Compliance Frameworks
    FRAMEWORKS_DATA_DIR: str = "./data/frameworks"
    
    # Audit Prediction Model
    AUDIT_MODEL_PATH: str = "./data/models/audit_predictor.pkl"
    AUDIT_SCALER_PATH: str = "./data/models/audit_scaler.pkl"
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "./logs/aicomplianceguard.log"
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:8000"]
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 10
    
    # Database
    DB_ENCRYPTION_ENABLED: bool = True

    @model_validator(mode="after")
    def validate_security_settings(self):
        """Fail fast on insecure production configuration."""
        environment = (self.ENVIRONMENT or "").strip().lower()
        is_production = environment in {"prod", "production"}

        if not is_production:
            return self

        insecure_markers = {
            "development-secret-key-change-in-production",
            "jwt-secret-change-in-production",
            "dev-secret-do-not-use-in-production",
            "dev-jwt-secret-do-not-use-in-production",
            "dev-32-byte-key-change-prod!!",
            "",
        }

        if self.SECRET_KEY in insecure_markers:
            raise ValueError("SECRET_KEY must be set to a strong, unique value in production")

        if self.JWT_SECRET in insecure_markers:
            raise ValueError("JWT_SECRET must be set to a strong, unique value in production")

        if len(self.AES_ENCRYPTION_KEY or "") < 32 or self.AES_ENCRYPTION_KEY in insecure_markers:
            raise ValueError("AES_ENCRYPTION_KEY must be at least 32 characters and not a default in production")

        if self.CORS_ORIGINS and any(origin.strip() == "*" for origin in self.CORS_ORIGINS):
            raise ValueError("CORS_ORIGINS cannot contain wildcard '*' in production")

        if not self.CORS_ORIGINS:
            raise ValueError("CORS_ORIGINS must be explicitly configured in production")

        if (self.LLM_PROVIDER or "").strip().lower() == "gemini":
            has_primary = bool((self.GEMINI_API_KEY or "").strip())
            has_secondary = bool((self.GEMINI_API_KEY_SECONDARY or "").strip())
            if not (has_primary or has_secondary):
                raise ValueError("At least one Gemini API key is required when LLM_PROVIDER is 'gemini' in production")

            mode = (self.GEMINI_KEY_SELECTION_MODE or "hash").strip().lower()
            if mode not in {"hash", "primary"}:
                raise ValueError("GEMINI_KEY_SELECTION_MODE must be 'hash' or 'primary'")

        return self
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Create settings instance
settings = Settings()

# Ensure directories exist
Path(settings.TEMP_UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
Path(settings.USER_UPLOADS_DIR).mkdir(parents=True, exist_ok=True)
Path(settings.MODEL_CACHE_DIR).mkdir(parents=True, exist_ok=True)
Path(settings.FRAMEWORKS_DATA_DIR).mkdir(parents=True, exist_ok=True)
Path("logs").mkdir(exist_ok=True)
