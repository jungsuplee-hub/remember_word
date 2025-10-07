from fastapi import APIRouter, Depends, HTTPException
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


@router.patch("/{group_id}", response_model=dict)
def update_group(group_id: int, payload: schemas.GroupUpdate, db: Session = Depends(get_db)):
    group = db.query(models.Group).filter(models.Group.id == group_id).one_or_none()
    if not group:
        raise HTTPException(404, "그룹을 찾을 수 없습니다.")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        group.name = data["name"]
    if "folder_id" in data and data["folder_id"] is not None:
        folder = db.query(models.Folder).filter(models.Folder.id == data["folder_id"]).one_or_none()
        if not folder:
            raise HTTPException(404, "이동할 폴더를 찾을 수 없습니다.")
        group.folder_id = data["folder_id"]

    db.commit()
    return {"id": group.id, "folder_id": group.folder_id, "name": group.name}


@router.delete("/{group_id}", response_model=dict)
def delete_group(group_id: int, db: Session = Depends(get_db)):
    group = db.query(models.Group).filter(models.Group.id == group_id).one_or_none()
    if not group:
        raise HTTPException(404, "그룹을 찾을 수 없습니다.")

    db.delete(group)
    db.commit()
    return {"status": "deleted", "id": group_id}
