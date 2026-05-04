from fastapi import FastAPI

from app.api.routes.events import router as events_router
from app.api.routes.health import router as health_router
from app.api.routes.jobs import router as jobs_router
from app.api.routes.oauth import router as oauth_router
from app.config import settings

app = FastAPI(title=settings.app_name)
app.include_router(events_router)
app.include_router(health_router)
app.include_router(jobs_router)
app.include_router(oauth_router)
