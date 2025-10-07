from pydantic import BaseModel, Field, root_validator
from typing import Optional, List, Literal


MAX_STAR_RATING = 10


class ProfileCreate(BaseModel):
    name: str = Field(..., description="표시할 이름")
    email: Optional[str] = Field(default=None, description="로그인을 위한 이메일")


class ProfileOut(BaseModel):
    id: int
    name: str
    email: Optional[str]

    class Config:
        from_attributes = True

class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None


class FolderUpdate(BaseModel):
    name: Optional[str] = None


class GroupCreate(BaseModel):
    folder_id: int
    name: str


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    folder_id: Optional[int] = None


class WordCreate(BaseModel):
    group_id: int
    language: str = Field(default="기본")
    term: str
    meaning: str
    reading: Optional[str] = None
    pos: Optional[str] = None
    example: Optional[str] = None
    memo: Optional[str] = None
    star: Optional[int] = Field(default=0, ge=0, le=MAX_STAR_RATING)


class WordUpdate(BaseModel):
    group_id: Optional[int] = None
    language: Optional[str] = None
    term: Optional[str] = None
    meaning: Optional[str] = None
    reading: Optional[str] = None
    pos: Optional[str] = None
    example: Optional[str] = None
    memo: Optional[str] = None
    star: Optional[int] = Field(default=None, ge=0, le=MAX_STAR_RATING)

class WordOut(BaseModel):
    id: int
    group_id: int
    language: str
    term: str
    meaning: str
    reading: Optional[str]
    pos: Optional[str]
    example: Optional[str]
    memo: Optional[str]
    star: int

    class Config:
        from_attributes = True


class QuizStartRequest(BaseModel):
    folder_id: Optional[int] = Field(default=None, description="시험을 볼 폴더")
    group_id: Optional[int] = Field(default=None, description="기본 그룹 ID (호환성)")
    group_ids: Optional[List[int]] = Field(default=None, description="시험에 포함할 그룹 ID 목록")
    profile_id: Optional[int] = Field(default=None, description="시험을 치르는 프로필")
    limit: Optional[int] = Field(default=None, gt=0, description="출제할 단어 수")
    random: bool = Field(default=True, description="문항 순서를 랜덤으로 섞을지 여부")
    direction: Literal["term_to_meaning", "meaning_to_term"] = "term_to_meaning"
    mode: Literal["study", "exam"] = "exam"
    min_star: Optional[int] = Field(default=None, ge=0, le=MAX_STAR_RATING, description="별 최소 점수")
    star_values: Optional[List[int]] = Field(default=None, description="선택한 별 값 목록")

    @root_validator(pre=True)
    def validate_groups(cls, values):
        group_id = values.get("group_id")
        group_ids = values.get("group_ids")

        parsed_ids: List[int] = []

        if group_ids:
            parsed_ids = []
            for gid in group_ids:
                if gid is None or gid == "":
                    continue
                try:
                    parsed_ids.append(int(gid))
                except (TypeError, ValueError):
                    raise ValueError("group_ids는 정수여야 합니다.")

        if group_id not in (None, ""):
            try:
                gid_int = int(group_id)
            except (TypeError, ValueError):
                raise ValueError("group_id는 정수여야 합니다.")
            parsed_ids.insert(0, gid_int)

        deduped: List[int] = []
        seen = set()
        for gid in parsed_ids:
            if gid in seen:
                continue
            seen.add(gid)
            deduped.append(gid)

        if not deduped:
            raise ValueError("시험을 시작하려면 최소 하나의 그룹을 선택해야 합니다.")

        values["group_ids"] = deduped
        values["group_id"] = deduped[0]
        return values


class QuizQuestionOut(BaseModel):
    id: int
    word_id: int
    position: int
    prompt: str
    answer: str
    star: int
    reading: Optional[str]

    class Config:
        from_attributes = True


class QuizStartResponse(BaseModel):
    session_id: int
    total: int
    direction: str
    questions: List[QuizQuestionOut]


class QuizAnswerSubmit(BaseModel):
    question_id: int
    answer: Optional[str] = None
    is_correct: bool


class WordImportStructuredSummary(BaseModel):
    inserted: int
    skipped: int
    folders_created: int
    groups_created: int


class QuizProgress(BaseModel):
    session_id: int
    total: int
    answered: int
    correct: int
    remaining: int
    incorrect_question_ids: List[int] = Field(default_factory=list)


class QuizRetryRequest(BaseModel):
    question_ids: Optional[List[int]] = Field(default=None, description="다시 풀고 싶은 문항 ID 목록")
    random: Optional[bool] = Field(default=None, description="랜덤 여부 덮어쓰기")

