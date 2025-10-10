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
            columns = set()

        if "star" not in columns:
            connection.execute(
                text("ALTER TABLE words ADD COLUMN star INTEGER NOT NULL DEFAULT 0")
            )

        try:
            quiz_session_columns = {
                column["name"] for column in inspector.get_columns("quiz_sessions")
            }
        except NoSuchTableError:
            quiz_session_columns = set()

        if "is_retry" not in quiz_session_columns:
            connection.execute(
                text(
                    "ALTER TABLE quiz_sessions ADD COLUMN is_retry BOOLEAN NOT NULL DEFAULT FALSE"
                )
            )

        try:
            profile_columns = {
                column["name"] for column in inspector.get_columns("profiles")
            }
        except NoSuchTableError:
            profile_columns = set()

        def add_profile_column(column_name: str, ddl: str) -> None:
            if column_name not in profile_columns:
                connection.execute(text(ddl))

        add_profile_column("username", "ALTER TABLE profiles ADD COLUMN username VARCHAR(255)")
        add_profile_column("password_hash", "ALTER TABLE profiles ADD COLUMN password_hash VARCHAR(255)")
        add_profile_column(
            "is_admin",
            "ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE",
        )
        add_profile_column(
            "last_login_at",
            "ALTER TABLE profiles ADD COLUMN last_login_at TIMESTAMP",
        )
        add_profile_column(
            "login_count",
            "ALTER TABLE profiles ADD COLUMN login_count INTEGER NOT NULL DEFAULT 0",
        )
        add_profile_column(
            "password_reset_token",
            "ALTER TABLE profiles ADD COLUMN password_reset_token VARCHAR(255)",
        )
        add_profile_column(
            "password_reset_expires_at",
            "ALTER TABLE profiles ADD COLUMN password_reset_expires_at TIMESTAMP",
        )

        if profile_columns and "username" not in profile_columns:
            connection.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username)"
                )
            )

        if profile_columns and "email" in profile_columns:
            connection.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email)"
                )
            )

        try:
            folder_columns = {
                column["name"] for column in inspector.get_columns("folders")
            }
        except NoSuchTableError:
            folder_columns = set()

        if "profile_id" not in folder_columns:
            connection.execute(
                text("ALTER TABLE folders ADD COLUMN profile_id INTEGER REFERENCES profiles(id)")
            )

        try:
            group_columns = {
                column["name"] for column in inspector.get_columns("groups")
            }
        except NoSuchTableError:
            group_columns = set()

        if "profile_id" not in group_columns:
            connection.execute(
                text("ALTER TABLE groups ADD COLUMN profile_id INTEGER REFERENCES profiles(id)")
            )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

