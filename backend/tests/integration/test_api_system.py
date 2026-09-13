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
async def test_system_status_and_health(client: AsyncClient):
    # 1. Health check
    health_resp = await client.get("/api/v1/system/health")
    assert health_resp.status_code == 200
    assert health_resp.json()["status"] == "healthy"

    # 2. System Status
    status_resp = await client.get("/api/v1/system/status")
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert status_data["database_status"] == "CONNECTED"
    assert "AI signals are probabilistic analysis" in status_data["disclaimer"]
    assert status_data["market_data_provider"] == "MOCK"
