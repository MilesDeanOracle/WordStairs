from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import PointsLedger, User
from ..points import stage_of, stage_title
from ..serialize import me_dict

router = APIRouter(prefix="/api/points", tags=["points"])


@router.get("/ledger")
def ledger(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(PointsLedger)
        .filter(PointsLedger.user_id == user.id)
        .order_by(PointsLedger.id.desc())
        .limit(20)
        .all()
    )
    db.commit()
    return [
        {"delta": r.delta, "reason": r.reason, "created_at": r.created_at.isoformat(timespec="seconds")}
        for r in rows
    ]


@router.get("/summary")
def summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.commit()
    me = me_dict(user, db)
    return {
        "points": me["points"],
        "stage": me["stage"],
        "stage_title": me["stage_title"],
        "next_stage_at": me["next_stage_at"],
        "daily_earned": me["daily_earned"],
        "daily_cap": me["daily_cap"],
    }
