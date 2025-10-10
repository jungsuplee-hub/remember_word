"""Bootstrap helpers to seed default accounts and ownership."""
from __future__ import annotations

from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from database import SessionLocal
import models
from utils.auth import hash_password

DEFAULT_USERS = [
    {
        "username": "jiyoo",
        "name": "이지유",
        "email": "4728740@hanmail.net",
        "password": "wldb0515",
        "is_admin": False,
    },
    {
        "username": "admin",
        "name": "admin",
        "email": "jungsup2.lee@gmail.com",
        "password": "e0425820",
        "is_admin": True,
    },
]

FOLDER_LANGUAGE_OVERRIDES = [
    {
        "name": "대한검정회 한자",
        "language": "한자",
        "admin_only": True,
    },
]


def _ensure_user(session: Session, spec: dict) -> models.Profile:
    profile = (
        session.query(models.Profile)
        .filter(models.Profile.username == spec["username"])
        .one_or_none()
    )
    password_hash = hash_password(spec["password"])
    if profile:
        profile.name = spec["name"]
        profile.email = spec["email"]
        profile.is_admin = spec["is_admin"]
        profile.password_hash = password_hash
    else:
        profile = models.Profile(
            username=spec["username"],
            name=spec["name"],
            email=spec["email"],
            password_hash=password_hash,
            is_admin=spec["is_admin"],
        )
        session.add(profile)
        session.flush()
    return profile


def ensure_default_accounts() -> None:
    """Create default user and admin accounts and assign orphaned data."""

    session: Optional[Session] = None
    try:
        session = SessionLocal()
        accounts = {spec["username"]: _ensure_user(session, spec) for spec in DEFAULT_USERS}
        session.flush()

        admin_ids = [
            row[0]
            for row in session.query(models.Profile.id)
            .filter(models.Profile.is_admin.is_(True))
            .all()
        ]

        for override in FOLDER_LANGUAGE_OVERRIDES:
            query = session.query(models.Folder).filter(models.Folder.name == override["name"])
            if override.get("admin_only", False):
                if not admin_ids:
                    continue
                query = query.filter(models.Folder.profile_id.in_(admin_ids))

            query = query.filter(
                or_(
                    models.Folder.default_language.is_(None),
                    func.trim(models.Folder.default_language) == "",
                    func.lower(func.trim(models.Folder.default_language)) == "기본",
                )
            )

            query.update(
                {"default_language": override["language"]}, synchronize_session=False
            )

        primary_user = accounts["jiyoo"]

        session.query(models.Folder).filter(models.Folder.profile_id.is_(None)).update(
            {"profile_id": primary_user.id}, synchronize_session=False
        )
        session.query(models.Group).filter(models.Group.profile_id.is_(None)).update(
            {"profile_id": primary_user.id}, synchronize_session=False
        )
        session.query(models.QuizSession).filter(models.QuizSession.profile_id.is_(None)).update(
            {"profile_id": primary_user.id}, synchronize_session=False
        )

        session.commit()
    finally:
        if session is not None:
            session.close()
