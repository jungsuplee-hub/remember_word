from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
import models, schemas
import pandas as pd
from io import BytesIO, StringIO
import math
from collections import defaultdict

router = APIRouter()

@router.post("", response_model=dict)
def create_word(payload: schemas.WordCreate, db: Session = Depends(get_db)):
    w = models.Word(**payload.model_dump())
    db.add(w); db.commit(); db.refresh(w)
    return {"id": w.id}

@router.get("", response_model=list[schemas.WordOut])
def list_words(
    group_id: int,
    min_star: int | None = Query(default=None, ge=0, le=5),
    star_values: list[int] | None = Query(default=None),
    db: Session = Depends(get_db),
):
    q = db.query(models.Word).filter(models.Word.group_id == group_id)
    if min_star is not None:
        q = q.filter(models.Word.star >= min_star)
    if star_values:
        q = q.filter(models.Word.star.in_(star_values))
    rows = q.order_by(models.Word.term).all()
    return rows


@router.patch("/{word_id}", response_model=schemas.WordOut)
def update_word(word_id: int, payload: schemas.WordUpdate, db: Session = Depends(get_db)):
    word = db.query(models.Word).filter(models.Word.id == word_id).one_or_none()
    if not word:
        raise HTTPException(404, "단어를 찾을 수 없습니다.")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(word, key, value)
    db.commit()
    db.refresh(word)
    return word

@router.post("/import", response_model=dict)
async def import_words(
    group_id: int = Form(...),
    file: UploadFile | None = File(None),
    clipboard: str | None = Form(None),
    db: Session = Depends(get_db),
):
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
        return max(0, min(5, ivalue))

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
    default_language: str = Form("en"),
    db: Session = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(400, "업로드할 파일을 선택하세요.")

    content = await file.read()
    name = (file.filename or "").lower()
    try:
        if name.endswith(".xlsx") or name.endswith(".xls"):
            df = pd.read_excel(BytesIO(content))
        else:
            df = pd.read_csv(StringIO(content.decode("utf-8")))
    except Exception as exc:
        raise HTTPException(400, f"파일을 읽을 수 없습니다: {exc}")

    df.columns = [str(c).strip().lower() for c in df.columns]
    required = {"folder", "group", "term", "meaning"}
    missing = required - set(df.columns)
    if missing:
        raise HTTPException(400, f"필수 컬럼 누락: {', '.join(sorted(missing))}")

    folders = db.query(models.Folder).all()
    folder_cache: dict[str, models.Folder] = {
        (f.name or "").strip().lower(): f for f in folders
    }
    group_cache: dict[tuple[int, str], models.Group] = {}
    word_cache: defaultdict[int, set[tuple[str, str]]] = defaultdict(set)

    inserted = 0
    skipped = 0
    folders_created = 0
    groups_created = 0

    def normalize(value: str | None) -> str:
        return (value or "").strip()

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
            folder = models.Folder(name=folder_name)
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
                )
                .one_or_none()
            )
            if not group:
                group = models.Group(folder_id=folder.id, name=group_name)
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
