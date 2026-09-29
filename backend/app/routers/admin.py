from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import DailyStat, User
from ..points import get_or_today_stat, stage_of, stage_title
from ..serialize import me_dict

router = APIRouter(prefix="/api/admin", tags=["admin"])


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user


@router.get("/users")
def list_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = []
    for u in db.query(User).order_by(User.id).all():
        stat = (
            db.query(DailyStat)
            .filter(DailyStat.user_id == u.id, DailyStat.date == date.today())
            .first()
        )
        rows.append(
            {
                **me_dict(u, db),
                "learned_today": stat.words_reviewed if stat else 0,
                "current_book_id": u.current_book_id,
                "created_at": u.created_at.isoformat(timespec="seconds"),
            }
        )
    db.commit()
    return rows
