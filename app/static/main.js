const state = {
  folders: [],
  groups: [],
  words: [],
  activeFolderId: null,
  activeGroupId: null,
};

const folderList = document.querySelector('#folder-list');
const groupList = document.querySelector('#group-list');
const wordTable = document.querySelector('#word-table');
const groupsSubtitle = document.querySelector('#groups-subtitle');
const toast = document.querySelector('#toast');
const minStarSelect = document.querySelector('#word-min-star');
const importForm = document.querySelector('#import-form');
const importFileInput = document.querySelector('#import-file');
const importLanguageInput = document.querySelector('#import-language');

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
    li.classList.toggle('active', state.activeFolderId === folder.id);

    li.innerHTML = `
      <span class="name">${folder.name}</span>
      <div class="item-actions">
        <button class="edit" data-action="edit" title="폴더 이름 수정">수정</button>
        <button class="danger" data-action="delete" title="폴더 삭제">삭제</button>
      </div>
    `;

    li.addEventListener('click', (event) => {
      if (event.target.closest('button')) return;
      selectFolder(folder.id);
    });
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
    li.classList.toggle('active', state.activeGroupId === group.id);
    li.innerHTML = `
      <span class="name">${group.name}</span>
      <div class="item-actions">
        <button class="edit" data-action="edit" title="그룹 이름 수정">수정</button>
        <button class="secondary" data-action="move" title="다른 폴더로 이동">이동</button>
        <button class="danger" data-action="delete" title="그룹 삭제">삭제</button>
      </div>
    `;

    li.addEventListener('click', (event) => {
      if (event.target.closest('button')) return;
      selectGroup(group.id);
    });

    groupList.appendChild(li);
  });
}

function renderWords() {
  wordTable.innerHTML = '';
  if (!state.activeGroupId) {
    wordTable.innerHTML = '<tr><td colspan="5">그룹을 선택하면 단어가 표시됩니다.</td></tr>';
    return;
  }
  if (state.words.length === 0) {
    wordTable.innerHTML = '<tr><td colspan="5">등록된 단어가 없습니다.</td></tr>';
    return;
  }

  state.words.forEach((word) => {
    const tr = document.createElement('tr');
    tr.dataset.id = word.id;
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
      <td class="word-actions">
        <button class="edit-word" data-action="edit-word">수정</button>
        <button class="secondary" data-action="move-word">이동</button>
        <button class="danger" data-action="delete-word">삭제</button>
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
  const changed = state.activeFolderId !== id;
  state.activeFolderId = id;
  state.activeGroupId = null;
  state.words = [];
  renderFolders();
  renderGroups();
  renderWords();
  if (changed) {
    await fetchGroups();
  }
}

async function selectGroup(id) {
  state.activeGroupId = id;
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
  const starContainer = event.target.closest('.star-cell');
  if (starContainer) {
    const wordId = Number(starContainer.dataset.id);
    if (event.target.matches('.star-up')) {
      changeStar(wordId, +1);
      return;
    }
    if (event.target.matches('.star-down')) {
      changeStar(wordId, -1);
      return;
    }
  }

  const moveBtn = event.target.closest('button[data-action="move-word"]');
  if (moveBtn) {
    const row = moveBtn.closest('tr');
    const wordId = Number(row.dataset.id);
    openWordMovePrompt(wordId);
    return;
  }

  const deleteBtn = event.target.closest('button[data-action="delete-word"]');
  if (deleteBtn) {
    const row = deleteBtn.closest('tr');
    const wordId = Number(row.dataset.id);
    deleteWord(wordId);
    return;
  }

  const editBtn = event.target.closest('button[data-action="edit-word"]');
  if (editBtn) {
    const row = editBtn.closest('tr');
    const wordId = Number(row.dataset.id);
    openWordEditPrompt(wordId);
  }
}

async function openFolderEditPrompt(folderId) {
  const folder = state.folders.find((f) => f.id === folderId);
  if (!folder) return;
  const nextName = prompt('새 폴더 이름을 입력하세요.', folder.name);
  if (nextName === null) return;
  const trimmed = nextName.trim();
  if (!trimmed || trimmed === folder.name) return;
  try {
    await api(`/folders/${folderId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: trimmed }),
    });
    showToast('폴더 이름을 변경했습니다.');
    await fetchFolders();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteFolder(folderId) {
  const folder = state.folders.find((f) => f.id === folderId);
  if (!folder) return;
  const confirmed = confirm('폴더를 삭제하면 하위 그룹과 단어도 함께 삭제됩니다. 계속할까요?');
  if (!confirmed) return;
  try {
    await api(`/folders/${folderId}`, { method: 'DELETE' });
    showToast('폴더를 삭제했습니다.');
    await fetchFolders();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function openGroupEditPrompt(groupId) {
  const group = state.groups.find((g) => g.id === groupId);
  if (!group) return;
  const nextName = prompt('새 그룹 이름을 입력하세요.', group.name);
  if (nextName === null) return;
  const trimmed = nextName.trim();
  if (!trimmed || trimmed === group.name) return;
  try {
    await api(`/groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: trimmed }),
    });
    showToast('그룹 이름을 변경했습니다.');
    await fetchGroups();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function openGroupMovePrompt(groupId) {
  const group = state.groups.find((g) => g.id === groupId);
  if (!group) return;
  if (state.folders.length === 0) {
    showToast('먼저 폴더를 만들어주세요.', 'error');
    return;
  }
  const options = state.folders
    .map((folder) => `${folder.id}: ${folder.name}`)
    .join('\n');
  const input = prompt(`이동할 폴더 ID를 선택하세요:\n${options}`, String(group.folder_id));
  if (input === null) return;
  const targetId = Number(input);
  if (!Number.isInteger(targetId) || !state.folders.some((f) => f.id === targetId)) {
    showToast('유효한 폴더 ID를 입력하세요.', 'error');
    return;
  }
  if (targetId === group.folder_id) return;
  try {
    await api(`/groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify({ folder_id: targetId }),
    });
    showToast('그룹을 다른 폴더로 이동했습니다.');
    if (state.activeFolderId === targetId) {
      await fetchGroups();
    } else if (state.activeFolderId === group.folder_id) {
      await fetchGroups();
    } else {
      await fetchFolders();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteGroup(groupId) {
  const group = state.groups.find((g) => g.id === groupId);
  if (!group) return;
  const confirmed = confirm('그룹을 삭제하면 포함된 단어도 함께 삭제됩니다. 계속할까요?');
  if (!confirmed) return;
  try {
    await api(`/groups/${groupId}`, { method: 'DELETE' });
    showToast('그룹을 삭제했습니다.');
    await fetchGroups();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function openWordEditPrompt(wordId) {
  const word = state.words.find((w) => w.id === wordId);
  if (!word) return;
  const nextTerm = prompt('단어를 수정하세요.', word.term);
  if (nextTerm === null) return;
  const term = nextTerm.trim();
  if (!term) {
    showToast('단어는 비워둘 수 없습니다.', 'error');
    return;
  }
  const nextMeaning = prompt('뜻을 수정하세요.', word.meaning);
  if (nextMeaning === null) return;
  const meaning = nextMeaning.trim();
  if (!meaning) {
    showToast('뜻은 비워둘 수 없습니다.', 'error');
    return;
  }
  try {
    const updated = await api(`/words/${wordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ term, meaning }),
    });
    const idx = state.words.findIndex((w) => w.id === wordId);
    if (idx >= 0) state.words[idx] = updated;
    renderWords();
    showToast('단어를 수정했습니다.');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function openWordMovePrompt(wordId) {
  const word = state.words.find((w) => w.id === wordId);
  if (!word) return;
  let groups = [];
  try {
    groups = await api('/groups');
  } catch (err) {
    showToast(err.message, 'error');
    return;
  }
  if (!groups || groups.length === 0) {
    showToast('이동할 그룹이 없습니다.', 'error');
    return;
  }
  const options = groups
    .map((g) => {
      const folder = state.folders.find((f) => f.id === g.folder_id);
      const folderName = folder ? folder.name : `폴더 ${g.folder_id}`;
      return `${g.id}: [${folderName}] ${g.name}`;
    })
    .join('\n');
  const input = prompt(`이동할 그룹을 선택하세요:\n${options}`, String(word.group_id));
  if (input === null) return;
  const targetId = Number(input);
  if (!Number.isInteger(targetId) || !groups.some((g) => g.id === targetId)) {
    showToast('유효한 그룹 ID를 입력하세요.', 'error');
    return;
  }
  if (targetId === word.group_id) return;
  try {
    await api(`/words/${wordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ group_id: targetId }),
    });
    showToast('단어를 다른 그룹으로 이동했습니다.');
    await fetchWords();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteWord(wordId) {
  const word = state.words.find((w) => w.id === wordId);
  if (!word) return;
  const confirmed = confirm('단어를 삭제하시겠습니까?');
  if (!confirmed) return;
  try {
    await api(`/words/${wordId}`, { method: 'DELETE' });
    showToast('단어를 삭제했습니다.');
    await fetchWords();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleStructuredImport(event) {
  event.preventDefault();
  const file = importFileInput.files[0];
  if (!file) {
    showToast('업로드할 파일을 선택하세요.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('default_language', importLanguageInput.value || 'en');

  try {
    const res = await fetch('/words/import-structured', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || '가져오기 중 오류가 발생했습니다.');
    }
    const summary = await res.json();
    showToast(`추가 ${summary.inserted}건, 건너뜀 ${summary.skipped}건`);
    importForm.reset();
    await fetchFolders();
    if (state.activeFolderId) {
      await fetchGroups();
      if (state.activeGroupId) {
        await fetchWords();
      }
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function handleFolderListClick(event) {
  const deleteBtn = event.target.closest('button[data-action="delete"]');
  if (deleteBtn) {
    const li = deleteBtn.closest('li');
    const folderId = Number(li.dataset.id);
    deleteFolder(folderId);
    return;
  }
  const editBtn = event.target.closest('button[data-action="edit"]');
  if (editBtn) {
    const li = editBtn.closest('li');
    const folderId = Number(li.dataset.id);
    openFolderEditPrompt(folderId);
  }
}

function handleGroupListClick(event) {
  const moveBtn = event.target.closest('button[data-action="move"]');
  if (moveBtn) {
    const li = moveBtn.closest('li');
    const groupId = Number(li.dataset.id);
    openGroupMovePrompt(groupId);
    return;
  }
  const deleteBtn = event.target.closest('button[data-action="delete"]');
  if (deleteBtn) {
    const li = deleteBtn.closest('li');
    const groupId = Number(li.dataset.id);
    deleteGroup(groupId);
    return;
  }
  const editBtn = event.target.closest('button[data-action="edit"]');
  if (editBtn) {
    const li = editBtn.closest('li');
    const groupId = Number(li.dataset.id);
    openGroupEditPrompt(groupId);
  }
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
  minStarSelect.addEventListener('change', fetchWords);
  folderList.addEventListener('click', handleFolderListClick);
  groupList.addEventListener('click', handleGroupListClick);
  wordTable.addEventListener('click', handleWordTableClick);
  if (importForm) {
    importForm.addEventListener('submit', handleStructuredImport);
  }
  fetchFolders();
}

document.addEventListener('DOMContentLoaded', init);
