from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from sqlalchemy.exc import NoSuchTableError

DATABASE_URL = os.getenv("DB_URL")
engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
Base = declarative_base()


def ensure_schema() -> None:
    """Ensure the runtime database schema matches the ORM models."""
    with engine.connect() as connection:
        inspector = inspect(connection)
        try:
            columns = {column["name"] for column in inspector.get_columns("words")}
        except NoSuchTableError:
            # The tables haven't been created yet. create_tables.py will handle it.
            return

        if "star" not in columns:
            connection.execute(
                text("ALTER TABLE words ADD COLUMN star INTEGER NOT NULL DEFAULT 0")
            )
            connection.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

