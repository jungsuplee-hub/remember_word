from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from database import get_db
import models
import schemas
from utils.auth import require_admin

router = APIRouter()


@router.post("", response_model=schemas.ProfileOut)
def create_profile(
    payload: schemas.ProfileCreate,
    db: Session = Depends(get_db),
    _: models.Profile = Depends(require_admin),
):
    profile = models.Profile(name=payload.name, email=payload.email)
    db.add(profile)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(400, "이미 사용 중인 이메일입니다.")
    db.refresh(profile)
    return profile


@router.get("", response_model=list[schemas.ProfileOut])
def list_profiles(
    db: Session = Depends(get_db),
    _: models.Profile = Depends(require_admin),
):
    return db.query(models.Profile).order_by(models.Profile.created_at).all()


@router.get("/{profile_id}", response_model=schemas.ProfileOut)
def get_profile(
    profile_id: int,
    db: Session = Depends(get_db),
    _: models.Profile = Depends(require_admin),
):
    profile = db.query(models.Profile).filter(models.Profile.id == profile_id).one_or_none()
    if not profile:
        raise HTTPException(404, "프로필을 찾을 수 없습니다.")
    return profile


@router.patch("/{profile_id}", response_model=schemas.ProfileOut)
def update_profile(
    profile_id: int,
    payload: schemas.ProfileCreate,
    db: Session = Depends(get_db),
    _: models.Profile = Depends(require_admin),
):
    profile = db.query(models.Profile).filter(models.Profile.id == profile_id).one_or_none()
    if not profile:
        raise HTTPException(404, "프로필을 찾을 수 없습니다.")
    profile.name = payload.name
    profile.email = payload.email
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(400, "이미 사용 중인 이메일입니다.")
    db.refresh(profile)
    return profile


@router.delete("/{profile_id}", response_model=dict)
def delete_profile(
    profile_id: int,
    db: Session = Depends(get_db),
    _: models.Profile = Depends(require_admin),
):
    profile = db.query(models.Profile).filter(models.Profile.id == profile_id).one_or_none()
    if not profile:
        raise HTTPException(404, "프로필을 찾을 수 없습니다.")
    db.delete(profile)
    db.commit()
    return {"status": "deleted"}
