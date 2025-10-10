"""Administrator endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from utils.auth import require_admin

router = APIRouter()


@router.get("/dashboard", response_model=list[schemas.AdminAccountStats])
def dashboard(
    _: models.Profile = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[schemas.AdminAccountStats]:
    profiles = db.query(models.Profile).order_by(models.Profile.id).all()

    folder_counts = dict(
        db.query(models.Folder.profile_id, func.count(models.Folder.id))
        .group_by(models.Folder.profile_id)
        .all()
    )
    group_counts = dict(
        db.query(models.Group.profile_id, func.count(models.Group.id))
        .group_by(models.Group.profile_id)
        .all()
    )
    word_counts = dict(
        db.query(models.Group.profile_id, func.count(models.Word.id))
        .select_from(models.Word)
        .join(models.Group, models.Group.id == models.Word.group_id)
        .group_by(models.Group.profile_id)
        .all()
    )
    quiz_counts = dict(
        db.query(models.QuizSession.profile_id, func.count(models.QuizSession.id))
        .group_by(models.QuizSession.profile_id)
        .all()
    )

    stats: list[schemas.AdminAccountStats] = []
    for profile in profiles:
        pid = profile.id
        stats.append(
            schemas.AdminAccountStats(
                profile_id=pid,
                username=profile.username,
                name=profile.name,
                email=profile.email,
                folder_count=folder_counts.get(pid, 0),
                group_count=group_counts.get(pid, 0),
                word_count=word_counts.get(pid, 0),
                quiz_count=quiz_counts.get(pid, 0),
                login_count=profile.login_count or 0,
                last_login_at=profile.last_login_at,
            )
        )

    return stats
