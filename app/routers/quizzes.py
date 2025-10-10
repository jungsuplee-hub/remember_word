from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, case
from sqlalchemy.orm import Session
from database import get_db
import models, schemas
import random

router = APIRouter()

MAX_STAR_SCORE = schemas.MAX_STAR_RATING


def _serialize_star_values(values: list[int] | None) -> str | None:
    if not values:
        return None
    unique_sorted = sorted({int(v) for v in values})
    return ",".join(str(v) for v in unique_sorted)


def _quiz_progress(session: models.QuizSession, db: Session) -> schemas.QuizProgress:
    incorrect_rows = (
        db.query(models.QuizQuestion.id)
        .filter(
            models.QuizQuestion.session_id == session.id,
            models.QuizQuestion.is_correct.is_(False),
        )
        .all()
    )
    incorrect_ids = [row[0] for row in incorrect_rows]
    return schemas.QuizProgress(
        session_id=session.id,
        total=session.total_questions,
        answered=session.answered_questions,
        correct=session.correct_questions,
        remaining=max(0, session.total_questions - session.answered_questions),
        incorrect_question_ids=incorrect_ids,
    )


@router.post("/start", response_model=schemas.QuizStartResponse)
def start_quiz(payload: schemas.QuizStartRequest, db: Session = Depends(get_db)):
    group_ids = payload.group_ids or []
    if not group_ids:
        raise HTTPException(400, "시험을 시작할 그룹을 선택하세요.")

    groups = (
        db.query(models.Group)
        .filter(models.Group.id.in_(group_ids))
        .all()
    )
    if len(groups) != len(group_ids):
        existing_ids = {g.id for g in groups}
        missing = sorted({gid for gid in group_ids if gid not in existing_ids})
        raise HTTPException(404, f"선택한 그룹을 찾을 수 없습니다: {missing}")

    folder_ids = {g.folder_id for g in groups}
    if len(folder_ids) > 1:
        raise HTTPException(400, "같은 폴더의 그룹만 선택할 수 있습니다.")
    if payload.folder_id and folder_ids and payload.folder_id not in folder_ids:
        raise HTTPException(400, "선택한 폴더에 그룹이 속해있지 않습니다.")

    primary_group_id = payload.group_id or group_ids[0]

    query = db.query(models.Word).filter(models.Word.group_id.in_(group_ids))
    if payload.min_star is not None:
        query = query.filter(models.Word.star >= payload.min_star)
    if payload.star_values:
        query = query.filter(models.Word.star.in_(payload.star_values))

    if payload.random:
        query = query.order_by(func.random())
    else:
        group_order = case(
            *[(gid, idx) for idx, gid in enumerate(group_ids)],
            value=models.Word.group_id,
        )
        query = query.order_by(group_order, models.Word.term)

    if payload.limit:
        query = query.limit(payload.limit)

    words = query.all()
    if not words:
        raise HTTPException(400, "선택한 조건에 해당하는 단어가 없습니다.")

    session = models.QuizSession(
        profile_id=payload.profile_id,
        group_id=primary_group_id,
        direction=payload.direction,
        mode=payload.mode,
        randomize=payload.random,
        limit_count=payload.limit,
        include_star_min=payload.min_star,
        include_star_values=_serialize_star_values(payload.star_values),
        total_questions=len(words),
        is_retry=False,
    )
    db.add(session)
    db.flush()

    quiz_questions = []
    for idx, word in enumerate(words, start=1):
        if payload.direction == "term_to_meaning":
            prompt = word.term
            answer = word.meaning
        else:
            prompt = word.meaning
            answer = word.term

        question = models.QuizQuestion(
            session_id=session.id,
            word_id=word.id,
            position=idx,
            prompt_text=prompt,
            answer_text=answer,
        )
        db.add(question)
        db.flush()
        quiz_questions.append((question, word))

    db.commit()

    questions_out = [
        schemas.QuizQuestionOut(
            id=question.id,
            word_id=question.word_id,
            position=question.position,
            prompt=question.prompt_text,
            answer=question.answer_text,
            star=word.star,
            reading=word.reading,
        )
        for question, word in quiz_questions
    ]

    return schemas.QuizStartResponse(
        session_id=session.id,
        total=session.total_questions,
        direction=session.direction,
        questions=questions_out,
    )


@router.post("/{session_id}/answer", response_model=schemas.QuizProgress)
def submit_answer(session_id: int, payload: schemas.QuizAnswerSubmit, db: Session = Depends(get_db)):
    session = db.query(models.QuizSession).filter(models.QuizSession.id == session_id).one_or_none()
    if not session:
        raise HTTPException(404, "시험 세션을 찾을 수 없습니다.")

    question = (
        db.query(models.QuizQuestion)
        .filter(models.QuizQuestion.id == payload.question_id)
        .one_or_none()
    )
    if not question or question.session_id != session_id:
        raise HTTPException(404, "해당 세션에서 문항을 찾을 수 없습니다.")

    previously_answered = question.is_correct is not None
    previous_correct = question.is_correct if previously_answered else False

    question.user_answer = payload.answer
    question.is_correct = payload.is_correct

    should_increment_star = (
        session.mode == "exam"
        and not session.is_retry
        and not previously_answered
        and not payload.is_correct
    )

    if not previously_answered:
        session.answered_questions += 1
        if payload.is_correct:
            session.correct_questions += 1
    else:
        if previous_correct and not payload.is_correct:
            session.correct_questions -= 1
        elif (not previous_correct) and payload.is_correct:
            session.correct_questions += 1

    if should_increment_star:
        word = question.word
        if word is not None:
            word.star = min(MAX_STAR_SCORE, (word.star or 0) + 1)

    db.commit()
    db.refresh(session)

    return _quiz_progress(session, db)


@router.get("/{session_id}/progress", response_model=schemas.QuizProgress)
def get_progress(session_id: int, db: Session = Depends(get_db)):
    session = db.query(models.QuizSession).filter(models.QuizSession.id == session_id).one_or_none()
    if not session:
        raise HTTPException(404, "시험 세션을 찾을 수 없습니다.")
    return _quiz_progress(session, db)


@router.post("/{session_id}/retry", response_model=schemas.QuizStartResponse)
def retry_incorrect(session_id: int, payload: schemas.QuizRetryRequest | None = None, db: Session = Depends(get_db)):
    session = db.query(models.QuizSession).filter(models.QuizSession.id == session_id).one_or_none()
    if not session:
        raise HTTPException(404, "시험 세션을 찾을 수 없습니다.")

    base_query = db.query(models.QuizQuestion).filter(models.QuizQuestion.session_id == session_id)
    if payload and payload.question_ids:
        base_query = base_query.filter(models.QuizQuestion.id.in_(payload.question_ids))
    else:
        base_query = base_query.filter(models.QuizQuestion.is_correct.is_(False))

    questions = base_query.order_by(models.QuizQuestion.position).all()
    if not questions:
        raise HTTPException(400, "다시 풀 문항이 없습니다.")

    randomize = session.randomize if payload is None or payload.random is None else payload.random
    word_ids = [q.word_id for q in questions]

    words_query = db.query(models.Word).filter(models.Word.id.in_(word_ids))
    words = words_query.all()
    word_map = {w.id: w for w in words}

    ordered_questions = list(questions)
    if randomize:
        random.shuffle(ordered_questions)
    else:
        ordered_questions.sort(key=lambda q: q.position)

    new_session = models.QuizSession(
        profile_id=session.profile_id,
        group_id=session.group_id,
        direction=session.direction,
        mode=session.mode,
        randomize=randomize,
        limit_count=len(ordered_questions),
        include_star_min=session.include_star_min,
        include_star_values=session.include_star_values,
        total_questions=len(ordered_questions),
        is_retry=True,
    )
    db.add(new_session)
    db.flush()

    quiz_questions = []
    for idx, original_question in enumerate(ordered_questions, start=1):
        word = word_map[original_question.word_id]
        question = models.QuizQuestion(
            session_id=new_session.id,
            word_id=word.id,
            position=idx,
            prompt_text=original_question.prompt_text,
            answer_text=original_question.answer_text,
        )
        db.add(question)
        db.flush()
        quiz_questions.append((question, word))

    db.commit()

    questions_out = [
        schemas.QuizQuestionOut(
            id=q.id,
            word_id=q.word_id,
            position=q.position,
            prompt=q.prompt_text,
            answer=q.answer_text,
            star=word.star,
            reading=word.reading,
        )
        for q, word in quiz_questions
    ]

    return schemas.QuizStartResponse(
        session_id=new_session.id,
        total=new_session.total_questions,
        direction=new_session.direction,
        questions=questions_out,
    )


@router.get("/history", response_model=list[schemas.QuizHistoryItem])
def list_history(limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    sessions = (
        db.query(models.QuizSession)
        .order_by(models.QuizSession.created_at.desc())
        .limit(limit)
        .all()
    )
    if not sessions:
        return []

    session_ids = [session.id for session in sessions]

    group_rows = (
        db.query(
            models.QuizQuestion.session_id,
            models.Group.name.label("group_name"),
            models.Folder.name.label("folder_name"),
        )
        .join(models.Word, models.Word.id == models.QuizQuestion.word_id)
        .join(models.Group, models.Group.id == models.Word.group_id)
        .join(models.Folder, models.Folder.id == models.Group.folder_id)
        .filter(models.QuizQuestion.session_id.in_(session_ids))
        .all()
    )

    folder_by_session: dict[int, str | None] = {}
    groups_by_session: dict[int, list[str]] = {}

    for row in group_rows:
        session_id = row.session_id
        folder_name = row.folder_name
        group_name = row.group_name
        if session_id not in folder_by_session:
            folder_by_session[session_id] = folder_name
        groups = groups_by_session.setdefault(session_id, [])
        if group_name and group_name not in groups:
            groups.append(group_name)

    history: list[schemas.QuizHistoryItem] = []
    for session in sessions:
        total = session.total_questions or 0
        correct = session.correct_questions or 0
        incorrect = max(0, total - correct)
        score = (correct / total * 100) if total else 0.0
        passed = total > 0 and (correct / total) >= 0.9
        history.append(
            schemas.QuizHistoryItem(
                session_id=session.id,
                created_at=session.created_at or datetime.utcnow(),
                folder_name=folder_by_session.get(session.id),
                group_names=groups_by_session.get(session.id, []),
                total=total,
                correct=correct,
                incorrect=incorrect,
                score=round(score, 1),
                passed=passed,
            )
        )

    return history
