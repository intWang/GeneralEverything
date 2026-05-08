from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.capabilities import router as capabilities_router
from app.api.routes.events import router as events_router
from app.api.routes.health import router as health_router
from app.api.routes.jobs import router as jobs_router
from app.api.routes.oauth import router as oauth_router
from app.config import settings

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(capabilities_router)
app.include_router(events_router)
app.include_router(health_router)
app.include_router(jobs_router)
app.include_router(oauth_router)
