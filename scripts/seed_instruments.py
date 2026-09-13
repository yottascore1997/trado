import asyncio
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from sqlalchemy import select
from app.core.database import AsyncSessionLocal, init_db
from app.models.market import Instrument
from app.core.logger import logger

DEFAULT_INSTRUMENTS = [
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
]


async def seed():
    await init_db()
    async with AsyncSessionLocal() as session:
        for inst_data in DEFAULT_INSTRUMENTS:
            stmt = select(Instrument).where(Instrument.symbol == inst_data["symbol"])
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none()

            if not existing:
                inst = Instrument(**inst_data)
                session.add(inst)
                logger.info(f"Seeding instrument: {inst_data['symbol']}")
            else:
                logger.info(f"Instrument already exists: {inst_data['symbol']}")

        await session.commit()
    logger.info("Instrument seeding completed.")


if __name__ == "__main__":
    asyncio.run(seed())
