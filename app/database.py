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

    # Importing inside the function avoids circular import issues because models.py
    # depends on ``Base`` from this module. The import ensures the metadata for all
    # ORM models (including newly added ones) is loaded before ``create_all`` runs.
    from models import Base as ModelBase  # pylint: disable=import-outside-toplevel

    with engine.begin() as connection:
        # Create any tables that do not yet exist. ``create_all`` is idempotent so
        # running it on every startup is safe and prevents "relation does not
        # exist" errors when new tables (e.g. quiz_sessions) are introduced.
        ModelBase.metadata.create_all(bind=connection)

        inspector = inspect(connection)
        try:
            columns = {column["name"] for column in inspector.get_columns("words")}
        except NoSuchTableError:
            # If the words table is still missing we cannot apply column migrations.
            # ``create_all`` above should normally prevent this path.
            return

        if "star" not in columns:
            connection.execute(
                text("ALTER TABLE words ADD COLUMN star INTEGER NOT NULL DEFAULT 0")
            )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

