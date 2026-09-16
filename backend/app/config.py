from typing import Optional, List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=[".env", "../.env", "backend/.env"], extra="allow")

    APP_NAME: str = "AI Intraday Signal Engine"
    APP_ENV: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./trading.db"

    # Security
    JWT_SECRET: str = "super-secret-key-change-this-in-production-min-32-chars-long"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Market Data
    MARKET_DATA_PROVIDER: str = "MOCK"
    UPSTOX_CLIENT_ID: Optional[str] = None
    UPSTOX_CLIENT_SECRET: Optional[str] = None
    UPSTOX_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/upstox/callback"
    UPSTOX_ACCESS_TOKEN: Optional[str] = None

    ZERODHA_API_KEY: Optional[str] = None
    ZERODHA_API_SECRET: Optional[str] = None
    ZERODHA_ACCESS_TOKEN: Optional[str] = None

    # Telegram
    TELEGRAM_BOT_TOKEN: Optional[str] = None
    TELEGRAM_CHAT_ID: Optional[str] = None
    TELEGRAM_NOTIFICATIONS_ENABLED: bool = False

    # Risk Defaults
    DEFAULT_CAPITAL: float = 100000.0
    RISK_PER_TRADE_PCT: float = 0.5
    MAX_DAILY_LOSS_PCT: float = 1.0
    MAX_TRADES_PER_DAY: int = 5
    MAX_CONSECUTIVE_LOSSES: int = 2
    MIN_RISK_REWARD: float = 2.0
    TRADING_START_TIME: str = "09:20:00"
    TRADING_END_TIME: str = "15:10:00"
    AI_SCORE_THRESHOLD: float = 70.0

    # Redis (optional in local dev)
    REDIS_URL: str = "redis://localhost:6379/0"

    # CORS
    CORS_ORIGINS: List[str] = ["*"]


settings = Settings()
