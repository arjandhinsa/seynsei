from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./seynse.db"

    # Auth
    SECRET_KEY: str = "339e370f994684ff719bf6e62f8f505ca26989b5c5b027997a11fb5117db06dc"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Free tier: Sensei replies per user per UTC day. Premium users are
    # unlimited. Tune from the environment without a deploy.
    FREE_DAILY_SENSEI_MESSAGES: int = 10

    # App
    APP_NAME: str = "Seynse"
    APP_ENV: str = "development"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()