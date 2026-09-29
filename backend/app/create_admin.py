"""创建或提升管理员：python -m app.create_admin [用户名] [密码]"""
import sys

from .auth import hash_password
from .database import Base, SessionLocal, engine, migrate
from .models import User


def main():
    Base.metadata.create_all(bind=engine)
    migrate()
    db = SessionLocal()
    username = sys.argv[1] if len(sys.argv) > 1 else "admin"
    password = sys.argv[2] if len(sys.argv) > 2 else "admin123456"

    user = db.query(User).filter(User.username == username).first()
    if user:
        user.is_admin = True
        print(f"已将 {username} 提升为管理员")
    else:
        db.add(User(username=username, password_hash=hash_password(password), is_admin=True))
        print(f"已创建管理员账号：{username} / {password}")
    db.commit()
    db.close()


main()
