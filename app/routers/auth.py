"""Authentication and account management routes."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi import APIRouter, Depends, HTTPException, Request, status
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


@router.get("/session", response_model=schemas.SessionInfo)
def session_info(
    current_user: models.Profile = Depends(require_current_user),
) -> schemas.SessionInfo:
    return current_user


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
        generate_reset_token(profile, db)

    return {
        "status": "reset_requested",
        "message": "이메일로 비밀번호 재설정 안내를 전송했습니다. (테스트 환경에서는 서버 로그를 확인하세요.)",
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
