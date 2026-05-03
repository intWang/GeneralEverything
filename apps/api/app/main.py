from fastapi import FastAPI

from app.api.routes.health import router as health_router
from app.config import settings

app = FastAPI(title=settings.app_name)
app.include_router(health_router)
