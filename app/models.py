from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, func, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base

class Folder(Base):
    __tablename__ = "folders"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    parent_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    groups = relationship("Group", back_populates="folder", cascade="all,delete")
    children = relationship("Folder", cascade="all,delete")

class Group(Base):
    __tablename__ = "groups"
    id = Column(Integer, primary_key=True)
    folder_id = Column(Integer, ForeignKey("folders.id"))
    name = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    folder = relationship("Folder", back_populates="groups")
    words = relationship("Word", back_populates="group", cascade="all,delete")

class Word(Base):
    __tablename__ = "words"
    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    language = Column(String, nullable=False)   # ko/ja/zh/en 등
    term = Column(String, nullable=False)
    meaning = Column(Text, nullable=False)
    reading = Column(String)
    pos = Column(String)
    example = Column(Text)
    memo = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    group = relationship("Group", back_populates="words")
    __table_args__ = (UniqueConstraint("group_id", "language", "term", name="uq_group_lang_term"),)

