import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import app
from app.core.database import Base, get_db
from app.models.market import Instrument


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

    # Seed initial instruments
    async with session_factory() as session:
        session.add(
            Instrument(
                symbol="NIFTY 50",
                name="NIFTY 50 Index",
                exchange="NSE",
                lot_size=25,
                tick_size=0.05,
                instrument_type="INDEX",
            )
        )
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
    await test_engine.dispose()


@pytest.mark.asyncio
async def test_instruments_and_quote(client: AsyncClient):
    # 1. List instruments
    inst_resp = await client.get("/api/v1/market/instruments")
    assert inst_resp.status_code == 200
    instruments = inst_resp.json()
    assert len(instruments) >= 1
    assert instruments[0]["symbol"] == "NIFTY 50"

    # 2. Get Quote
    quote_resp = await client.get("/api/v1/market/quote?symbol=NIFTY%2050")
    assert quote_resp.status_code == 200
    quote = quote_resp.json()
    assert quote["symbol"] == "NIFTY 50"
    assert quote["price"] > 0

    # 3. Market Data Status before CSV upload
    status_resp = await client.get("/api/v1/market/status?symbol=NIFTY%2050")
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert status_data["has_data"] is False
    assert status_data["status_message"] == "Historical market data required."


@pytest.mark.asyncio
async def test_csv_upload_api(client: AsyncClient):
    # Register user to authenticate
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "uploader@market.in", "password": "Pass1234Secure!"},
    )
    token = reg_resp.json()["access_token"]

    csv_data = (
        "timestamp,open,high,low,close,volume,instrument\n"
        "2026-01-05 09:15:00,25100,25120,25090,25115,125000,NIFTY 50\n"
        "2026-01-05 09:16:00,25115,25135,25110,25130,95000,NIFTY 50\n"
    )

    files = {"file": ("test_nifty.csv", csv_data, "text/csv")}
    upload_resp = await client.post(
        "/api/v1/market/upload-csv?symbol=NIFTY%2050",
        files=files,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert upload_resp.status_code == 200
    summary = upload_resp.json()
    assert summary["valid_rows"] == 2
    assert summary["status"] == "SUCCESS"

    # Verify status now reports ready
    status_resp = await client.get("/api/v1/market/status?symbol=NIFTY%2050")
    status_data = status_resp.json()
    assert status_data["has_data"] is True
    assert status_data["candle_count"] == 2
