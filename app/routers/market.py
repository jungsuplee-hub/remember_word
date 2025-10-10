"""Endpoints for the shared word market."""
from __future__ import annotations

from collections import defaultdict

from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

import models
import schemas
from database import get_db
from utils.auth import require_current_user
from utils.sorting import korean_alnum_sort_key

router = APIRouter()


LANGUAGE_RENAMES = {
    "대한검정회 한자": "기본언어 한자",
}


def _normalize(value: str | None) -> str:
    if value is None:
        return ""
    return value.strip()


def _rename_language(value: str | None) -> str:
    normalized = _normalize(value)
    return LANGUAGE_RENAMES.get(normalized, normalized)


def _language_key(value: str | None) -> str:
    renamed = _rename_language(value)
    return renamed or "기본"


@router.get("/languages", response_model=list[schemas.MarketLanguageSummary])
def list_languages(
    _: models.Profile = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> list[schemas.MarketLanguageSummary]:
    rows = (
        db.query(
            models.Folder.id,
            models.Folder.default_language,
            func.count(models.Group.id).label("group_count"),
        )
        .join(models.Profile, models.Profile.id == models.Folder.profile_id)
        .outerjoin(models.Group, models.Group.folder_id == models.Folder.id)
        .filter(models.Profile.is_admin.is_(True))
        .group_by(models.Folder.id, models.Folder.default_language)
        .all()
    )

    summary: dict[str, dict[str, int]] = defaultdict(lambda: {"folder_count": 0, "group_count": 0})
    for _folder_id, default_language, group_count in rows:
        language = _language_key(default_language)
        summary[language]["folder_count"] += 1
        summary[language]["group_count"] += int(group_count or 0)

    result = [
        schemas.MarketLanguageSummary(
            language=language,
            folder_count=data["folder_count"],
            group_count=data["group_count"],
        )
        for language, data in summary.items()
    ]
    result.sort(key=lambda item: korean_alnum_sort_key(item.language))
    return result


@router.get("/folders", response_model=list[schemas.MarketFolderOut])
def list_folders(
    language: str = Query(..., description="선택한 기본 언어"),
    _: models.Profile = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> list[schemas.MarketFolderOut]:
    normalized_language = _language_key(language)
    normalized_language_key = normalized_language.lower()

    rows = (
        db.query(models.Folder, func.count(models.Group.id).label("group_count"))
        .join(models.Profile, models.Profile.id == models.Folder.profile_id)
        .outerjoin(models.Group, models.Group.folder_id == models.Folder.id)
        .filter(models.Profile.is_admin.is_(True))
        .group_by(models.Folder.id)
        .all()
    )

    folders: list[schemas.MarketFolderOut] = []
    for folder, group_count in rows:
        folder_language_key = _language_key(folder.default_language).lower()
        if folder_language_key != normalized_language_key:
            continue
        folders.append(
            schemas.MarketFolderOut(
                id=folder.id,
                name=folder.name,
                default_language=_rename_language(folder.default_language) or None,
                group_count=int(group_count or 0),
            )
        )

    folders.sort(key=lambda item: korean_alnum_sort_key(item.name))
    return folders


@router.get("/groups", response_model=list[schemas.MarketGroupOut])
def list_groups(
    folder_id: int = Query(..., description="폴더 ID"),
    _: models.Profile = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> list[schemas.MarketGroupOut]:
    folder = (
        db.query(models.Folder)
        .join(models.Profile, models.Profile.id == models.Folder.profile_id)
        .filter(
            models.Folder.id == folder_id,
            models.Profile.is_admin.is_(True),
        )
        .one_or_none()
    )
    if not folder:
        raise HTTPException(404, "폴더를 찾을 수 없습니다.")

    rows = (
        db.query(models.Group, func.count(models.Word.id).label("word_count"))
        .outerjoin(models.Word, models.Word.group_id == models.Group.id)
        .filter(
            models.Group.folder_id == folder_id,
            models.Group.profile_id == folder.profile_id,
        )
        .group_by(models.Group.id)
        .all()
    )

    groups = [
        schemas.MarketGroupOut(
            id=group.id,
            name=group.name,
            word_count=int(word_count or 0),
        )
        for group, word_count in rows
    ]
    groups.sort(key=lambda item: korean_alnum_sort_key(item.name))
    return groups


@router.post("/import", response_model=schemas.MarketImportSummary)
def import_groups(
    payload: schemas.MarketImportRequest,
    current_user: models.Profile = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> schemas.MarketImportSummary:
    folder = (
        db.query(models.Folder)
        .join(models.Profile, models.Profile.id == models.Folder.profile_id)
        .filter(
            models.Folder.id == payload.folder_id,
            models.Profile.is_admin.is_(True),
        )
        .one_or_none()
    )
    if not folder:
        raise HTTPException(404, "폴더를 찾을 수 없습니다.")

    groups = (
        db.query(models.Group)
        .options(selectinload(models.Group.words))
        .filter(
            models.Group.folder_id == folder.id,
            models.Group.id.in_(payload.group_ids),
            models.Group.profile_id == folder.profile_id,
        )
        .all()
    )

    found_ids = {group.id for group in groups}
    missing = set(payload.group_ids) - found_ids
    if missing:
        raise HTTPException(404, "선택한 그룹을 찾을 수 없습니다.")

    group_map = {group.id: group for group in groups}
    ordered_groups = [group_map[group_id] for group_id in payload.group_ids]

    target_folder = (
        db.query(models.Folder)
        .filter(
            models.Folder.profile_id == current_user.id,
            models.Folder.name == folder.name,
            models.Folder.default_language == folder.default_language,
        )
        .one_or_none()
    )

    if not target_folder and folder.default_language:
        target_folder = (
            db.query(models.Folder)
            .filter(
                models.Folder.profile_id == current_user.id,
                models.Folder.name == folder.name,
                models.Folder.default_language.is_(None),
            )
            .one_or_none()
        )
        if target_folder:
            target_folder.default_language = folder.default_language

    if not target_folder:
        target_folder = models.Folder(
            name=folder.name,
            profile_id=current_user.id,
            default_language=folder.default_language,
        )
        db.add(target_folder)
        db.flush()

    existing_groups = (
        db.query(models.Group)
        .options(selectinload(models.Group.words))
        .filter(
            models.Group.folder_id == target_folder.id,
            models.Group.profile_id == current_user.id,
        )
        .all()
    )

    group_cache = {group.name: group for group in existing_groups}
    word_cache: dict[int, set[tuple[str, str]]] = {}

    def build_word_cache(group: models.Group) -> set[tuple[str, str]]:
        cache = {
            (_normalize(word.language).lower(), _normalize(word.term).lower())
            for word in group.words
        }
        word_cache[group.id] = cache
        return cache

    created_groups = 0
    updated_groups = 0
    imported_words = 0
    skipped_words = 0

    for source_group in ordered_groups:
        target_group = group_cache.get(source_group.name)
        if not target_group:
            target_group = models.Group(
                folder_id=target_folder.id,
                name=source_group.name,
                profile_id=current_user.id,
            )
            db.add(target_group)
            db.flush()
            group_cache[source_group.name] = target_group
            word_cache[target_group.id] = set()
            created_groups += 1
        else:
            updated_groups += 1
            if target_group.id not in word_cache:
                build_word_cache(target_group)

        cache = word_cache.setdefault(target_group.id, set())

        for word in source_group.words:
            key = (_normalize(word.language).lower(), _normalize(word.term).lower())
            if key in cache:
                skipped_words += 1
                continue
            new_word = models.Word(
                group_id=target_group.id,
                language=word.language,
                term=word.term,
                meaning=word.meaning,
                reading=word.reading,
                pos=word.pos,
                example=word.example,
                memo=word.memo,
                star=word.star,
            )
            db.add(new_word)
            cache.add(key)
            imported_words += 1

    db.commit()

    return schemas.MarketImportSummary(
        folder_id=target_folder.id,
        folder_name=target_folder.name,
        default_language=_rename_language(target_folder.default_language) or None,
        created_groups=created_groups,
        updated_groups=updated_groups,
        imported_words=imported_words,
        skipped_words=skipped_words,
    )
