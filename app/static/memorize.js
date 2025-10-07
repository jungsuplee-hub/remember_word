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
};

const toast = document.querySelector('#toast');
const folderSelect = document.querySelector('#memorize-folder');
const groupSelect = document.querySelector('#memorize-group');
const subtitle = document.querySelector('#memorize-subtitle');
const tableBody = document.querySelector('#memorize-word-table');
const tableContainer = document.querySelector('#memorize-table-container');
const toggleTermBtn = document.querySelector('#toggle-term');
const toggleMeaningBtn = document.querySelector('#toggle-meaning');

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

function createCell({ text, hiddenLabel, buttonClass, peeked }) {
  const cell = document.createElement('td');
  cell.className = `${buttonClass === 'preview-term' ? 'term-cell' : 'meaning-cell'}`;

  const visibleSpan = document.createElement('span');
  visibleSpan.className = 'value-text';
  visibleSpan.textContent = text;

  const hiddenSpan = document.createElement('span');
  hiddenSpan.className = 'value-hidden';
  hiddenSpan.textContent = hiddenLabel;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = `${buttonClass} secondary`;
  const label = buttonClass === 'preview-term' ? '단어' : '뜻';
  button.textContent = peeked ? `${label} 숨기기` : `${label} 보기`;

  cell.appendChild(visibleSpan);
  cell.appendChild(hiddenSpan);
  cell.appendChild(button);
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
      hiddenLabel: '단어 숨김',
      buttonClass: 'preview-term',
      peeked: state.peekTerm.has(word.id),
    });

    const meaningCell = createCell({
      text: word.meaning,
      hiddenLabel: '뜻 숨김',
      buttonClass: 'preview-meaning',
      peeked: state.peekMeaning.has(word.id),
    });

    row.appendChild(termCell);
    row.appendChild(meaningCell);

    tableBody.appendChild(row);
  });

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

function updateRowButtons(row) {
  const id = Number(row.dataset.id);
  const termButton = row.querySelector('.preview-term');
  const meaningButton = row.querySelector('.preview-meaning');

  if (termButton) {
    const peeked = state.peekTerm.has(id);
    termButton.textContent = peeked ? '단어 숨기기' : '단어 보기';
    row.classList.toggle('peek-term', peeked);
  }

  if (meaningButton) {
    const peeked = state.peekMeaning.has(id);
    meaningButton.textContent = peeked ? '뜻 숨기기' : '뜻 보기';
    row.classList.toggle('peek-meaning', peeked);
  }
}

function handlePointerDown(event) {
  const button = event.target.closest('button');
  if (!button) return;

  const row = button.closest('tr');
  if (!row || !row.dataset.id) return;

  const id = Number(row.dataset.id);
  let peekType = null;
  if (button.classList.contains('preview-term')) {
    if (!state.hideTerm) return;
    peekType = 'term';
    setPeekState(id, peekType, true);
    updateRowButtons(row);
  } else if (button.classList.contains('preview-meaning')) {
    if (!state.hideMeaning) return;
    peekType = 'meaning';
    setPeekState(id, peekType, true);
    updateRowButtons(row);
  } else {
    return;
  }

  const handleRelease = (ev) => {
    if (ev.pointerId !== event.pointerId) return;
    setPeekState(id, peekType, false);
    updateRowButtons(row);
    window.removeEventListener('pointerup', handleRelease);
    window.removeEventListener('pointercancel', handleRelease);
  };

  window.addEventListener('pointerup', handleRelease);
  window.addEventListener('pointercancel', handleRelease);
}

tableBody.addEventListener('pointerdown', handlePointerDown);

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

fetchFolders();
