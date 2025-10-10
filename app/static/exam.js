const state = {
  folders: [],
  groups: [],
  activeFolderId: null,
  selectedGroupIds: [],
  quiz: {
    active: false,
    completed: false,
    sessionId: null,
    questions: [],
    index: 0,
    progress: null,
    awaitingResult: false,
    lastResult: null,
  },
};

const toast = document.querySelector('#toast');
const folderSelect = document.querySelector('#exam-folder');
const groupsContainer = document.querySelector('#exam-groups');
const selectAllBtn = document.querySelector('#exam-select-all');
const clearSelectionBtn = document.querySelector('#exam-clear-selection');
const subtitle = document.querySelector('#exam-subtitle');
const form = document.querySelector('#exam-form');
const content = document.querySelector('#exam-content');
const questionContainer = document.querySelector('#exam-question');
const promptEl = document.querySelector('#exam-prompt');
const readingEl = document.querySelector('#exam-reading');
const previewBtn = document.querySelector('#exam-preview');
const memorizeFailBtn = document.querySelector('#exam-fail');
const memorizeSuccessBtn = document.querySelector('#exam-success');
const answerEl = document.querySelector('#exam-answer');
const progressEl = document.querySelector('#exam-progress');
const summaryEl = document.querySelector('#exam-summary');
const summaryText = document.querySelector('#exam-summary-text');
const retryBtn = document.querySelector('#exam-retry');
const resetBtn = document.querySelector('#exam-reset');
const summaryScore = document.querySelector('#exam-summary-score');
const summaryBadge = document.querySelector('#exam-summary-badge');
const historyList = document.querySelector('#exam-history-list');
const historyEmpty = document.querySelector('#exam-history-empty');
const historyRefreshBtn = document.querySelector('#exam-history-refresh');
const resultModal = document.querySelector('#exam-result-modal');
const resultTitle = document.querySelector('#exam-result-title');
const resultMessage = document.querySelector('#exam-result-message');
const resultCloseBtn = document.querySelector('#exam-result-close');
const historyEmptyDefaultText = historyEmpty
  ? historyEmpty.textContent
  : '아직 시험 이력이 없습니다.';
let historyLoading = false;

function showToast(message, type = 'info') {
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
  } catch {
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
  return correct / total >= 0.9;
}

function formatDateTime(value) {
  if (!value) return '날짜 정보 없음';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '날짜 정보 없음';
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function hideResultModal() {
  if (!resultModal) return;
  resultModal.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

function showResultModal({ score, passed, correct, incorrect, total }) {
  if (!resultModal || !resultTitle || !resultMessage || !resultCloseBtn) return;
  const scoreText = `${formatScore(score)}점`;
  resultModal.dataset.status = passed ? 'pass' : 'fail';
  resultTitle.textContent = passed ? 'Pass' : 'Fail';
  resultTitle.classList.toggle('pass', passed);
  resultTitle.classList.toggle('fail', !passed);
  resultMessage.textContent = `${total}문제 중 ${correct}문제를 맞히고 ${incorrect}문제를 틀렸습니다. ${scoreText}을 기록했습니다.`;
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

function renderFolders() {
  folderSelect.innerHTML = '<option value="">폴더 선택</option>';
  state.folders.forEach((folder) => {
    const option = document.createElement('option');
    option.value = folder.id;
    option.textContent = folder.name;
    if (folder.id === state.activeFolderId) option.selected = true;
    folderSelect.appendChild(option);
  });
}

function updateGroupActionButtons() {
  const disabled = !state.activeFolderId || state.groups.length === 0;
  selectAllBtn.disabled = disabled;
  clearSelectionBtn.disabled = disabled;
  if (disabled) {
    groupsContainer.setAttribute('aria-disabled', 'true');
    groupsContainer.classList.add('is-disabled');
  } else {
    groupsContainer.removeAttribute('aria-disabled');
    groupsContainer.classList.remove('is-disabled');
  }
}

function renderGroups() {
  groupsContainer.innerHTML = '';
  if (!state.activeFolderId) {
    const message = document.createElement('p');
    message.className = 'group-placeholder';
    message.textContent = '폴더를 먼저 선택하세요.';
    groupsContainer.appendChild(message);
    updateGroupActionButtons();
    return;
  }

  if (state.groups.length === 0) {
    const message = document.createElement('p');
    message.className = 'group-placeholder';
    message.textContent = '선택할 그룹이 없습니다.';
    groupsContainer.appendChild(message);
    updateGroupActionButtons();
    return;
  }

  state.groups.forEach((group) => {
    const label = document.createElement('label');
    label.className = 'group-checkbox-item';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = group.id;
    input.checked = state.selectedGroupIds.includes(group.id);

    const text = document.createElement('span');
    text.textContent = group.name;

    label.appendChild(input);
    label.appendChild(text);
    groupsContainer.appendChild(label);
  });

  updateGroupActionButtons();
}

function getSelectedGroupNames() {
  if (!state.selectedGroupIds.length) return [];
  const nameById = new Map(state.groups.map((group) => [group.id, group.name]));
  return state.selectedGroupIds
    .map((id) => nameById.get(id))
    .filter((name) => typeof name === 'string' && name.trim().length);
}

function updateSubtitle() {
  if (!state.quiz.active) {
    if (state.quiz.lastResult) {
      const { correct, total, score, passed } = state.quiz.lastResult;
      const statusText = passed ? 'Pass' : 'Fail';
      subtitle.textContent = `마지막 시험 결과: ${correct}/${total} · ${formatScore(score)}점 ${statusText}`;
      return;
    }

    if (!state.quiz.completed) {
      if (state.activeFolderId && state.selectedGroupIds.length) {
        const selectedNames = getSelectedGroupNames();
        if (selectedNames.length) {
          subtitle.textContent = `선택한 그룹: ${selectedNames.join(', ')}`;
        } else {
          subtitle.textContent = '선택한 그룹 정보를 불러오지 못했습니다.';
        }
      } else {
        subtitle.textContent = '폴더와 그룹을 선택한 뒤 시험을 시작하세요.';
      }
    } else {
      subtitle.textContent = '시험 준비가 완료되었습니다.';
    }
    return;
  }

  const { progress } = state.quiz;
  if (!progress) {
    subtitle.textContent = '시험을 준비 중입니다...';
    return;
  }
  subtitle.textContent = `진행 ${progress.answered}/${progress.total} · 정답 ${progress.correct}`;
}

function resetPreview() {
  answerEl.textContent = '';
  answerEl.classList.add('hidden');
}

function showAnswerPreview() {
  if (!state.quiz.active) return;
  const question = state.quiz.questions[state.quiz.index];
  if (!question) return;
  answerEl.textContent = `정답: ${question.answer}`;
  answerEl.classList.remove('hidden');
}

function hideAnswerPreview() {
  answerEl.classList.add('hidden');
  answerEl.textContent = '';
}

function resetQuizState(options = {}) {
  const { preserveLastResult = false } = options;
  state.quiz.active = false;
  state.quiz.completed = false;
  state.quiz.sessionId = null;
  state.quiz.questions = [];
  state.quiz.index = 0;
  state.quiz.progress = null;
  state.quiz.awaitingResult = false;
  if (!preserveLastResult) {
    state.quiz.lastResult = null;
  }
  resetPreview();
  content.classList.add('hidden');
  questionContainer.classList.remove('hidden');
  summaryEl.classList.add('hidden');
  previewBtn.disabled = true;
  memorizeFailBtn.disabled = true;
  memorizeSuccessBtn.disabled = true;
  if (summaryScore) {
    summaryScore.textContent = '';
    summaryScore.classList.add('hidden');
  }
  if (summaryBadge) {
    summaryBadge.classList.add('hidden');
    summaryBadge.classList.remove('badge-pass', 'badge-fail');
  }
  if (summaryText) {
    summaryText.textContent = '';
  }
  hideResultModal();
  updateSubtitle();
}

function showQuestion() {
  const question = state.quiz.questions[state.quiz.index];
  if (!question) return;
  content.classList.remove('hidden');
  summaryEl.classList.add('hidden');
  questionContainer.classList.remove('hidden');
  promptEl.textContent = `${state.quiz.index + 1}. ${question.prompt}`;
  if (question.reading) {
    readingEl.textContent = `읽기: ${question.reading}`;
    readingEl.classList.remove('hidden');
  } else {
    readingEl.textContent = '';
    readingEl.classList.add('hidden');
  }
  resetPreview();
  state.quiz.awaitingResult = false;
  memorizeFailBtn.disabled = false;
  memorizeSuccessBtn.disabled = false;
  previewBtn.disabled = false;
  updateProgressUI();
}

function updateProgressUI() {
  if (!state.quiz.progress) {
    progressEl.textContent = '';
    return;
  }
  const { answered, total, correct, remaining } = state.quiz.progress;
  progressEl.textContent = `진행 ${answered}/${total} · 정답 ${correct} · 남은 ${remaining}`;
  updateSubtitle();
}

function showSummary() {
  state.quiz.active = false;
  state.quiz.completed = true;
  questionContainer.classList.add('hidden');
  summaryEl.classList.remove('hidden');
  if (state.quiz.progress) {
    const { total, correct } = state.quiz.progress;
    const incorrect = Math.max(0, total - correct);
    const score = computeScore(correct, total);
    const passed = isPassed(correct, total);
    const statusText = passed ? 'Pass' : 'Fail';
    if (summaryText) {
      summaryText.textContent = `총 ${total}문제 중 ${correct}문제를 맞히고 ${incorrect}문제를 틀렸습니다.`;
    }
    if (summaryScore) {
      summaryScore.textContent = `${formatScore(score)}점`;
      summaryScore.classList.remove('hidden');
    }
    if (summaryBadge) {
      summaryBadge.textContent = statusText;
      summaryBadge.classList.remove('hidden');
      summaryBadge.classList.toggle('badge-pass', passed);
      summaryBadge.classList.toggle('badge-fail', !passed);
    }
    state.quiz.lastResult = { total, correct, incorrect, score, passed };
    showResultModal({ score, passed, correct, incorrect, total });
    retryBtn.disabled = !state.quiz.progress.incorrect_question_ids || state.quiz.progress.incorrect_question_ids.length === 0;
  } else {
    if (summaryText) {
      summaryText.textContent = '시험 결과를 가져오지 못했습니다.';
    }
    if (summaryScore) {
      summaryScore.textContent = '';
      summaryScore.classList.add('hidden');
    }
    if (summaryBadge) {
      summaryBadge.classList.add('hidden');
      summaryBadge.classList.remove('badge-pass', 'badge-fail');
    }
    retryBtn.disabled = true;
  }
  fetchHistory({ showLoading: false });
  updateSubtitle();
}

async function retakeExamFromHistory(item) {
  if (!item) {
    showToast('시험 정보를 찾을 수 없습니다.', 'error');
    return false;
  }

  if (state.quiz.active) {
    showToast('현재 진행 중인 시험을 먼저 마치거나 초기화하세요.', 'error');
    return false;
  }

  if (item.folder_id == null) {
    showToast('폴더 정보를 찾을 수 없습니다.', 'error');
    return false;
  }

  const folderId = Number(item.folder_id);
  if (!Number.isInteger(folderId) || folderId <= 0) {
    showToast('폴더 정보를 찾을 수 없습니다.', 'error');
    return false;
  }

  const rawGroupIds = Array.isArray(item.group_ids) ? item.group_ids : [];
  const groupIds = Array.from(
    new Set(
      rawGroupIds
        .filter((value) => value !== null && value !== undefined)
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  );

  if (!groupIds.length) {
    showToast('시험에 필요한 그룹 정보를 찾을 수 없습니다.', 'error');
    return false;
  }

  state.activeFolderId = folderId;
  state.selectedGroupIds = groupIds;
  await fetchFolders();

  const folderExists = state.folders.some((folder) => folder.id === folderId);
  if (!folderExists) {
    showToast('폴더 정보를 불러올 수 없습니다.', 'error');
    return false;
  }

  if (!state.selectedGroupIds.length) {
    showToast('선택한 그룹을 찾을 수 없습니다.', 'error');
    return false;
  }

  renderFolders();
  if (folderSelect) {
    folderSelect.value = String(folderId);
  }
  renderGroups();
  updateSubtitle();

  const limitInput = form.querySelector('input[name="limit"]');
  if (limitInput) {
    limitInput.value = item.limit != null ? String(item.limit) : '';
  }

  const directionSelect = form.querySelector('select[name="direction"]');
  if (directionSelect && item.direction) {
    directionSelect.value = item.direction;
  }

  const minStarSelect = form.querySelector('select[name="min_star"]');
  if (minStarSelect) {
    minStarSelect.value = item.min_star != null ? String(item.min_star) : '';
  }

  const randomCheckbox = form.querySelector('input[name="random"]');
  if (randomCheckbox) {
    randomCheckbox.checked = item.random !== false;
  }

  const payload = {
    folder_id: folderId,
    group_id: state.selectedGroupIds[0],
    group_ids: [...state.selectedGroupIds],
    random: item.random !== false,
    direction: item.direction || 'term_to_meaning',
    mode: item.mode || 'exam',
  };

  if (item.limit != null) {
    const value = Number(item.limit);
    if (Number.isInteger(value)) {
      payload.limit = value;
    }
  }

  if (item.min_star != null) {
    const value = Number(item.min_star);
    if (Number.isInteger(value)) {
      payload.min_star = value;
    }
  }

  if (Array.isArray(item.star_values) && item.star_values.length) {
    const values = item.star_values
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value));
    if (values.length) {
      payload.star_values = values;
    }
  }

  return startExam(payload, { toastMessage: '이전 시험을 다시 시작합니다.' });
}

function renderHistory(items) {
  if (!historyList || !historyEmpty) return;
  historyList.innerHTML = '';
  const entries = Array.isArray(items) ? items : [];
  if (!entries.length) {
    historyEmpty.textContent = historyEmptyDefaultText;
    historyEmpty.classList.remove('hidden');
    return;
  }

  historyEmpty.classList.add('hidden');

  entries.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'exam-history-item';

    const header = document.createElement('div');
    header.className = 'exam-history-item-header';

    const badge = document.createElement('span');
    badge.className = `badge ${item.passed ? 'badge-pass' : 'badge-fail'}`;
    badge.textContent = item.passed ? 'Pass' : 'Fail';

    const scoreEl = document.createElement('span');
    scoreEl.className = 'exam-history-item-score';
    const scoreValue = Number(item.score);
    const safeScore = Number.isFinite(scoreValue) ? scoreValue : 0;
    scoreEl.textContent = `${formatScore(safeScore)}점`;

    header.appendChild(badge);
    header.appendChild(scoreEl);

    const meta = document.createElement('p');
    meta.className = 'exam-history-item-meta';
    const folderName = item.folder_name || '폴더 정보 없음';
    meta.textContent = `${formatDateTime(item.created_at)} · ${folderName}`;

    const groupsEl = document.createElement('p');
    groupsEl.className = 'exam-history-item-groups';
    const groups = Array.isArray(item.group_names) && item.group_names.length
      ? item.group_names.join(', ')
      : '그룹 정보 없음';
    groupsEl.textContent = `그룹: ${groups}`;

    const stats = document.createElement('p');
    stats.className = 'exam-history-item-stats';
    const total = Number(item.total) || 0;
    const incorrect = Number(item.incorrect) || 0;
    const correct = Number(item.correct) || 0;
    stats.textContent = `${total}문제 중 ${incorrect}문제를 틀렸습니다. (정답 ${correct}개)`;

    const actions = document.createElement('div');
    actions.className = 'exam-history-item-actions';

    const retakeBtn = document.createElement('button');
    retakeBtn.type = 'button';
    retakeBtn.className = 'secondary';
    retakeBtn.textContent = '시험 다시보기';
    retakeBtn.addEventListener('click', async () => {
      if (retakeBtn.disabled) return;
      retakeBtn.disabled = true;
      try {
        await retakeExamFromHistory(item);
      } finally {
        retakeBtn.disabled = false;
      }
    });

    actions.appendChild(retakeBtn);

    li.appendChild(header);
    li.appendChild(meta);
    li.appendChild(groupsEl);
    li.appendChild(stats);
    li.appendChild(actions);

    historyList.appendChild(li);
  });
}

async function fetchHistory(options = {}) {
  if (!historyList || !historyEmpty) return;
  const { showLoading = true } = options;
  if (historyLoading) return;
  historyLoading = true;
  if (showLoading) {
    historyEmpty.textContent = '시험 이력을 불러오는 중입니다...';
    historyEmpty.classList.remove('hidden');
  }
  try {
    const data = await api('/quizzes/history?limit=20');
    renderHistory(data);
  } catch (err) {
    historyList.innerHTML = '';
    historyEmpty.textContent = `시험 이력을 불러오지 못했습니다. ${err.message}`;
    historyEmpty.classList.remove('hidden');
    showToast(err.message, 'error');
  } finally {
    historyLoading = false;
  }
}

async function fetchFolders() {
  try {
    const data = await api('/folders');
    state.folders = data;
    if (!state.folders.find((f) => f.id === state.activeFolderId)) {
      state.activeFolderId = null;
      state.groups = [];
      state.selectedGroupIds = [];
    }
    renderFolders();
    if (state.activeFolderId) {
      await fetchGroups(state.activeFolderId);
    } else {
      renderGroups();
      updateSubtitle();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function fetchGroups(folderId) {
  if (!folderId) {
    state.groups = [];
    state.selectedGroupIds = [];
    renderGroups();
    updateSubtitle();
    return;
  }
  try {
    const data = await api(`/groups?folder_id=${folderId}`);
    state.groups = data;
    const availableIds = state.groups.map((g) => g.id);
    const preservedSelection = state.selectedGroupIds.filter((id) => availableIds.includes(id));
    if (preservedSelection.length) {
      state.selectedGroupIds = preservedSelection;
    } else {
      state.selectedGroupIds = [];
    }
    renderGroups();
    updateSubtitle();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function startExam(payload, options = {}) {
  const { toastMessage = '시험을 시작합니다.' } = options;

  state.quiz.active = true;
  state.quiz.completed = false;
  updateSubtitle();
  content.classList.add('hidden');
  summaryEl.classList.add('hidden');

  let success = false;
  try {
    const result = await api('/quizzes/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    state.quiz.sessionId = result.session_id;
    state.quiz.questions = result.questions || [];
    state.quiz.index = 0;
    state.quiz.progress = {
      session_id: result.session_id,
      total: result.total,
      answered: 0,
      correct: 0,
      remaining: result.total,
      incorrect_question_ids: [],
    };
    showQuestion();
    showToast(toastMessage);
    success = true;
  } catch (err) {
    resetQuizState({ preserveLastResult: true });
    showToast(err.message, 'error');
  }

  return success;
}

async function handleStart(event) {
  event.preventDefault();
  if (!state.activeFolderId) {
    showToast('먼저 폴더를 선택하세요.', 'error');
    return;
  }
  if (!state.selectedGroupIds.length) {
    showToast('시험을 시작할 그룹을 선택하세요.', 'error');
    return;
  }

  const formData = new FormData(event.currentTarget);
  const selectedIds = [...state.selectedGroupIds];
  const payload = {
    folder_id: state.activeFolderId,
    group_id: selectedIds[0],
    group_ids: selectedIds,
    random: formData.get('random') !== null,
    direction: formData.get('direction') || 'term_to_meaning',
    mode: 'exam',
  };
  const limit = formData.get('limit');
  if (limit) payload.limit = Number(limit);
  const minStar = formData.get('min_star');
  if (minStar) payload.min_star = Number(minStar);
  await startExam(payload);
}

async function submitResult(isCorrect) {
  if (!state.quiz.active || state.quiz.awaitingResult) return;
  const question = state.quiz.questions[state.quiz.index];
  if (!question) return;

  state.quiz.awaitingResult = true;
  hideAnswerPreview();
  memorizeFailBtn.disabled = true;
  memorizeSuccessBtn.disabled = true;
  previewBtn.disabled = true;

  try {
    const progress = await api(`/quizzes/${state.quiz.sessionId}/answer`, {
      method: 'POST',
      body: JSON.stringify({
        question_id: question.id,
        answer: null,
        is_correct: isCorrect,
      }),
    });
    state.quiz.progress = progress;
    updateProgressUI();
    const nextIndex = state.quiz.index + 1;
    if (nextIndex < state.quiz.questions.length) {
      state.quiz.index = nextIndex;
      setTimeout(() => {
        state.quiz.awaitingResult = false;
        showQuestion();
      }, 400);
    } else {
      state.quiz.awaitingResult = false;
      showSummary();
    }
  } catch (err) {
    showToast(err.message, 'error');
    memorizeFailBtn.disabled = false;
    memorizeSuccessBtn.disabled = false;
    previewBtn.disabled = false;
    state.quiz.awaitingResult = false;
  }
}

async function handleRetry() {
  if (!state.quiz.progress || !state.quiz.progress.incorrect_question_ids.length) {
    showToast('다시 암기할 문제가 없습니다.', 'info');
    return;
  }

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
    state.quiz.questions = result.questions || [];
    state.quiz.index = 0;
    state.quiz.progress = {
      session_id: result.session_id,
      total: result.total,
      answered: 0,
      correct: 0,
      remaining: result.total,
      incorrect_question_ids: [],
    };
    showQuestion();
    showToast('틀린 문제를 다시 시작합니다.');
  } catch (err) {
    resetQuizState({ preserveLastResult: true });
    showToast(err.message, 'error');
  }
}

function handleReset() {
  resetQuizState({ preserveLastResult: true });
  showToast('시험 설정을 초기화했습니다.');
}

function handleFolderChange(event) {
  const folderId = Number(event.target.value) || null;
  state.activeFolderId = folderId;
  state.selectedGroupIds = [];
  fetchGroups(folderId);
}

function handleGroupSelectionChange() {
  if (!state.groups.length) {
    state.selectedGroupIds = [];
  } else {
    const checkboxes = groupsContainer.querySelectorAll('input[type="checkbox"]');
    state.selectedGroupIds = Array.from(checkboxes)
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => Number(checkbox.value));
  }
  updateSubtitle();
}

function handleSelectAllGroups() {
  if (!state.groups.length) return;
  state.selectedGroupIds = state.groups.map((group) => group.id);
  renderGroups();
  updateSubtitle();
}

function handleClearGroupSelection() {
  state.selectedGroupIds = [];
  renderGroups();
  updateSubtitle();
}

function handlePreviewPointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  event.preventDefault();
  try {
    previewBtn.setPointerCapture(event.pointerId);
  } catch (err) {
    // ignore if pointer capture is not available
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

function init() {
  form.addEventListener('submit', handleStart);
  memorizeFailBtn.addEventListener('click', () => submitResult(false));
  memorizeSuccessBtn.addEventListener('click', () => submitResult(true));
  retryBtn.addEventListener('click', handleRetry);
  resetBtn.addEventListener('click', handleReset);
  folderSelect.addEventListener('change', handleFolderChange);
  groupsContainer.addEventListener('change', handleGroupSelectionChange);
  selectAllBtn.addEventListener('click', handleSelectAllGroups);
  clearSelectionBtn.addEventListener('click', handleClearGroupSelection);
  previewBtn.addEventListener('pointerdown', handlePreviewPointerDown);
  previewBtn.addEventListener('pointerup', handlePreviewPointerUp);
  previewBtn.addEventListener('pointerleave', hideAnswerPreview);
  previewBtn.addEventListener('pointercancel', handlePreviewPointerUp);
  previewBtn.addEventListener('keydown', handlePreviewKeyDown);
  previewBtn.addEventListener('keyup', handlePreviewKeyUp);
  if (historyRefreshBtn) {
    historyRefreshBtn.addEventListener('click', () => fetchHistory());
  }
  if (resultCloseBtn) {
    resultCloseBtn.addEventListener('click', hideResultModal);
  }
  if (resultModal) {
    resultModal.addEventListener('click', (event) => {
      if (event.target === resultModal) {
        hideResultModal();
      }
    });
  }
  document.addEventListener('keydown', handleGlobalKeydown);
  resetQuizState();
  fetchFolders();
  fetchHistory();
  updateSubtitle();
}

document.addEventListener('DOMContentLoaded', init);
