from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "GET API"
    database_url: str = "postgresql+psycopg://get:get@localhost:5432/get"
    redis_url: str = "redis://localhost:6379/0"
    transcript_model_name: str = "small"
    transcript_device: str = "auto"
    transcript_compute_type: str = "int8"
    transcript_beam_size: int = 5
    transcript_enable_vad: bool = True
    openai_api_key: str | None = None
    openai_base_url: str = "https://api.openai.com/v1"
    translation_model: str = "gpt-5-mini"
    ringcentral_cookie_file: str | None = None
    ringcentral_cookies_from_browser: str | None = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
