import unicodedata

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import create_token, get_current_user, hash_password, verify_password
from ..database import get_db
from ..models import User
from ..schemas import LoginIn, RegisterIn
from ..serialize import me_dict

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _normalize(name: str) -> str:
    """全角字母转半角、去首尾空格，避免输入法/复制导致的登录失败。"""
    return unicodedata.normalize("NFKC", name).strip()


@router.post("/register")
def register(body: RegisterIn, db: Session = Depends(get_db)):
    username = _normalize(body.username)
    if len(username) < 2:
        raise HTTPException(status_code=400, detail="用户名至少 2 个字符")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="用户名已经被占用了")
    user = User(username=username, password_hash=hash_password(body.password), grade=body.grade)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"token": create_token(user.id), "user": me_dict(user, db)}


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    username = _normalize(body.username)
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=400, detail="用户名或密码不对")
    db.commit()
    return {"token": create_token(user.id), "user": me_dict(user, db)}


@router.get("/me")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.commit()
    return me_dict(user, db)
