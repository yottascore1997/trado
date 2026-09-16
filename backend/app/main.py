import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config import settings
from app.core.database import init_db, AsyncSessionLocal
from app.core.logger import logger
from app.models.market import Instrument
from app.api.v1 import auth, market, risk, system


async def background_market_poller():
    """Continuously runs in background every 4s to scan Upstox live feed and update paper trades."""
    logger.info("Background Upstox Live Market Poller started.")
    await asyncio.sleep(2.0)  # brief warm-up delay
    while True:
        try:
            from app.services.stock_screener import stock_screener_service
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, stock_screener_service.run_screener)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.debug(f"Background market scan: {e}")
        await asyncio.sleep(4.0)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database tables and default instruments
    logger.info("Starting up AI Intraday Signal Engine...")
    await init_db()

    # Seed initial instruments if missing
    async with AsyncSessionLocal() as session:
        default_instruments = [
            # Indices
            {
                "symbol": "NIFTY 50",
                "name": "NIFTY 50 Benchmark Index",
                "exchange": "NSE",
                "lot_size": 25,
                "tick_size": 0.05,
                "instrument_type": "INDEX",
            },
            {
                "symbol": "BANK NIFTY",
                "name": "NIFTY Bank Sectoral Index",
                "exchange": "NSE",
                "lot_size": 15,
                "tick_size": 0.05,
                "instrument_type": "INDEX",
            },
            # Top Liquid NSE Stocks
            {
                "symbol": "RELIANCE",
                "name": "Reliance Industries Ltd",
                "exchange": "NSE",
                "lot_size": 250,
                "tick_size": 0.05,
                "instrument_type": "STOCK",
            },
            {
                "symbol": "SBIN",
                "name": "State Bank of India",
                "exchange": "NSE",
                "lot_size": 750,
                "tick_size": 0.05,
                "instrument_type": "STOCK",
            },
            {
                "symbol": "ICICIBANK",
                "name": "ICICI Bank Ltd",
                "exchange": "NSE",
                "lot_size": 700,
                "tick_size": 0.05,
                "instrument_type": "STOCK",
            },
            {
                "symbol": "HDFCBANK",
                "name": "HDFC Bank Ltd",
                "exchange": "NSE",
                "lot_size": 550,
                "tick_size": 0.05,
                "instrument_type": "STOCK",
            },
            {
                "symbol": "INFY",
                "name": "Infosys Ltd",
                "exchange": "NSE",
                "lot_size": 400,
                "tick_size": 0.05,
                "instrument_type": "STOCK",
            },
            {
                "symbol": "TATASTEEL",
                "name": "Tata Steel Ltd",
                "exchange": "NSE",
                "lot_size": 5500,
                "tick_size": 0.05,
                "instrument_type": "STOCK",
            },
            {
                "symbol": "TCS",
                "name": "Tata Consultancy Services Ltd",
                "exchange": "NSE",
                "lot_size": 175,
                "tick_size": 0.05,
                "instrument_type": "STOCK",
            },
            {
                "symbol": "BHARTIARTL",
                "name": "Bharti Airtel Ltd",
                "exchange": "NSE",
                "lot_size": 475,
                "tick_size": 0.05,
                "instrument_type": "STOCK",
            },
        ]
        for inst_data in default_instruments:
            stmt = select(Instrument).where(Instrument.symbol == inst_data["symbol"])
            res = await session.execute(stmt)
            if not res.scalar_one_or_none():
                session.add(Instrument(**inst_data))
                logger.info(f"Initialized default instrument: {inst_data['symbol']}")
        await session.commit()

    logger.info("Application ready.")
    poller_task = asyncio.create_task(background_market_poller())
    try:
        yield
    finally:
        logger.info("Shutting down AI Intraday Signal Engine...")
        poller_task.cancel()


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description=(
        "Production-ready AI-powered intraday trading signal platform for Indian stock markets "
        "(NSE: NIFTY 50, BANK NIFTY). Generates BUY / SELL / NO TRADE signals, paper trading, and analytics."
    ),
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(market.router, prefix="/api/v1")
app.include_router(risk.router, prefix="/api/v1")
app.include_router(system.router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "status": "online",
        "market": "NSE (NIFTY 50 & BANK NIFTY)",
        "disclaimer": system.MANDATORY_DISCLAIMER,
    }
