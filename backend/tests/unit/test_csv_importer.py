import pytest
import pytest_asyncio
from datetime import datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.core.database import Base
from app.models.market import Instrument, MarketCandle
from app.services.market_data.csv_importer import CSVMarketDataImporter


@pytest_asyncio.fixture
async def test_db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        # Seed test instrument
        inst = Instrument(
            symbol="NIFTY 50",
            name="NIFTY 50 Benchmark",
            exchange="NSE",
            lot_size=25,
            tick_size=0.05,
            instrument_type="INDEX",
        )
        session.add(inst)
        await session.commit()
        yield session

    await engine.dispose()


@pytest.mark.asyncio
async def test_csv_importer_valid_and_duplicates(test_db: AsyncSession):
    # CSV content with:
    # 2 valid rows
    # 1 duplicate timestamp row
    # 1 invalid OHLC row (High < Open)
    # 1 row outside session hours (08:00 AM)
    csv_content = """timestamp,open,high,low,close,volume,instrument
2026-01-05 09:15:00,25000,25050,24980,25020,100000,NIFTY 50
2026-01-05 09:16:00,25020,25060,25010,25040,120000,NIFTY 50
2026-01-05 09:16:00,25020,25060,25010,25040,120000,NIFTY 50
2026-01-05 09:17:00,25040,24900,24800,24850,50000,NIFTY 50
2026-01-05 08:00:00,25000,25010,24990,25005,10000,NIFTY 50
"""
    importer = CSVMarketDataImporter(test_db)
    summary = await importer.import_csv_content(csv_content, "test.csv", "NIFTY 50")

    assert summary.status == "SUCCESS"
    assert summary.total_rows == 5
    assert summary.valid_rows == 2
    assert summary.duplicate_rows == 1
    assert summary.invalid_rows == 2  # 1 invalid OHLC + 1 outside session
