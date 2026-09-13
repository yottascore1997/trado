from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.risk import RiskSetting
from app.schemas.risk import RiskSettingsOut, RiskSettingsUpdate
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/risk", tags=["Risk Management"])


@router.get("/", response_model=RiskSettingsOut)
async def get_risk_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve user risk settings or create default if not present."""
    stmt = select(RiskSetting).where(RiskSetting.user_id == current_user.id)
    result = await db.execute(stmt)
    risk = result.scalar_one_or_none()

    if not risk:
        risk = RiskSetting(user_id=current_user.id)
        db.add(risk)
        await db.commit()
        await db.refresh(risk)

    return RiskSettingsOut.model_validate(risk)


@router.put("/", response_model=RiskSettingsOut)
async def update_risk_settings(
    risk_in: RiskSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update risk management parameters."""
    stmt = select(RiskSetting).where(RiskSetting.user_id == current_user.id)
    result = await db.execute(stmt)
    risk = result.scalar_one_or_none()

    if not risk:
        risk = RiskSetting(user_id=current_user.id)
        db.add(risk)

    update_data = risk_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(risk, field, value)

    await db.commit()
    await db.refresh(risk)
    return RiskSettingsOut.model_validate(risk)
