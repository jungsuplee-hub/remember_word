const PENDING_EXAM_KEY = 'remember-word:pending-exam-start';
const RETURN_MESSAGE_KEY = 'remember-word:exam-return-message';

const state = {
  payload: null,
  quiz: {
    active: false,
    completed: false,
    sessionId: null,
    questions: [],
    index: 0,
    progress: null,
    awaitingResult: false,
    lastResult: null,
    pendingSubmissions: 0,
    answers: {},
  },
};

const toast = document.querySelector('#toast');
const subtitle = document.querySelector('#exam-session-subtitle');
const content = document.querySelector('#exam-session-content');
const placeholder = document.querySelector('#exam-session-placeholder');
const progressEl = document.querySelector('#exam-session-progress');
const questionContainer = document.querySelector('#exam-session-question');
const promptEl = document.querySelector('#exam-session-prompt');
const readingEl = document.querySelector('#exam-session-reading');
const answerEl = document.querySelector('#exam-session-answer');
const summaryEl = document.querySelector('#exam-session-summary');
const summaryText = document.querySelector('#exam-session-summary-text');
const summaryScore = document.querySelector('#exam-session-summary-score');
const summaryBadge = document.querySelector('#exam-session-summary-badge');
const previewBtn = document.querySelector('#exam-session-preview');
const failBtn = document.querySelector('#exam-session-fail');
const successBtn = document.querySelector('#exam-session-success');
const previousBtn = document.querySelector('#exam-session-previous');
const stopBtn = document.querySelector('#exam-session-stop');
const retryBtn = document.querySelector('#exam-session-retry');
const returnBtn = document.querySelector('#exam-session-return');
const resultModal = document.querySelector('#exam-session-result-modal');
const resultTitle = document.querySelector('#exam-session-result-title');
const resultMessage = document.querySelector('#exam-session-result-message');
const resultCloseBtn = document.querySelector('#exam-session-result-close');
const resultRetryBtn = document.querySelector('#exam-session-result-retry');
const userGreeting = document.querySelector('#user-greeting');
const adminLink = document.querySelector('#admin-link');
const logoutButton = document.querySelector('#logout-button');
const accountLink = document.querySelector('#account-link');
const sessionManager = window.Session;
let passRatio = 0.9;

function normalizeThreshold(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 90;
  return Math.min(100, Math.max(0, numeric));
}

function updatePassRatioFromUser(user) {
  const threshold = normalizeThreshold(user?.exam_pass_threshold);
  passRatio = threshold / 100;
}

function updateUserMenu(user) {
  if (!user) return;
  const isAdmin = sessionManager?.isAdmin
    ? sessionManager.isAdmin(user)
    : Boolean(user?.is_admin);
  if (userGreeting) {
    userGreeting.textContent = `${user.name}님`;
  }
  if (adminLink) {
    adminLink.hidden = !isAdmin;
    adminLink.classList.toggle('hidden', !isAdmin);
    if (isAdmin) {
      adminLink.removeAttribute('hidden');
      adminLink.setAttribute('aria-hidden', 'false');
    } else {
      adminLink.setAttribute('aria-hidden', 'true');
    }
  }
  if (accountLink) {
    accountLink.hidden = false;
    accountLink.classList.remove('hidden');
    accountLink.removeAttribute('hidden');
    accountLink.setAttribute('aria-hidden', 'false');
  }
}

if (sessionManager) {
  sessionManager.subscribe((user) => {
    updatePassRatioFromUser(user);
    updateUserMenu(user);
  });
}

if (logoutButton && sessionManager) {
  logoutButton.addEventListener('click', (event) => {
    event.preventDefault();
    sessionManager.logout();
  });
}

function showToast(message, type = 'info') {
  if (!toast) return;
  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    let detail = '요청 중 오류가 발생했습니다.';
    try {
      const data = await res.json();
      detail = data.detail || JSON.stringify(data);
    } catch (err) {
      // ignore parse error
    }
    throw new Error(detail);
  }
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    return text;
  }
}

function computeScore(correct, total) {
  if (!total) return 0;
  const value = (correct / total) * 100;
  return Math.round(value * 10) / 10;
}

function formatScore(score) {
  if (!Number.isFinite(score)) return '-';
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function isPassed(correct, total) {
  if (!total) return false;
  return correct / total >= passRatio;
}

function consumePendingExamPayload() {
  try {
    const raw = sessionStorage.getItem(PENDING_EXAM_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_EXAM_KEY);
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.payload) {
      return parsed.payload;
    }
  } catch (err) {
    console.error('Failed to read pending exam payload', err);
  }
  return null;
}

function setReturnMessage(message) {
  try {
    sessionStorage.setItem(RETURN_MESSAGE_KEY, message);
  } catch (err) {
    console.error('Failed to set return message', err);
  }
}

function returnToExamPage(message) {
  if (message) {
    setReturnMessage(message);
  }
  window.location.href = '/static/exam.html';
}

function resetPreview() {
  if (!answerEl) return;
  answerEl.textContent = '';
  answerEl.classList.add('hidden');
}

function showAnswerPreview() {
  if (!state.quiz.active) return;
  const question = state.quiz.questions[state.quiz.index];
  if (!question || !answerEl) return;
  answerEl.textContent = `정답: ${question.answer}`;
  answerEl.classList.remove('hidden');
}

function hideAnswerPreview() {
  if (!answerEl) return;
  answerEl.classList.add('hidden');
  answerEl.textContent = '';
}

function updateSubtitle() {
  if (!subtitle) return;
  if (state.quiz.active) {
    const progress = state.quiz.progress;
    if (!progress) {
      subtitle.textContent = '시험을 준비 중입니다...';
      return;
    }
    const incorrect = Math.max(0, progress.answered - progress.correct);
    const accuracy = progress.answered
      ? `${formatScore(computeScore(progress.correct, progress.answered))}%`
      : '-';
    subtitle.textContent = `진행 ${progress.answered}/${progress.total} · 정답 ${progress.correct} · 오답 ${incorrect} · 정답률 ${accuracy}`;
    return;
  }
  if (state.quiz.completed && state.quiz.lastResult) {
    const { correct, total, score, passed } = state.quiz.lastResult;
    const statusText = passed ? 'Pass' : 'Fail';
    subtitle.textContent = `마지막 시험 결과: ${correct}/${total} · ${formatScore(score)}점 ${statusText}`;
  } else {
    subtitle.textContent = '시험을 준비 중입니다...';
  }
}

function showPlaceholder(message) {
  if (placeholder) {
    if (message) {
      const text = placeholder.querySelector('p');
      if (text) text.textContent = message;
    }
    placeholder.classList.remove('hidden');
  }
  if (content) {
    content.classList.add('hidden');
  }
  updateSubtitle();
}

function hidePlaceholder() {
  if (placeholder) {
    placeholder.classList.add('hidden');
  }
  if (content) {
    content.classList.remove('hidden');
  }
}

function resetQuizState() {
  state.quiz.active = false;
  state.quiz.completed = false;
  state.quiz.sessionId = null;
  state.quiz.questions = [];
  state.quiz.index = 0;
  state.quiz.progress = null;
  state.quiz.awaitingResult = false;
  state.quiz.lastResult = null;
  state.quiz.pendingSubmissions = 0;
  state.quiz.answers = {};
  resetPreview();
  if (questionContainer) {
    questionContainer.classList.add('hidden');
  }
  if (summaryEl) {
    summaryEl.classList.add('hidden');
  }
  if (summaryText) summaryText.textContent = '';
  if (summaryScore) {
    summaryScore.textContent = '';
    summaryScore.classList.add('hidden');
  }
  if (summaryBadge) {
    summaryBadge.classList.add('hidden');
    summaryBadge.classList.remove('badge-pass', 'badge-fail');
  }
  if (previewBtn) previewBtn.disabled = true;
  if (failBtn) failBtn.disabled = true;
  if (successBtn) successBtn.disabled = true;
  if (previousBtn) previousBtn.disabled = true;
  if (stopBtn) stopBtn.disabled = true;
  showPlaceholder('진행할 시험 정보를 찾을 수 없습니다.');
}

function updateProgressUI() {
  if (!progressEl) return;
  const progress = state.quiz.progress;
  if (!progress) {
    progressEl.textContent = '';
    updateSubtitle();
    return;
  }
  const { answered, total, correct, remaining } = progress;
  const incorrect = Math.max(0, answered - correct);
  const accuracy = answered ? `${formatScore(computeScore(correct, answered))}%` : '-';
  progressEl.textContent = `진행 ${answered}/${total} · 정답 ${correct} · 오답 ${incorrect} · 남은 ${remaining} · 정답률 ${accuracy}`;
  updateSubtitle();
}

function showQuestion() {
  const question = state.quiz.questions[state.quiz.index];
  if (!question || !questionContainer) return;
  hidePlaceholder();
  if (summaryEl) summaryEl.classList.add('hidden');
  questionContainer.classList.remove('hidden');
  if (promptEl) {
    promptEl.textContent = `${state.quiz.index + 1}. ${question.prompt}`;
  }
  if (readingEl) {
    if (question.reading) {
      readingEl.textContent = `읽기: ${question.reading}`;
      readingEl.classList.remove('hidden');
    } else {
      readingEl.textContent = '';
      readingEl.classList.add('hidden');
    }
  }
  resetPreview();
  state.quiz.awaitingResult = false;
  if (failBtn) failBtn.disabled = false;
  if (successBtn) successBtn.disabled = false;
  if (previewBtn) previewBtn.disabled = false;
  if (previousBtn) previousBtn.disabled = state.quiz.index === 0;
  if (stopBtn) stopBtn.disabled = false;
  updateProgressUI();
}

function hideResultModal() {
  if (!resultModal) return;
  resultModal.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

function showResultModal({ score, passed, correct, incorrect, total, canRetry }) {
  if (!resultModal || !resultTitle || !resultMessage || !resultCloseBtn) return;
  const scoreText = `${formatScore(score)}점`;
  resultModal.dataset.status = passed ? 'pass' : 'fail';
  resultTitle.textContent = passed ? 'Pass' : 'Fail';
  resultTitle.classList.toggle('pass', passed);
  resultTitle.classList.toggle('fail', !passed);
  resultMessage.textContent = `${total}문제 중 ${correct}문제를 맞히고 ${incorrect}문제를 틀렸습니다. ${scoreText}을 기록했습니다.`;
  if (resultRetryBtn) {
    resultRetryBtn.classList.toggle('hidden', !canRetry);
  }
  resultModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  setTimeout(() => {
    try {
      resultCloseBtn.focus({ preventScroll: true });
    } catch (err) {
      // ignore focus errors
    }
  }, 0);
}

function updateSummaryFromProgress() {
  if (!summaryEl) return;
  const progress = state.quiz.progress;
  if (!progress) {
    summaryEl.classList.add('hidden');
    return;
  }
  const { total, correct } = progress;
  const incorrect = Math.max(0, total - correct);
  const score = computeScore(correct, total);
  const passed = isPassed(correct, total);
  if (summaryText) {
    summaryText.textContent = `총 ${total}문제 중 ${correct}문제를 맞히고 ${incorrect}문제를 틀렸습니다.`;
  }
  if (summaryScore) {
    summaryScore.textContent = `${formatScore(score)}점`;
    summaryScore.classList.remove('hidden');
  }
  if (summaryBadge) {
    summaryBadge.textContent = passed ? 'Pass' : 'Fail';
    summaryBadge.classList.remove('hidden');
    summaryBadge.classList.toggle('badge-pass', passed);
    summaryBadge.classList.toggle('badge-fail', !passed);
  }
  const canRetry = Array.isArray(progress.incorrect_question_ids) && progress.incorrect_question_ids.length > 0;
  if (retryBtn) {
    retryBtn.disabled = !canRetry;
  }
  summaryEl.classList.remove('hidden');
  state.quiz.lastResult = { total, correct, incorrect, score, passed };
  showResultModal({ score, passed, correct, incorrect, total, canRetry });
}

async function startExam(payload) {
  if (!payload) {
    resetQuizState();
    return;
  }
  state.payload = payload;
  state.quiz.active = true;
  state.quiz.completed = false;
  state.quiz.questions = [];
  state.quiz.index = 0;
  state.quiz.progress = null;
  state.quiz.awaitingResult = false;
  state.quiz.answers = {};
  hidePlaceholder();
  if (content) content.classList.remove('hidden');
  if (questionContainer) questionContainer.classList.add('hidden');
  if (summaryEl) summaryEl.classList.add('hidden');
  if (progressEl) progressEl.textContent = '';
  updateSubtitle();

  try {
    const result = await api('/quizzes/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    state.quiz.sessionId = result.session_id;
    state.quiz.questions = Array.isArray(result.questions) ? result.questions : [];
    state.quiz.index = 0;
    state.quiz.progress = {
      session_id: result.session_id,
      total: result.total,
      answered: 0,
      correct: 0,
      remaining: result.total,
      incorrect_question_ids: [],
    };
    state.quiz.pendingSubmissions = 0;
    state.quiz.answers = {};
    state.quiz.awaitingResult = false;
    showQuestion();
    showToast('시험을 시작합니다.');
  } catch (err) {
    showToast(err.message, 'error');
    resetQuizState();
  }
}

function cloneProgress(progress) {
  if (!progress) return null;
  return {
    session_id: progress.session_id,
    total: progress.total,
    answered: progress.answered,
    correct: progress.correct,
    remaining: progress.remaining,
    incorrect_question_ids: Array.isArray(progress.incorrect_question_ids)
      ? [...progress.incorrect_question_ids]
      : [],
  };
}

function applyOptimisticProgress(
  questionId,
  isCorrect,
  wasPreviouslyAnswered,
  previousCorrect,
) {
  const current = cloneProgress(state.quiz.progress) || {
    session_id: state.quiz.sessionId,
    total: state.quiz.questions.length,
    answered: 0,
    correct: 0,
    remaining: state.quiz.questions.length,
    incorrect_question_ids: [],
  };
  if (!wasPreviouslyAnswered) {
    current.answered = Math.min(current.total, current.answered + 1);
    if (isCorrect) {
      current.correct = Math.min(current.total, current.correct + 1);
      current.incorrect_question_ids = current.incorrect_question_ids.filter((id) => id !== questionId);
    } else if (!current.incorrect_question_ids.includes(questionId)) {
      current.incorrect_question_ids = [...current.incorrect_question_ids, questionId];
    }
  } else {
    if (previousCorrect && !isCorrect) {
      current.correct = Math.max(0, current.correct - 1);
    } else if (!previousCorrect && isCorrect) {
      current.correct = Math.min(current.total, current.correct + 1);
    }
    if (isCorrect) {
      current.incorrect_question_ids = current.incorrect_question_ids.filter((id) => id !== questionId);
    } else if (!current.incorrect_question_ids.includes(questionId)) {
      current.incorrect_question_ids = [...current.incorrect_question_ids, questionId];
    }
  }
  current.remaining = Math.max(0, current.total - current.answered);
  return current;
}

function handleSubmissionError(previousProgress, originalIndex, wasLastQuestion, error) {
  showToast(error.message, 'error');
  if (previousProgress) {
    state.quiz.progress = previousProgress;
  }
  if (wasLastQuestion) {
    state.quiz.active = true;
    state.quiz.completed = false;
    state.quiz.lastResult = null;
    if (summaryEl) summaryEl.classList.add('hidden');
    hideResultModal();
  }
  state.quiz.index = originalIndex;
  showQuestion();
}

function submitResult(isCorrect) {
  if (!state.quiz.active || state.quiz.awaitingResult) return;
  const question = state.quiz.questions[state.quiz.index];
  if (!question) return;

  const originalIndex = state.quiz.index;
  const wasLastQuestion = originalIndex >= state.quiz.questions.length - 1;
  const previousProgress = cloneProgress(state.quiz.progress);
  const previousAnswer = state.quiz.answers?.[question.id]
    ? { ...state.quiz.answers[question.id] }
    : null;
  const wasPreviouslyAnswered = Boolean(previousAnswer);
  const previousCorrect = previousAnswer ? Boolean(previousAnswer.isCorrect) : false;

  state.quiz.awaitingResult = true;
  hideAnswerPreview();
  if (failBtn) failBtn.disabled = true;
  if (successBtn) successBtn.disabled = true;
  if (previewBtn) previewBtn.disabled = true;
  if (previousBtn) previousBtn.disabled = true;

  const optimisticProgress = applyOptimisticProgress(
    question.id,
    isCorrect,
    wasPreviouslyAnswered,
    previousCorrect,
  );
  state.quiz.progress = optimisticProgress;
  if (!state.quiz.answers) {
    state.quiz.answers = {};
  }
  state.quiz.answers[question.id] = { isCorrect };
  updateProgressUI();

  if (wasLastQuestion) {
    showSummary();
    state.quiz.awaitingResult = false;
  } else {
    state.quiz.index = originalIndex + 1;
    showQuestion();
  }

  const payload = {
    question_id: question.id,
    answer: null,
    is_correct: isCorrect,
  };

  state.quiz.pendingSubmissions += 1;
  api(`/quizzes/${state.quiz.sessionId}/answer`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
    .then((progress) => {
      state.quiz.progress = progress;
      if (state.quiz.completed) {
        updateSummaryFromProgress();
      } else {
        updateProgressUI();
      }
    })
    .catch((err) => {
      if (previousAnswer) {
        state.quiz.answers[question.id] = previousAnswer;
      } else if (state.quiz.answers) {
        delete state.quiz.answers[question.id];
      }
      handleSubmissionError(previousProgress, originalIndex, wasLastQuestion, err);
    })
    .finally(() => {
      state.quiz.pendingSubmissions = Math.max(0, state.quiz.pendingSubmissions - 1);
      if (state.quiz.pendingSubmissions === 0) {
        state.quiz.awaitingResult = false;
      }
    });
}

function handlePreviousQuestion() {
  if (!state.quiz.active || state.quiz.awaitingResult) return;
  if (state.quiz.index <= 0) return;
  state.quiz.index = Math.max(0, state.quiz.index - 1);
  hideAnswerPreview();
  showQuestion();
}

async function handleRetry() {
  const progress = state.quiz.progress;
  if (!progress || !Array.isArray(progress.incorrect_question_ids) || progress.incorrect_question_ids.length === 0) {
    showToast('다시 풀 문제가 없습니다.', 'info');
    return;
  }
  hideResultModal();
  state.quiz.active = true;
  state.quiz.completed = false;
  updateSubtitle();
  resetPreview();
  try {
    const result = await api(`/quizzes/${state.quiz.sessionId}/retry`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    state.quiz.sessionId = result.session_id;
    state.quiz.questions = Array.isArray(result.questions) ? result.questions : [];
    state.quiz.index = 0;
    state.quiz.progress = {
      session_id: result.session_id,
      total: result.total,
      answered: 0,
      correct: 0,
      remaining: result.total,
      incorrect_question_ids: [],
    };
    state.quiz.pendingSubmissions = 0;
    state.quiz.answers = {};
    showQuestion();
    showToast('틀린 문제를 다시 시작합니다.');
  } catch (err) {
    showToast(err.message, 'error');
    showPlaceholder('시험 정보를 다시 불러오지 못했습니다. 시험 모드로 돌아가 다시 시도하세요.');
  }
}

function showSummary() {
  state.quiz.active = false;
  state.quiz.completed = true;
  if (questionContainer) questionContainer.classList.add('hidden');
  updateSummaryFromProgress();
  updateSubtitle();
}

async function handleStopExam() {
  if (!state.quiz.sessionId) {
    returnToExamPage('시험 정보가 없어 시험 모드로 돌아갑니다.');
    return;
  }
  const confirmed = window.confirm('시험을 중단하고 현재 시험 기록을 삭제할까요?');
  if (!confirmed) return;
  if (stopBtn) stopBtn.disabled = true;
  try {
    await api(`/quizzes/${state.quiz.sessionId}`, {
      method: 'DELETE',
    });
    setReturnMessage('시험을 중단하고 시험 기록을 삭제했습니다.');
    returnToExamPage();
  } catch (err) {
    if (stopBtn) stopBtn.disabled = false;
    showToast(err.message, 'error');
  }
}

function handleReturnToExam() {
  returnToExamPage('시험을 종료하고 시험 모드로 돌아갑니다.');
}

function handlePreviewPointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  event.preventDefault();
  try {
    previewBtn.setPointerCapture(event.pointerId);
  } catch (err) {
    // ignore
  }
  showAnswerPreview();
}

function handlePreviewPointerUp(event) {
  if (typeof previewBtn.hasPointerCapture === 'function' && typeof previewBtn.releasePointerCapture === 'function') {
    const pointerId = event.pointerId;
    if (pointerId !== undefined && previewBtn.hasPointerCapture(pointerId)) {
      try {
        previewBtn.releasePointerCapture(pointerId);
      } catch (err) {
        // ignore
      }
    }
  }
  hideAnswerPreview();
}

function handlePreviewKeyDown(event) {
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    showAnswerPreview();
  }
}

function handlePreviewKeyUp(event) {
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    hideAnswerPreview();
  }
}

function handleGlobalKeydown(event) {
  if (event.key === 'Escape' && resultModal && !resultModal.classList.contains('hidden')) {
    hideResultModal();
  }
}

async function init() {
  if (sessionManager) {
    const user = await sessionManager.ensureAuthenticated();
    updatePassRatioFromUser(user);
  }
  resetQuizState();
  showPlaceholder('시험을 준비 중입니다...');
  const payload = consumePendingExamPayload();
  if (!payload) {
    showPlaceholder('진행할 시험 정보를 찾을 수 없습니다. 시험 모드에서 다시 시작하세요.');
    updateSubtitle();
    return;
  }
  startExam(payload);
}

if (failBtn) failBtn.addEventListener('click', () => submitResult(false));
if (successBtn) successBtn.addEventListener('click', () => submitResult(true));
if (previousBtn) previousBtn.addEventListener('click', handlePreviousQuestion);
if (retryBtn) retryBtn.addEventListener('click', handleRetry);
if (returnBtn) returnBtn.addEventListener('click', handleReturnToExam);
if (stopBtn) stopBtn.addEventListener('click', handleStopExam);
if (previewBtn) {
  previewBtn.addEventListener('pointerdown', handlePreviewPointerDown);
  previewBtn.addEventListener('pointerup', handlePreviewPointerUp);
  previewBtn.addEventListener('pointerleave', hideAnswerPreview);
  previewBtn.addEventListener('pointercancel', handlePreviewPointerUp);
  previewBtn.addEventListener('keydown', handlePreviewKeyDown);
  previewBtn.addEventListener('keyup', handlePreviewKeyUp);
}
if (resultCloseBtn) {
  resultCloseBtn.addEventListener('click', () => returnToExamPage('시험 결과를 확인하고 시험 모드로 돌아갑니다.'));
}
if (resultRetryBtn) {
  resultRetryBtn.addEventListener('click', handleRetry);
}
if (resultModal) {
  resultModal.addEventListener('click', (event) => {
    if (event.target === resultModal) {
      hideResultModal();
    }
  });
}

document.addEventListener('keydown', handleGlobalKeydown);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init().catch((error) => {
      console.error(error);
      showToast('세션을 확인하는 중 오류가 발생했습니다.', 'error');
    });
  });
} else {
  init().catch((error) => {
    console.error(error);
    showToast('세션을 확인하는 중 오류가 발생했습니다.', 'error');
  });
}
