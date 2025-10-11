from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

import models
import schemas
from database import get_db
from utils.auth import require_current_user

router = APIRouter()


def serialize_plan(plan: models.StudyPlan) -> dict:
    folder_name = plan.folder.name if getattr(plan, "folder", None) else ""
    group_name = plan.group.name if getattr(plan, "group", None) else ""
    return {
        "id": plan.id,
        "study_date": plan.study_date,
        "folder_id": plan.folder_id,
        "folder_name": folder_name,
        "group_id": plan.group_id,
        "group_name": group_name,
    }


@router.get("", response_model=list[schemas.StudyPlanOut])
def list_study_plans(
    start: date | None = None,
    end: date | None = None,
    db: Session = Depends(get_db),
    current_user: models.Profile = Depends(require_current_user),
):
    query = (
        db.query(models.StudyPlan)
        .options(
            selectinload(models.StudyPlan.folder),
            selectinload(models.StudyPlan.group),
        )
        .filter(models.StudyPlan.profile_id == current_user.id)
    )

    if start:
        query = query.filter(models.StudyPlan.study_date >= start)
    if end:
        query = query.filter(models.StudyPlan.study_date <= end)

    plans = query.order_by(models.StudyPlan.study_date, models.StudyPlan.id).all()
    return [serialize_plan(plan) for plan in plans]


@router.put("/{study_date}", response_model=list[schemas.StudyPlanOut])
def set_study_plan(
    study_date: date,
    payload: schemas.StudyPlanSet,
    db: Session = Depends(get_db),
    current_user: models.Profile = Depends(require_current_user),
):
    normalized_ids: list[int] = []
    seen_ids: set[int] = set()
    for group_id in payload.group_ids:
        if group_id in seen_ids:
            continue
        seen_ids.add(group_id)
        normalized_ids.append(group_id)

    if normalized_ids:
        groups = (
            db.query(models.Group)
            .filter(
                models.Group.id.in_(normalized_ids),
                models.Group.profile_id == current_user.id,
            )
            .all()
        )
        found_ids = {group.id for group in groups}
        missing = [gid for gid in normalized_ids if gid not in found_ids]
        if missing:
            raise HTTPException(status_code=404, detail="선택한 그룹을 찾을 수 없습니다.")

        group_map = {group.id: group for group in groups}
    else:
        group_map = {}

    (
        db.query(models.StudyPlan)
        .filter(
            models.StudyPlan.profile_id == current_user.id,
            models.StudyPlan.study_date == study_date,
        )
        .delete(synchronize_session=False)
    )

    for group_id in normalized_ids:
        group = group_map[group_id]
        plan = models.StudyPlan(
            profile_id=current_user.id,
            study_date=study_date,
            folder_id=group.folder_id,
            group_id=group.id,
        )
        db.add(plan)

    db.commit()

    refreshed = (
        db.query(models.StudyPlan)
        .options(
            selectinload(models.StudyPlan.folder),
            selectinload(models.StudyPlan.group),
        )
        .filter(
            models.StudyPlan.profile_id == current_user.id,
            models.StudyPlan.study_date == study_date,
        )
        .order_by(models.StudyPlan.id)
        .all()
    )

    return [serialize_plan(plan) for plan in refreshed]


@router.patch("/{plan_id}", response_model=schemas.StudyPlanOut)
def move_study_plan(
    plan_id: int,
    payload: schemas.StudyPlanMove,
    db: Session = Depends(get_db),
    current_user: models.Profile = Depends(require_current_user),
):
    plan = (
        db.query(models.StudyPlan)
        .options(
            selectinload(models.StudyPlan.folder),
            selectinload(models.StudyPlan.group),
        )
        .filter(
            models.StudyPlan.id == plan_id,
            models.StudyPlan.profile_id == current_user.id,
        )
        .one_or_none()
    )

    if not plan:
        raise HTTPException(status_code=404, detail="학습 계획을 찾을 수 없습니다.")

    plan.study_date = payload.study_date
    db.commit()
    db.refresh(plan)
    return serialize_plan(plan)


@router.delete("/{plan_id}", response_model=dict)
def delete_study_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: models.Profile = Depends(require_current_user),
):
    plan = (
        db.query(models.StudyPlan)
        .filter(
            models.StudyPlan.id == plan_id,
            models.StudyPlan.profile_id == current_user.id,
        )
        .one_or_none()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="학습 계획을 찾을 수 없습니다.")

    db.delete(plan)
    db.commit()
    return {"status": "deleted", "id": plan_id}
