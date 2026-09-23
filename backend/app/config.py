import os
import re
import logging
from pathlib import Path
from typing import Optional, List
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("trading_engine")

# Paths to authoritative project directories and .env files
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
ROOT_ENV = ROOT_DIR / ".env"
BACKEND_ENV = ROOT_DIR / "backend" / ".env"
CWD_ENV = Path(".env").resolve()


def clean_token_value(token: Optional[str]) -> Optional[str]:
    """Strips whitespace, surrounding quotes, and 'Bearer ' prefix from a token string."""
    if not token:
        return None
    t = token.strip()
    if (t.startswith('"') and t.endswith('"')) or (t.startswith("'") and t.endswith("'")):
        t = t[1:-1].strip()
    if t.lower().startswith("bearer "):
        t = t[7:].strip()
    return t if t else None


def read_token_from_file(path: Path) -> Optional[str]:
    """Extracts UPSTOX_ACCESS_TOKEN from a .env file directly."""
    if not path.is_file():
        return None
    try:
        content = path.read_text(encoding="utf-8")
        match = re.search(r'^\s*UPSTOX_ACCESS_TOKEN\s*=\s*(.+?)\s*$', content, re.MULTILINE)
        if match:
            return clean_token_value(match.group(1))
    except Exception as e:
        logger.debug(f"Error reading token from {path}: {e}")
    return None


def write_token_to_env_files(token: str):
    """Safely updates UPSTOX_ACCESS_TOKEN in both root .env and backend .env."""
    clean = clean_token_value(token)
    if not clean:
        return

    for p in [ROOT_ENV, BACKEND_ENV, CWD_ENV]:
        try:
            if p.is_file():
                content = p.read_text(encoding="utf-8")
                if re.search(r'^\s*UPSTOX_ACCESS_TOKEN\s*=', content, re.MULTILINE):
                    new_content = re.sub(
                        r'^\s*UPSTOX_ACCESS_TOKEN\s*=.*$',
                        f'UPSTOX_ACCESS_TOKEN="{clean}"',
                        content,
                        flags=re.MULTILINE,
                    )
                else:
                    new_content = content.rstrip() + f'\nUPSTOX_ACCESS_TOKEN="{clean}"\n'
                if new_content != content:
                    p.write_text(new_content, encoding="utf-8")
                    logger.info(f"Updated UPSTOX_ACCESS_TOKEN in {p}")
            elif p in (ROOT_ENV, BACKEND_ENV):
                p.write_text(f'UPSTOX_ACCESS_TOKEN="{clean}"\n', encoding="utf-8")
                logger.info(f"Created {p} with UPSTOX_ACCESS_TOKEN")
        except Exception as e:
            logger.warning(f"Could not persist token to {p}: {e}")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[str(ROOT_ENV), str(BACKEND_ENV), ".env"],
        extra="allow",
    )

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
    MARKET_DATA_PROVIDER: str = "UPSTOX"
    UPSTOX_CLIENT_ID: Optional[str] = None
    UPSTOX_CLIENT_SECRET: Optional[str] = None
    UPSTOX_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/upstox/callback"

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

    # Internal state for dynamic hot-reloading from .env
    _in_memory_token: Optional[str] = None
    _last_checked_mtime: float = 0.0

    @property
    def UPSTOX_ACCESS_TOKEN(self) -> Optional[str]:
        """
        Dynamically retrieves the authoritative Upstox access token from:
        1. In-memory runtime override if set
        2. os.environ["UPSTOX_ACCESS_TOKEN"]
        3. Root .env file (auto-reloaded if modified by user)
        4. backend/.env file
        Always returns a sanitized token (no quotes, no 'Bearer ' prefix).
        """
        # Check if root .env file has been modified on disk
        current_mtime = 0.0
        for p in [ROOT_ENV, BACKEND_ENV]:
            if p.is_file():
                try:
                    current_mtime = max(current_mtime, p.stat().st_mtime)
                except Exception:
                    pass

        if current_mtime > self._last_checked_mtime:
            self._last_checked_mtime = current_mtime
            # Re-read token from disk
            token_from_file = read_token_from_file(ROOT_ENV) or read_token_from_file(BACKEND_ENV)
            if token_from_file:
                self._in_memory_token = token_from_file
                os.environ["UPSTOX_ACCESS_TOKEN"] = token_from_file

        if self._in_memory_token:
            return self._in_memory_token

        env_val = clean_token_value(os.environ.get("UPSTOX_ACCESS_TOKEN"))
        if env_val:
            self._in_memory_token = env_val
            return env_val

        # Fallback disk read
        disk_token = read_token_from_file(ROOT_ENV) or read_token_from_file(BACKEND_ENV) or read_token_from_file(CWD_ENV)
        if disk_token:
            self._in_memory_token = disk_token
            os.environ["UPSTOX_ACCESS_TOKEN"] = disk_token
            return disk_token

        return None

    @UPSTOX_ACCESS_TOKEN.setter
    def UPSTOX_ACCESS_TOKEN(self, value: Optional[str]):
        """Sets the token in memory, os.environ, and persists to both .env files."""
        clean = clean_token_value(value)
        self._in_memory_token = clean
        if clean:
            os.environ["UPSTOX_ACCESS_TOKEN"] = clean
            write_token_to_env_files(clean)

    def set_upstox_token(self, token: str):
        """Authoritative method to update Upstox token across all storage layers."""
        self.UPSTOX_ACCESS_TOKEN = token


settings = Settings()
