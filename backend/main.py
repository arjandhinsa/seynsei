from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
import app.models  # noqa: F401 — import for side effect: registers all models with SQLAlchemy
from app.routes import achievements, auth, challenges, conversations, progress


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema is owned by Alembic — `alembic upgrade head` runs as the
    # release hook on deploy, and manually in dev. See backend/README.md.
    print(f"✓ {settings.APP_NAME} started")
    yield
    print(f"✓ {settings.APP_NAME} stopped")


# Create the FastAPI app
app = FastAPI(
    title="Seynsei API",
    description="Social Confidence Coach — Backend API",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS middleware to allow frontend to talk to backend.
# allow_origins: web domains from env (exact match, comma-separated).
# allow_origin_regex: native app shells (Capacitor iOS/Android) and local
# dev servers, handled in code so env formatting can't silently break it.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()],
    allow_origin_regex=r"^(capacitor|ionic)://localhost$|^https?://localhost(:\d+)?$",
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes — uncomment these as you build each one
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(achievements.router, prefix="/api/achievements", tags=["Achievements"])
app.include_router(challenges.router, prefix="/api/challenges", tags=["Challenges"])
app.include_router(conversations.router, prefix="/api/conversations", tags=["Conversations"])
app.include_router(progress.router, prefix="/api/progress", tags=["Progress"])

# Health check — simple endpoint to verify the server is running
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "app": settings.APP_NAME}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000)