from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import router
from app.config import CORS_ORIGINS, DATABASE_URL
from app.db import close_pool, init_schema, open_pool
from app.scanning.routes import router as scanning_router

@asynccontextmanager
async def lifespan(_: FastAPI):
    # Connect to PostgreSQL and create the tables if they do not exist yet.
    try:
        open_pool()
        init_schema()
    except Exception as exc:
        host = DATABASE_URL.split("@")[-1]
        raise RuntimeError(
            f"Could not connect to PostgreSQL at {host}. "
            "Check that PostgreSQL is running, that the 'threatforge' database exists "
            "(createdb -U postgres threatforge), and that DATABASE_URL in backend/.env is correct."
        ) from exc
    yield
    close_pool()


app = FastAPI(title="ThreatForge API", version="0.2.0", lifespan=lifespan)

# Lets the Vite dev server (http://localhost:5173) call the API directly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# All routes live in app/api.py and start with /api
app.include_router(router)
app.include_router(scanning_router)