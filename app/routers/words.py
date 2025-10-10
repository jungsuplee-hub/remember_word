from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
import models, schemas
import pandas as pd
from io import BytesIO, StringIO
import math
from collections import defaultdict
from utils.auth import require_current_user

router = APIRouter()

@router.post("", response_model=dict)
def create_word(
    payload: schemas.WordCreate,
    db: Session = Depends(get_db),
    current_user: models.Profile = Depends(require_current_user),
):
    group = (
        db.query(models.Group)
        .filter(
            models.Group.id == payload.group_id,
            models.Group.profile_id == current_user.id,
        )
        .one_or_none()
    )
    if not group:
        raise HTTPException(404, "그룹을 찾을 수 없습니다.")

    w = models.Word(**payload.model_dump())
    db.add(w)
    db.commit()
    db.refresh(w)
    return {"id": w.id}

@router.get("", response_model=list[schemas.WordOut])
def list_words(
    group_id: int,
    min_star: int | None = Query(default=None, ge=0, le=schemas.MAX_STAR_RATING),
    star_values: list[int] | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: models.Profile = Depends(require_current_user),
):
    q = (
        db.query(models.Word)
        .join(models.Group, models.Group.id == models.Word.group_id)
        .filter(
            models.Word.group_id == group_id,
            models.Group.profile_id == current_user.id,
        )
    )
    if min_star is not None:
        q = q.filter(models.Word.star >= min_star)
    if star_values:
        q = q.filter(models.Word.star.in_(star_values))
    rows = q.order_by(models.Word.id).all()
    return rows


@router.patch("/{word_id}", response_model=schemas.WordOut)
def update_word(
    word_id: int,
    payload: schemas.WordUpdate,
    db: Session = Depends(get_db),
    current_user: models.Profile = Depends(require_current_user),
):
    word = (
        db.query(models.Word)
        .join(models.Group, models.Group.id == models.Word.group_id)
        .filter(
            models.Word.id == word_id,
            models.Group.profile_id == current_user.id,
        )
        .one_or_none()
    )
    if not word:
        raise HTTPException(404, "단어를 찾을 수 없습니다.")
    data = payload.model_dump(exclude_unset=True)
    if "group_id" in data and data["group_id"] is not None:
        group = (
            db.query(models.Group)
            .filter(
                models.Group.id == data["group_id"],
                models.Group.profile_id == current_user.id,
            )
            .one_or_none()
        )
        if not group:
            raise HTTPException(404, "이동할 그룹을 찾을 수 없습니다.")
        word.group_id = data.pop("group_id")
    for key, value in data.items():
        setattr(word, key, value)
    db.commit()
    db.refresh(word)
    return word


@router.delete("/{word_id}", response_model=dict)
def delete_word(
    word_id: int,
    db: Session = Depends(get_db),
    current_user: models.Profile = Depends(require_current_user),
):
    word = (
        db.query(models.Word)
        .join(models.Group, models.Group.id == models.Word.group_id)
        .filter(
            models.Word.id == word_id,
            models.Group.profile_id == current_user.id,
        )
        .one_or_none()
    )
    if not word:
        raise HTTPException(404, "단어를 찾을 수 없습니다.")

    related_questions = (
        db.query(models.QuizQuestion)
        .filter(models.QuizQuestion.word_id == word_id)
        .all()
    )

    if related_questions:
        session_adjustments: dict[int, dict[str, int]] = defaultdict(
            lambda: {"total": 0, "answered": 0, "correct": 0}
        )

        for question in related_questions:
            adjustments = session_adjustments[question.session_id]
            adjustments["total"] += 1
            if question.is_correct is not None:
                adjustments["answered"] += 1
                if question.is_correct:
                    adjustments["correct"] += 1
            db.delete(question)

        if session_adjustments:
            sessions = (
                db.query(models.QuizSession)
                .filter(models.QuizSession.id.in_(session_adjustments.keys()))
                .all()
            )

            for session in sessions:
                adjustments = session_adjustments[session.id]
                session.total_questions = max(
                    0, session.total_questions - adjustments["total"]
                )
                session.answered_questions = max(
                    0, session.answered_questions - adjustments["answered"]
                )
                session.correct_questions = max(
                    0, session.correct_questions - adjustments["correct"]
                )

    db.delete(word)
    db.commit()
    return {"status": "deleted", "id": word_id}

@router.post("/import", response_model=dict)
async def import_words(
    group_id: int = Form(...),
    file: UploadFile | None = File(None),
    clipboard: str | None = Form(None),
    db: Session = Depends(get_db),
    current_user: models.Profile = Depends(require_current_user),
):
    group = (
        db.query(models.Group)
        .filter(
            models.Group.id == group_id,
            models.Group.profile_id == current_user.id,
        )
        .one_or_none()
    )
    if not group:
        raise HTTPException(404, "그룹을 찾을 수 없습니다.")

    if not file and not clipboard:
        raise HTTPException(400, "file 또는 clipboard 중 하나를 제공하세요.")

    if file:
        content = await file.read()
        name = (file.filename or "").lower()
        if name.endswith(".xlsx"):
            df = pd.read_excel(BytesIO(content))
        else:
            try:
                df = pd.read_csv(StringIO(content.decode("utf-8")), sep=None, engine="python")
            except Exception:
                df = pd.read_csv(StringIO(content.decode("utf-8")), sep=",")
    else:
        s = clipboard.strip()
        try:
            df = pd.read_csv(StringIO(s), sep=None, engine="python")
        except Exception:
            df = pd.read_csv(StringIO(s), sep="\t")

    required = {"language","term","meaning"}
    cols_lower = [c.lower() for c in df.columns]
    df.columns = cols_lower
    missing = required - set(cols_lower)
    if missing:
        raise HTTPException(400, f"필수 컬럼 누락: {missing}. 필요한 컬럼: language, term, meaning")

    df["group_id"] = group_id
    inserted = 0
    updated = 0

    def parse_star(value):
        if value is None:
            return None
        if isinstance(value, float) and math.isnan(value):
            return None
        try:
            ivalue = int(value)
        except (TypeError, ValueError):
            return None
        return max(0, min(schemas.MAX_STAR_RATING, ivalue))

    for row in df.to_dict(orient="records"):
        obj = db.query(models.Word).filter(
            models.Word.group_id==group_id,
            models.Word.language==row["language"],
            models.Word.term==row["term"]
        ).one_or_none()

        star_value = parse_star(row.get("star"))

        if obj:
            for k in ["meaning","reading","pos","example","memo"]:
                if k in row:
                    setattr(obj, k, row.get(k))
            if star_value is not None:
                obj.star = star_value
            updated += 1
        else:
            obj = models.Word(
                group_id=group_id,
                language=row["language"],
                term=row["term"],
                meaning=row["meaning"],
                reading=row.get("reading"),
                pos=row.get("pos"),
                example=row.get("example"),
                memo=row.get("memo"),
                star=star_value or 0,
            )
            db.add(obj)
            inserted += 1

    db.commit()
    return {"inserted": inserted, "updated": updated}


@router.post("/import-structured", response_model=schemas.WordImportStructuredSummary)
async def import_with_structure(
    file: UploadFile = File(...),
    default_language: str = Form("기본"),
    db: Session = Depends(get_db),
    current_user: models.Profile = Depends(require_current_user),
):
    if not file.filename:
        raise HTTPException(400, "업로드할 파일을 선택하세요.")

    content = await file.read()
    name = (file.filename or "").lower()
    def read_table(*, header: int | None = 0):
        try:
            if name.endswith(".xlsx") or name.endswith(".xls"):
                return pd.read_excel(BytesIO(content), header=header)
            return pd.read_csv(StringIO(content.decode("utf-8")), header=header)
        except Exception as exc:  # pragma: no cover - 사용자 입력 오류 처리
            raise HTTPException(400, f"파일을 읽을 수 없습니다: {exc}")

    def canonicalize(value: str | int | float | None) -> str:
        if value is None:
            return ""
        if isinstance(value, float) and math.isnan(value):
            return ""
        return str(value).strip().lower()

    alias_map = {
        "folder": {"folder", "폴더", "폴더명", "카테고리", "folder name", "folder명"},
        "group": {
            "group",
            "그룹",
            "그룹명",
            "day",
            "day1",
            "day2",
            "day3",
            "단계",
            "세트",
            "unit",
            "lesson",
        },
        "term": {
            "term",
            "word",
            "단어",
            "표제어",
            "영단어",
            "단어(영어)",
            "단어(외국어)",
        },
        "meaning": {
            "meaning",
            "뜻",
            "의미",
            "해석",
            "뜻(한국어)",
            "뜻풀이",
            "translation",
        },
    }

    def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
        normalized: list[str] = []
        for col in df.columns:
            key = canonicalize(col)
            replaced = None
            for target, aliases in alias_map.items():
                if key == target or key in aliases:
                    replaced = target
                    break
            normalized.append(replaced or key)
        df.columns = normalized
        return df

    def try_parse_dataframe() -> pd.DataFrame:
        df_initial = normalize_columns(read_table())
        required = {"folder", "group", "term", "meaning"}
        missing = required - set(df_initial.columns)
        if not missing:
            return df_initial

        # 헤더가 없거나 첫 줄이 데이터인 경우 다시 시도합니다.
        df_no_header = read_table(header=None)
        if df_no_header is None or df_no_header.empty:
            raise HTTPException(400, f"필수 컬럼 누락: {', '.join(sorted(missing))}")

        first_row = [canonicalize(v) for v in df_no_header.iloc[0].tolist()]
        header_map: dict[int, str] = {}
        for idx, value in enumerate(first_row):
            for target, aliases in alias_map.items():
                if value == target or value in aliases:
                    header_map[idx] = target
                    break

        df_candidate = df_no_header.copy()
        drop_first_row = False
        if header_map:
            recognized = set(header_map.values())
            if required.issubset(recognized):
                drop_first_row = True
            else:
                header_map = {}

        if not header_map and len(df_candidate.columns) >= 4:
            header_map = {
                df_candidate.columns[0]: "folder",
                df_candidate.columns[1]: "group",
                df_candidate.columns[2]: "term",
                df_candidate.columns[3]: "meaning",
            }

        if header_map:
            df_candidate = df_candidate.rename(columns=header_map)
        df_candidate = normalize_columns(df_candidate)

        if drop_first_row:
            df_candidate = df_candidate.iloc[1:]

        required_missing = required - set(df_candidate.columns)
        if required_missing:
            raise HTTPException(400, f"필수 컬럼 누락: {', '.join(sorted(required_missing))}")

        return df_candidate.reset_index(drop=True)

    df = try_parse_dataframe()

    folders = (
        db.query(models.Folder)
        .filter(models.Folder.profile_id == current_user.id)
        .all()
    )
    folder_cache: dict[str, models.Folder] = {
        (f.name or "").strip().lower(): f for f in folders
    }
    group_cache: dict[tuple[int, str], models.Group] = {}
    word_cache: defaultdict[int, set[tuple[str, str]]] = defaultdict(set)

    inserted = 0
    skipped = 0
    folders_created = 0
    groups_created = 0

    def normalize(value: str | int | float | bool | None) -> str:
        if value is None:
            return ""
        if isinstance(value, float) and math.isnan(value):
            return ""
        return str(value).strip()

    for row in df.to_dict(orient="records"):
        folder_name = normalize(row.get("folder"))
        group_name = normalize(row.get("group"))
        term = normalize(row.get("term"))
        meaning = normalize(row.get("meaning"))
        language = normalize(row.get("language")) or default_language

        if not folder_name or not group_name or not term or not meaning:
            skipped += 1
            continue

        folder_key = folder_name.lower()
        folder = folder_cache.get(folder_key)
        if not folder:
            folder = models.Folder(name=folder_name, profile_id=current_user.id)
            db.add(folder)
            db.flush()
            folder_cache[folder_key] = folder
            folders_created += 1

        group_key = (folder.id, group_name.lower())
        group = group_cache.get(group_key)
        if not group:
            group = (
                db.query(models.Group)
                .filter(
                    models.Group.folder_id == folder.id,
                    models.Group.name == group_name,
                    models.Group.profile_id == current_user.id,
                )
                .one_or_none()
            )
            if not group:
                group = models.Group(
                    folder_id=folder.id,
                    name=group_name,
                    profile_id=current_user.id,
                )
                db.add(group)
                db.flush()
                groups_created += 1
            group_cache[group_key] = group

        if group.id not in word_cache:
            existing = (
                db.query(models.Word.language, models.Word.term)
                .filter(models.Word.group_id == group.id)
                .all()
            )
            word_cache[group.id] = {
                (normalize(lang).lower(), normalize(term_).lower())
                for lang, term_ in existing
            }

        word_key = (language.lower(), term.lower())
        if word_key in word_cache[group.id]:
            skipped += 1
            continue

        word = models.Word(
            group_id=group.id,
            language=language,
            term=term,
            meaning=meaning,
        )
        db.add(word)
        word_cache[group.id].add(word_key)
        inserted += 1

    db.commit()
    return schemas.WordImportStructuredSummary(
        inserted=inserted,
        skipped=skipped,
        folders_created=folders_created,
        groups_created=groups_created,
    )
