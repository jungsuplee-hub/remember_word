const state = {
  folders: [],
  groups: [],
  words: [],
  activeFolderId: null,
  activeGroupId: null,
  quiz: {
    active: false,
    completed: false,
    sessionId: null,
    direction: null,
    questions: [],
    index: 0,
    progress: null,
    hasAnsweredCurrent: false,
  },
};

const folderList = document.querySelector('#folder-list');
const groupList = document.querySelector('#group-list');
const wordTable = document.querySelector('#word-table');
const groupsSubtitle = document.querySelector('#groups-subtitle');
const toast = document.querySelector('#toast');
const minStarSelect = document.querySelector('#word-min-star');
const quizSubtitle = document.querySelector('#quiz-subtitle');
const quizForm = document.querySelector('#quiz-form');
const quizContent = document.querySelector('#quiz-content');
const quizProgress = document.querySelector('#quiz-progress');
const quizQuestionContainer = document.querySelector('#quiz-question');
const quizPrompt = document.querySelector('#quiz-prompt');
const quizReading = document.querySelector('#quiz-reading');
const quizAnswerInput = document.querySelector('#quiz-answer');
const quizSubmitBtn = document.querySelector('#quiz-submit');
const quizShowAnswerBtn = document.querySelector('#quiz-show-answer');
const quizNextBtn = document.querySelector('#quiz-next');
const quizFeedback = document.querySelector('#quiz-feedback');
const quizCorrectAnswer = document.querySelector('#quiz-correct-answer');
const quizSummary = document.querySelector('#quiz-summary');
const quizSummaryText = document.querySelector('#quiz-summary-text');
const quizRetryBtn = document.querySelector('#quiz-retry');
const quizResetBtn = document.querySelector('#quiz-reset');

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
  folderList.innerHTML = '';
  if (state.folders.length === 0) {
    folderList.innerHTML = '<li class="empty">등록된 폴더가 없습니다.</li>';
    return;
  }
  state.folders.forEach((folder) => {
    const li = document.createElement('li');
    li.dataset.id = folder.id;
    li.innerHTML = `<span class="name">${folder.name}</span>`;
    if (state.activeFolderId === folder.id) {
      li.classList.add('active');
    }
    li.addEventListener('click', () => selectFolder(folder.id));
    folderList.appendChild(li);
  });
}

function renderGroups() {
  groupList.innerHTML = '';
  if (!state.activeFolderId) {
    groupList.innerHTML = '<li class="empty">왼쪽에서 폴더를 선택하세요.</li>';
    groupsSubtitle.textContent = '폴더를 선택하세요';
    return;
  }
  groupsSubtitle.textContent = `선택한 폴더 ID: ${state.activeFolderId}`;
  if (state.groups.length === 0) {
    groupList.innerHTML = '<li class="empty">아직 그룹이 없습니다.</li>';
    return;
  }
  state.groups.forEach((group) => {
    const li = document.createElement('li');
    li.dataset.id = group.id;
    li.innerHTML = `<span class="name">${group.name}</span>`;
    if (state.activeGroupId === group.id) {
      li.classList.add('active');
    }
    li.addEventListener('click', () => selectGroup(group.id));
    groupList.appendChild(li);
  });
}

function renderWords() {
  wordTable.innerHTML = '';
  if (!state.activeGroupId) {
    wordTable.innerHTML = '<tr><td colspan="4">그룹을 선택하면 단어가 표시됩니다.</td></tr>';
    return;
  }
  if (state.words.length === 0) {
    wordTable.innerHTML = '<tr><td colspan="4">등록된 단어가 없습니다.</td></tr>';
    return;
  }
  state.words.forEach((word) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${word.language}</td>
      <td>${word.term}</td>
      <td>${word.meaning}</td>
      <td>
        <div class="star-cell" data-id="${word.id}">
          <span class="star-value">${word.star}</span>
          <button class="star-up" title="별점 +1">▲</button>
          <button class="star-down" title="별점 -1">▼</button>
        </div>
      </td>
    `;
    wordTable.appendChild(tr);
  });
}

async function fetchFolders() {
  try {
    const data = await api('/folders');
    state.folders = data;
    if (!state.folders.find((f) => f.id === state.activeFolderId)) {
      state.activeFolderId = null;
      state.groups = [];
      state.activeGroupId = null;
      state.words = [];
      resetQuizState();
    }
    renderFolders();
    renderGroups();
    renderWords();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function fetchGroups() {
  if (!state.activeFolderId) return;
  try {
    const data = await api(`/groups?folder_id=${state.activeFolderId}`);
    state.groups = data;
    if (!state.groups.find((g) => g.id === state.activeGroupId)) {
      state.activeGroupId = null;
      state.words = [];
      resetQuizState();
    }
    renderGroups();
    renderWords();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function fetchWords() {
  if (!state.activeGroupId) return;
  const minStar = minStarSelect.value;
  const params = new URLSearchParams({ group_id: state.activeGroupId });
  if (minStar !== '') params.append('min_star', minStar);
  try {
    const data = await api(`/words?${params.toString()}`);
    state.words = data;
    renderWords();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function selectFolder(id) {
  state.activeFolderId = id;
  state.activeGroupId = null;
  state.words = [];
  resetQuizState();
  renderFolders();
  renderGroups();
  renderWords();
  await fetchGroups();
}

async function selectGroup(id) {
  const changed = state.activeGroupId !== id;
  state.activeGroupId = id;
  if (changed) {
    resetQuizState();
  }
  renderGroups();
  await fetchWords();
}

async function handleFolderSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const name = formData.get('name').trim();
  if (!name) return;
  try {
    await api('/folders', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    form.reset();
    showToast('폴더가 추가되었습니다.');
    await fetchFolders();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleGroupSubmit(event) {
  event.preventDefault();
  if (!state.activeFolderId) {
    showToast('먼저 폴더를 선택하세요.', 'error');
    return;
  }
  const form = event.currentTarget;
  const formData = new FormData(form);
  const name = formData.get('name').trim();
  if (!name) return;
  try {
    await api('/groups', {
      method: 'POST',
      body: JSON.stringify({ name, folder_id: state.activeFolderId }),
    });
    form.reset();
    showToast('그룹이 추가되었습니다.');
    await fetchGroups();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleWordSubmit(event) {
  event.preventDefault();
  if (!state.activeGroupId) {
    showToast('먼저 그룹을 선택하세요.', 'error');
    return;
  }
  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = {
    group_id: state.activeGroupId,
    language: formData.get('language') || 'en',
    term: formData.get('term').trim(),
    meaning: formData.get('meaning').trim(),
    memo: formData.get('memo').trim() || null,
    star: Number(formData.get('star') || 0),
  };
  if (!payload.term || !payload.meaning) {
    showToast('단어와 뜻을 입력하세요.', 'error');
    return;
  }
  try {
    await api('/words', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    form.reset();
    form.elements.language.value = 'en';
    form.elements.star.value = '0';
    showToast('단어가 추가되었습니다.');
    await fetchWords();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function changeStar(wordId, delta) {
  const word = state.words.find((w) => w.id === wordId);
  if (!word) return;
  const next = Math.min(5, Math.max(0, word.star + delta));
  if (next === word.star) return;
  try {
    const updated = await api(`/words/${wordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ star: next }),
    });
    const idx = state.words.findIndex((w) => w.id === wordId);
    if (idx >= 0) state.words[idx] = updated;
    renderWords();
    showToast('별점이 업데이트되었습니다.');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function handleWordTableClick(event) {
  const container = event.target.closest('.star-cell');
  if (!container) return;
  const wordId = Number(container.dataset.id);
  if (event.target.matches('.star-up')) {
    changeStar(wordId, +1);
  } else if (event.target.matches('.star-down')) {
    changeStar(wordId, -1);
  }
}

function updateQuizFormAvailability() {
  if (!quizForm) return;
  const hasGroup = Boolean(state.activeGroupId);
  const disabled = !hasGroup || state.quiz.active;
  quizForm
    .querySelectorAll('input, select, button')
    .forEach((el) => {
      el.disabled = disabled;
    });
}

function updateQuizSubtitle() {
  if (!quizSubtitle) return;
  if (!state.activeGroupId) {
    quizSubtitle.textContent = '그룹을 선택하면 시험을 시작할 수 있습니다.';
    return;
  }

  if (state.quiz.active) {
    const answered = state.quiz.progress ? state.quiz.progress.answered : 0;
    const total = state.quiz.questions.length || (state.quiz.progress ? state.quiz.progress.total : 0);
    quizSubtitle.textContent = `시험 진행 중 (${answered}/${total} 문항)`;
  } else if (state.quiz.completed && state.quiz.progress) {
    quizSubtitle.textContent = `마지막 시험 결과: ${state.quiz.progress.correct}/${state.quiz.progress.total} 정답`;
  } else {
    quizSubtitle.textContent = '옵션을 설정하고 시험을 시작하세요.';
  }
}

function resetQuizDisplay() {
  quizContent.classList.add('hidden');
  quizQuestionContainer.classList.remove('hidden');
  quizSummary.classList.add('hidden');
  quizPrompt.textContent = '';
  quizReading.textContent = '';
  quizReading.classList.add('hidden');
  quizAnswerInput.value = '';
  quizAnswerInput.disabled = false;
  quizSubmitBtn.disabled = false;
  quizShowAnswerBtn.disabled = false;
  quizNextBtn.disabled = true;
  quizFeedback.textContent = '';
  quizFeedback.classList.remove('success', 'error');
  quizCorrectAnswer.textContent = '';
  quizCorrectAnswer.classList.add('hidden');
  quizProgress.textContent = '';
}

function resetQuizState() {
  state.quiz.active = false;
  state.quiz.completed = false;
  state.quiz.sessionId = null;
  state.quiz.direction = null;
  state.quiz.questions = [];
  state.quiz.index = 0;
  state.quiz.progress = null;
  state.quiz.hasAnsweredCurrent = false;
  if (quizForm) {
    resetQuizDisplay();
    updateQuizFormAvailability();
    updateQuizSubtitle();
  }
}

function updateQuizProgressUI() {
  if (!state.quiz.progress) {
    quizProgress.textContent = '';
    return;
  }
  const { answered, total, correct, remaining } = state.quiz.progress;
  quizProgress.textContent = `진행: ${answered}/${total} · 정답 ${correct} · 남은 ${remaining}`;
  updateQuizSubtitle();
}

function showQuizQuestion() {
  const question = state.quiz.questions[state.quiz.index];
  if (!question) return;
  quizContent.classList.remove('hidden');
  quizSummary.classList.add('hidden');
  quizQuestionContainer.classList.remove('hidden');
  quizPrompt.textContent = `${state.quiz.index + 1}. ${question.prompt}`;
  if (question.reading) {
    quizReading.textContent = `읽기: ${question.reading}`;
    quizReading.classList.remove('hidden');
  } else {
    quizReading.textContent = '';
    quizReading.classList.add('hidden');
  }
  quizAnswerInput.value = '';
  quizAnswerInput.disabled = false;
  quizAnswerInput.focus();
  quizSubmitBtn.disabled = false;
  quizShowAnswerBtn.disabled = false;
  quizNextBtn.disabled = true;
  quizFeedback.textContent = '';
  quizFeedback.classList.remove('success', 'error');
  quizCorrectAnswer.textContent = '';
  quizCorrectAnswer.classList.add('hidden');
  state.quiz.hasAnsweredCurrent = false;
  updateQuizProgressUI();
}

async function handleQuizStart(event) {
  event.preventDefault();
  if (!state.activeGroupId) {
    showToast('먼저 그룹을 선택하세요.', 'error');
    return;
  }

  const formData = new FormData(event.currentTarget);
  const payload = {
    group_id: state.activeGroupId,
    random: formData.get('random') !== null,
    direction: formData.get('direction') || 'term_to_meaning',
    mode: 'exam',
  };
  const limit = formData.get('limit');
  if (limit) {
    payload.limit = Number(limit);
  }
  const minStar = formData.get('min_star');
  if (minStar) {
    payload.min_star = Number(minStar);
  }

  state.quiz.active = true;
  state.quiz.completed = false;
  updateQuizFormAvailability();
  updateQuizSubtitle();
  resetQuizDisplay();

  try {
    const result = await api('/quizzes/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    state.quiz.sessionId = result.session_id;
    state.quiz.direction = result.direction;
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
    state.quiz.hasAnsweredCurrent = false;
    showQuizQuestion();
    showToast('시험이 시작되었습니다.');
  } catch (err) {
    state.quiz.active = false;
    updateQuizFormAvailability();
    updateQuizSubtitle();
    resetQuizDisplay();
    showToast(err.message, 'error');
  }
}

async function submitQuizAnswer() {
  if (!state.quiz.sessionId || state.quiz.hasAnsweredCurrent) return;
  const question = state.quiz.questions[state.quiz.index];
  if (!question) return;

  const userAnswer = quizAnswerInput.value;
  const normalizedUser = userAnswer.trim().toLowerCase();
  const normalizedAnswer = question.answer.trim().toLowerCase();
  const isCorrect = normalizedUser !== '' && normalizedAnswer !== '' && normalizedUser === normalizedAnswer;

  quizSubmitBtn.disabled = true;
  quizAnswerInput.disabled = true;

  try {
    const progress = await api(`/quizzes/${state.quiz.sessionId}/answer`, {
      method: 'POST',
      body: JSON.stringify({
        question_id: question.id,
        answer: userAnswer,
        is_correct: isCorrect,
      }),
    });
    state.quiz.progress = progress;
    state.quiz.hasAnsweredCurrent = true;
    quizNextBtn.disabled = false;
    quizFeedback.textContent = isCorrect ? '정답입니다! 잘하셨어요.' : '틀렸습니다. 정답을 확인해보세요.';
    quizFeedback.classList.toggle('success', isCorrect);
    quizFeedback.classList.toggle('error', !isCorrect);
    if (!isCorrect) {
      quizCorrectAnswer.textContent = `정답: ${question.answer}`;
      quizCorrectAnswer.classList.remove('hidden');
    }
    updateQuizProgressUI();
  } catch (err) {
    quizSubmitBtn.disabled = false;
    quizAnswerInput.disabled = false;
    showToast(err.message, 'error');
  }
}

function showQuizAnswer() {
  const question = state.quiz.questions[state.quiz.index];
  if (!question) return;
  quizCorrectAnswer.textContent = `정답: ${question.answer}`;
  quizCorrectAnswer.classList.remove('hidden');
}

function showQuizSummary() {
  state.quiz.active = false;
  state.quiz.completed = true;
  updateQuizFormAvailability();
  quizQuestionContainer.classList.add('hidden');
  quizSummary.classList.remove('hidden');
  const progress = state.quiz.progress;
  if (progress) {
    const incorrect = progress.total - progress.correct;
    quizSummaryText.textContent = `총 ${progress.total}문제 중 ${progress.correct}문제를 맞히고 ${incorrect}문제를 틀렸습니다.`;
    quizRetryBtn.disabled = progress.incorrect_question_ids.length === 0;
  } else {
    quizSummaryText.textContent = '시험 결과를 가져오지 못했습니다.';
    quizRetryBtn.disabled = true;
  }
  quizContent.classList.remove('hidden');
  updateQuizSubtitle();
}

function handleQuizNext() {
  if (!state.quiz.sessionId) return;
  if (!state.quiz.hasAnsweredCurrent) {
    showToast('답안을 제출한 뒤 다음 문제로 이동하세요.', 'error');
    return;
  }
  if (state.quiz.index + 1 < state.quiz.questions.length) {
    state.quiz.index += 1;
    showQuizQuestion();
  } else {
    showQuizSummary();
  }
}

async function handleQuizRetry() {
  if (!state.quiz.sessionId) return;
  if (!state.quiz.progress || state.quiz.progress.incorrect_question_ids.length === 0) {
    showToast('틀린 문제가 없습니다.', 'info');
    return;
  }

  state.quiz.active = true;
  state.quiz.completed = false;
  updateQuizFormAvailability();
  resetQuizDisplay();

  try {
    const result = await api(`/quizzes/${state.quiz.sessionId}/retry`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    state.quiz.sessionId = result.session_id;
    state.quiz.direction = result.direction;
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
    state.quiz.hasAnsweredCurrent = false;
    showQuizQuestion();
    showToast('틀린 문제 시험을 다시 시작합니다.');
  } catch (err) {
    state.quiz.active = false;
    updateQuizFormAvailability();
    updateQuizSubtitle();
    resetQuizDisplay();
    showToast(err.message, 'error');
  }
}

function handleQuizReset() {
  resetQuizState();
  updateQuizFormAvailability();
  updateQuizSubtitle();
  showToast('시험 설정이 초기화되었습니다.');
}

function init() {
  document.querySelector('#folder-form').addEventListener('submit', handleFolderSubmit);
  document.querySelector('#group-form').addEventListener('submit', handleGroupSubmit);
  document.querySelector('#word-form').addEventListener('submit', handleWordSubmit);
  document.querySelector('#refresh-folders').addEventListener('click', fetchFolders);
  document.querySelector('#refresh-words').addEventListener('click', (event) => {
    event.preventDefault();
    fetchWords();
  });
  wordTable.addEventListener('click', handleWordTableClick);
  if (quizForm) {
    quizForm.addEventListener('submit', handleQuizStart);
    quizSubmitBtn.addEventListener('click', submitQuizAnswer);
    quizShowAnswerBtn.addEventListener('click', showQuizAnswer);
    quizNextBtn.addEventListener('click', handleQuizNext);
    quizRetryBtn.addEventListener('click', handleQuizRetry);
    quizResetBtn.addEventListener('click', handleQuizReset);
    updateQuizFormAvailability();
    updateQuizSubtitle();
  }
  fetchFolders();
}

document.addEventListener('DOMContentLoaded', init);
