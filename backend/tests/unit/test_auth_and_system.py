import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.core.database import Base
from app.core.security import get_password_hash, verify_password, create_access_token, decode_access_token
from app.models.user import User


def test_password_hashing():
    raw_pass = "SuperSecretTrader123!"
    hashed = get_password_hash(raw_pass)

    assert hashed != raw_pass
    assert verify_password(raw_pass, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_jwt_token_flow():
    user_data = {"sub": "test-uuid-1234", "email": "trader@market.in"}
    token = create_access_token(user_data)

    payload = decode_access_token(token)
    assert payload is not None
    assert payload.get("sub") == "test-uuid-1234"
    assert payload.get("email") == "trader@market.in"
