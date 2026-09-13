from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, func

from app.config import settings
from app.core.database import get_db
from app.models.market import Instrument, MarketCandle
from app.models.ai_model import AIModel
from app.schemas.system import SystemStatusOut, HealthCheckOut
from app.services.market_data.validator import is_indian_market_session

router = APIRouter(prefix="/system", tags=["System Status"])

MANDATORY_DISCLAIMER = (
    "AI signals are probabilistic analysis, not guaranteed returns. "
    "Past backtest performance does not guarantee future results. "
    "Use paper trading before risking real capital."
)


@router.get("/health", response_model=HealthCheckOut)
async def health_check():
    """Liveness probe."""
    return HealthCheckOut(
        status="healthy",
        app_name=settings.APP_NAME,
        version="1.0.0",
        timestamp=datetime.now(timezone.utc),
    )


@router.get("/status", response_model=SystemStatusOut)
async def get_system_status(db: AsyncSession = Depends(get_db)):
    """Comprehensive system status across DB, Market Data, Model, and Session."""
    # 1. Database check
    db_status = "CONNECTED"
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        db_status = "ERROR"

    # 2. Market Data & Last Candle Check
    latest_candle_ts = None
    try:
        stmt = select(func.max(MarketCandle.timestamp))
        res = await db.execute(stmt)
        latest_candle_ts = res.scalar_one_or_none()
    except Exception:
        pass

    # Active instruments count
    inst_count = 0
    try:
        res = await db.execute(select(func.count(Instrument.id)).where(Instrument.is_active == True))
        inst_count = res.scalar_one()
    except Exception:
        pass

    # 3. Active AI Model check
    model_status = "UNAVAILABLE"
    active_version = None
    try:
        m_stmt = select(AIModel).where(AIModel.is_active == True)
        m_res = await db.execute(m_stmt)
        active_model = m_res.scalar_one_or_none()
        if active_model:
            model_status = "READY"
            active_version = active_model.version
    except Exception:
        pass

    now_utc = datetime.now(timezone.utc)
    market_is_open = is_indian_market_session(now_utc)

    # Calculate latency if candle exists
    latency_ms = None
    if latest_candle_ts:
        latency_ms = max(0.0, (now_utc - latest_candle_ts.replace(tzinfo=timezone.utc)).total_seconds() * 1000)

    market_data_status = "CONNECTED"
    if latency_ms and latency_ms > 300000 and market_is_open:
        # > 5 minutes without a candle during market hours
        market_data_status = "STALE"

    return SystemStatusOut(
        market_data_provider=settings.MARKET_DATA_PROVIDER,
        market_data_status=market_data_status,
        database_status=db_status,
        ai_model_status=model_status,
        active_model_version=active_version,
        websocket_status="READY",
        last_candle_timestamp=latest_candle_ts,
        data_latency_ms=round(latency_ms, 1) if latency_ms else None,
        market_session="OPEN" if market_is_open else "CLOSED",
        active_instruments=inst_count,
        system_mode="PAPER" if settings.DEBUG else "LIVE",
        disclaimer=MANDATORY_DISCLAIMER,
    )
