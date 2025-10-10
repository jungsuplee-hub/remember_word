from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models, schemas
from utils.sorting import korean_alnum_sort_key
from utils.auth import require_current_user

router = APIRouter()

@router.post("", response_model=dict)
def create_folder(
    payload: schemas.FolderCreate,
    db: Session = Depends(get_db),
    current_user: models.Profile = Depends(require_current_user),
):
    parent_folder = None
    if payload.parent_id is not None:
        parent_folder = (
            db.query(models.Folder)
            .filter(
                models.Folder.id == payload.parent_id,
                models.Folder.profile_id == current_user.id,
            )
            .one_or_none()
        )
        if not parent_folder:
            raise HTTPException(404, "상위 폴더를 찾을 수 없습니다.")

    f = models.Folder(
        name=payload.name,
        parent_id=payload.parent_id if parent_folder else None,
        profile_id=current_user.id,
    )
    db.add(f); db.commit(); db.refresh(f)
    return {"id": f.id}

@router.get("", response_model=list[dict])
def list_folders(
    db: Session = Depends(get_db),
    current_user: models.Profile = Depends(require_current_user),
):
    rows = (
        db.query(models.Folder)
        .filter(models.Folder.profile_id == current_user.id)
        .all()
    )
    rows.sort(key=lambda r: korean_alnum_sort_key(r.name or ""))
    return [{"id": r.id, "name": r.name, "parent_id": r.parent_id} for r in rows]


@router.patch("/{folder_id}", response_model=dict)
def update_folder(
    folder_id: int,
    payload: schemas.FolderUpdate,
    db: Session = Depends(get_db),
    current_user: models.Profile = Depends(require_current_user),
):
    folder = (
        db.query(models.Folder)
        .filter(
            models.Folder.id == folder_id,
            models.Folder.profile_id == current_user.id,
        )
        .one_or_none()
    )
    if not folder:
        raise HTTPException(404, "폴더를 찾을 수 없습니다.")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        folder.name = data["name"]

    db.commit()
    return {"id": folder.id, "name": folder.name}


@router.delete("/{folder_id}", response_model=dict)
def delete_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: models.Profile = Depends(require_current_user),
):
    folder = (
        db.query(models.Folder)
        .filter(
            models.Folder.id == folder_id,
            models.Folder.profile_id == current_user.id,
        )
        .one_or_none()
    )
    if not folder:
        raise HTTPException(404, "폴더를 찾을 수 없습니다.")

    db.delete(folder)
    db.commit()
    return {"status": "deleted", "id": folder_id}
