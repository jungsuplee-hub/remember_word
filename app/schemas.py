from pydantic import BaseModel
from typing import Optional, List

class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None

class GroupCreate(BaseModel):
    folder_id: int
    name: str

class WordCreate(BaseModel):
    group_id: int
    language: str
    term: str
    meaning: str
    reading: Optional[str] = None
    pos: Optional[str] = None
    example: Optional[str] = None
    memo: Optional[str] = None

class WordOut(BaseModel):
    id: int
    group_id: int
    language: str
    term: str
    meaning: str
    class Config:
        from_attributes = True

