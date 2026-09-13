import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class BacktestRun(Base):
    __tablename__ = "backtest_runs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    timeframe = Column(String(10), default="1m", nullable=False)

    strategy_config = Column(JSON, nullable=False)
    risk_config = Column(JSON, nullable=False)
    model_id = Column(String(36), ForeignKey("ai_models.id"), nullable=True)

    status = Column(String(20), default="PENDING", index=True)  # PENDING, RUNNING, COMPLETED, FAILED

    total_trades = Column(Integer, default=0)
    winning_trades = Column(Integer, default=0)
    losing_trades = Column(Integer, default=0)
    win_rate = Column(Float, default=0.0)
    profit_factor = Column(Float, default=0.0)
    gross_profit = Column(Float, default=0.0)
    gross_loss = Column(Float, default=0.0)
    net_profit = Column(Float, default=0.0)
    max_drawdown = Column(Float, default=0.0)
    expectancy = Column(Float, default=0.0)
    sharpe_ratio = Column(Float, default=0.0)
    sortino_ratio = Column(Float, default=0.0)

    summary_metrics = Column(JSON, nullable=True)  # Detailed breakdowns (hour, weekday, regime, etc.)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="backtest_runs")
    ai_model = relationship("AIModel", back_populates="backtest_runs")
    trades = relationship("BacktestTrade", back_populates="backtest_run", cascade="all, delete-orphan")


class BacktestTrade(Base):
    __tablename__ = "backtest_trades"

    id = Column(Integer, primary_key=True, index=True)
    backtest_id = Column(String(36), ForeignKey("backtest_runs.id"), nullable=False, index=True)
    trade_number = Column(Integer, nullable=False)

    entry_time = Column(DateTime, nullable=False)
    exit_time = Column(DateTime, nullable=False)
    side = Column(String(10), nullable=False)
    entry_price = Column(Float, nullable=False)
    exit_price = Column(Float, nullable=False)
    quantity = Column(Integer, nullable=False)
    pnl = Column(Float, nullable=False)
    return_pct = Column(Float, nullable=False)
    exit_reason = Column(String(50), nullable=False)
    holding_bars = Column(Integer, default=0)

    backtest_run = relationship("BacktestRun", back_populates="trades")
