const MAX_STAR_RATING = 10;

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
const userGreeting = document.querySelector('#user-greeting');
const adminLink = document.querySelector('#admin-link');
const logoutButton = document.querySelector('#logout-button');
const accountLink = document.querySelector('#account-link');
const folderCount = document.querySelector('#folder-count');
const groupCount = document.querySelector('#group-count');
const wordCount = document.querySelector('#word-count');
const folderEditDialog = document.querySelector('#folder-edit-dialog');
const folderEditForm = document.querySelector('#folder-edit-form');
const folderEditNameInput = document.querySelector('#folder-edit-name');
const folderEditCancelButton = document.querySelector('#folder-edit-cancel');
const folderEditSubmitButton = document.querySelector('#folder-edit-submit');
const folderEditFolderLabel = document.querySelector('#folder-edit-folder');
const folderEditBackdrop = folderEditDialog ? folderEditDialog.querySelector('.modal-backdrop') : null;
const groupEditDialog = document.querySelector('#group-edit-dialog');
const groupEditForm = document.querySelector('#group-edit-form');
const groupEditNameInput = document.querySelector('#group-edit-name');
const groupEditCancelButton = document.querySelector('#group-edit-cancel');
const groupEditSubmitButton = document.querySelector('#group-edit-submit');
const groupEditGroupLabel = document.querySelector('#group-edit-group');
const groupEditFolderLabel = document.querySelector('#group-edit-folder');
const groupEditBackdrop = groupEditDialog ? groupEditDialog.querySelector('.modal-backdrop') : null;
const wordEditDialog = document.querySelector('#word-edit-dialog');
const wordEditForm = document.querySelector('#word-edit-form');
const wordEditTermInput = document.querySelector('#word-edit-term');
const wordEditMeaningInput = document.querySelector('#word-edit-meaning');
const wordEditCancelButton = document.querySelector('#word-edit-cancel');
const wordEditSubmitButton = document.querySelector('#word-edit-submit');
const wordEditWordLabel = document.querySelector('#word-edit-word');
const wordEditBackdrop = wordEditDialog ? wordEditDialog.querySelector('.modal-backdrop') : null;
const wordMoveDialog = document.querySelector('#word-move-dialog');
const wordMoveForm = document.querySelector('#word-move-form');
const wordMoveFolderSelect = document.querySelector('#word-move-folder');
const wordMoveGroupSelect = document.querySelector('#word-move-group');
const wordMoveCancelButton = document.querySelector('#word-move-cancel');
const wordMoveSubmitButton = document.querySelector('#word-move-submit');
const wordMoveWordLabel = document.querySelector('#word-move-word');
const wordMoveBackdrop = wordMoveDialog ? wordMoveDialog.querySelector('.modal-backdrop') : null;
const groupMoveDialog = document.querySelector('#group-move-dialog');
const groupMoveForm = document.querySelector('#group-move-form');
const groupMoveFolderSelect = document.querySelector('#group-move-folder');
const groupMoveCancelButton = document.querySelector('#group-move-cancel');
const groupMoveSubmitButton = document.querySelector('#group-move-submit');
const groupMoveGroupLabel = document.querySelector('#group-move-group');
const groupMoveCurrentFolderLabel = document.querySelector('#group-move-current-folder');
const groupMoveBackdrop = groupMoveDialog
  ? groupMoveDialog.querySelector('.modal-backdrop')
  : null;
let folderEditTargetFolderId = null;
let groupEditTargetGroupId = null;
let wordEditTargetWordId = null;
let wordMoveTargetWordId = null;
let wordMoveOriginalGroupId = null;
let wordMoveGroupsCache = [];
let groupMoveTargetGroupId = null;
let groupMoveOriginalFolderId = null;
function updateUserMenu(user) {
  if (!user) return;
  const isAdmin = Session?.isAdmin ? Session.isAdmin(user) : Boolean(user?.is_admin);
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

Session.subscribe(updateUserMenu);

if (logoutButton) {
  logoutButton.addEventListener('click', (event) => {
    event.preventDefault();
    Session.logout();
  });
}

function showToast(message, type = 'info') {
  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
}

function updateFolderEditSubmitState() {
  if (!folderEditSubmitButton || !folderEditNameInput) return;
  const hasName = Boolean(folderEditNameInput.value.trim());
  folderEditSubmitButton.disabled = !hasName;
}

function updateGroupEditSubmitState() {
  if (!groupEditSubmitButton || !groupEditNameInput) return;
  const hasName = Boolean(groupEditNameInput.value.trim());
  groupEditSubmitButton.disabled = !hasName;
}

function updateWordEditSubmitState() {
  if (!wordEditSubmitButton || !wordEditTermInput || !wordEditMeaningInput) return;
  const hasTerm = Boolean(wordEditTermInput.value.trim());
  const hasMeaning = Boolean(wordEditMeaningInput.value.trim());
  wordEditSubmitButton.disabled = !(hasTerm && hasMeaning);
}

function updateCounts() {
  if (folderCount) {
    folderCount.textContent = state.folders.length;
  }
  if (groupCount) {
    groupCount.textContent = state.groups.length;
  }
  if (wordCount) {
    wordCount.textContent = state.words.length;
  }
}

function resolveFolderName(folderId) {
  const folder = state.folders.find((f) => f.id === folderId);
  return folder ? folder.name : `폴더 ${folderId}`;
}

function closeFolderEditDialog() {
  if (!folderEditDialog) return;
  folderEditDialog.classList.add('hidden');
  folderEditDialog.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  folderEditTargetFolderId = null;
  if (folderEditForm) {
    folderEditForm.reset();
  }
  if (folderEditFolderLabel) {
    folderEditFolderLabel.textContent = '';
  }
  updateFolderEditSubmitState();
}

function openFolderEditDialog(folderId) {
  if (!folderEditDialog || !folderEditForm || !folderEditNameInput) {
    return;
  }
  const folder = state.folders.find((f) => f.id === folderId);
  if (!folder) return;

  folderEditTargetFolderId = folderId;
  folderEditDialog.classList.remove('hidden');
  folderEditDialog.removeAttribute('aria-hidden');
  document.body.classList.add('modal-open');

  if (folderEditFolderLabel) {
    folderEditFolderLabel.textContent = `선택한 폴더: ${folder.name}`;
  }
  folderEditNameInput.value = folder.name ?? '';
  updateFolderEditSubmitState();

  setTimeout(() => {
    if (folderEditNameInput) {
      folderEditNameInput.focus();
      folderEditNameInput.select();
    }
  }, 0);
}

function closeGroupEditDialog() {
  if (!groupEditDialog) return;
  groupEditDialog.classList.add('hidden');
  groupEditDialog.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  groupEditTargetGroupId = null;
  if (groupEditForm) {
    groupEditForm.reset();
  }
  if (groupEditGroupLabel) {
    groupEditGroupLabel.textContent = '';
  }
  if (groupEditFolderLabel) {
    groupEditFolderLabel.textContent = '';
  }
  updateGroupEditSubmitState();
}

function openGroupEditDialog(groupId) {
  if (!groupEditDialog || !groupEditForm || !groupEditNameInput) {
    return;
  }

  const group = state.groups.find((g) => g.id === groupId);
  if (!group) return;

  groupEditTargetGroupId = groupId;
  groupEditDialog.classList.remove('hidden');
  groupEditDialog.removeAttribute('aria-hidden');
  document.body.classList.add('modal-open');

  if (groupEditGroupLabel) {
    groupEditGroupLabel.textContent = `선택한 그룹: ${group.name}`;
  }
  if (groupEditFolderLabel) {
    groupEditFolderLabel.textContent = `소속 폴더: ${resolveFolderName(group.folder_id)}`;
  }
  groupEditNameInput.value = group.name ?? '';
  updateGroupEditSubmitState();

  setTimeout(() => {
    if (groupEditNameInput) {
      groupEditNameInput.focus();
      groupEditNameInput.select();
    }
  }, 0);
}

function updateWordMoveSubmitState() {
  if (!wordMoveSubmitButton) return;
  const hasSelection = Boolean(
    wordMoveGroupSelect
      && !wordMoveGroupSelect.disabled
      && wordMoveGroupSelect.value
  );
  wordMoveSubmitButton.disabled = !hasSelection;
}

function updateGroupMoveSubmitState() {
  if (!groupMoveSubmitButton || !groupMoveFolderSelect) return;
  const folderValue = groupMoveFolderSelect.value;
  const folderId = Number(folderValue);
  const isValid =
    Boolean(folderValue) && Number.isInteger(folderId) && folderId !== groupMoveOriginalFolderId;
  groupMoveSubmitButton.disabled = !isValid;
}

function populateWordMoveFolderOptions(selectedFolderId) {
  if (!wordMoveFolderSelect) return;
  wordMoveFolderSelect.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '폴더를 선택하세요';
  placeholder.disabled = true;
  wordMoveFolderSelect.appendChild(placeholder);

  const seen = new Set();
  const folders = [];

  wordMoveGroupsCache.forEach((group) => {
    if (seen.has(group.folder_id)) return;
    seen.add(group.folder_id);
    folders.push({ id: group.folder_id, name: resolveFolderName(group.folder_id) });
  });

  folders.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  folders.forEach((folder) => {
    const option = document.createElement('option');
    option.value = String(folder.id);
    option.textContent = folder.name;
    if (selectedFolderId && folder.id === selectedFolderId) {
      option.selected = true;
      placeholder.selected = false;
    }
    wordMoveFolderSelect.appendChild(option);
  });

  if (!selectedFolderId) {
    placeholder.selected = true;
  }

  const hasFolders = folders.length > 0;
  wordMoveFolderSelect.disabled = !hasFolders;
  if (!hasFolders) {
    placeholder.textContent = '이동할 폴더가 없습니다.';
    placeholder.selected = true;
  }
}

function populateWordMoveGroupOptions(folderId, selectedGroupId) {
  if (!wordMoveGroupSelect) return;
  wordMoveGroupSelect.innerHTML = '';

  if (!folderId) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '폴더를 먼저 선택하세요.';
    option.disabled = true;
    option.selected = true;
    wordMoveGroupSelect.appendChild(option);
    wordMoveGroupSelect.disabled = true;
    updateWordMoveSubmitState();
    return;
  }

  const groups = wordMoveGroupsCache.filter((group) => group.folder_id === folderId);

  if (groups.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '이 폴더에는 그룹이 없습니다.';
    option.disabled = true;
    option.selected = true;
    wordMoveGroupSelect.appendChild(option);
    wordMoveGroupSelect.disabled = true;
    updateWordMoveSubmitState();
    return;
  }

  groups
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    .forEach((group) => {
      const option = document.createElement('option');
      option.value = String(group.id);
      option.textContent = group.name;
      if (selectedGroupId && group.id === selectedGroupId) {
        option.selected = true;
      }
      wordMoveGroupSelect.appendChild(option);
    });

  wordMoveGroupSelect.disabled = false;
  if (!selectedGroupId) {
    wordMoveGroupSelect.selectedIndex = 0;
  }
  updateWordMoveSubmitState();
}

function populateGroupMoveFolderOptions(folders) {
  if (!groupMoveFolderSelect) return;
  groupMoveFolderSelect.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '이동할 폴더를 선택하세요';
  placeholder.disabled = true;
  placeholder.selected = true;
  groupMoveFolderSelect.appendChild(placeholder);

  folders.forEach((folder) => {
    const option = document.createElement('option');
    option.value = String(folder.id);
    option.textContent = folder.name;
    groupMoveFolderSelect.appendChild(option);
  });

  groupMoveFolderSelect.disabled = folders.length === 0;
  updateGroupMoveSubmitState();
}

function closeWordMoveDialog() {
  if (!wordMoveDialog) return;
  wordMoveDialog.classList.add('hidden');
  wordMoveDialog.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  wordMoveTargetWordId = null;
  wordMoveOriginalGroupId = null;
  wordMoveGroupsCache = [];
  if (wordMoveForm) {
    wordMoveForm.reset();
  }
  if (wordMoveFolderSelect) {
    wordMoveFolderSelect.innerHTML = '';
    wordMoveFolderSelect.disabled = true;
  }
  if (wordMoveGroupSelect) {
    wordMoveGroupSelect.innerHTML = '';
    wordMoveGroupSelect.disabled = true;
  }
  if (wordMoveWordLabel) {
    wordMoveWordLabel.textContent = '';
  }
  updateWordMoveSubmitState();
}

function closeGroupMoveDialog() {
  if (!groupMoveDialog) return;
  groupMoveDialog.classList.add('hidden');
  groupMoveDialog.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  groupMoveTargetGroupId = null;
  groupMoveOriginalFolderId = null;
  if (groupMoveForm) {
    groupMoveForm.reset();
  }
  if (groupMoveFolderSelect) {
    groupMoveFolderSelect.innerHTML = '';
    groupMoveFolderSelect.disabled = true;
  }
  if (groupMoveGroupLabel) {
    groupMoveGroupLabel.textContent = '';
  }
  if (groupMoveCurrentFolderLabel) {
    groupMoveCurrentFolderLabel.textContent = '';
  }
  updateGroupMoveSubmitState();
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
    updateCounts();
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
  updateCounts();
}

function renderGroups() {
  groupList.innerHTML = '';
  if (!state.activeFolderId) {
    groupList.innerHTML = '<li class="empty">왼쪽에서 폴더를 선택하세요.</li>';
    groupsSubtitle.textContent = '폴더를 선택하세요';
    state.groups = [];
    updateCounts();
    return;
  }
  groupsSubtitle.textContent = `선택한 폴더 ID: ${state.activeFolderId}`;

  if (state.groups.length === 0) {
    groupList.innerHTML = '<li class="empty">아직 그룹이 없습니다.</li>';
    updateCounts();
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
  updateCounts();
}

function renderWords() {
  wordTable.innerHTML = '';
  if (!state.activeGroupId) {
    wordTable.innerHTML = '<tr><td colspan="5">그룹을 선택하면 단어가 표시됩니다.</td></tr>';
    state.words = [];
    updateCounts();
    return;
  }
  if (state.words.length === 0) {
    wordTable.innerHTML = '<tr><td colspan="5">등록된 단어가 없습니다.</td></tr>';
    updateCounts();
    return;
  }

  state.words.forEach((word, index) => {
    const tr = document.createElement('tr');
    tr.dataset.id = word.id;
    tr.innerHTML = `
      <td class="word-number">${index + 1}</td>
      <td>${word.term}</td>
      <td>${word.meaning}</td>
      <td>
        <div class="star-cell" data-id="${word.id}">
          <button class="star-down" title="별점 낮추기" aria-label="별점 낮추기">−</button>
          <span class="star-value" aria-live="polite">${word.star}</span>
          <button class="star-up" title="별점 올리기" aria-label="별점 올리기">＋</button>
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
  updateCounts();
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
    language: '기본',
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
  const next = Math.min(MAX_STAR_RATING, Math.max(0, word.star + delta));
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
    openWordEditDialog(wordId);
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

async function openGroupMovePrompt(groupId) {
  if (!groupMoveDialog || !groupMoveForm || !groupMoveFolderSelect) {
    return;
  }

  const group = state.groups.find((g) => g.id === groupId);
  if (!group) return;

  if (!state.folders || state.folders.length === 0) {
    showToast('먼저 폴더를 만들어주세요.', 'error');
    return;
  }

  const availableFolders = state.folders.filter((folder) => folder.id !== group.folder_id);
  if (availableFolders.length === 0) {
    showToast('이동할 다른 폴더가 없습니다.', 'error');
    return;
  }

  groupMoveTargetGroupId = groupId;
  groupMoveOriginalFolderId = group.folder_id;
  if (groupMoveGroupLabel) {
    groupMoveGroupLabel.textContent = `선택한 그룹: ${group.name}`;
  }
  if (groupMoveCurrentFolderLabel) {
    groupMoveCurrentFolderLabel.textContent = `현재 폴더: ${resolveFolderName(group.folder_id)}`;
  }

  groupMoveDialog.classList.remove('hidden');
  groupMoveDialog.removeAttribute('aria-hidden');
  document.body.classList.add('modal-open');

  groupMoveFolderSelect.disabled = true;
  groupMoveFolderSelect.innerHTML = '';
  updateGroupMoveSubmitState();

  populateGroupMoveFolderOptions(availableFolders);
  groupMoveFolderSelect.disabled = false;
  updateGroupMoveSubmitState();

  setTimeout(() => {
    if (groupMoveFolderSelect) {
      groupMoveFolderSelect.focus();
    }
  }, 0);
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

function closeWordEditDialog() {
  if (!wordEditDialog) return;
  wordEditDialog.classList.add('hidden');
  wordEditDialog.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  wordEditTargetWordId = null;
  if (wordEditForm) {
    wordEditForm.reset();
  }
  if (wordEditWordLabel) {
    wordEditWordLabel.textContent = '';
  }
  updateWordEditSubmitState();
}

function openWordEditDialog(wordId) {
  if (!wordEditDialog || !wordEditForm || !wordEditTermInput || !wordEditMeaningInput) {
    return;
  }
  const word = state.words.find((w) => w.id === wordId);
  if (!word) return;

  wordEditTargetWordId = wordId;
  wordEditDialog.classList.remove('hidden');
  wordEditDialog.removeAttribute('aria-hidden');
  document.body.classList.add('modal-open');

  if (wordEditWordLabel) {
    wordEditWordLabel.textContent = `선택한 단어: ${word.term}`;
  }
  wordEditTermInput.value = word.term ?? '';
  wordEditMeaningInput.value = word.meaning ?? '';
  updateWordEditSubmitState();

  setTimeout(() => {
    if (wordEditTermInput) {
      wordEditTermInput.focus();
      wordEditTermInput.select();
    }
  }, 0);
}

async function openWordMovePrompt(wordId) {
  if (!wordMoveDialog || !wordMoveForm || !wordMoveFolderSelect || !wordMoveGroupSelect) {
    return;
  }

  const word = state.words.find((w) => w.id === wordId);
  if (!word) return;

  wordMoveTargetWordId = wordId;
  wordMoveOriginalGroupId = word.group_id;
  if (wordMoveWordLabel) {
    wordMoveWordLabel.textContent = `선택한 단어: ${word.term}`;
  }

  wordMoveDialog.classList.remove('hidden');
  wordMoveDialog.removeAttribute('aria-hidden');
  document.body.classList.add('modal-open');

  if (wordMoveFolderSelect) {
    wordMoveFolderSelect.disabled = true;
  }
  if (wordMoveGroupSelect) {
    wordMoveGroupSelect.disabled = true;
    wordMoveGroupSelect.innerHTML = '';
  }
  updateWordMoveSubmitState();

  try {
    const groups = await api('/groups');
    wordMoveGroupsCache = Array.isArray(groups) ? groups : [];
  } catch (err) {
    closeWordMoveDialog();
    showToast(err.message, 'error');
    return;
  }

  if (!wordMoveGroupsCache || wordMoveGroupsCache.length === 0) {
    closeWordMoveDialog();
    showToast('이동할 그룹이 없습니다.', 'error');
    return;
  }

  const currentGroup = wordMoveGroupsCache.find((group) => group.id === word.group_id);
  const selectedFolderId = currentGroup ? currentGroup.folder_id : null;

  populateWordMoveFolderOptions(selectedFolderId);
  if (selectedFolderId) {
    populateWordMoveGroupOptions(selectedFolderId, word.group_id);
  } else {
    populateWordMoveGroupOptions(null, null);
  }

  if (selectedFolderId) {
    wordMoveFolderSelect.value = String(selectedFolderId);
  }

  setTimeout(() => {
    if (wordMoveGroupSelect && !wordMoveGroupSelect.disabled) {
      wordMoveGroupSelect.focus();
    } else if (wordMoveFolderSelect && !wordMoveFolderSelect.disabled) {
      wordMoveFolderSelect.focus();
    }
  }, 0);
}

if (folderEditNameInput) {
  folderEditNameInput.addEventListener('input', updateFolderEditSubmitState);
}

if (folderEditCancelButton) {
  folderEditCancelButton.addEventListener('click', (event) => {
    event.preventDefault();
    closeFolderEditDialog();
  });
}

if (folderEditBackdrop) {
  folderEditBackdrop.addEventListener('click', () => {
    closeFolderEditDialog();
  });
}

if (folderEditForm) {
  folderEditForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!folderEditTargetFolderId || !folderEditNameInput) {
      return;
    }

    const name = folderEditNameInput.value.trim();
    if (!name) {
      showToast('폴더 이름을 입력하세요.', 'error');
      updateFolderEditSubmitState();
      return;
    }

    const folder = state.folders.find((f) => f.id === folderEditTargetFolderId);
    if (folder && folder.name === name) {
      closeFolderEditDialog();
      return;
    }

    if (folderEditSubmitButton) {
      folderEditSubmitButton.disabled = true;
    }

    try {
      await api(`/folders/${folderEditTargetFolderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      showToast('폴더 이름을 변경했습니다.');
      closeFolderEditDialog();
      await fetchFolders();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      if (folderEditSubmitButton) {
        folderEditSubmitButton.disabled = false;
      }
      updateFolderEditSubmitState();
    }
  });
}

if (folderEditDialog) {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !folderEditDialog.classList.contains('hidden')) {
      event.preventDefault();
      closeFolderEditDialog();
    }
  });
}

if (groupEditNameInput) {
  groupEditNameInput.addEventListener('input', updateGroupEditSubmitState);
}

if (groupEditCancelButton) {
  groupEditCancelButton.addEventListener('click', (event) => {
    event.preventDefault();
    closeGroupEditDialog();
  });
}

if (groupEditBackdrop) {
  groupEditBackdrop.addEventListener('click', () => {
    closeGroupEditDialog();
  });
}

if (groupEditForm) {
  groupEditForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!groupEditTargetGroupId || !groupEditNameInput) {
      return;
    }

    const name = groupEditNameInput.value.trim();
    if (!name) {
      showToast('그룹 이름을 입력하세요.', 'error');
      updateGroupEditSubmitState();
      return;
    }

    const group = state.groups.find((g) => g.id === groupEditTargetGroupId);
    if (group && group.name === name) {
      closeGroupEditDialog();
      return;
    }

    if (groupEditSubmitButton) {
      groupEditSubmitButton.disabled = true;
    }

    try {
      await api(`/groups/${groupEditTargetGroupId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      showToast('그룹 이름을 변경했습니다.');
      closeGroupEditDialog();
      await fetchGroups();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      if (groupEditSubmitButton) {
        groupEditSubmitButton.disabled = false;
      }
      updateGroupEditSubmitState();
    }
  });
}

if (groupEditDialog) {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !groupEditDialog.classList.contains('hidden')) {
      event.preventDefault();
      closeGroupEditDialog();
    }
  });
}

if (wordEditTermInput) {
  wordEditTermInput.addEventListener('input', updateWordEditSubmitState);
}

if (wordEditMeaningInput) {
  wordEditMeaningInput.addEventListener('input', updateWordEditSubmitState);
}

if (wordEditCancelButton) {
  wordEditCancelButton.addEventListener('click', (event) => {
    event.preventDefault();
    closeWordEditDialog();
  });
}

if (wordEditBackdrop) {
  wordEditBackdrop.addEventListener('click', () => {
    closeWordEditDialog();
  });
}

if (wordEditForm) {
  wordEditForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!wordEditTargetWordId || !wordEditTermInput || !wordEditMeaningInput) {
      return;
    }

    const term = wordEditTermInput.value.trim();
    const meaning = wordEditMeaningInput.value.trim();

    if (!term || !meaning) {
      showToast('단어와 뜻을 모두 입력하세요.', 'error');
      updateWordEditSubmitState();
      return;
    }

    if (wordEditSubmitButton) {
      wordEditSubmitButton.disabled = true;
    }

    try {
      const updated = await api(`/words/${wordEditTargetWordId}`, {
        method: 'PATCH',
        body: JSON.stringify({ term, meaning }),
      });
      const idx = state.words.findIndex((w) => w.id === wordEditTargetWordId);
      if (idx >= 0) state.words[idx] = updated;
      renderWords();
      showToast('단어를 수정했습니다.');
      closeWordEditDialog();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      if (wordEditSubmitButton) {
        wordEditSubmitButton.disabled = false;
      }
      updateWordEditSubmitState();
    }
  });
}

if (wordEditDialog) {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !wordEditDialog.classList.contains('hidden')) {
      closeWordEditDialog();
    }
  });
}

if (wordMoveCancelButton) {
  wordMoveCancelButton.addEventListener('click', (event) => {
    event.preventDefault();
    closeWordMoveDialog();
  });
}

if (wordMoveBackdrop) {
  wordMoveBackdrop.addEventListener('click', () => {
    closeWordMoveDialog();
  });
}

if (wordMoveFolderSelect) {
  wordMoveFolderSelect.addEventListener('change', () => {
    const folderValue = wordMoveFolderSelect.value;
    const folderId = Number(folderValue);
    if (!folderValue || !Number.isInteger(folderId)) {
      populateWordMoveGroupOptions(null, null);
      return;
    }
    populateWordMoveGroupOptions(folderId, null);
  });
}

if (wordMoveGroupSelect) {
  wordMoveGroupSelect.addEventListener('change', updateWordMoveSubmitState);
}

if (wordMoveForm) {
  wordMoveForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!wordMoveTargetWordId || !wordMoveGroupSelect || wordMoveGroupSelect.disabled) {
      return;
    }
    const targetValue = wordMoveGroupSelect.value;
    const targetId = Number(targetValue);
    if (!targetValue || !Number.isInteger(targetId)) {
      showToast('이동할 그룹을 선택하세요.', 'error');
      return;
    }
    if (wordMoveOriginalGroupId === targetId) {
      closeWordMoveDialog();
      return;
    }
    try {
      await api(`/words/${wordMoveTargetWordId}`, {
        method: 'PATCH',
        body: JSON.stringify({ group_id: targetId }),
      });
      showToast('단어를 다른 그룹으로 이동했습니다.');
      closeWordMoveDialog();
      await fetchWords();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

if (wordMoveDialog) {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !wordMoveDialog.classList.contains('hidden')) {
      event.preventDefault();
      closeWordMoveDialog();
    }
  });
}

if (groupMoveCancelButton) {
  groupMoveCancelButton.addEventListener('click', (event) => {
    event.preventDefault();
    closeGroupMoveDialog();
  });
}

if (groupMoveBackdrop) {
  groupMoveBackdrop.addEventListener('click', () => {
    closeGroupMoveDialog();
  });
}

if (groupMoveFolderSelect) {
  groupMoveFolderSelect.addEventListener('change', updateGroupMoveSubmitState);
}

if (groupMoveForm) {
  groupMoveForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!groupMoveTargetGroupId || !groupMoveFolderSelect || groupMoveFolderSelect.disabled) {
      return;
    }
    const targetValue = groupMoveFolderSelect.value;
    const targetId = Number(targetValue);
    if (!targetValue || !Number.isInteger(targetId)) {
      showToast('이동할 폴더를 선택하세요.', 'error');
      return;
    }
    if (targetId === groupMoveOriginalFolderId) {
      closeGroupMoveDialog();
      return;
    }

    const originalFolderId = groupMoveOriginalFolderId;

    try {
      await api(`/groups/${groupMoveTargetGroupId}`, {
        method: 'PATCH',
        body: JSON.stringify({ folder_id: targetId }),
      });
      showToast('그룹을 다른 폴더로 이동했습니다.');
      closeGroupMoveDialog();
      if (state.activeFolderId === targetId || state.activeFolderId === originalFolderId) {
        await fetchGroups();
      } else {
        await fetchFolders();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

if (groupMoveDialog) {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !groupMoveDialog.classList.contains('hidden')) {
      event.preventDefault();
      closeGroupMoveDialog();
    }
  });
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
    openFolderEditDialog(folderId);
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
    openGroupEditDialog(groupId);
  }
}

async function init() {
  await Session.ensureAuthenticated();
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
  fetchFolders();
}

document.addEventListener('DOMContentLoaded', () => {
  init().catch((error) => {
    console.error(error);
    showToast('세션을 확인하는 중 오류가 발생했습니다.', 'error');
  });
});
