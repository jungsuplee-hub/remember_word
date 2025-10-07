# Remember Word API

이 프로젝트는 다양한 언어(영어, 한자, 한글 등)의 어휘 암기를 돕기 위한 백엔드 API입니다. 단어 폴더/그룹 관리, 엑셀/클립보드 업로드, 별점 기반 태깅, 시험 세션 관리 등의 기능을 제공합니다.

## 주요 기능

### 폴더 & 그룹
* `/folders` – 폴더 생성 및 조회
* `/groups` – 폴더별 그룹 생성 및 조회

### 단어 관리
* `/words`
  * 단어 등록 (직접 입력 또는 `/words/import`로 엑셀/CSV/클립보드 업로드)
  * 그룹별 단어 조회, 별점 필터링(min_star, star_values)
  * 단어 정보 및 별점 수정(PATCH `/words/{word_id}`)

### 프로필
* `/profiles` – 학습자를 위한 프로필 CRUD 지원 (이름/이메일 기반)

### 시험(퀴즈)
* `/quizzes/start` – 그룹 단위로 시험 세션 생성
  * 랜덤/순차 출제, 최대 문항 수 제한, 출제 방향(단어→뜻 / 뜻→단어), 별점 기반 필터링 지원
* `/quizzes/{session_id}/answer` – 문항 단위 채점 결과 반영 및 진행 상황 갱신
* `/quizzes/{session_id}/progress` – 현재까지의 정답/오답 현황 조회 (몇 개 중 몇 개 정답인지 확인 가능)
* `/quizzes/{session_id}/retry` – 틀린 문항만 모아 재시험 세션 생성

## 실행 방법

1. 환경 변수 `DB_URL`을 설정합니다. (예: `sqlite:///./remember_word.db`)
2. 의존성 설치: `pip install -r requirements.txt`
3. 테이블 생성: `python app/create_tables.py`
4. 서버 실행: `uvicorn app.main:app --reload --port 8080`

## 추가 아이디어

* 프로필별 시험 히스토리 통계 페이지
* 별점 또는 태그 기반의 맞춤형 학습 큐레이션
* 시험 결과를 활용한 스페이싱 반복(Spaced Repetition) 알고리즘 적용
* 다국어 발음 TTS 연동, 예문 퀴즈 등 확장 기능
