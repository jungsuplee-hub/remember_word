# Remember Word Backend API Specification

## 1. Overview
"Remember Word" 백엔드는 FastAPI 기반 REST API로, 학습자가 단어장을 구성하고 시험 및 복습을 진행할 수 있도록 데이터를 관리하고 서비스 로직을 제공합니다. 본 문서는 프런트엔드와의 연동을 고려한 엔드포인트 정의, 인증 흐름, 데이터 모델, 비즈니스 규칙을 정리합니다.

## 2. 핵심 도메인 모델
- **UserProfile**
  - id (UUID)
  - email, password_hash
  - display_name, preferred_language
  - default_quiz_options (JSON)
  - created_at, updated_at
- **Folder**
  - id (UUID)
  - user_id (FK -> UserProfile)
  - title, description, position
  - created_at, updated_at
- **Group**
  - id (UUID)
  - folder_id (FK -> Folder)
  - title, description, target_goal
  - position, created_at, updated_at
- **Word**
  - id (UUID)
  - group_id (FK -> Group)
  - term, reading, part_of_speech, meaning, example_sentence
  - rating (0~5), tags (array of strings)
  - metadata (JSON: source, difficulty 등)
  - created_at, updated_at
- **QuizSession**
  - id (UUID)
  - user_id, folder_id?, group_ids (list)
  - mode (word_to_meaning, meaning_to_word, mixed 등)
  - question_count, options (JSON)
  - started_at, finished_at, score
- **QuizAttempt**
  - id (UUID)
  - quiz_session_id (FK -> QuizSession)
  - word_id
  - presented_prompt, user_answer, is_correct, response_time
- **ReviewTask**
  - id (UUID)
  - user_id, word_id
  - due_date, interval, status (pending/completed)
  - source_quiz_session_id (optional)

## 3. 인증 & 권한
1. 이메일 기반 회원가입/로그인
   - `POST /auth/signup`: 이메일, 비밀번호, 표시 이름으로 가입.
   - `POST /auth/login`: JWT access token + refresh token 발급.
2. 토큰 갱신
   - `POST /auth/token/refresh`: refresh token으로 access token 재발급.
3. 로그아웃 / 토큰 무효화
   - `POST /auth/logout`: refresh token blacklist 처리.
4. OAuth 확장
   - `/auth/oauth/{provider}`: 추후 구글/애플 추가 시 redirect 기반 flow 적용.
5. 권한 규칙
   - 모든 리소스는 `user_id` 기반 soft-tenant 구조.
   - 관리자 전용 엔드포인트는 `/admin` prefix로 분리, Role 필드 활용.

## 4. 엔드포인트 설계
### 4.1 프로필
- `GET /profiles/me`
  - 설명: 로그인한 사용자의 프로필 조회.
  - 응답: `UserProfile` DTO.
- `PATCH /profiles/me`
  - 설명: 표시 이름, 선호 언어, 기본 시험 옵션 업데이트.
  - 요청 바디: `{ "display_name": string?, "preferred_language": string?, "default_quiz_options": object? }`.
- `GET /profiles/me/stats`
  - 설명: 최근 시험 결과, streak, 오답 상위 태그 등 요약 통계 반환.

### 4.2 폴더 & 그룹
- `GET /folders`
  - 설명: 현재 프로필의 폴더와 하위 그룹 목록을 트리 구조로 반환.
- `POST /folders`
  - 설명: 새 폴더 생성.
  - 요청: `{ "title": string, "description": string? }`.
- `PATCH /folders/{folder_id}` / `DELETE /folders/{folder_id}`
  - 설명: 폴더 정보 수정 및 삭제 (소프트 삭제 옵션).
- `POST /folders/{folder_id}/groups`
  - 설명: 폴더 내 그룹 생성.
  - 요청: `{ "title": string, "description": string?, "target_goal": string? }`.
- `PATCH /groups/{group_id}` / `DELETE /groups/{group_id}`
  - 설명: 그룹 정보 수정 및 삭제.
- `POST /groups/{group_id}/move`
  - 설명: 그룹을 다른 폴더로 이동 및 정렬 순서 변경.

### 4.3 단어 데이터
- `GET /groups/{group_id}/words`
  - 설명: 페이지네이션 + 필터(별점, 태그) 지원.
  - 쿼리: `page`, `page_size`, `rating_min`, `rating_max`, `tags`, `search`.
- `POST /groups/{group_id}/words`
  - 설명: 단어 단건 생성.
- `PUT /words/{word_id}` / `DELETE /words/{word_id}`
  - 설명: 단어 수정 및 삭제.
- `POST /groups/{group_id}/words/bulk`
  - 설명: 엑셀/CSV/클립보드 파싱 결과를 일괄 저장. 서버에서는 중복 단어 감지 후 병합 옵션 처리.
  - 요청: `{ "words": [ { term, meaning, ... } ], "merge_strategy": "keep_new" | "keep_existing" | "merge_fields" }`.
- `GET /words/{word_id}/history`
  - 설명: 해당 단어의 시험 기록, 복습 일정 등 관련 로그 조회.

### 4.4 시험(Quiz)
- `POST /quiz/sessions`
  - 설명: 시험 세션 생성. 옵션으로 대상 폴더/그룹, 필터, 모드를 지정.
  - 요청: `{ "target": { "folder_id"?, "group_ids"? }, "filters": { "rating": [min,max], "tags": [] }, "mode": "word_to_meaning", "question_count": int?, "options": {"random_order": bool, ...} }`.
  - 응답: 생성된 세션 ID 및 첫 문제 payload.
- `POST /quiz/sessions/{session_id}/attempts`
  - 설명: 문제 풀이 제출. 정답 판정 및 다음 문제 반환.
  - 요청: `{ "word_id": UUID, "user_answer": string, "time_spent": float }`.
  - 응답: `{ "is_correct": bool, "correct_answer": string, "next_question": {...} }`.
- `POST /quiz/sessions/{session_id}/finish`
  - 설명: 시험 종료 처리, 결과 요약을 저장.
- `GET /quiz/sessions/{session_id}`
  - 설명: 특정 시험 세션의 상세 데이터(문항 목록, 정답 여부, 소요 시간 등) 조회.
- `GET /quiz/sessions`
  - 설명: 최근 시험 기록 목록. 필터: 기간, 폴더, 그룹, 모드.
- `POST /quiz/sessions/{session_id}/retry`
  - 설명: 오답만 새로운 세션으로 생성.

### 4.5 복습(Spaced Repetition)
- `GET /reviews/tasks`
  - 설명: 현재 due 상태의 복습 과제 조회.
- `POST /reviews/tasks`
  - 설명: 수동으로 복습 과제 등록(예: 교사가 지정).
- `PATCH /reviews/tasks/{task_id}`
  - 설명: 상태 업데이트(`completed`, `skipped`), 다음 due 계산.
- `POST /reviews/bulk-generate`
  - 설명: 시험 결과를 기반으로 복습 큐 생성. Leitner 시스템 등 알고리즘 옵션 포함.

### 4.6 메타 데이터 & 기본 리스트
- `GET /catalogs/default-groups`
  - 설명: 기본 제공 단어장 목록 반환.
- `POST /catalogs/default-groups/{catalog_id}/clone`
  - 설명: 선택한 기본 리스트를 사용자의 폴더/그룹으로 복사.
- `GET /tags`
  - 설명: 사용자 정의 태그 목록 + 추천 태그.

## 5. 파일 업로드 파이프라인
1. `POST /imports/upload`
   - 설명: Presigned URL 발급 혹은 직접 업로드 처리.
2. `POST /imports/parse`
   - 설명: 업로드된 파일을 파싱하여 필드 매핑 후보를 반환.
3. `POST /imports/commit`
   - 설명: 매핑된 데이터를 그룹에 저장. 중복 단어 처리 전략과 로그 반환.
4. 에러 처리: 잘못된 인코딩, 필드 부족 시 상세 메시지와 재시도 가이드를 제공.

## 6. 이벤트 & 알림
- `POST /notifications/test`
  - 설명: 사용자 알림 설정 검증.
- Background Tasks
  - 복습 due 계산, 이메일/웹푸시 발송.
  - Celery or FastAPI BackgroundTasks + Redis.

## 7. 데이터 무결성 & 감사 로그
- 모든 삭제는 soft delete 필드(`is_archived`, `deleted_at`)로 처리.
- 주요 변경 이력(단어 수정, 시험 결과)은 `AuditLog` 테이블에 기록.
- GDPR/개인정보 보호 대응: 사용자 데이터 삭제 요청 시, 시험 기록은 익명화 처리.

## 8. 성능 & 확장성 고려사항
- 읽기 요청에 대해 캐시(예: Redis) 활용, 특히 폴더/그룹 트리.
- 대용량 업로드 시 비동기 처리 큐 도입.
- 시험 세션 채점 로직은 WebSocket/SSE를 통해 실시간 진행 상황을 프런트에 전송 가능.
- 데이터베이스 인덱스: `user_id`, `folder_id`, `group_id`, `tags`(GIN index) 최적화.

## 9. 테스트 전략
- 단위 테스트: FastAPI dependency override를 활용한 service/CRUD 테스트.
- 통합 테스트: TestClient로 JWT 인증 flow + 주요 엔드포인트 happy path 검증.
- 로드 테스트: k6 혹은 Locust로 업로드, 시험 진행, 복습 큐 생성 시나리오 점검.
- 모니터링: OpenTelemetry + Prometheus/Grafana로 API latency, 오류율 추적.

## 10. 로드맵 & 향후 확장
1. **MVP**
   - 폴더/그룹 CRUD, 단어 업로드, 기본 시험 세션, 시험 결과 저장.
2. **V1.1**
   - 복습 큐, 태그/별점 필터 시험, 기본 리스트 카탈로그 API.
3. **V1.2**
   - Spaced repetition 자동 스케줄링, 알림 발송, 통계 API 고도화.
4. **V2.0**
   - 음성 인식 기반 발음 퀴즈, AI 추천, 협업/공유 기능.

---
이 문서는 프런트엔드가 명세에 따라 안정적으로 연동할 수 있도록 백엔드 REST API의 구조와 동작을 정의합니다. 구현 시 FastAPI 라우터, Pydantic 스키마, 데이터베이스 ORM 모델을 본 명세에 맞추어 확장하십시오.
