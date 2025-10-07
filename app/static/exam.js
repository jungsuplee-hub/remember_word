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
  },
};

const toast = document.querySelector('#toast');
const folderSelect = document.querySelector('#exam-folder');
const groupsSelect = document.querySelector('#exam-groups');
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
  groupsSelect.disabled = disabled;
}

function renderGroups() {
  groupsSelect.innerHTML = '';
  if (!state.activeFolderId) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '폴더를 먼저 선택하세요.';
    option.disabled = true;
    groupsSelect.appendChild(option);
    updateGroupActionButtons();
    return;
  }

  if (state.groups.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '선택할 그룹이 없습니다.';
    option.disabled = true;
    groupsSelect.appendChild(option);
    updateGroupActionButtons();
    return;
  }

  state.groups.forEach((group) => {
    const option = document.createElement('option');
    option.value = group.id;
    option.textContent = group.name;
    option.selected = state.selectedGroupIds.includes(group.id);
    groupsSelect.appendChild(option);
  });

  updateGroupActionButtons();
}

function updateSubtitle() {
  if (!state.quiz.active) {
    if (!state.quiz.completed) {
      if (state.activeFolderId && state.selectedGroupIds.length) {
        subtitle.textContent = `선택한 그룹 ${state.selectedGroupIds.length}개`;
      } else {
        subtitle.textContent = '폴더와 그룹을 선택한 뒤 시험을 시작하세요.';
      }
    } else if (state.quiz.progress) {
      subtitle.textContent = `마지막 시험 결과: ${state.quiz.progress.correct}/${state.quiz.progress.total}`;
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

function resetQuizState() {
  state.quiz.active = false;
  state.quiz.completed = false;
  state.quiz.sessionId = null;
  state.quiz.questions = [];
  state.quiz.index = 0;
  state.quiz.progress = null;
  state.quiz.awaitingResult = false;
  resetPreview();
  content.classList.add('hidden');
  questionContainer.classList.remove('hidden');
  summaryEl.classList.add('hidden');
  previewBtn.disabled = true;
  memorizeFailBtn.disabled = true;
  memorizeSuccessBtn.disabled = true;
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
    const incorrect = total - correct;
    summaryText.textContent = `총 ${total}문제 중 ${correct}문제를 암기했고 ${incorrect}문제를 다시 암기해야 합니다.`;
    retryBtn.disabled = !state.quiz.progress.incorrect_question_ids || state.quiz.progress.incorrect_question_ids.length === 0;
  } else {
    summaryText.textContent = '시험 결과를 가져오지 못했습니다.';
    retryBtn.disabled = true;
  }
  updateSubtitle();
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
      state.selectedGroupIds = [...availableIds];
    }
    renderGroups();
    updateSubtitle();
  } catch (err) {
    showToast(err.message, 'error');
  }
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

  state.quiz.active = true;
  state.quiz.completed = false;
  updateSubtitle();
  content.classList.add('hidden');
  summaryEl.classList.add('hidden');

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
    showToast('시험을 시작합니다.');
  } catch (err) {
    resetQuizState();
    showToast(err.message, 'error');
  }
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
    resetQuizState();
    showToast(err.message, 'error');
  }
}

function handleReset() {
  resetQuizState();
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
    state.selectedGroupIds = Array.from(groupsSelect.selectedOptions).map((option) => Number(option.value));
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

function updateGroupSelectionUI() {
  Array.from(groupsSelect.options).forEach((option) => {
    if (!option.value) {
      option.selected = false;
      return;
    }
    option.selected = state.selectedGroupIds.includes(Number(option.value));
  });
}

function init() {
  form.addEventListener('submit', handleStart);
  memorizeFailBtn.addEventListener('click', () => submitResult(false));
  memorizeSuccessBtn.addEventListener('click', () => submitResult(true));
  retryBtn.addEventListener('click', handleRetry);
  resetBtn.addEventListener('click', handleReset);
  folderSelect.addEventListener('change', handleFolderChange);
  groupsSelect.addEventListener('change', () => {
    handleGroupSelectionChange();
    updateGroupSelectionUI();
  });
  selectAllBtn.addEventListener('click', handleSelectAllGroups);
  clearSelectionBtn.addEventListener('click', handleClearGroupSelection);
  previewBtn.addEventListener('pointerdown', handlePreviewPointerDown);
  previewBtn.addEventListener('pointerup', handlePreviewPointerUp);
  previewBtn.addEventListener('pointerleave', hideAnswerPreview);
  previewBtn.addEventListener('pointercancel', handlePreviewPointerUp);
  previewBtn.addEventListener('keydown', handlePreviewKeyDown);
  previewBtn.addEventListener('keyup', handlePreviewKeyUp);
  resetQuizState();
  fetchFolders();
  updateSubtitle();
}

document.addEventListener('DOMContentLoaded', init);
