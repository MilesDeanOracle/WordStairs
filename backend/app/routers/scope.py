from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Book, Unit, UnitScope, User

router = APIRouter(prefix="/api/scope", tags=["scope"])


def seed_scope(db: Session, user: User) -> None:
    """首次访问：把指派书的单元全部启用，之后以用户自己的开关为准。"""
    if db.query(UnitScope).filter(UnitScope.user_id == user.id).count() > 0:
        return
    if not user.current_book_id:
        return
    for u in db.query(Unit).filter(Unit.book_id == user.current_book_id):
        db.add(UnitScope(user_id=user.id, unit_id=u.id, study=True, practice=True))
    db.commit()


@router.get("")
def get_scope(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    seed_scope(db, user)
    rows = {r.unit_id: r for r in db.query(UnitScope).filter(UnitScope.user_id == user.id)}
    out = []
    for b in db.query(Book).order_by(Book.id):
        units = db.query(Unit).filter(Unit.book_id == b.id).order_by(Unit.order_no, Unit.id).all()
        out.append(
            {
                "id": b.id,
                "name": b.name,
                "stage": b.stage,
                "units": [
                    {
                        "id": u.id,
                        "name": u.name,
                        "study": rows[u.id].study if u.id in rows else False,
                        "practice": rows[u.id].practice if u.id in rows else False,
                    }
                    for u in units
                ],
            }
        )
    db.commit()
    return out


class UnitScopeIn(BaseModel):
    unit_id: int
    study: bool
    practice: bool


class BookScopeIn(BaseModel):
    book_id: int
    study: bool
    practice: bool


class BookRangeIn(BaseModel):
    book_id: int
    start: int  # 1 起始、含端点；start > end 表示全部关闭
    end: int


@router.put("/book-range")
def put_book_range(body: BookRangeIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """按单元顺序设置一段范围（start–end，含两端），范围内的单元学习和练习同时启用。"""
    book = db.get(Book, body.book_id)
    if not book:
        raise HTTPException(status_code=404, detail="书不存在")
    units = db.query(Unit).filter(Unit.book_id == book.id).order_by(Unit.order_no, Unit.id).all()
    n = len(units)
    start = max(1, min(body.start, n))
    end = max(start - 1, min(body.end, n))  # start > end 时全部关闭
    for i, u in enumerate(units, start=1):
        on = start <= i <= end
        row = (
            db.query(UnitScope)
            .filter(UnitScope.user_id == user.id, UnitScope.unit_id == u.id)
            .first()
        )
        # 总是落行（包括全关），避免被「首次访问自动全选」的兜底覆盖
        if row is None:
            db.add(UnitScope(user_id=user.id, unit_id=u.id, study=on, practice=on))
        else:
            row.study = on
            row.practice = on
    db.commit()
    return {"ok": True}


@router.put("/unit")
def put_unit(body: UnitScopeIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not db.get(Unit, body.unit_id):
        raise HTTPException(status_code=404, detail="单元不存在")
    row = (
        db.query(UnitScope)
        .filter(UnitScope.user_id == user.id, UnitScope.unit_id == body.unit_id)
        .first()
    )
    if row is None:
        db.add(UnitScope(user_id=user.id, unit_id=body.unit_id, study=body.study, practice=body.practice))
    else:
        row.study = body.study
        row.practice = body.practice
    db.commit()
    return {"ok": True}


@router.put("/book")
def put_book(body: BookScopeIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    book = db.get(Book, body.book_id)
    if not book:
        raise HTTPException(status_code=404, detail="书不存在")
    units = db.query(Unit).filter(Unit.book_id == book.id).all()
    for u in units:
        row = (
            db.query(UnitScope)
            .filter(UnitScope.user_id == user.id, UnitScope.unit_id == u.id)
            .first()
        )
        if row is None:
            db.add(UnitScope(user_id=user.id, unit_id=u.id, study=body.study, practice=body.practice))
        else:
            row.study = body.study
            row.practice = body.practice
    db.commit()
    return {"ok": True}
