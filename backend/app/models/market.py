from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    Index,
    JSON,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class Instrument(Base):
    __tablename__ = "instruments"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    exchange = Column(String(20), default="NSE", nullable=False)
    lot_size = Column(Integer, nullable=False, default=1)
    tick_size = Column(Float, nullable=False, default=0.05)
    instrument_type = Column(String(20), default="INDEX", nullable=False)  # INDEX, FUTURE, STOCK
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    candles = relationship("MarketCandle", back_populates="instrument", cascade="all, delete-orphan")
    signals = relationship("Signal", back_populates="instrument")


class MarketCandle(Base):
    __tablename__ = "market_candles"

    id = Column(Integer, primary_key=True, index=True)
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)  # stored in UTC
    timeframe = Column(String(10), default="1m", nullable=False)  # 1m, 3m, 5m, 15m
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(Float, nullable=False, default=0.0)
    is_complete = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    instrument = relationship("Instrument", back_populates="candles")
    indicators = relationship("TechnicalIndicator", back_populates="candle", uselist=False, cascade="all, delete-orphan")
    features = relationship("MarketFeature", back_populates="candle", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("instrument_id", "timeframe", "timestamp", name="uq_candle_instrument_tf_ts"),
        Index("ix_candle_inst_tf_ts", "instrument_id", "timeframe", "timestamp"),
    )


class TechnicalIndicator(Base):
    __tablename__ = "technical_indicators"

    id = Column(Integer, primary_key=True, index=True)
    candle_id = Column(Integer, ForeignKey("market_candles.id"), unique=True, nullable=False)
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    timeframe = Column(String(10), default="1m", nullable=False)

    ema_9 = Column(Float, nullable=True)
    ema_20 = Column(Float, nullable=True)
    ema_50 = Column(Float, nullable=True)
    vwap = Column(Float, nullable=True)
    rsi_14 = Column(Float, nullable=True)
    macd = Column(Float, nullable=True)
    macd_signal = Column(Float, nullable=True)
    macd_hist = Column(Float, nullable=True)
    atr_14 = Column(Float, nullable=True)
    adx_14 = Column(Float, nullable=True)
    relative_volume = Column(Float, nullable=True)
    bb_upper = Column(Float, nullable=True)
    bb_middle = Column(Float, nullable=True)
    bb_lower = Column(Float, nullable=True)

    # Opening Range & Structure
    orb_high_5m = Column(Float, nullable=True)
    orb_low_5m = Column(Float, nullable=True)
    orb_high_15m = Column(Float, nullable=True)
    orb_low_15m = Column(Float, nullable=True)
    orb_high_30m = Column(Float, nullable=True)
    orb_low_30m = Column(Float, nullable=True)
    prev_day_high = Column(Float, nullable=True)
    prev_day_low = Column(Float, nullable=True)
    day_high = Column(Float, nullable=True)
    day_low = Column(Float, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    candle = relationship("MarketCandle", back_populates="indicators")


class MarketFeature(Base):
    __tablename__ = "market_features"

    id = Column(Integer, primary_key=True, index=True)
    candle_id = Column(Integer, ForeignKey("market_candles.id"), unique=True, nullable=False)
    feature_vector = Column(JSON, nullable=False)  # Normalized ML features dict
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    candle = relationship("MarketCandle", back_populates="features")
