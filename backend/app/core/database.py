from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.config import settings
from app.core.logger import logger

# Connection arguments and pool configuration based on database type
connect_args = {}
engine_kwargs = {"echo": False, "future": True}

db_url = settings.DATABASE_URL
if db_url.startswith("mysql://"):
    db_url = db_url.replace("mysql://", "mysql+aiomysql://", 1)
elif db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

if "sqlite" in db_url:
    connect_args = {"check_same_thread": False}
    engine_kwargs["connect_args"] = connect_args
elif "mysql" in db_url:
    engine_kwargs["pool_recycle"] = 3600
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["connect_args"] = {"charset": "utf8mb4"}
elif "postgresql" in db_url:
    engine_kwargs["pool_recycle"] = 1800
    engine_kwargs["pool_pre_ping"] = True

engine = create_async_engine(
    db_url,
    **engine_kwargs,
)


AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    import app.models  # noqa
    logger.info("Initializing database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables initialized successfully.")
