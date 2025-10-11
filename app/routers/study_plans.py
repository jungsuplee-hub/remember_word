from __future__ import annotations

from datetime import date

from datetime import date, datetime, time, timedelta

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
        "is_completed": False,
        "exam_sessions": [],
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
    serialized = [serialize_plan(plan) for plan in plans]

    if not serialized:
        return serialized

    group_ids = {plan.group_id for plan in plans}
    study_dates = [plan.study_date for plan in plans if plan.study_date is not None]

    if not group_ids or not study_dates:
        return serialized

    min_date = min(study_dates)
    max_date = max(study_dates)

    start_dt = datetime.combine(min_date, time.min)
    end_dt = datetime.combine(max_date + timedelta(days=1), time.min)

    sessions = (
        db.query(models.QuizSession)
        .filter(
            models.QuizSession.profile_id == current_user.id,
            models.QuizSession.mode == "exam",
            models.QuizSession.created_at >= start_dt,
            models.QuizSession.created_at < end_dt,
        )
        .order_by(models.QuizSession.created_at.desc())
        .all()
    )

    threshold_percent = current_user.exam_pass_threshold or 90
    normalized_threshold = max(0, min(100, threshold_percent)) / 100

    session_ids = [session.id for session in sessions]

    group_ids_by_session: dict[int, set[int]] = {}
    if session_ids:
        question_rows = (
            db.query(models.QuizQuestion.session_id, models.Word.group_id)
            .join(models.Word, models.Word.id == models.QuizQuestion.word_id)
            .filter(models.QuizQuestion.session_id.in_(session_ids))
            .all()
        )
        for session_id, group_id in question_rows:
            if group_id is None or group_id not in group_ids:
                continue
            targets = group_ids_by_session.setdefault(session_id, set())
            targets.add(group_id)

    history_map: dict[tuple[int, date], list[dict]] = {}
    for session in sessions:
        created_at = session.created_at or datetime.utcnow()
        session_date = created_at.date()
        if session_date < min_date or session_date > max_date:
            continue

        total = session.total_questions or 0
        correct = session.correct_questions or 0
        score = (correct / total * 100) if total else 0.0
        entry = {
            "session_id": session.id,
            "created_at": created_at,
            "total": total,
            "correct": correct,
            "score": round(score, 1),
            "passed": total > 0 and (correct / total) >= normalized_threshold,
        }

        target_groups = group_ids_by_session.get(session.id)
        if not target_groups:
            if session.group_id in group_ids:
                target_groups = {session.group_id}
            else:
                continue

        for group_id in target_groups:
            if group_id not in group_ids:
                continue
            key = (group_id, session_date)
            history_map.setdefault(key, []).append(entry.copy())

    for plan, payload in zip(plans, serialized):
        key = (plan.group_id, plan.study_date)
        sessions_for_plan = history_map.get(key, [])
        payload["exam_sessions"] = sessions_for_plan
        payload["is_completed"] = any(item.get("passed") for item in sessions_for_plan)

    return serialized


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
