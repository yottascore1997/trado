import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class AIModel(Base):
    __tablename__ = "ai_models"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    version = Column(String(50), unique=True, index=True, nullable=False)  # e.g. 'XGB-v1.0'
    model_type = Column(String(50), default="XGBoost", nullable=False)
    status = Column(String(20), default="TRAINED", nullable=False)  # ACTIVE, ARCHIVED, TRAINING, FAILED
    is_active = Column(Boolean, default=False, index=True)

    features_list = Column(JSON, nullable=False)
    hyperparameters = Column(JSON, nullable=False)

    training_period_start = Column(DateTime, nullable=True)
    training_period_end = Column(DateTime, nullable=True)
    validation_period_start = Column(DateTime, nullable=True)
    validation_period_end = Column(DateTime, nullable=True)
    test_period_start = Column(DateTime, nullable=True)
    test_period_end = Column(DateTime, nullable=True)

    # Classification & Trading Evaluation Metrics
    metrics = Column(JSON, nullable=True)  # accuracy, precision, recall, f1, roc_auc, win_rate, expectancy, etc.
    model_file_path = Column(String(500), nullable=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    signals = relationship("Signal", back_populates="ai_model")
    predictions = relationship("AIPrediction", back_populates="ai_model")
    backtest_runs = relationship("BacktestRun", back_populates="ai_model")
