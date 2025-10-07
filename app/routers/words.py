from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models, schemas
import pandas as pd
from io import BytesIO, StringIO

router = APIRouter()

@router.post("", response_model=dict)
def create_word(payload: schemas.WordCreate, db: Session = Depends(get_db)):
    w = models.Word(**payload.model_dump())
    db.add(w); db.commit(); db.refresh(w)
    return {"id": w.id}

@router.get("", response_model=list[schemas.WordOut])
def list_words(group_id: int, db: Session = Depends(get_db)):
    rows = db.query(models.Word).filter(models.Word.group_id == group_id).all()
    return rows

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

    for row in df.to_dict(orient="records"):
        obj = db.query(models.Word).filter(
            models.Word.group_id==group_id,
            models.Word.language==row["language"],
            models.Word.term==row["term"]
        ).one_or_none()

        if obj:
            for k in ["meaning","reading","pos","example","memo"]:
                if k in row:
                    setattr(obj, k, row.get(k))
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
            )
            db.add(obj)
            inserted += 1

    db.commit()
    return {"inserted": inserted, "updated": updated}
