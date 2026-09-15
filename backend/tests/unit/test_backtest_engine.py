import pytest
from app.services.backtest_engine import BacktestEngine
from app.core.database import AsyncSessionLocal


@pytest.mark.asyncio
async def test_backtest_engine_run():
    async with AsyncSessionLocal() as db:
        engine = BacktestEngine(db)
        for sym in ["NIFTY 50", "BANK NIFTY", "RELIANCE"]:
            result = await engine.run_backtest(symbol=sym, initial_capital=100000.0)

            assert "total_candles" in result
            assert result["total_candles"] > 0
            assert "summary" in result
            summary = result["summary"]
            assert summary["total_trades"] > 0
            assert summary["win_rate"] >= 60.0
            assert summary["capital_protection_rate"] >= 60.0
            assert summary["net_pnl"] > 0.0
            assert "equity_curve" in result
            assert len(result["equity_curve"]) > 1
            assert "trades" in result
            assert len(result["trades"]) > 0

