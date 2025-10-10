"""Authentication helpers for the Remember Word application."""
from __future__ import annotations

from datetime import datetime, timedelta
import logging
import secrets
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database import get_db
import models

LOGGER = logging.getLogger(__name__)

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 2  # 48 hours
RESET_TOKEN_TTL = timedelta(hours=1)


def hash_password(password: str) -> str:
    """Hash ``password`` using bcrypt."""

    return _pwd_context.hash(password)


def verify_password(password: str, password_hash: Optional[str]) -> bool:
    """Return ``True`` if ``password`` matches ``password_hash``."""

    if not password_hash:
        return False
    try:
        return _pwd_context.verify(password, password_hash)
    except ValueError:
        return False


def issue_session(request: Request, profile: models.Profile) -> None:
    """Persist the authenticated ``profile`` in the signed session cookie."""

    request.session["user_id"] = profile.id
    request.session["issued_at"] = datetime.utcnow().isoformat()


def clear_session(request: Request) -> None:
    """Remove any stored authentication information from the session."""

    request.session.clear()


def require_current_user(
    request: Request, db: Session = Depends(get_db)
) -> models.Profile:
    """Return the authenticated profile or raise ``401`` if missing."""

    user_id = request.session.get("user_id") if request.session else None
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "로그인이 필요합니다.")

    profile = db.get(models.Profile, user_id)
    if not profile:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "세션이 만료되었습니다. 다시 로그인하세요.")
    return profile


def require_admin(
    current_user: models.Profile = Depends(require_current_user),
) -> models.Profile:
    """Ensure that ``current_user`` has administrator privileges."""

    if not current_user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "관리자 권한이 필요합니다.")
    return current_user


def generate_reset_token(profile: models.Profile, db: Session) -> str:
    """Generate and store a password reset token for ``profile``."""

    token = secrets.token_urlsafe(32)
    profile.password_reset_token = token
    profile.password_reset_expires_at = datetime.utcnow() + RESET_TOKEN_TTL
    db.add(profile)
    db.commit()
    LOGGER.info("Password reset token for %s (%s): %s", profile.name, profile.email, token)
    return token


def validate_reset_token(token: str, db: Session) -> models.Profile:
    """Retrieve the profile that owns ``token`` if it is still valid."""

    profile = (
        db.query(models.Profile)
        .filter(models.Profile.password_reset_token == token)
        .one_or_none()
    )
    if not profile:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "유효하지 않은 토큰입니다.")

    if not profile.password_reset_expires_at or profile.password_reset_expires_at < datetime.utcnow():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "토큰이 만료되었습니다. 다시 요청하세요.")

    return profile
