from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
import models, schemas

router = APIRouter()

@router.post("", response_model=dict)
def create_group(payload: schemas.GroupCreate, db: Session = Depends(get_db)):
    g = models.Group(folder_id=payload.folder_id, name=payload.name)
    db.add(g); db.commit(); db.refresh(g)
    return {"id": g.id}

@router.get("", response_model=list[dict])
def list_groups(folder_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(models.Group)
    if folder_id:
        q = q.filter(models.Group.folder_id == folder_id)
    rows = q.all()
    return [{"id": r.id, "folder_id": r.folder_id, "name": r.name} for r in rows]
