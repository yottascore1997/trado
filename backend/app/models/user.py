import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    broker_accounts = relationship("BrokerAccount", back_populates="user", cascade="all, delete-orphan")
    risk_settings = relationship("RiskSetting", back_populates="user", uselist=False, cascade="all, delete-orphan")
    paper_trades = relationship("PaperTrade", back_populates="user")
    backtest_runs = relationship("BacktestRun", back_populates="user")


class BrokerAccount(Base):
    __tablename__ = "broker_accounts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    broker_name = Column(String(50), nullable=False)  # 'ZERODHA', 'UPSTOX', 'MOCK'
    api_key_encrypted = Column(Text, nullable=True)
    api_secret_encrypted = Column(Text, nullable=True)
    access_token_encrypted = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="broker_accounts")
