from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    ForeignKey,
    DateTime,
    Date,
    func,
    UniqueConstraint,
    Boolean,
    text,
)
from sqlalchemy.orm import relationship
from database import Base

class Folder(Base):
    __tablename__ = "folders"
    id = Column(Integer, primary_key=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=True)
    name = Column(String, nullable=False)
    parent_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    default_language = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    groups = relationship("Group", back_populates="folder", cascade="all,delete")
    children = relationship("Folder", cascade="all,delete")
    profile = relationship("Profile", back_populates="folders")

class Group(Base):
    __tablename__ = "groups"
    id = Column(Integer, primary_key=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=True)
    folder_id = Column(Integer, ForeignKey("folders.id"))
    name = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    folder = relationship("Folder", back_populates="groups")
    words = relationship("Word", back_populates="group", cascade="all,delete")
    quiz_sessions = relationship("QuizSession", back_populates="group", cascade="all,delete")
    profile = relationship("Profile", back_populates="groups")

class Word(Base):
    __tablename__ = "words"
    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    language = Column(String, nullable=False, default="기본", server_default="기본")   # ko/ja/zh/en 등
    term = Column(String, nullable=False)
    meaning = Column(Text, nullable=False)
    reading = Column(String)
    pos = Column(String)
    example = Column(Text)
    memo = Column(Text)
    star = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime, server_default=func.now())
    group = relationship("Group", back_populates="words")
    __table_args__ = (UniqueConstraint("group_id", "language", "term", name="uq_group_lang_term"),)


class Profile(Base):
    __tablename__ = "profiles"
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True)
    password_hash = Column(String, nullable=True)
    is_admin = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    last_login_at = Column(DateTime)
    login_count = Column(Integer, nullable=False, default=0, server_default="0")
    password_reset_token = Column(String, nullable=True)
    password_reset_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    exam_pass_threshold = Column(
        Integer, nullable=False, default=90, server_default="90"
    )
    sessions = relationship("QuizSession", back_populates="profile", cascade="all,delete")
    folders = relationship("Folder", back_populates="profile", cascade="all,delete")
    groups = relationship("Group", back_populates="profile", cascade="all,delete")
    study_plans = relationship("StudyPlan", back_populates="profile", cascade="all,delete")
    social_accounts = relationship(
        "SocialAccount",
        back_populates="profile",
        cascade="all, delete-orphan",
    )


class SocialAccount(Base):
    __tablename__ = "social_accounts"
    id = Column(Integer, primary_key=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False)
    provider = Column(String, nullable=False)
    provider_account_id = Column(String, nullable=False)
    email = Column(String, nullable=True)
    name = Column(String, nullable=True)
    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    profile = relationship("Profile", back_populates="social_accounts")

    __table_args__ = (
        UniqueConstraint("provider", "provider_account_id", name="uq_social_provider_account"),
    )


class QuizSession(Base):
    __tablename__ = "quiz_sessions"
    id = Column(Integer, primary_key=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    direction = Column(String, nullable=False)  # term_to_meaning or meaning_to_term
    mode = Column(String, nullable=False)
    randomize = Column(Boolean, nullable=False, default=True)
    limit_count = Column(Integer)
    include_star_min = Column(Integer)
    include_star_values = Column(String)
    total_questions = Column(Integer, nullable=False)
    answered_questions = Column(Integer, nullable=False, default=0)
    correct_questions = Column(Integer, nullable=False, default=0)
    is_retry = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    created_at = Column(DateTime, server_default=func.now())
    profile = relationship("Profile", back_populates="sessions")
    group = relationship("Group", back_populates="quiz_sessions")
    questions = relationship("QuizQuestion", back_populates="session", cascade="all,delete")


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("quiz_sessions.id"), nullable=False)
    word_id = Column(Integer, ForeignKey("words.id"), nullable=False)
    position = Column(Integer, nullable=False)
    prompt_text = Column(Text, nullable=False)
    answer_text = Column(Text, nullable=False)
    user_answer = Column(Text)
    is_correct = Column(Boolean)
    created_at = Column(DateTime, server_default=func.now())
    session = relationship("QuizSession", back_populates="questions")
    word = relationship("Word")


class StudyPlan(Base):
    __tablename__ = "study_plans"
    id = Column(Integer, primary_key=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False)
    study_date = Column(Date, nullable=False)
    folder_id = Column(Integer, ForeignKey("folders.id"), nullable=False)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    profile = relationship("Profile", back_populates="study_plans")
    folder = relationship("Folder")
    group = relationship("Group")

    __table_args__ = (
        UniqueConstraint(
            "profile_id",
            "study_date",
            "group_id",
            name="uq_study_plan_profile_date_group",
        ),
    )

