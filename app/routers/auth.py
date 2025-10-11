"""Authentication and account management routes."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from utils.auth import (
    clear_session,
    generate_reset_token,
    hash_password,
    issue_session,
    require_current_user,
    validate_reset_token,
    verify_password,
)
from utils.email import send_password_reset_email
from utils.oauth import (
    OAuthError,
    build_authorization_redirect,
    complete_oauth_login,
    generate_state,
    get_provider,
)

router = APIRouter()


@router.post("/login", response_model=schemas.SessionInfo)
def login(
    payload: schemas.LoginRequest, request: Request, db: Session = Depends(get_db)
) -> schemas.SessionInfo:
    username = payload.username.strip()
    candidate = (
        db.query(models.Profile)
        .filter(func.lower(models.Profile.username) == func.lower(username))
        .one_or_none()
    )
    if not candidate or not verify_password(payload.password, candidate.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "아이디 또는 비밀번호가 올바르지 않습니다.")

    issue_session(request, candidate)
    candidate.login_count = (candidate.login_count or 0) + 1
    candidate.last_login_at = datetime.utcnow()
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return candidate


@router.post("/register", response_model=schemas.SessionInfo, status_code=status.HTTP_201_CREATED)
def register(
    payload: schemas.RegistrationRequest, request: Request, db: Session = Depends(get_db)
) -> schemas.SessionInfo:
    username = payload.username.strip()
    if not username:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "아이디를 입력하세요.")

    existing_username = (
        db.query(models.Profile)
        .filter(func.lower(models.Profile.username) == func.lower(username))
        .one_or_none()
    )
    if existing_username:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "이미 사용 중인 아이디입니다.")

    email = payload.email.strip().lower() if payload.email else None
    if email:
        existing_email = (
            db.query(models.Profile)
            .filter(func.lower(models.Profile.email) == email)
            .one_or_none()
        )
        if existing_email:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "이미 사용 중인 이메일입니다.")

    profile = models.Profile(
        username=username,
        name=payload.name.strip() or username,
        email=email,
        password_hash=hash_password(payload.password),
        is_admin=False,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)

    issue_session(request, profile)
    return profile


@router.post("/logout", response_model=dict)
def logout(request: Request) -> dict:
    clear_session(request)
    return {"status": "ok"}


@router.patch("/preferences", response_model=schemas.SessionInfo)
def update_preferences(
    payload: schemas.AccountPreferencesUpdate,
    current_user: models.Profile = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> schemas.SessionInfo:
    current_user.exam_pass_threshold = payload.exam_pass_threshold
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/session", response_model=schemas.SessionInfo)
def session_info(
    current_user: models.Profile = Depends(require_current_user),
) -> schemas.SessionInfo:
    return current_user


@router.get("/oauth/{provider}", name="oauth_start")
def oauth_start(provider: str, request: Request, next: Optional[str] = "/") -> RedirectResponse:
    try:
        provider_config = get_provider(provider)
    except OAuthError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc

    state = generate_state()
    request.session["oauth_state"] = state
    if next and next.startswith("/"):
        request.session["oauth_next"] = next
    else:
        request.session["oauth_next"] = "/"

    redirect_url = build_authorization_redirect(provider_config, request=request, state=state)
    return RedirectResponse(redirect_url)


@router.get("/oauth/{provider}/callback", name="oauth_callback")
async def oauth_callback(
    provider: str,
    request: Request,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    stored_state = request.session.pop("oauth_state", None)
    next_url = request.session.pop("oauth_next", "/")
    if not next_url or not isinstance(next_url, str) or not next_url.startswith("/"):
        next_url = "/"

    incoming_state = request.query_params.get("state")
    if not stored_state or incoming_state != stored_state:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "잘못된 소셜 로그인 요청입니다.")

    error = request.query_params.get("error")
    if error:
        error_description = request.query_params.get("error_description")
        message = error_description or "소셜 로그인 도중 오류가 발생했습니다."
        raise HTTPException(status.HTTP_400_BAD_REQUEST, message)

    code = request.query_params.get("code")
    if not code:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "인증 코드가 전달되지 않았습니다.")

    try:
        profile = await complete_oauth_login(
            provider,
            code=code,
            request=request,
            state=incoming_state,
            db=db,
        )
    except OAuthError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    issue_session(request, profile)
    profile.login_count = (profile.login_count or 0) + 1
    profile.last_login_at = datetime.utcnow()
    db.add(profile)
    db.commit()

    return RedirectResponse(next_url or "/")


@router.post("/change-password", response_model=dict)
def change_password(
    payload: schemas.PasswordChangeRequest,
    current_user: models.Profile = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "현재 비밀번호가 일치하지 않습니다.")

    current_user.password_hash = hash_password(payload.new_password)
    current_user.password_reset_token = None
    current_user.password_reset_expires_at = None
    db.add(current_user)
    db.commit()
    return {"status": "password_changed"}


@router.post("/request-reset", response_model=dict)
def request_password_reset(
    payload: schemas.PasswordResetRequest, db: Session = Depends(get_db)
) -> dict:
    email = payload.email.strip().lower()
    profile = (
        db.query(models.Profile)
        .filter(func.lower(models.Profile.email) == email)
        .one_or_none()
    )
    if profile:
        token = generate_reset_token(profile, db)
        send_password_reset_email(profile, token)

    return {
        "status": "reset_requested",
        "message": "이메일로 비밀번호 재설정 안내를 전송했습니다.",
    }


@router.post("/reset", response_model=dict)
def reset_password(payload: schemas.PasswordResetConfirm, db: Session = Depends(get_db)) -> dict:
    profile = validate_reset_token(payload.token, db)
    profile.password_hash = hash_password(payload.new_password)
    profile.password_reset_token = None
    profile.password_reset_expires_at = None
    db.add(profile)
    db.commit()
    return {"status": "password_reset"}


@router.get("/me", response_model=schemas.SessionInfo)
def me(current_user: models.Profile = Depends(require_current_user)) -> schemas.SessionInfo:
    return current_user
