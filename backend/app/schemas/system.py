from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel


class HealthCheckOut(BaseModel):
    status: str
    app_name: str
    version: str
    timestamp: datetime


class SystemStatusOut(BaseModel):
    market_data_provider: str
    market_data_status: str  # CONNECTED, STALE, OFFLINE
    database_status: str  # CONNECTED, ERROR
    ai_model_status: str  # READY, UNAVAILABLE
    active_model_version: Optional[str] = None
    websocket_status: str  # READY, OFFLINE
    last_candle_timestamp: Optional[datetime] = None
    data_latency_ms: Optional[float] = None
    market_session: str  # OPEN, CLOSED
    active_instruments: int
    system_mode: str  # HISTORICAL, PAPER, LIVE
    disclaimer: str
