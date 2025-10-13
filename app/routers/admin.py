"""Administrator endpoints."""
from __future__ import annotations

from io import BytesIO
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from openpyxl import load_workbook
from openpyxl.utils.exceptions import InvalidFileException

import models
import schemas
from database import get_db
from utils.auth import require_admin
from utils.hanja_lookup import contains_hanja, lookup_meaning

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
        .filter(models.QuizSession.is_completed.is_(True))
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


@router.post("/utilities/hanja-meanings", response_class=StreamingResponse)
async def populate_hanja_meanings(
    _: models.Profile = Depends(require_admin),
    file: UploadFile = File(...),
) -> StreamingResponse:
    """Populate the meanings column for a worksheet that contains Hanja terms."""

    if not file.filename:
        raise HTTPException(400, "업로드할 엑셀 파일을 선택하세요.")

    filename = file.filename or ""
    lower_name = filename.lower()
    if not lower_name.endswith((".xlsx", ".xlsm", ".xltx", ".xltm")):
        raise HTTPException(400, "엑셀(.xlsx) 파일만 지원합니다.")

    content = await file.read()
    try:
        workbook = load_workbook(BytesIO(content))
    except InvalidFileException as exc:  # pragma: no cover - openpyxl specific message
        raise HTTPException(400, f"엑셀 파일을 열 수 없습니다: {exc}")

    worksheet = workbook.active

    processed = 0
    filled = 0
    already_present = 0
    untranslated = 0

    for row in worksheet.iter_rows(min_row=1):
        if not row:
            continue
        term_cell = row[0]
        meaning_cell = row[1] if len(row) > 1 else None

        term_value = term_cell.value
        if term_value is None:
            continue

        term_text = str(term_value).strip()
        if not term_text:
            continue

        if meaning_cell is None:
            meaning_cell = worksheet.cell(row=term_cell.row, column=2)

        existing_value = meaning_cell.value
        if isinstance(existing_value, str):
            existing_text = existing_value.strip()
        else:
            existing_text = str(existing_value).strip() if existing_value is not None else ""

        if existing_text:
            already_present += 1
            continue

        translated = lookup_meaning(term_text)
        if translated:
            processed += 1
            meaning_cell.value = translated
            filled += 1
        else:
            if contains_hanja(term_text):
                processed += 1
                untranslated += 1

    output = BytesIO()
    workbook.save(output)
    output.seek(0)

    base_name = Path(filename).stem or "hanja"
    safe_base = "".join(
        ch if ch.isalnum() or ch in {"_", "-", " ", "."} else "_" for ch in base_name
    ).strip("_ ")
    if not safe_base:
        safe_base = "hanja"
    download_name = f"{safe_base}_뜻자동입력.xlsx"
    ascii_fallback = "".join(
        ch if ch.isascii() and (ch.isalnum() or ch in {"_", "-", " ", "."}) else "_"
        for ch in safe_base
    ).strip("_ ")
    if not ascii_fallback:
        ascii_fallback = "hanja"
    fallback_name = f"{ascii_fallback}_meaning.xlsx"

    quoted_name = quote(download_name)

    response = StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response.headers[
        "Content-Disposition"
    ] = f"attachment; filename=\"{fallback_name}\"; filename*=UTF-8''{quoted_name}"
    response.headers["X-Meaning-Processed"] = str(processed)
    response.headers["X-Meaning-Filled"] = str(filled)
    response.headers["X-Meaning-Existing"] = str(already_present)
    response.headers["X-Meaning-Missing"] = str(untranslated)

    return response
