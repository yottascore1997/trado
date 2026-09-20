from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.core.database import get_db
from app.models.market import Instrument, MarketCandle
from app.schemas.market import (
    InstrumentCreate,
    InstrumentOut,
    CandleOut,
    QuoteOut,
    CSVIngestionSummary,
)
from app.services.market_data.factory import get_market_data_provider
from app.services.market_data.csv_importer import CSVMarketDataImporter
from app.api.deps import get_current_user, get_optional_current_user
from app.models.user import User

router = APIRouter(prefix="/market", tags=["Market Data"])


@router.get("/instruments", response_model=List[InstrumentOut])
async def list_instruments(db: AsyncSession = Depends(get_db)):
    """List all supported instruments."""
    stmt = select(Instrument).where(Instrument.is_active == True).order_by(Instrument.symbol)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/instruments", response_model=InstrumentOut, status_code=status.HTTP_201_CREATED)
async def create_instrument(
    inst_in: InstrumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """Register a new tradable instrument."""
    stmt = select(Instrument).where(Instrument.symbol == inst_in.symbol.upper())
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Instrument '{inst_in.symbol}' already exists.",
        )

    instrument = Instrument(
        symbol=inst_in.symbol.upper(),
        name=inst_in.name,
        exchange=inst_in.exchange.upper(),
        lot_size=inst_in.lot_size,
        tick_size=inst_in.tick_size,
        instrument_type=inst_in.instrument_type.upper(),
    )
    db.add(instrument)
    await db.commit()
    await db.refresh(instrument)
    return instrument


@router.get("/quote", response_model=QuoteOut)
async def get_quote(
    symbol: str = Query("NIFTY 50", description="Instrument symbol (e.g. NIFTY 50, BANK NIFTY)"),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve the latest quote for an instrument."""
    provider = get_market_data_provider()
    quote = await provider.get_live_price(symbol)
    return QuoteOut(**quote)


@router.get("/candles", response_model=List[CandleOut])
async def get_candles(
    symbol: str = Query("NIFTY 50", description="Instrument symbol"),
    timeframe: str = Query("1m", description="Timeframe (1m, 3m, 5m, 15m)"),
    limit: int = Query(500, ge=1, le=5000, description="Max candle count"),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch historical candles for charting and analysis.
    If database contains no candles for this instrument, notifies that historical market data is required.
    """
    stmt = select(Instrument).where(Instrument.symbol == symbol.upper())
    res = await db.execute(stmt)
    instrument = res.scalar_one_or_none()

    if not instrument:
        raise HTTPException(status_code=404, detail=f"Instrument '{symbol}' not found.")

    query = select(MarketCandle).where(
        MarketCandle.instrument_id == instrument.id,
        MarketCandle.timeframe == timeframe,
    )

    if start_date:
        query = query.where(MarketCandle.timestamp >= start_date)
    if end_date:
        query = query.where(MarketCandle.timestamp <= end_date)

    query = query.order_by(desc(MarketCandle.timestamp)).limit(limit)
    result = await db.execute(query)
    candles = result.scalars().all()

    # Return chronological order for charts
    return list(reversed(candles))


@router.post("/upload-csv", response_model=CSVIngestionSummary)
async def upload_historical_csv(
    file: UploadFile = File(...),
    symbol: Optional[str] = Query(None, description="Target instrument symbol (optional if defined in CSV)"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Upload and validate historical 1-minute CSV market data.
    Enforces strict OHLC bounds, Indian session hours (09:15-15:30 IST), deduplication, and logging.
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported.")

    content = await file.read()
    content_str = content.decode("utf-8", errors="replace")

    importer = CSVMarketDataImporter(db)
    summary = await importer.import_csv_content(
        file_content=content_str,
        file_name=file.filename,
        target_symbol=symbol,
    )

    return summary


@router.get("/status")
async def get_market_data_status(
    symbol: str = Query("NIFTY 50"),
    db: AsyncSession = Depends(get_db),
):
    """
    Checks if historical data exists or if market data is required.
    """
    stmt = select(Instrument).where(Instrument.symbol == symbol.upper())
    res = await db.execute(stmt)
    instrument = res.scalar_one_or_none()

    if not instrument:
        return {
            "symbol": symbol,
            "has_data": False,
            "candle_count": 0,
            "status_message": f"Instrument {symbol} not found.",
        }

    count_stmt = select(func.count(MarketCandle.id)).where(MarketCandle.instrument_id == instrument.id)
    count_res = await db.execute(count_stmt)
    candle_count = count_res.scalar_one()

    if candle_count == 0:
        return {
            "symbol": symbol,
            "has_data": False,
            "candle_count": 0,
            "status_message": "Historical market data required.",
        }

    # Fetch min and max timestamps
    min_max_stmt = select(
        func.min(MarketCandle.timestamp),
        func.max(MarketCandle.timestamp),
    ).where(MarketCandle.instrument_id == instrument.id)
    min_max_res = await db.execute(min_max_stmt)
    min_ts, max_ts = min_max_res.one()

    return {
        "symbol": symbol,
        "has_data": True,
        "candle_count": candle_count,
        "start_timestamp": min_ts,
        "end_timestamp": max_ts,
        "status_message": "Historical data ready.",
    }


@router.get("/screener")
async def get_stock_screener_results(
    wallet_budget: Optional[float] = Query(None, description="Isolated wallet budget in INR"),
    mode: Optional[str] = Query(None, description="Trading mode: INTRADAY_STOCKS, BANKNIFTY_OPTIONS, etc."),
    risk_pct: Optional[float] = Query(None, description="Risk per trade percentage"),
):
    """
    Execute multi-stage stock screener funnel with dynamic wallet sizing:
    NSE Liquid Universe -> Volume/Volatility -> Technical Setup -> Index Alignment -> AI Ranked Setups.
    """
    from app.services.stock_screener import stock_screener_service
    return stock_screener_service.run_screener(
        wallet_budget=wallet_budget,
        mode=mode,
        risk_pct=risk_pct,
    )


@router.get("/indices")
async def get_indices():
    """
    Fetch real-time quotes and momentum state for NIFTY 50 and BANK NIFTY directly from Upstox.
    """
    from app.services.stock_screener import stock_screener_service
    return stock_screener_service.get_indices_status()


@router.get("/top-setups")
async def get_top_setups(
    wallet_budget: Optional[float] = Query(None, description="Isolated wallet budget in INR"),
    mode: Optional[str] = Query(None, description="Trading mode: INTRADAY_STOCKS, BANKNIFTY_OPTIONS, etc."),
    risk_pct: Optional[float] = Query(None, description="Risk per trade percentage"),
):
    """
    Fetch the highest-conviction intraday setups (Top 5) and benchmark indices sized to wallet.
    """
    from app.services.stock_screener import stock_screener_service
    res = stock_screener_service.run_screener(
        wallet_budget=wallet_budget,
        mode=mode,
        risk_pct=risk_pct,
    )
    return {
        "indices": res["indices"],
        "top_setups": res["top_setups"],
        "funnel": res["funnel"],
        "wallet_metrics": res.get("wallet_metrics"),
    }


@router.get("/datasets")
async def list_available_datasets(db: AsyncSession = Depends(get_db)):
    """
    Lists all market instruments in SQLite and their ingested historical candle counts and date boundaries.
    """
    stmt = select(Instrument).where(Instrument.is_active == True).order_by(Instrument.symbol)
    res = await db.execute(stmt)
    instruments = res.scalars().all()

    datasets = []
    for inst in instruments:
        count_stmt = select(func.count(MarketCandle.id)).where(MarketCandle.instrument_id == inst.id)
        count_res = await db.execute(count_stmt)
        c_count = count_res.scalar_one()

        min_max_stmt = select(
            func.min(MarketCandle.timestamp),
            func.max(MarketCandle.timestamp),
        ).where(MarketCandle.instrument_id == inst.id)
        mm_res = await db.execute(min_max_stmt)
        min_ts, max_ts = mm_res.one()

        datasets.append({
            "id": inst.id,
            "symbol": inst.symbol,
            "name": inst.name,
            "exchange": inst.exchange,
            "candle_count": c_count,
            "has_data": c_count > 0,
            "start_timestamp": min_ts.strftime("%Y-%m-%d %H:%M") if min_ts else None,
            "end_timestamp": max_ts.strftime("%Y-%m-%d %H:%M") if max_ts else None,
            "status": "READY" if c_count > 0 else "NO_DATA",
        })

    return datasets


@router.get("/backtest/run")
async def run_backtest_simulation(
    symbol: str = Query("NIFTY 50", description="Instrument symbol (NIFTY 50, BANK NIFTY, RELIANCE)"),
    strategy: str = Query("PRICE_ACTION_V2", description="Trading strategy (PRICE_ACTION_V2, VWAP_BREAKOUT)"),
    capital: float = Query(100000.0, description="Initial virtual capital"),
    db: AsyncSession = Depends(get_db),
):
    """
    Run intraday backtest simulation on actual stored SQLite 1-minute historical candles.
    """
    from app.services.backtest_engine import BacktestEngine
    engine = BacktestEngine(db)
    result = await engine.run_backtest(
        symbol=symbol,
        strategy=strategy,
        initial_capital=capital,
    )
    return result


@router.get("/trading-plan")
async def get_trading_plan():
    """
    Retrieve active isolated Virtual Wallet budget, trading mode, risk controls, and buying power metrics.
    """
    from app.services.trading_plan_manager import trading_plan_manager
    plan = trading_plan_manager.get_plan()
    metrics = trading_plan_manager.calculate_metrics()
    return {
        **plan,
        "metrics": metrics.model_dump(),
    }


@router.post("/trading-plan")
async def update_trading_plan(update_data: dict):
    """
    Update isolated Virtual Wallet budget (e.g. ₹10,000 / ₹1,00,000), mode, and risk parameters.
    """
    from app.services.trading_plan_manager import trading_plan_manager
    from app.schemas.trading_plan import TradingPlanUpdate
    plan_in = TradingPlanUpdate(**update_data)
    res = trading_plan_manager.update_plan(plan_in)
    return res.model_dump()


@router.post("/trading-plan/kill-switch")
async def toggle_kill_switch(payload: Optional[dict] = None):
    """
    Emergency Halt & Circuit Breaker: Immediately freeze all trading operations.
    """
    from app.services.trading_plan_manager import trading_plan_manager
    active_val = payload.get("active") if payload else None
    new_state = trading_plan_manager.toggle_kill_switch(active_val)
    return {
        "kill_switch_active": new_state,
        "message": "KILL SWITCH TRIPPED: All automated orders frozen." if new_state else "SYSTEM ARMED: Trading operational.",
    }


@router.post("/execute-order")
async def execute_trade_order(order_payload: dict):
    """
    Execute/Simulate trade order with strict Virtual Wallet Ring-Fencing and Upstox API payload generation.
    """
    from app.services.trading_plan_manager import trading_plan_manager
    from app.schemas.trading_plan import ExecuteOrderIn
    try:
        order_in = ExecuteOrderIn(**order_payload)
        res = trading_plan_manager.execute_order(order_in)
        return res.model_dump()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/broker/status")
async def get_broker_status():
    """
    Returns live broker connection health, authenticated user profile, and funds summary.
    """
    from app.config import settings
    from app.services.market_data.factory import get_market_data_provider, set_market_data_provider

    provider = get_market_data_provider()

    # If provider is not Upstox but token is present, switch it to Upstox
    if not hasattr(provider, "get_user_profile") and settings.UPSTOX_ACCESS_TOKEN:
        provider = set_market_data_provider("UPSTOX", access_token=settings.UPSTOX_ACCESS_TOKEN)

    if hasattr(provider, "get_user_profile"):
        profile = await provider.get_user_profile()
        funds = await provider.get_funds_and_margin()
        token_expired = profile.get("token_expired", False)
        return {
            "connected": not token_expired,
            "token_valid": not token_expired,
            "broker": "UPSTOX",
            "user_name": profile.get("user_name", "MAYUR NANDLAL KHOTELE"),
            "user_id": profile.get("user_id", "HX3888"),
            "email": profile.get("email", "mayurkhotele1111@gmail.com"),
            "is_active": not token_expired,
            "funds": funds,
            "provider_mode": "UPSTOX_LIVE_API_V2" if not token_expired else "UPSTOX_TOKEN_EXPIRED",
            "error": profile.get("error") if token_expired else None,
        }
    else:
        return {
            "connected": False,
            "token_valid": False,
            "broker": "UPSTOX",
            "user_name": "Upstox User",
            "user_id": "DISCONNECTED",
            "is_active": False,
            "provider_mode": "DISCONNECTED",
        }


@router.post("/broker/update-token")
async def update_broker_token(payload: dict):
    """
    Dynamically update Upstox Access Token for today's market session without restarting server.
    """
    token = payload.get("access_token")
    if not token or len(token.strip()) < 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or empty Upstox access token provided.",
        )

    clean_token = token.strip()
    # Auto-strip 'Bearer ' or 'bearer ' if user copied it along with token
    if clean_token.lower().startswith("bearer "):
        clean_token = clean_token[7:].strip()

    from app.config import settings
    settings.UPSTOX_ACCESS_TOKEN = clean_token
    settings.MARKET_DATA_PROVIDER = "UPSTOX"

    # Reset & instantiate Upstox provider with the new token
    from app.services.market_data.factory import set_market_data_provider
    provider = set_market_data_provider("UPSTOX", access_token=clean_token)

    # Persist to .env if possible
    import re
    from pathlib import Path
    try:
        for p in [Path(__file__).resolve().parent.parent.parent.parent / ".env", Path(".env"), Path("backend/.env")]:
            if p.exists():
                text = p.read_text(encoding="utf-8")
                if "UPSTOX_ACCESS_TOKEN" in text:
                    text = re.sub(r'UPSTOX_ACCESS_TOKEN=".*?"', f'UPSTOX_ACCESS_TOKEN="{clean_token}"', text)
                else:
                    text += f'\nUPSTOX_ACCESS_TOKEN="{clean_token}"\n'
                p.write_text(text, encoding="utf-8")
                break
    except Exception as e:
        logger.warning(f"Could not persist token to .env: {e}")

    # Immediately verify token with Upstox API
    profile = await provider.get_user_profile()
    token_expired = profile.get("token_expired", False)
    if token_expired:
        error_msg = profile.get("error") or "Upstox rejected this token (HTTP 401). The token may have expired or is invalid for today's session."
        return {
            "success": False,
            "connected": False,
            "token_valid": False,
            "message": error_msg,
            "profile": profile,
        }

    return {
        "success": True,
        "connected": True,
        "token_valid": True,
        "message": f"Successfully connected to Upstox as {profile.get('user_name', 'User')} ({profile.get('user_id', '')})",
        "profile": profile,
    }


# =====================================================================
# ZERO-RISK AUTOMATED PAPER TRADING & DAY-WISE P&L LEDGER ENDPOINTS
# =====================================================================

@router.get("/paper/summary")
async def get_paper_summary():
    """
    Returns live paper trading metrics: Virtual Wallet (₹10,000), Margin Locked,
    Unrealized MTM, Today's Realized P&L, Auto-Trading Status, and Open Positions.
    """
    from app.services.paper_trading_engine import paper_trading_engine
    return paper_trading_engine.get_summary()


@router.get("/paper/daywise-pnl")
async def get_paper_daywise_pnl():
    """
    Returns complete Date-by-Date P&L Ledger:
    Date, Total Trades, Wins, Losses, Win Rate %, Gross PnL, Charges, Net PnL, ROI % on Wallet.
    """
    from app.services.paper_trading_engine import paper_trading_engine
    return paper_trading_engine.get_daywise_pnl()


@router.post("/paper/toggle-auto")
async def toggle_paper_auto_trading(payload: Optional[dict] = None):
    """
    Arms or pauses automated trade execution on Upstox Live feed.
    """
    from app.services.paper_trading_engine import paper_trading_engine
    enabled = payload.get("enabled") if payload else None
    new_state = paper_trading_engine.toggle_auto_trading(enabled)
    return {
        "auto_trading_enabled": new_state,
        "status": "ARMED" if new_state else "PAUSED",
        "message": "Auto-trading operational: Taking A+/A setups on Upstox live feed." if new_state else "Auto-trading paused.",
    }


@router.post("/paper/close-position")
async def close_paper_position(payload: dict):
    """
    Closes an active open paper trade manually.
    """
    from app.services.paper_trading_engine import paper_trading_engine
    position_id = payload.get("position_id")
    if not position_id:
        raise HTTPException(status_code=400, detail="Missing position_id")

    res = paper_trading_engine.close_position(position_id, reason="MANUAL_CLOSE")
    if not res:
        raise HTTPException(status_code=404, detail="Position not found or already closed")
    return res


@router.post("/paper/reset")
async def reset_paper_wallet(payload: Optional[dict] = None):
    """
    Resets Virtual Wallet balance (e.g. ₹10,000) and starts fresh.
    """
    from app.services.paper_trading_engine import paper_trading_engine
    budget = payload.get("budget", 10000.0) if payload else 10000.0
    paper_trading_engine.reset_account(budget)
    return {
        "success": True,
        "message": f"Virtual wallet reset safely to ₹{budget:,.0f}.",
        "summary": paper_trading_engine.get_summary(),
    }





