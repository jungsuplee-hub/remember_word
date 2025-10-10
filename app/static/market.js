const state = {
  languages: [],
  folders: [],
  groups: [],
  activeLanguage: '',
  activeFolderId: null,
  selectedGroupIds: new Set(),
};

const languageSelect = document.querySelector('#market-language');
const languageSummary = document.querySelector('#market-language-summary');
const folderList = document.querySelector('#market-folders');
const groupContainer = document.querySelector('#market-groups');
const importButton = document.querySelector('#market-import');
const selectionSummary = document.querySelector('#market-selection-summary');
const folderCount = document.querySelector('#market-folder-count');
const groupCount = document.querySelector('#market-group-count');
const refreshButton = document.querySelector('#market-refresh');
const toast = document.querySelector('#toast');
const logoutButton = document.querySelector('#logout-button');
const accountLink = document.querySelector('#account-link');
const adminLink = document.querySelector('#admin-link');
const userGreeting = document.querySelector('#user-greeting');

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
      // ignore
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

function updateCounts() {
  if (folderCount) {
    folderCount.textContent = state.folders.length;
  }
  if (groupCount) {
    groupCount.textContent = state.groups.length;
  }
}

function updateLanguageSummary() {
  if (!languageSummary) return;
  if (!state.activeLanguage) {
    languageSummary.textContent = '기본 언어를 선택하면 해당 언어의 공유 폴더가 나타납니다.';
    return;
  }
  const stats = state.languages.find((item) => item.language === state.activeLanguage);
  if (!stats) {
    languageSummary.textContent = `${state.activeLanguage} 언어의 공유 폴더 정보를 불러올 수 없습니다.`;
    return;
  }
  languageSummary.textContent = `${state.activeLanguage} · 폴더 ${stats.folder_count}개, 그룹 ${stats.group_count}개`;
}

function renderLanguageOptions() {
  if (!languageSelect) return;
  const previousValue = state.activeLanguage;
  languageSelect.innerHTML = '';
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = '기본 언어를 선택하세요';
  defaultOption.disabled = true;
  defaultOption.selected = !previousValue;
  languageSelect.appendChild(defaultOption);

  state.languages.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.language;
    option.textContent = `${item.language} (${item.folder_count}개 폴더)`;
    if (item.language === previousValue) {
      option.selected = true;
    }
    languageSelect.appendChild(option);
  });
}

function renderFolders() {
  if (!folderList) return;
  folderList.innerHTML = '';

  if (!state.activeLanguage) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = '먼저 기본 언어를 선택하세요.';
    folderList.appendChild(li);
    state.folders = [];
    state.activeFolderId = null;
    updateCounts();
    return;
  }

  if (state.folders.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = '선택한 기본 언어에 공유 폴더가 없습니다.';
    folderList.appendChild(li);
    state.activeFolderId = null;
    updateCounts();
    return;
  }

  state.folders.forEach((folder) => {
    const li = document.createElement('li');
    li.dataset.id = String(folder.id);
    li.classList.toggle('active', state.activeFolderId === folder.id);
    li.innerHTML = `
      <span class="name">${folder.name}</span>
      <span class="meta">${folder.group_count.toLocaleString()}개 그룹</span>
    `;
    li.addEventListener('click', () => {
      if (state.activeFolderId === folder.id) return;
      state.activeFolderId = folder.id;
      state.selectedGroupIds.clear();
      renderFolders();
      renderGroups();
      fetchGroups();
    });
    folderList.appendChild(li);
  });
  updateCounts();
}

function renderGroups() {
  if (!groupContainer) return;
  groupContainer.innerHTML = '';
  const hasFolder = Boolean(state.activeFolderId);

  if (!hasFolder) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = '폴더를 선택하면 그룹이 표시됩니다.';
    groupContainer.appendChild(p);
    state.groups = [];
    updateCounts();
    updateSelectionSummary();
    if (importButton) {
      importButton.disabled = true;
    }
    return;
  }

  if (state.groups.length === 0) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = '이 폴더에는 아직 가져올 그룹이 없습니다.';
    groupContainer.appendChild(p);
    updateCounts();
    updateSelectionSummary();
    if (importButton) {
      importButton.disabled = true;
    }
    return;
  }

  state.groups.forEach((group) => {
    const label = document.createElement('label');
    label.className = 'market-group-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = String(group.id);
    checkbox.checked = state.selectedGroupIds.has(group.id);
    checkbox.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      const groupId = Number(target.value);
      if (target.checked) {
        state.selectedGroupIds.add(groupId);
      } else {
        state.selectedGroupIds.delete(groupId);
      }
      updateSelectionSummary();
    });

    const nameSpan = document.createElement('span');
    nameSpan.className = 'market-group-name';
    nameSpan.textContent = group.name;

    const countSpan = document.createElement('span');
    countSpan.className = 'market-group-count';
    countSpan.textContent = `${group.word_count.toLocaleString()} 단어`;

    label.appendChild(checkbox);
    label.appendChild(nameSpan);
    label.appendChild(countSpan);

    groupContainer.appendChild(label);
  });
  updateCounts();
  updateSelectionSummary();
}

function updateSelectionSummary() {
  if (!selectionSummary) return;
  const selectedGroups = state.groups.filter((group) => state.selectedGroupIds.has(group.id));
  const groupTotal = selectedGroups.length;
  const wordTotal = selectedGroups.reduce((sum, group) => sum + (group.word_count || 0), 0);

  if (groupTotal === 0) {
    selectionSummary.textContent = '가져올 그룹을 선택하세요.';
    if (importButton) {
      importButton.disabled = true;
    }
    return;
  }

  selectionSummary.textContent = `선택한 그룹 ${groupTotal}개 · 예상 단어 ${wordTotal.toLocaleString()}개`;
  if (importButton) {
    importButton.disabled = false;
  }
}

async function fetchLanguages() {
  try {
    const data = await api('/market/languages');
    state.languages = data || [];
    const hasActive = state.activeLanguage
      && state.languages.some((item) => item.language === state.activeLanguage);
    if (!hasActive) {
      state.activeLanguage = '';
      state.folders = [];
      state.groups = [];
      state.selectedGroupIds.clear();
    }
    if (!state.activeLanguage && state.languages.length === 1) {
      state.activeLanguage = state.languages[0].language;
    }
    renderLanguageOptions();
    if (languageSelect) {
      languageSelect.value = state.activeLanguage || '';
    }
    updateLanguageSummary();
    if (state.activeLanguage) {
      await fetchFolders();
    } else {
      renderFolders();
      renderGroups();
      updateCounts();
    }
  } catch (error) {
    console.error(error);
    showToast(error.message, 'error');
  }
}

async function fetchFolders() {
  if (!state.activeLanguage) {
    state.folders = [];
    state.groups = [];
    state.activeFolderId = null;
    state.selectedGroupIds.clear();
    renderFolders();
    renderGroups();
    updateCounts();
    return;
  }

  try {
    const params = new URLSearchParams({ language: state.activeLanguage });
    const data = await api(`/market/folders?${params}`);
    state.folders = data || [];
    state.groups = [];
    state.activeFolderId = null;
    state.selectedGroupIds.clear();
    renderFolders();
    renderGroups();
    updateCounts();
  } catch (error) {
    console.error(error);
    showToast(error.message, 'error');
  }
}

async function fetchGroups() {
  if (!state.activeFolderId) {
    state.groups = [];
    renderGroups();
    return;
  }
  try {
    const params = new URLSearchParams({ folder_id: String(state.activeFolderId) });
    const data = await api(`/market/groups?${params}`);
    state.groups = data || [];
    state.selectedGroupIds.clear();
    renderGroups();
  } catch (error) {
    console.error(error);
    showToast(error.message, 'error');
  }
}

async function handleImport() {
  if (!state.activeFolderId || state.selectedGroupIds.size === 0) return;
  if (importButton) {
    importButton.disabled = true;
  }
  try {
    const payload = {
      folder_id: state.activeFolderId,
      group_ids: Array.from(state.selectedGroupIds),
    };
    const summary = await api('/market/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    showToast(
      `가져오기 완료: 새 그룹 ${summary.created_groups}개, 단어 ${summary.imported_words}개 추가`,
    );
    state.selectedGroupIds.clear();
    updateSelectionSummary();
  } catch (error) {
    console.error(error);
    showToast(error.message, 'error');
  } finally {
    if (state.selectedGroupIds.size > 0 && importButton) {
      importButton.disabled = false;
    }
  }
}

async function init() {
  try {
    await Session.ensureAuthenticated();
  } catch (error) {
    if (error.message !== 'unauthenticated') {
      console.error(error);
      showToast(error.message, 'error');
    }
    return;
  }

  if (languageSelect) {
    languageSelect.addEventListener('change', (event) => {
      state.activeLanguage = event.target.value;
      updateLanguageSummary();
      fetchFolders();
    });
  }

  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      fetchLanguages();
    });
  }

  if (importButton) {
    importButton.addEventListener('click', handleImport);
  }

  await fetchLanguages();
}

init();
