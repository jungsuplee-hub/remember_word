from datetime import datetime, date
from pydantic import BaseModel, Field, EmailStr, root_validator
from typing import Optional, List, Literal


MAX_STAR_RATING = 10


class ProfileCreate(BaseModel):
    name: str = Field(..., description="표시할 이름")
    email: Optional[str] = Field(default=None, description="로그인을 위한 이메일")


class LoginRequest(BaseModel):
    username: str = Field(..., description="로그인 아이디")
    password: str = Field(..., description="비밀번호")


class RegistrationRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="로그인 아이디")
    name: str = Field(..., min_length=1, max_length=100, description="표시 이름")
    email: Optional[EmailStr] = Field(default=None, description="연락 이메일")
    password: str = Field(..., min_length=6, max_length=128, description="비밀번호")


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(..., description="현재 비밀번호")
    new_password: str = Field(..., description="새 비밀번호")


class AccountPreferencesUpdate(BaseModel):
    exam_pass_threshold: int = Field(
        ..., ge=0, le=100, description="시험 합격 기준 (%)"
    )


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


class SessionInfo(BaseModel):
    id: int
    username: Optional[str]
    name: str
    email: Optional[str]
    is_admin: bool
    last_login_at: Optional[datetime]
    login_count: int
    exam_pass_threshold: int = Field(default=90, ge=0, le=100)

    class Config:
        from_attributes = True


class ProfileOut(BaseModel):
    id: int
    username: Optional[str]
    name: str
    email: Optional[str]
    is_admin: bool
    last_login_at: Optional[datetime]
    login_count: int
    exam_pass_threshold: int = Field(default=90, ge=0, le=100)

    class Config:
        from_attributes = True

class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None
    default_language: Optional[str] = None


class FolderUpdate(BaseModel):
    name: Optional[str] = None
    default_language: Optional[str] = None


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
    number_start: Optional[int] = Field(
        default=None,
        ge=1,
        description="선택한 그룹에서 시작할 단어 번호 (1부터 시작)",
    )
    number_end: Optional[int] = Field(
        default=None,
        ge=1,
        description="선택한 그룹에서 종료할 단어 번호",
    )

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

    @root_validator(skip_on_failure=True)
    def validate_number_range(cls, values):
        start = values.get("number_start")
        end = values.get("number_end")

        if start is None and end is None:
            return values

        if start is not None and start <= 0:
            raise ValueError("번호 범위는 1 이상의 값이어야 합니다.")
        if end is not None and end <= 0:
            raise ValueError("번호 범위는 1 이상의 값이어야 합니다.")

        normalized_start = start or 1
        normalized_end = end or normalized_start

        if normalized_start > normalized_end:
            raise ValueError("시작 번호는 끝 번호보다 클 수 없습니다.")

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


class StudyPlanSet(BaseModel):
    group_ids: List[int] = Field(default_factory=list, description="선택한 그룹 ID 목록")


class StudyPlanMove(BaseModel):
    study_date: date = Field(..., description="학습 계획을 이동할 날짜")


class StudyPlanMemoUpdate(BaseModel):
    memo: Optional[str] = Field(default=None, description="선택한 날짜에 대한 메모 내용")


class StudyPlanMemoOut(BaseModel):
    study_date: date
    memo: Optional[str] = None

    class Config:
        from_attributes = True


class StudyPlanExamSessionOut(BaseModel):
    session_id: int
    created_at: datetime
    total: int
    correct: int
    score: float
    passed: bool


class StudyPlanOut(BaseModel):
    id: int
    study_date: date
    folder_id: int
    folder_name: str
    group_id: int
    group_name: str
    is_completed: bool = Field(default=False)
    exam_sessions: List[StudyPlanExamSessionOut] = Field(default_factory=list)
    day_memo: Optional[str] = Field(default=None, description="해당 날짜에 저장된 메모")

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


class QuizHistoryItem(BaseModel):
    session_id: int
    created_at: datetime
    folder_id: Optional[int]
    folder_name: Optional[str]
    group_ids: List[int] = Field(default_factory=list)
    group_names: List[str] = Field(default_factory=list)
    total: int
    correct: int
    incorrect: int
    score: float
    passed: bool
    direction: str
    random: bool
    limit: Optional[int]
    min_star: Optional[int]
    star_values: List[int] = Field(default_factory=list)
    mode: Optional[str]


class AdminAccountStats(BaseModel):
    profile_id: int
    username: Optional[str]
    name: str
    email: Optional[str]
    folder_count: int
    group_count: int
    word_count: int
    quiz_count: int
    login_count: int
    last_login_at: Optional[datetime]


class MarketLanguageSummary(BaseModel):
    language: str
    folder_count: int
    group_count: int


class MarketFolderOut(BaseModel):
    id: int
    name: str
    default_language: Optional[str]
    group_count: int


class MarketGroupOut(BaseModel):
    id: int
    name: str
    word_count: int


class MarketImportRequest(BaseModel):
    folder_id: int
    group_ids: List[int]

    @root_validator(pre=True)
    def validate_group_ids(cls, values):
        raw_group_ids = values.get("group_ids") or []
        normalized: List[int] = []
        seen = set()
        for gid in raw_group_ids:
            if gid in (None, ""):
                continue
            try:
                gid_int = int(gid)
            except (TypeError, ValueError):
                raise ValueError("group_ids는 정수여야 합니다.")
            if gid_int in seen:
                continue
            seen.add(gid_int)
            normalized.append(gid_int)
        if not normalized:
            raise ValueError("가져올 그룹을 하나 이상 선택하세요.")
        values["group_ids"] = normalized
        return values


class MarketImportSummary(BaseModel):
    folder_id: int
    folder_name: str
    default_language: Optional[str]
    created_groups: int
    updated_groups: int
    imported_words: int
    skipped_words: int

