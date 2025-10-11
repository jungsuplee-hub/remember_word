const PENDING_EXAM_KEY = 'remember-word:pending-exam-start';
const RETURN_MESSAGE_KEY = 'remember-word:exam-return-message';

const state = {
  folders: [],
  groups: [],
  activeFolderId: null,
  selectedGroupIds: [],
  rangeStart: null,
  rangeEnd: null,
  rangeGroupId: null,
};

const urlParams = new URLSearchParams(window.location.search);

function parseIdParam(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseGroupIds(params) {
  const ids = [];
  const seen = new Set();
  const add = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0 || seen.has(parsed)) return;
    seen.add(parsed);
    ids.push(parsed);
  };
  params.getAll('group_id').forEach((value) => add(value));
  params.getAll('group_ids').forEach((value) => {
    String(value)
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean)
      .forEach((token) => add(token));
  });
  return ids;
}

const initialFolderId = parseIdParam(urlParams.get('folder_id'));
const initialGroupIds = parseGroupIds(urlParams);

const toast = document.querySelector('#toast');
const subtitle = document.querySelector('#exam-subtitle');
const folderSelect = document.querySelector('#exam-folder');
const groupsContainer = document.querySelector('#exam-groups');
const selectAllBtn = document.querySelector('#exam-select-all');
const clearSelectionBtn = document.querySelector('#exam-clear-selection');
const form = document.querySelector('#exam-form');
const historyList = document.querySelector('#exam-history-list');
const historyEmpty = document.querySelector('#exam-history-empty');
const historyRefreshBtn = document.querySelector('#exam-history-refresh');
const historyEmptyDefaultText = historyEmpty ? historyEmpty.textContent : '아직 시험 이력이 없습니다.';
let historyLoading = false;
const userGreeting = document.querySelector('#user-greeting');
const adminLink = document.querySelector('#admin-link');
const logoutButton = document.querySelector('#logout-button');
const accountLink = document.querySelector('#account-link');
const rangeContainer = document.querySelector('#exam-range-container');
const rangeStartInput = document.querySelector('#exam-range-start');
const rangeEndInput = document.querySelector('#exam-range-end');

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

function consumeReturnMessage() {
  try {
    const raw = sessionStorage.getItem(RETURN_MESSAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(RETURN_MESSAGE_KEY);
    return raw;
  } catch (err) {
    console.error('Failed to read return message', err);
    return null;
  }
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

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const hasTimezone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value);
    const normalized = value.includes(' ') && !value.includes('T') ? value.replace(' ', 'T') : value;
    const isoCandidate = normalized.replace(/\.(\d{3})\d*(?=(?:[zZ]|[+-]\d{2}:?\d{2})?$)/, '.$1');

    const parseWith = (input) => {
      const parsed = new Date(input);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    if (!hasTimezone) {
      const base = isoCandidate;
      const candidate = base.endsWith('Z') ? base : `${base}Z`;
      const withUtc = parseWith(candidate);
      if (withUtc) {
        return withUtc;
      }
    }

    const direct = parseWith(isoCandidate);
    if (direct) {
      return direct;
    }
  }

  if (typeof value === 'number') {
    const fromNumber = new Date(value);
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
  }

  return null;
}

function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) return '날짜 정보 없음';
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function storePendingExam(payload) {
  try {
    const data = JSON.stringify({ payload, createdAt: Date.now() });
    sessionStorage.setItem(PENDING_EXAM_KEY, data);
  } catch (err) {
    console.error('Failed to store pending exam payload', err);
  }
}

function navigateToExamSession(payload) {
  storePendingExam(payload);
  window.location.href = '/static/exam-session.html';
}

function renderFolders() {
  if (!folderSelect) return;
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
  if (selectAllBtn) selectAllBtn.disabled = disabled;
  if (clearSelectionBtn) clearSelectionBtn.disabled = disabled;
  if (groupsContainer) {
    if (disabled) {
      groupsContainer.setAttribute('aria-disabled', 'true');
      groupsContainer.classList.add('is-disabled');
    } else {
      groupsContainer.removeAttribute('aria-disabled');
      groupsContainer.classList.remove('is-disabled');
    }
  }
}

function renderGroups() {
  if (!groupsContainer) return;
  groupsContainer.innerHTML = '';

  if (!state.activeFolderId) {
    const message = document.createElement('p');
    message.className = 'group-placeholder';
    message.textContent = '폴더를 먼저 선택하세요.';
    groupsContainer.appendChild(message);
    updateGroupActionButtons();
    updateRangeVisibility();
    return;
  }

  if (state.groups.length === 0) {
    const message = document.createElement('p');
    message.className = 'group-placeholder';
    message.textContent = '선택할 그룹이 없습니다.';
    groupsContainer.appendChild(message);
    updateGroupActionButtons();
    updateRangeVisibility();
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
  updateRangeVisibility();
}

function getSelectedGroupNames() {
  if (!state.selectedGroupIds.length) return [];
  const nameById = new Map(state.groups.map((group) => [group.id, group.name]));
  return state.selectedGroupIds
    .map((id) => nameById.get(id))
    .filter((name) => typeof name === 'string' && name.trim().length);
}

function updateSubtitle() {
  if (!subtitle) return;
  if (!state.activeFolderId || !state.selectedGroupIds.length) {
    subtitle.textContent = '폴더와 그룹을 선택한 뒤 시험을 시작하세요.';
    return;
  }
  const names = getSelectedGroupNames();
  if (names.length) {
    subtitle.textContent = `선택한 그룹: ${names.join(', ')}`;
  } else {
    subtitle.textContent = '선택한 그룹 정보를 불러오지 못했습니다.';
  }
}

function handleFolderChange(event) {
  const folderId = Number(event.target.value) || null;
  state.activeFolderId = folderId;
  state.selectedGroupIds = [];
  state.rangeStart = null;
  state.rangeEnd = null;
  state.rangeGroupId = null;
  fetchGroups(folderId);
}

function handleGroupSelectionChange() {
  if (!groupsContainer) return;
  if (!state.groups.length) {
    state.selectedGroupIds = [];
  } else {
    const checkboxes = groupsContainer.querySelectorAll('input[type="checkbox"]');
    state.selectedGroupIds = Array.from(checkboxes)
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => Number(checkbox.value));
  }
  updateSubtitle();
  updateRangeVisibility();
}

function handleSelectAllGroups() {
  if (!state.groups.length) return;
  state.selectedGroupIds = state.groups.map((group) => group.id);
  renderGroups();
  updateSubtitle();
}

function handleClearGroupSelection() {
  state.selectedGroupIds = [];
  state.rangeStart = null;
  state.rangeEnd = null;
  state.rangeGroupId = null;
  renderGroups();
  updateSubtitle();
}

async function fetchFolders() {
  try {
    const data = await api('/folders');
    state.folders = Array.isArray(data) ? data : [];
    if (!state.folders.find((folder) => folder.id === state.activeFolderId)) {
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
    state.rangeStart = null;
    state.rangeEnd = null;
    state.rangeGroupId = null;
    renderGroups();
    updateSubtitle();
    return;
  }
  try {
    const data = await api(`/groups?folder_id=${folderId}`);
    state.groups = Array.isArray(data) ? data : [];
    const availableIds = state.groups.map((group) => group.id);
    const preserved = state.selectedGroupIds.filter((id) => availableIds.includes(id));
    state.selectedGroupIds = preserved;
    if (preserved.length !== 1) {
      state.rangeStart = null;
      state.rangeEnd = null;
      state.rangeGroupId = preserved.length === 1 ? preserved[0] : null;
    }
    renderGroups();
    updateSubtitle();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function buildStartPayload(formData) {
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
  if (selectedIds.length === 1) {
    const start = parseRangeForRequest(state.rangeStart);
    const end = parseRangeForRequest(state.rangeEnd);
    if (start != null) payload.number_start = start;
    if (end != null) payload.number_end = end;
  }
  return payload;
}

function parseRangeForRequest(value) {
  if (value == null) return null;
  if (!Number.isInteger(value)) return null;
  if (value <= 0) return null;
  return value;
}

function validateRangeState() {
  const start = state.rangeStart;
  const end = state.rangeEnd;

  if (start != null && (!Number.isInteger(start) || start <= 0)) {
    return { valid: false, message: '시작 번호는 1 이상의 정수로 입력하세요.' };
  }

  if (end != null && (!Number.isInteger(end) || end <= 0)) {
    return { valid: false, message: '끝 번호는 1 이상의 정수로 입력하세요.' };
  }

  if (start == null && end == null) {
    return { valid: true };
  }

  const normalizedStart = start ?? 1;
  const normalizedEnd = end ?? Number.MAX_SAFE_INTEGER;

  if (normalizedStart > normalizedEnd) {
    return { valid: false, message: '시작 번호는 끝 번호보다 클 수 없습니다.' };
  }

  return { valid: true };
}

function resetRangeInputs() {
  if (rangeStartInput) rangeStartInput.value = '';
  if (rangeEndInput) rangeEndInput.value = '';
}

function updateRangeVisibility() {
  if (!rangeContainer || !rangeStartInput || !rangeEndInput) return;
  const singleGroupSelected = state.selectedGroupIds.length === 1;

  if (singleGroupSelected) {
    const groupId = state.selectedGroupIds[0];
    const isDifferentGroup = state.rangeGroupId !== groupId;
    if (isDifferentGroup) {
      state.rangeStart = null;
      state.rangeEnd = null;
      state.rangeGroupId = groupId;
    }
    rangeContainer.hidden = false;
    rangeStartInput.disabled = false;
    rangeEndInput.disabled = false;
    rangeStartInput.value = state.rangeStart != null ? String(state.rangeStart) : '';
    rangeEndInput.value = state.rangeEnd != null ? String(state.rangeEnd) : '';
  } else {
    rangeContainer.hidden = true;
    rangeStartInput.disabled = true;
    rangeEndInput.disabled = true;
    resetRangeInputs();
    state.rangeStart = null;
    state.rangeEnd = null;
    state.rangeGroupId = null;
  }
}

function handleRangeInput(event) {
  if (!event?.target) return;
  const raw = event.target.value.trim();
  const parsed = raw ? Number(raw) : null;
  const normalized = Number.isFinite(parsed) ? parsed : null;

  if (event.target === rangeStartInput) {
    state.rangeStart = normalized;
  } else if (event.target === rangeEndInput) {
    state.rangeEnd = normalized;
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
  if (state.selectedGroupIds.length === 1) {
    const { valid, message } = validateRangeState();
    if (!valid) {
      showToast(message, 'error');
      return;
    }
  }
  const formData = new FormData(event.currentTarget);
  const payload = buildStartPayload(formData);
  navigateToExamSession(payload);
}

async function retakeExamFromHistory(item) {
  if (!item) {
    showToast('시험 정보를 찾을 수 없습니다.', 'error');
    return;
  }
  if (state.activeFolderId && state.activeFolderId !== Number(item.folder_id)) {
    // ensure latest folder data is loaded for subtitle when returning later
    state.activeFolderId = Number(item.folder_id) || null;
  }
  const folderId = Number(item.folder_id);
  if (!Number.isInteger(folderId) || folderId <= 0) {
    showToast('폴더 정보를 찾을 수 없습니다.', 'error');
    return;
  }
  const rawGroupIds = Array.isArray(item.group_ids) ? item.group_ids : [];
  const groupIds = Array.from(new Set(rawGroupIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)));
  if (!groupIds.length) {
    showToast('시험에 필요한 그룹 정보를 찾을 수 없습니다.', 'error');
    return;
  }
  const payload = {
    folder_id: folderId,
    group_id: groupIds[0],
    group_ids: groupIds,
    random: item.random !== false,
    direction: item.direction || 'term_to_meaning',
    mode: item.mode || 'exam',
  };
  if (item.limit != null) {
    const value = Number(item.limit);
    if (Number.isInteger(value)) payload.limit = value;
  }
  if (item.min_star != null) {
    const value = Number(item.min_star);
    if (Number.isInteger(value)) payload.min_star = value;
  }
  if (Array.isArray(item.star_values) && item.star_values.length) {
    const values = item.star_values
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value));
    if (values.length) {
      payload.star_values = values;
    }
  }
  navigateToExamSession(payload);
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
    const safeScore = Number.isFinite(scoreValue) ? scoreValue : computeScore(Number(item.correct) || 0, Number(item.total) || 0);
    scoreEl.textContent = `${formatScore(safeScore)}점`;

    header.appendChild(badge);
    header.appendChild(scoreEl);

    const meta = document.createElement('p');
    meta.className = 'exam-history-item-meta';
    const folderName = item.folder_name || '폴더 정보 없음';
    meta.textContent = `${formatDateTime(item.created_at)} · ${folderName}`;

    const groupsEl = document.createElement('p');
    groupsEl.className = 'exam-history-item-groups';
    const groups = Array.isArray(item.group_names) && item.group_names.length ? item.group_names.join(', ') : '그룹 정보 없음';
    groupsEl.textContent = `그룹: ${groups}`;

    const stats = document.createElement('p');
    stats.className = 'exam-history-item-stats';
    const total = Number(item.total) || 0;
    const incorrect = Number(item.incorrect) || Math.max(0, total - (Number(item.correct) || 0));
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

async function init() {
  await Session.ensureAuthenticated();
  if (initialFolderId) {
    state.activeFolderId = initialFolderId;
  }
  if (initialGroupIds.length) {
    state.selectedGroupIds = [...initialGroupIds];
  }
  if (form) {
    form.addEventListener('submit', handleStart);
  }
  if (folderSelect) {
    folderSelect.addEventListener('change', handleFolderChange);
  }
  if (groupsContainer) {
    groupsContainer.addEventListener('change', handleGroupSelectionChange);
  }
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', handleSelectAllGroups);
  }
  if (clearSelectionBtn) {
    clearSelectionBtn.addEventListener('click', handleClearGroupSelection);
  }
  if (rangeStartInput) {
    rangeStartInput.addEventListener('input', handleRangeInput);
  }
  if (rangeEndInput) {
    rangeEndInput.addEventListener('input', handleRangeInput);
  }
  if (historyRefreshBtn) {
    historyRefreshBtn.addEventListener('click', () => fetchHistory());
  }
  const returnMessage = consumeReturnMessage();
  if (returnMessage) {
    showToast(returnMessage);
  }
  await fetchFolders();
  if (window.location.search) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  await fetchHistory();
  updateSubtitle();
}

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
