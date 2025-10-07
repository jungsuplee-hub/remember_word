from fastapi import APIRouter, Depends, HTTPException
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


@router.patch("/{folder_id}", response_model=dict)
def update_folder(folder_id: int, payload: schemas.FolderUpdate, db: Session = Depends(get_db)):
    folder = db.query(models.Folder).filter(models.Folder.id == folder_id).one_or_none()
    if not folder:
        raise HTTPException(404, "폴더를 찾을 수 없습니다.")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        folder.name = data["name"]

    db.commit()
    return {"id": folder.id, "name": folder.name}
