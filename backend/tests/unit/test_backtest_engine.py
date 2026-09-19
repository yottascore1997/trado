import pytest
from datetime import datetime, timezone, timedelta
from app.services.backtest_engine import BacktestEngine
from app.core.database import AsyncSessionLocal, init_db
from app.models.market import Instrument, MarketCandle
from sqlalchemy import select


@pytest.mark.asyncio
async def test_backtest_engine_run():
    await init_db()
    async with AsyncSessionLocal() as db:
        stmt = select(Instrument).where(Instrument.symbol == "NIFTY 50")
        res = await db.execute(stmt)
        inst = res.scalar_one_or_none()
        if not inst:
            inst = Instrument(
                symbol="NIFTY 50",
                name="NIFTY 50 Benchmark Index",
                exchange="NSE",
                lot_size=25,
                tick_size=0.05,
                instrument_type="INDEX",
                is_active=True,
            )
            db.add(inst)
            await db.commit()
            await db.refresh(inst)

        # Ensure test candles exist for backtesting
        c_stmt = select(MarketCandle).where(MarketCandle.instrument_id == inst.id)
        c_res = await db.execute(c_stmt)
        candles = c_res.scalars().all()
        if not candles:
            base_time = datetime.now(timezone.utc) - timedelta(days=1)
            for i in range(120):
                p = 23000.0 + (i * 2.0 if i % 10 < 5 else -i * 1.5)
                candle = MarketCandle(
                    instrument_id=inst.id,
                    timestamp=base_time + timedelta(minutes=i),
                    timeframe="1m",
                    open=p,
                    high=p + 5.0,
                    low=p - 5.0,
                    close=p + 2.0,
                    volume=15000,
                )
                db.add(candle)
            await db.commit()

        engine = BacktestEngine(db)
        result = await engine.run_backtest(symbol="NIFTY 50", initial_capital=100000.0)

        assert "total_candles" in result
        assert result["total_candles"] > 0
        assert "summary" in result
        assert "trades" in result

