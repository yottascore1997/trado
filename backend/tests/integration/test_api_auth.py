import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import app
from app.core.database import Base, get_db


@pytest_asyncio.fixture
async def client():
    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(test_engine, expire_on_commit=False)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
    await test_engine.dispose()


@pytest.mark.asyncio
async def test_register_and_login_flow(client: AsyncClient):
    # 1. Register
    reg_payload = {
        "email": "testtrader@nse.in",
        "password": "SecurePassword123!",
        "full_name": "Test Trader",
    }
    reg_resp = await client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_resp.status_code == 201
    data = reg_resp.json()
    assert "access_token" in data
    assert data["user"]["email"] == "testtrader@nse.in"

    # Duplicate registration should fail
    dup_resp = await client.post("/api/v1/auth/register", json=reg_payload)
    assert dup_resp.status_code == 400

    # 2. Login
    login_resp = await client.post(
        "/api/v1/auth/login",
        data={"username": "testtrader@nse.in", "password": "SecurePassword123!"},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]

    # 3. Get /me
    me_resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "testtrader@nse.in"
