from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
import models, schemas

router = APIRouter()

@router.post("", response_model=dict)
def create_folder(payload: schemas.FolderCreate, db: Session = Depends(get_db)):
    f = models.Folder(name=payload.name, parent_id=payload.parent_id)
    db.add(f); db.commit(); db.refresh(f)
    return {"id": f.id}

@router.get("", response_model=list[dict])
def list_folders(db: Session = Depends(get_db)):
    rows = db.query(models.Folder).all()
    return [{"id": r.id, "name": r.name, "parent_id": r.parent_id} for r in rows]
