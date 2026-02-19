from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@postgres:5432/grocery_agent"
    openai_api_key: str = ""
    master_key: str = "change-me"
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 24 hours

    model_config = {"env_file": ".env"}


settings = Settings()
