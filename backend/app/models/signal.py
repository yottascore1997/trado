import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Signal(Base):
    __tablename__ = "signals"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    timeframe = Column(String(10), default="1m", nullable=False)
    signal_type = Column(String(20), nullable=False)  # BUY, SELL, NO_TRADE

    entry_price = Column(Float, nullable=True)
    stop_loss = Column(Float, nullable=True)
    target_price = Column(Float, nullable=True)
    risk_reward = Column(Float, nullable=True)

    ai_score = Column(Float, nullable=True)  # 0 to 100
    technical_score = Column(Float, nullable=True)  # 0 to 100
    market_regime = Column(String(30), nullable=True)  # TRENDING_BULLISH, TRENDING_BEARISH, SIDEWAYS, etc.
    setup_type = Column(String(50), nullable=True)  # VWAP_BREAKOUT, EMA_PULLBACK, etc.
    status = Column(String(30), default="ACTIVE", index=True)  # ACTIVE, TRIGGERED, EXPIRED, INVALIDATED, COMPLETED

    reason_summary = Column(JSON, nullable=True)  # Structured reasons & risk notes
    model_id = Column(String(36), ForeignKey("ai_models.id"), nullable=True)

    expired_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    instrument = relationship("Instrument", back_populates="signals")
    ai_model = relationship("AIModel", back_populates="signals")
    paper_trades = relationship("PaperTrade", back_populates="signal")


class AIPrediction(Base):
    __tablename__ = "ai_predictions"

    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(String(36), ForeignKey("ai_models.id"), nullable=False)
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False)
    timestamp = Column(DateTime, nullable=False, index=True)
    raw_probability = Column(Float, nullable=False)
    calibrated_score = Column(Float, nullable=False)
    feature_importances = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    ai_model = relationship("AIModel", back_populates="predictions")


class MarketEvent(Base):
    __tablename__ = "market_events"

    id = Column(Integer, primary_key=True, index=True)
    event_time = Column(DateTime, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    severity = Column(String(20), default="MEDIUM", nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    instrument = Column(String(50), nullable=True)
    source = Column(String(100), nullable=True)
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
