from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine, migrate
from .routers import admin, auth, books, content, points, practice, scope, study


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    migrate()
    yield


app = FastAPI(title="词阶 WordStairs API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth.router, books.router, study.router, practice.router, points.router, admin.router, content.router, scope.router):
    app.include_router(r)


@app.get("/api/health")
def health():
    return {"ok": True}
