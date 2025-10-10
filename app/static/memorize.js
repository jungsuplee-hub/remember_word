const state = {
  folders: [],
  groups: [],
  words: [],
  activeFolderId: null,
  activeGroupId: null,
  hideTerm: false,
  hideMeaning: false,
  peekTerm: new Set(),
  peekMeaning: new Set(),
  audioLanguage: 'auto',
};

const toast = document.querySelector('#toast');
const folderSelect = document.querySelector('#memorize-folder');
const groupSelect = document.querySelector('#memorize-group');
const subtitle = document.querySelector('#memorize-subtitle');
const tableBody = document.querySelector('#memorize-word-table');
const tableContainer = document.querySelector('#memorize-table-container');
const toggleTermBtn = document.querySelector('#toggle-term');
const toggleMeaningBtn = document.querySelector('#toggle-meaning');
const audioLanguageInputs = document.querySelectorAll("input[name='audio-language']");
const userGreeting = document.querySelector('#user-greeting');
const adminLink = document.querySelector('#admin-link');
const logoutButton = document.querySelector('#logout-button');
const passwordLink = document.querySelector('#password-link');

function updateUserMenu(user) {
  if (!user) return;
  if (userGreeting) {
    userGreeting.textContent = `${user.name}님`;
  }
  if (adminLink) {
    adminLink.hidden = !user.is_admin;
  }
  if (passwordLink) {
    passwordLink.hidden = false;
  }
}

Session.subscribe(updateUserMenu);

if (logoutButton) {
  logoutButton.addEventListener('click', (event) => {
    event.preventDefault();
    Session.logout();
  });
}

const AUDIO_LANGUAGE_LABELS = {
  auto: '자동',
  'en-US': '영어',
  'ko-KR': '한글',
  'zh-CN': '한자',
};

audioLanguageInputs.forEach((input) => {
  if (input.checked) {
    state.audioLanguage = input.value;
  }
});

const speech = {
  supported:
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window,
  voices: [],
  warningShown: false,
  missingVoiceWarnings: new Set(),
};

function loadVoices() {
  if (!speech.supported) return;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) {
    speech.voices = voices;
  }
}

if (speech.supported) {
  loadVoices();
  window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
}

function detectLanguageFromTerm(term) {
  const text = (term || '').trim();
  if (!text) return 'ko-KR';
  if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(text)) return 'ko-KR';
  if (/[一-鿿]/.test(text)) return 'zh-CN';
  if (/[A-Za-z]/.test(text)) return 'en-US';
  return 'ko-KR';
}

function selectVoiceForLang(lang) {
  if (!speech.supported) return null;
  if (!speech.voices.length) {
    loadVoices();
  }
  if (!speech.voices.length) return null;

  const exact = speech.voices.find((voice) => voice.lang === lang);
  if (exact) return exact;

  const base = lang.split('-')[0];
  return speech.voices.find((voice) => voice.lang && voice.lang.startsWith(base));
}

function getAudioLanguageLabel(lang = state.audioLanguage) {
  return AUDIO_LANGUAGE_LABELS[lang] || AUDIO_LANGUAGE_LABELS.auto;
}

function resolveSpeechLanguage(term) {
  if (state.audioLanguage === 'auto') {
    return detectLanguageFromTerm(term);
  }
  return state.audioLanguage;
}

function updateAudioButtonA11y(button) {
  if (!button) return;
  const term = button.dataset.term || '';
  const languageLabel = getAudioLanguageLabel();
  const isAuto = state.audioLanguage === 'auto';
  const ariaLabel = isAuto
    ? `${term} 발음 듣기`
    : `${term} ${languageLabel} 발음 듣기`;

  button.setAttribute('aria-label', ariaLabel.trim());
  button.title = isAuto ? '발음 듣기' : `${languageLabel} 발음 듣기`;
}

function updateAllAudioButtonsAria() {
  tableBody.querySelectorAll('.term-audio').forEach((button) => {
    updateAudioButtonA11y(button);
  });
}

function notifyMissingVoice(lang) {
  if (!lang || speech.missingVoiceWarnings.has(lang)) return;
  speech.missingVoiceWarnings.add(lang);
  const label = getAudioLanguageLabel(lang);
  showToast(`${label} 음성을 찾을 수 없어 기본 음성으로 재생됩니다.`, 'info');
}

function speakTerm({ term, reading }) {
  const trimmedTerm = (term || '').trim();
  if (!trimmedTerm) return;
  if (!speech.supported) {
    if (!speech.warningShown) {
      showToast('이 브라우저에서는 발음을 지원하지 않습니다.', 'error');
      speech.warningShown = true;
    }
    return;
  }

  const normalizedReading = (reading || '').trim();
  let speechText = trimmedTerm;
  let lang = resolveSpeechLanguage(trimmedTerm);

  if (state.audioLanguage === 'zh-CN') {
    if (normalizedReading) {
      speechText = normalizedReading;
      lang = 'ko-KR';
    } else {
      lang = 'zh-CN';
    }
  }

  const utterance = new SpeechSynthesisUtterance(speechText);
  utterance.lang = lang;
  utterance.rate = 0.9;

  const voice = selectVoiceForLang(lang);
  if (voice) {
    utterance.voice = voice;
  } else if (state.audioLanguage !== 'auto') {
    notifyMissingVoice(lang);
  }

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function createAudioButton(term, reading) {
  const trimmed = (term || '').trim();
  if (!trimmed) return null;
  const normalizedReading = (reading || '').trim();

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'term-audio';
  button.dataset.term = trimmed;
  if (normalizedReading) {
    button.dataset.reading = normalizedReading;
  }
  updateAudioButtonA11y(button);
  if (!speech.supported) {
    button.disabled = true;
    button.setAttribute('aria-disabled', 'true');
  } else {
    button.setAttribute('aria-disabled', 'false');
  }

  button.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5.5 15h-2A1.5 1.5 0 0 1 2 13.5v-3A1.5 1.5 0 0 1 3.5 9h2L10 5.5a1 1 0 0 1 1.64.77v10.46A1 1 0 0 1 10 17.5zM15.46 8.54a1 1 0 1 1 1.41-1.41 6 6 0 0 1 0 8.49 1 1 0 1 1-1.41-1.41 4 4 0 0 0 0-5.67m2.83-2.83a1 1 0 0 1 1.41 0 9 9 0 0 1 0 12.73 1 1 0 1 1-1.41-1.41 7 7 0 0 0 0-9.9 1 1 0 0 1 0-1.42" />
    </svg>
  `;

  const stopPropagation = (event) => event.stopPropagation();
  button.addEventListener('pointerdown', stopPropagation);
  button.addEventListener('pointerup', stopPropagation);
  button.addEventListener('pointercancel', stopPropagation);
  button.addEventListener('keydown', stopPropagation);

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    speakTerm({ term: trimmed, reading: normalizedReading });
  });

  return button;
}

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

function renderGroups() {
  groupSelect.innerHTML = '';
  if (!state.activeFolderId) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '폴더를 먼저 선택하세요.';
    option.disabled = true;
    option.selected = true;
    groupSelect.appendChild(option);
    groupSelect.disabled = true;
    return;
  }

  if (state.groups.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '선택할 그룹이 없습니다.';
    option.disabled = true;
    option.selected = true;
    groupSelect.appendChild(option);
    groupSelect.disabled = true;
    return;
  }

  groupSelect.disabled = false;
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '그룹 선택';
  placeholder.selected = !state.activeGroupId;
  groupSelect.appendChild(placeholder);
  state.groups.forEach((group) => {
    const option = document.createElement('option');
    option.value = group.id;
    option.textContent = group.name;
    if (group.id === state.activeGroupId) option.selected = true;
    groupSelect.appendChild(option);
  });

  if (!state.groups.some((group) => group.id === state.activeGroupId)) {
    state.activeGroupId = null;
  }
}

function updateSubtitle() {
  if (!state.activeGroupId) {
    if (state.activeFolderId) {
      subtitle.textContent = '그룹을 선택하면 단어가 표시됩니다.';
    } else {
      subtitle.textContent = '폴더와 그룹을 선택하세요.';
    }
    return;
  }

  subtitle.textContent = `총 ${state.words.length}개의 단어`;
}

function createCell({ text, hiddenLabel, type, reading }) {
  const cell = document.createElement('td');
  cell.className = type === 'term' ? 'term-cell' : 'meaning-cell';
  cell.dataset.type = type;
  cell.tabIndex = -1;
  cell.setAttribute('role', 'button');
  cell.setAttribute('aria-disabled', 'true');
  cell.setAttribute('aria-label', type === 'term' ? '단어' : '뜻');
  cell.setAttribute('aria-pressed', 'false');

  const visibleSpan = document.createElement('span');
  visibleSpan.className = 'value-text';
  visibleSpan.textContent = text;

  const hiddenSpan = document.createElement('span');
  hiddenSpan.className = 'value-hidden';
  hiddenSpan.textContent = hiddenLabel;

  if (type === 'term') {
    const termContent = document.createElement('div');
    termContent.className = 'term-content';
    termContent.appendChild(visibleSpan);
    const audioButton = createAudioButton(text, reading);
    if (audioButton) {
      termContent.appendChild(audioButton);
    }
    cell.appendChild(termContent);
  } else {
    cell.appendChild(visibleSpan);
  }
  cell.appendChild(hiddenSpan);
  return cell;
}

function renderWords() {
  tableBody.innerHTML = '';

  if (!state.activeGroupId) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 2;
    cell.className = 'empty';
    cell.textContent = '그룹을 선택하면 단어가 표시됩니다.';
    row.appendChild(cell);
    tableBody.appendChild(row);
    updateSubtitle();
    updateToggleButtons();
    return;
  }

  if (state.words.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 2;
    cell.className = 'empty';
    cell.textContent = '등록된 단어가 없습니다.';
    row.appendChild(cell);
    tableBody.appendChild(row);
    updateSubtitle();
    updateToggleButtons();
    return;
  }

  state.words.forEach((word) => {
    const row = document.createElement('tr');
    row.dataset.id = word.id;

    if (state.peekTerm.has(word.id)) row.classList.add('peek-term');
    if (state.peekMeaning.has(word.id)) row.classList.add('peek-meaning');

    const termCell = createCell({
      text: word.term,
      hiddenLabel: '단어 가려짐 · 길게 눌러 보기',
      type: 'term',
      reading: word.reading,
    });

    const meaningCell = createCell({
      text: word.meaning,
      hiddenLabel: '뜻 가려짐 · 길게 눌러 보기',
      type: 'meaning',
    });

    row.appendChild(termCell);
    row.appendChild(meaningCell);

    tableBody.appendChild(row);
    updateRowState(row);
  });

  updateAllAudioButtonsAria();
  updateSubtitle();
  updateToggleButtons();
}

function updateToggleButtons() {
  const hasWords = state.words.length > 0;
  toggleTermBtn.disabled = !hasWords;
  toggleMeaningBtn.disabled = !hasWords;

  toggleTermBtn.dataset.active = state.hideTerm ? 'true' : 'false';
  toggleTermBtn.textContent = state.hideTerm ? '단어 모두 보이기' : '단어 가리기';

  toggleMeaningBtn.dataset.active = state.hideMeaning ? 'true' : 'false';
  toggleMeaningBtn.textContent = state.hideMeaning ? '뜻 모두 보이기' : '뜻 가리기';

  tableContainer.classList.toggle('hide-term', state.hideTerm && hasWords);
  tableContainer.classList.toggle('hide-meaning', state.hideMeaning && hasWords);

  const termInteractive = state.hideTerm && hasWords;
  const meaningInteractive = state.hideMeaning && hasWords;

  tableBody.querySelectorAll('td.term-cell').forEach((cell) => {
    cell.tabIndex = termInteractive ? 0 : -1;
    cell.setAttribute('aria-disabled', termInteractive ? 'false' : 'true');
    cell.setAttribute('aria-label', termInteractive ? '단어 보기' : '단어');
  });

  tableBody.querySelectorAll('td.meaning-cell').forEach((cell) => {
    cell.tabIndex = meaningInteractive ? 0 : -1;
    cell.setAttribute('aria-disabled', meaningInteractive ? 'false' : 'true');
    cell.setAttribute('aria-label', meaningInteractive ? '뜻 보기' : '뜻');
  });
}

function resetPeekStates() {
  if (!state.hideTerm) {
    state.peekTerm.clear();
  }
  if (!state.hideMeaning) {
    state.peekMeaning.clear();
  }
}

async function fetchFolders() {
  try {
    state.folders = await api('/folders');
    if (!state.folders.some((folder) => folder.id === state.activeFolderId)) {
      state.activeFolderId = null;
      state.groups = [];
      state.activeGroupId = null;
      state.words = [];
    }
    renderFolders();
    renderGroups();
    renderWords();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function fetchGroups() {
  if (!state.activeFolderId) return;
  try {
    state.groups = await api(`/groups?folder_id=${state.activeFolderId}`);
    renderGroups();
    if (state.activeGroupId) {
      await fetchWords();
    } else {
      state.words = [];
      renderWords();
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function fetchWords() {
  if (!state.activeGroupId) return;
  try {
    state.peekTerm.clear();
    state.peekMeaning.clear();
    state.words = await api(`/words?group_id=${state.activeGroupId}`);
    renderWords();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

folderSelect.addEventListener('change', () => {
  const value = Number(folderSelect.value);
  state.activeFolderId = Number.isFinite(value) && value > 0 ? value : null;
  state.activeGroupId = null;
  state.groups = [];
  state.words = [];
  state.hideTerm = false;
  state.hideMeaning = false;
  resetPeekStates();
  renderGroups();
  renderWords();
  if (state.activeFolderId) {
    fetchGroups();
  }
});

groupSelect.addEventListener('change', () => {
  const value = Number(groupSelect.value);
  state.activeGroupId = Number.isFinite(value) && value > 0 ? value : null;
  state.words = [];
  state.hideTerm = false;
  state.hideMeaning = false;
  resetPeekStates();
  renderWords();
  if (state.activeGroupId) {
    fetchWords();
  }
});

function setPeekState(id, type, shouldPeek) {
  const set = type === 'term' ? state.peekTerm : state.peekMeaning;
  if (shouldPeek) {
    set.add(id);
  } else {
    set.delete(id);
  }
}

function updateRowState(row) {
  const id = Number(row.dataset.id);
  if (!Number.isFinite(id)) return;
  row.classList.toggle('peek-term', state.peekTerm.has(id));
  row.classList.toggle('peek-meaning', state.peekMeaning.has(id));

  const termCell = row.querySelector('.term-cell');
  if (termCell) {
    termCell.setAttribute('aria-pressed', state.peekTerm.has(id) ? 'true' : 'false');
  }

  const meaningCell = row.querySelector('.meaning-cell');
  if (meaningCell) {
    meaningCell.setAttribute('aria-pressed', state.peekMeaning.has(id) ? 'true' : 'false');
  }
}

function handlePointerDown(event) {
  const cell = event.target.closest('td');
  if (!cell) return;

  if (cell.getAttribute('aria-disabled') === 'true') return;

  const row = cell.closest('tr');
  if (!row || !row.dataset.id) return;

  const id = Number(row.dataset.id);
  let peekType = null;
  if (cell.dataset.type === 'term') {
    if (!state.hideTerm) return;
    peekType = 'term';
    setPeekState(id, peekType, true);
    updateRowState(row);
    cell.focus({ preventScroll: true });
  } else if (cell.dataset.type === 'meaning') {
    if (!state.hideMeaning) return;
    peekType = 'meaning';
    setPeekState(id, peekType, true);
    updateRowState(row);
    cell.focus({ preventScroll: true });
  } else {
    return;
  }

  const handleRelease = (ev) => {
    if (ev.pointerId !== event.pointerId) return;
    setPeekState(id, peekType, false);
    updateRowState(row);
    window.removeEventListener('pointerup', handleRelease);
    window.removeEventListener('pointercancel', handleRelease);
  };

  window.addEventListener('pointerup', handleRelease);
  window.addEventListener('pointercancel', handleRelease);
}

tableBody.addEventListener('pointerdown', handlePointerDown);

function handleKeyDown(event) {
  if (event.key !== ' ' && event.key !== 'Enter') return;
  const cell = event.target.closest('td');
  if (!cell) return;
  if (cell.getAttribute('aria-disabled') === 'true') return;

  const row = cell.closest('tr');
  if (!row || !row.dataset.id) return;

  const id = Number(row.dataset.id);
  let peekType = null;
  if (cell.dataset.type === 'term') {
    if (!state.hideTerm) return;
    peekType = 'term';
  } else if (cell.dataset.type === 'meaning') {
    if (!state.hideMeaning) return;
    peekType = 'meaning';
  } else {
    return;
  }

  setPeekState(id, peekType, true);
  updateRowState(row);
  event.preventDefault();

  const handleKeyUp = (ev) => {
    if (ev.target !== cell) return;
    setPeekState(id, peekType, false);
    updateRowState(row);
    cell.removeEventListener('keyup', handleKeyUp);
    cell.removeEventListener('blur', handleBlur);
  };

  const handleBlur = () => {
    setPeekState(id, peekType, false);
    updateRowState(row);
    cell.removeEventListener('keyup', handleKeyUp);
    cell.removeEventListener('blur', handleBlur);
  };

  cell.addEventListener('keyup', handleKeyUp);
  cell.addEventListener('blur', handleBlur, { once: true });
}

tableBody.addEventListener('keydown', handleKeyDown);

audioLanguageInputs.forEach((input) => {
  input.addEventListener('change', () => {
    if (!input.checked) return;
    state.audioLanguage = input.value;
    updateAllAudioButtonsAria();
    if (speech.supported && state.audioLanguage !== 'auto') {
      const voice = selectVoiceForLang(state.audioLanguage);
      if (!voice) {
        notifyMissingVoice(state.audioLanguage);
      }
    }
  });
});

toggleTermBtn.addEventListener('click', () => {
  if (!state.words.length) return;
  state.hideTerm = !state.hideTerm;
  if (!state.hideTerm) {
    state.peekTerm.clear();
  }
  renderWords();
});

toggleMeaningBtn.addEventListener('click', () => {
  if (!state.words.length) return;
  state.hideMeaning = !state.hideMeaning;
  if (!state.hideMeaning) {
    state.peekMeaning.clear();
  }
  renderWords();
});

Session.ensureAuthenticated()
  .then(() => fetchFolders())
  .catch((error) => {
    if (error.message !== 'unauthenticated') {
      console.error(error);
      showToast('세션을 확인하는 중 오류가 발생했습니다.', 'error');
    }
  });
