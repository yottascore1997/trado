import logging
import sys
from app.config import settings

LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"


def setup_logger(name: str = "trading_engine") -> logging.Logger:
    logger = logging.getLogger(name)
    level = logging.DEBUG if settings.DEBUG else logging.INFO
    logger.setLevel(level)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(level)
        formatter = logging.Formatter(LOG_FORMAT)
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger


logger = setup_logger()
