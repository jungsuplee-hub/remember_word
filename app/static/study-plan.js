const today = new Date();
const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

const state = {
  currentMonth: new Date(today.getFullYear(), today.getMonth(), 1),
  selectedDate: null,
  plansByDate: new Map(),
  memosByDate: new Map(),
  memoDrafts: new Map(),
  memoLoadedDates: new Set(),
  memoLoadingDates: new Set(),
  memoSavingDates: new Set(),
  folders: [],
  groupsByFolder: new Map(),
  activeFolderId: null,
  draggingPlan: null,
  isPlanModalOpen: false,
  timezoneOffset: new Date().getTimezoneOffset(),
};

const touchDrag = {
  active: false,
  sourceEl: null,
  dropTarget: null,
  timeoutId: null,
  started: false,
  planId: null,
  dateIso: null,
  startX: 0,
  startY: 0,
};

const userGreeting = document.querySelector('#user-greeting');
const logoutButton = document.querySelector('#logout-button');
const adminLink = document.querySelector('#admin-link');
const accountLink = document.querySelector('#account-link');
const monthLabel = document.querySelector('#plan-month-label');
const prevMonthBtn = document.querySelector('#plan-prev-month');
const nextMonthBtn = document.querySelector('#plan-next-month');
const calendarGrid = document.querySelector('#study-plan-calendar');
const detailTitle = document.querySelector('#plan-detail-title');
const detailSubtitle = document.querySelector('#plan-detail-subtitle');
const detailList = document.querySelector('#plan-detail-list');
const detailEmpty = document.querySelector('#plan-detail-empty');
const clearDayButton = document.querySelector('#plan-clear-day');
const folderSelect = document.querySelector('#plan-folder-select');
const groupSelect = document.querySelector('#plan-group-select');
const planForm = document.querySelector('#plan-form');
const planSubmitButton = planForm?.querySelector('button[type="submit"]') || null;
const planMemoSection = document.querySelector('#plan-memo-section');
const planMemoForm = document.querySelector('#plan-memo-form');
const planMemoTextarea = document.querySelector('#plan-memo-text');
const planMemoSaveButton = document.querySelector('#plan-memo-save');
const planMemoClearButton = document.querySelector('#plan-memo-clear');
const planMemoFeedback = document.querySelector('#plan-memo-feedback');
const toast = document.querySelector('#toast');
const planModal = document.querySelector('#plan-modal');
const planModalDialog = planModal?.querySelector('.plan-modal-dialog') || null;
let lastFocusedElement = null;

function setBodyModalState(open) {
  if (open) {
    document.body.classList.add('plan-modal-open');
  } else {
    document.body.classList.remove('plan-modal-open');
  }
}

function openPlanModal() {
  if (!planModal || !planModalDialog || !state.selectedDate) return;
  lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  planModal.hidden = false;
  planModal.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => {
    planModal.classList.add('visible');
  });
  state.isPlanModalOpen = true;
  setBodyModalState(true);
  const selectedButton = calendarGrid?.querySelector(`.calendar-day[data-date="${state.selectedDate}"]`);
  if (selectedButton) {
    selectedButton.setAttribute('aria-expanded', 'true');
  }
  requestAnimationFrame(() => {
    planModalDialog.focus();
  });
}

function closePlanModal() {
  if (!planModal) return;
  planModal.classList.remove('visible');
  planModal.setAttribute('aria-hidden', 'true');
  state.isPlanModalOpen = false;
  setBodyModalState(false);
  const selectedButton = calendarGrid?.querySelector(`.calendar-day[data-date="${state.selectedDate}"]`);
  if (selectedButton) {
    selectedButton.setAttribute('aria-expanded', 'false');
  }
  setTimeout(() => {
    if (!state.isPlanModalOpen) {
      planModal.hidden = true;
    }
  }, 200);
  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    lastFocusedElement.focus();
  }
  lastFocusedElement = null;
}

function formatISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseISODate(iso) {
  if (!iso) return null;
  const [year, month, day] = iso.split('-').map((value) => Number(value));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function formatMonthLabel(date) {
  return `${date.getFullYear()}년 ${String(date.getMonth() + 1).padStart(2, '0')}월`;
}

function formatKoreanDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}년 ${month}월 ${day}일`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function isSameMonth(dateA, dateB) {
  return dateA.getFullYear() === dateB.getFullYear() && dateA.getMonth() === dateB.getMonth();
}

function isOnOrBeforeToday(date) {
  if (!(date instanceof Date)) {
    return false;
  }
  const comparable = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return comparable.getTime() <= todayStart.getTime();
}

function showToast(message, type = 'info') {
  if (!toast) return;
  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
}

function normalizeMemoValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') return String(value);
  return value.replace(/\r\n/g, '\n');
}

function getSavedMemo(dateIso) {
  if (!dateIso) return '';
  if (!state.memosByDate.has(dateIso)) return '';
  return normalizeMemoValue(state.memosByDate.get(dateIso));
}

function getDraftMemo(dateIso) {
  if (!dateIso) return '';
  if (state.memoDrafts.has(dateIso)) {
    return normalizeMemoValue(state.memoDrafts.get(dateIso));
  }
  return getSavedMemo(dateIso);
}

function setDraftMemo(dateIso, value) {
  if (!dateIso) return;
  state.memoDrafts.set(dateIso, normalizeMemoValue(value));
}

function setSavedMemo(dateIso, value, { markLoaded = true } = {}) {
  if (!dateIso) return;
  const normalized = normalizeMemoValue(value);
  const previousSaved = getSavedMemo(dateIso);
  const hadDraft = state.memoDrafts.has(dateIso);
  const draftBefore = hadDraft
    ? normalizeMemoValue(state.memoDrafts.get(dateIso))
    : previousSaved;
  const wasDirty = hadDraft ? draftBefore !== previousSaved : false;

  state.memosByDate.set(dateIso, normalized);
  if (markLoaded) {
    state.memoLoadedDates.add(dateIso);
  }

  if (!wasDirty) {
    state.memoDrafts.set(dateIso, normalized);
    if (state.selectedDate === dateIso && planMemoTextarea && planMemoTextarea.value !== normalized) {
      planMemoTextarea.value = normalized;
    }
  }

  if (state.selectedDate === dateIso) {
    updateMemoControls();
  }
}

function isMemoDirty(dateIso) {
  if (!dateIso) return false;
  return getDraftMemo(dateIso) !== getSavedMemo(dateIso);
}

function updateMemoControls() {
  if (!planMemoTextarea || !planMemoSaveButton) return;
  const iso = state.selectedDate;
  if (!iso) {
    planMemoTextarea.value = '';
    planMemoTextarea.disabled = true;
    planMemoTextarea.placeholder = '날짜를 선택하면 메모를 작성할 수 있습니다.';
    planMemoSaveButton.disabled = true;
    planMemoSaveButton.textContent = '메모 저장';
    if (planMemoClearButton) {
      planMemoClearButton.disabled = true;
    }
    if (planMemoFeedback) {
      planMemoFeedback.textContent = '날짜를 선택하세요.';
    }
    if (planMemoSection) {
      planMemoSection.classList.add('is-disabled');
    }
    return;
  }

  const loading = state.memoLoadingDates.has(iso);
  const saving = state.memoSavingDates.has(iso);
  const busy = loading || saving;
  const draft = getDraftMemo(iso);
  const savedMemo = getSavedMemo(iso);
  const dirty = isMemoDirty(iso);

  if (planMemoTextarea.value !== draft) {
    planMemoTextarea.value = draft;
  }
  planMemoTextarea.disabled = loading;
  planMemoTextarea.placeholder = '선택한 날짜에 대한 메모를 입력하세요.';

  planMemoSaveButton.disabled = !dirty || saving;
  planMemoSaveButton.textContent = saving ? '저장 중...' : '메모 저장';

  if (planMemoClearButton) {
    planMemoClearButton.disabled = busy || (!draft && !savedMemo);
  }

  if (planMemoFeedback) {
    if (loading) {
      planMemoFeedback.textContent = '메모를 불러오는 중입니다...';
    } else if (saving) {
      planMemoFeedback.textContent = '메모를 저장하는 중입니다...';
    } else if (dirty) {
      planMemoFeedback.textContent = '저장되지 않은 변경사항이 있습니다.';
    } else if (savedMemo) {
      planMemoFeedback.textContent = '메모가 저장되어 있습니다.';
    } else {
      planMemoFeedback.textContent = '메모가 비어 있습니다.';
    }
  }

  if (planMemoSection) {
    planMemoSection.classList.toggle('is-disabled', loading);
  }
}

async function fetchMemoForDate(dateIso) {
  if (!dateIso || state.memoLoadingDates.has(dateIso)) return;
  state.memoLoadingDates.add(dateIso);
  updateMemoControls();
  try {
    const data = await api(`/study-plans/memo/${dateIso}`);
    const memoText = data && Object.prototype.hasOwnProperty.call(data, 'memo') ? data.memo : null;
    setSavedMemo(dateIso, memoText, { markLoaded: true });
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    state.memoLoadingDates.delete(dateIso);
    if (state.selectedDate === dateIso) {
      updateMemoControls();
    }
  }
}

function ensureMemoLoaded(dateIso) {
  if (!dateIso) {
    updateMemoControls();
    return;
  }
  if (state.memoLoadedDates.has(dateIso)) {
    updateMemoControls();
    return;
  }
  fetchMemoForDate(dateIso);
}

async function saveMemoForSelectedDate() {
  const iso = state.selectedDate;
  if (!iso) return;
  if (!planMemoTextarea) return;
  if (!isMemoDirty(iso)) {
    showToast('변경된 내용이 없습니다.', 'info');
    return;
  }
  const payload = { memo: getDraftMemo(iso) };
  state.memoSavingDates.add(iso);
  updateMemoControls();
  try {
    const result = await api(`/study-plans/memo/${iso}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    const memoText = result && Object.prototype.hasOwnProperty.call(result, 'memo') ? result.memo : null;
    setSavedMemo(iso, memoText, { markLoaded: true });
    showToast(memoText ? '메모를 저장했어요.' : '메모를 비웠습니다.', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    state.memoSavingDates.delete(iso);
    updateMemoControls();
  }
}

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

function sortPlans(plans) {
  return [...plans].sort((a, b) => {
    if (a.folder_name === b.folder_name) {
      return a.group_name.localeCompare(b.group_name, 'ko');
    }
    return a.folder_name.localeCompare(b.folder_name, 'ko');
  });
}

function getPlansForDate(iso) {
  if (!iso) return [];
  return state.plansByDate.get(iso) ? [...state.plansByDate.get(iso)] : [];
}

function setPlansForDate(iso, plans) {
  if (!iso) return;
  if (!plans.length) {
    state.plansByDate.delete(iso);
    return;
  }
  state.plansByDate.set(iso, sortPlans(plans));
}

function getDayCompletionStatus(plans) {
  if (!Array.isArray(plans) || !plans.length) {
    return null;
  }
  const total = plans.length;
  const completed = plans.reduce((count, plan) => (plan?.is_completed ? count + 1 : count), 0);
  if (completed === total) {
    return 'completed';
  }
  return 'pending';
}

function createCalendarChip(plan, dateIso, totalCount, plans) {
  const chip = document.createElement('div');
  chip.className = 'calendar-plan-chip';
  chip.draggable = true;
  chip.dataset.planId = String(plan.id);
  chip.dataset.date = dateIso;
  chip.textContent = totalCount > 1
    ? `${plan.folder_name} ${plan.group_name} 등 ${totalCount}개`
    : `${plan.folder_name} ${plan.group_name}`;

  if (totalCount > 1 && Array.isArray(plans)) {
    const rest = plans
      .slice(1)
      .map((item) => `${item.folder_name} ${item.group_name}`)
      .join(', ');
    chip.title = rest ? `추가 그룹: ${rest}` : chip.textContent;
    chip.classList.add('is-summary');
  }
  chip.addEventListener('dragstart', handlePlanDragStart);
  chip.addEventListener('dragend', handlePlanDragEnd);
  chip.addEventListener('touchstart', handlePlanTouchStart, { passive: false });
  return chip;
}

function renderCalendar() {
  if (!calendarGrid) return;
  calendarGrid.innerHTML = '';
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  weekdays.forEach((weekday) => {
    const header = document.createElement('div');
    header.className = 'calendar-weekday';
    header.textContent = weekday;
    calendarGrid.appendChild(header);
  });

  const monthStart = startOfMonth(state.currentMonth);
  const monthEnd = endOfMonth(state.currentMonth);
  const rangeStart = addDays(monthStart, -monthStart.getDay());
  const rangeEnd = addDays(monthEnd, 6 - monthEnd.getDay());

  for (let day = new Date(rangeStart); day <= rangeEnd; day.setDate(day.getDate() + 1)) {
    const current = new Date(day);
    const iso = formatISODate(current);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'calendar-day';
    button.dataset.date = iso;
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-controls', 'plan-modal');

    const weekday = current.getDay();
    if (weekday === 0 || weekday === 6) {
      button.classList.add('is-weekend');
    }

    if (!isSameMonth(current, state.currentMonth)) {
      button.classList.add('is-outside');
    }
    const isSelected = iso === state.selectedDate;
    if (isSelected) {
      button.classList.add('is-selected');
    }
    button.setAttribute('aria-expanded', state.isPlanModalOpen && isSelected ? 'true' : 'false');

    const dateLabel = document.createElement('span');
    dateLabel.className = 'calendar-date';
    dateLabel.textContent = String(current.getDate());
    button.appendChild(dateLabel);

    const plans = getPlansForDate(iso);
    const dayStatus = getDayCompletionStatus(plans);
    if (dayStatus === 'completed') {
      button.classList.add('is-completed');
    } else if (dayStatus === 'pending' && isOnOrBeforeToday(current)) {
      button.classList.add('is-pending');
    }
    if (plans.length) {
      const container = document.createElement('div');
      container.className = 'calendar-plans';
      container.appendChild(createCalendarChip(plans[0], iso, plans.length, plans));
      button.appendChild(container);
    }

    button.addEventListener('click', () => selectDate(iso));
    button.addEventListener('dragenter', handleDayDragEnter);
    button.addEventListener('dragover', handleDayDragOver);
    button.addEventListener('dragleave', handleDayDragLeave);
    button.addEventListener('drop', handleDayDrop);

    calendarGrid.appendChild(button);
  }
}

function createDetailListItem(plan) {
  const item = document.createElement('li');
  item.className = 'plan-detail-item';
  item.dataset.planId = String(plan.id);
  item.dataset.date = plan.study_date;
  item.draggable = true;

  const info = document.createElement('div');
  info.className = 'plan-detail-info';
  info.innerHTML = `
    <span class="plan-detail-folder">${plan.folder_name}</span>
    <span class="plan-detail-group">${plan.group_name}</span>
  `;

  const actions = document.createElement('div');
  actions.className = 'plan-detail-actions';

  const memorizeBtn = document.createElement('button');
  memorizeBtn.type = 'button';
  memorizeBtn.className = 'secondary';
  memorizeBtn.dataset.action = 'memorize';
  memorizeBtn.dataset.folderId = String(plan.folder_id);
  memorizeBtn.dataset.groupId = String(plan.group_id);
  memorizeBtn.textContent = '암기하기';

  const examBtn = document.createElement('button');
  examBtn.type = 'button';
  examBtn.className = 'primary';
  examBtn.dataset.action = 'exam';
  examBtn.dataset.folderId = String(plan.folder_id);
  examBtn.dataset.groupId = String(plan.group_id);
  examBtn.textContent = '시험보기';

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'danger-outline';
  removeBtn.dataset.action = 'remove';
  removeBtn.dataset.planId = String(plan.id);
  removeBtn.textContent = '삭제';

  const changeBtn = document.createElement('button');
  changeBtn.type = 'button';
  changeBtn.className = 'secondary';
  changeBtn.dataset.action = 'change';
  changeBtn.dataset.planId = String(plan.id);
  changeBtn.dataset.planDate = plan.study_date;
  changeBtn.textContent = '변경';

  actions.appendChild(memorizeBtn);
  actions.appendChild(examBtn);
  actions.appendChild(changeBtn);
  actions.appendChild(removeBtn);

  item.appendChild(info);
  item.appendChild(actions);

  item.addEventListener('dragstart', handlePlanDragStart);
  item.addEventListener('dragend', handlePlanDragEnd);
  item.addEventListener('touchstart', handlePlanTouchStart, { passive: false });

  return item;
}

function updatePlanSubmitState() {
  if (!planSubmitButton) return;
  const hasDate = Boolean(state.selectedDate);
  const hasSelection = groupSelect && Array.from(groupSelect.selectedOptions).some((option) => option.value);
  planSubmitButton.disabled = !(hasDate && hasSelection);
}

function refreshGroupAvailability() {
  if (!groupSelect) return;
  const selectedPlans = new Set(getPlansForDate(state.selectedDate).map((plan) => plan.group_id));
  Array.from(groupSelect.options).forEach((option) => {
    if (!option.value) return;
    const id = Number(option.value);
    const already = selectedPlans.has(id);
    option.disabled = already;
    option.classList.toggle('is-disabled', already);
    if (already && option.selected) {
      option.selected = false;
    }
  });
  updatePlanSubmitState();
}

function renderDetail() {
  if (!detailTitle || !detailSubtitle) return;
  const selectedDate = state.selectedDate ? parseISODate(state.selectedDate) : null;
  if (!selectedDate) {
    detailTitle.textContent = '날짜를 선택하세요';
    detailSubtitle.textContent = '계획할 날짜를 선택하면 그룹을 추가하거나 삭제할 수 있습니다.';
    if (detailList) detailList.innerHTML = '';
    if (detailList) detailList.hidden = true;
    if (detailEmpty) detailEmpty.hidden = false;
    if (clearDayButton) {
      clearDayButton.disabled = true;
    }
    refreshGroupAvailability();
    updateMemoControls();
    return;
  }

  detailTitle.textContent = `${formatKoreanDate(selectedDate)} 학습 계획`;
  const plans = getPlansForDate(state.selectedDate);
  if (!plans.length) {
    detailSubtitle.textContent = '아직 학습 계획이 없습니다. 그룹을 추가해보세요.';
    if (detailList) {
      detailList.innerHTML = '';
      detailList.hidden = true;
    }
    if (detailEmpty) {
      detailEmpty.hidden = false;
    }
    if (clearDayButton) {
      clearDayButton.disabled = true;
    }
  } else {
    detailSubtitle.textContent = `총 ${plans.length}개의 그룹이 예정되어 있습니다.`;
    if (detailList) {
      detailList.innerHTML = '';
      plans.forEach((plan) => detailList.appendChild(createDetailListItem(plan)));
      detailList.hidden = false;
    }
    if (detailEmpty) {
      detailEmpty.hidden = true;
    }
    if (clearDayButton) {
      clearDayButton.disabled = false;
    }
  }
  refreshGroupAvailability();
  updateMemoControls();
}

function renderFolders() {
  if (!folderSelect) return;
  folderSelect.innerHTML = '<option value="">폴더 선택</option>';
  state.folders.forEach((folder) => {
    const option = document.createElement('option');
    option.value = folder.id;
    option.textContent = folder.name;
    if (folder.id === state.activeFolderId) {
      option.selected = true;
    }
    folderSelect.appendChild(option);
  });
}

function updateGroupSelectOptions() {
  if (!groupSelect) return;
  const folderId = state.activeFolderId;
  if (!folderId) {
    groupSelect.innerHTML = '<option value="">폴더를 먼저 선택하세요.</option>';
    groupSelect.disabled = true;
    groupSelect.classList.add('is-disabled');
    updatePlanSubmitState();
    return;
  }
  const groups = state.groupsByFolder.get(folderId) || [];
  if (!groups.length) {
    groupSelect.innerHTML = '<option value="">추가할 그룹이 없습니다.</option>';
    groupSelect.disabled = true;
    groupSelect.classList.add('is-disabled');
    updatePlanSubmitState();
    return;
  }
  groupSelect.innerHTML = '';
  groupSelect.disabled = false;
  groupSelect.classList.remove('is-disabled');
  groups.forEach((group) => {
    const option = document.createElement('option');
    option.value = group.id;
    option.textContent = group.name;
    groupSelect.appendChild(option);
  });
  refreshGroupAvailability();
}

async function fetchFolders() {
  try {
    const data = await api('/folders');
    state.folders = Array.isArray(data) ? data : [];
    if (!state.folders.some((folder) => folder.id === state.activeFolderId)) {
      state.activeFolderId = null;
    }
    renderFolders();
    if (state.activeFolderId) {
      await fetchGroupsForFolder(state.activeFolderId);
    } else {
      updateGroupSelectOptions();
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function fetchGroupsForFolder(folderId) {
  if (!folderId) return;
  if (state.groupsByFolder.has(folderId)) {
    updateGroupSelectOptions();
    return;
  }
  try {
    const data = await api(`/groups?folder_id=${folderId}`);
    state.groupsByFolder.set(folderId, Array.isArray(data) ? data : []);
    updateGroupSelectOptions();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function persistDay(dateIso, groupIds, options = {}) {
  const { toastMessage = '학습 계획을 저장했습니다.', silent = false } = options;
  try {
    const payload = { group_ids: groupIds };
    const plans = await api(`/study-plans/${dateIso}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    const normalized = Array.isArray(plans) ? plans : [];
    setPlansForDate(dateIso, normalized);
    if (normalized.length && Object.prototype.hasOwnProperty.call(normalized[0], 'day_memo')) {
      setSavedMemo(dateIso, normalized[0].day_memo, { markLoaded: true });
    }
    renderCalendar();
    if (state.selectedDate === dateIso) {
      renderDetail();
      ensureMemoLoaded(dateIso);
    }
    if (!silent && toastMessage) {
      showToast(toastMessage, 'success');
    }
    return normalized;
  } catch (error) {
    showToast(error.message, 'error');
    return null;
  }
}

async function addGroupsToSelectedDate(groupIds) {
  if (!state.selectedDate) {
    showToast('먼저 날짜를 선택하세요.', 'error');
    return false;
  }
  const currentPlans = getPlansForDate(state.selectedDate);
  const existing = new Set(currentPlans.map((plan) => plan.group_id));
  const toAdd = groupIds.filter((id) => !existing.has(id));
  if (!toAdd.length) {
    showToast('이미 추가된 그룹입니다.', 'info');
    return false;
  }
  const groupList = currentPlans.map((plan) => plan.group_id).concat(toAdd);
  await persistDay(state.selectedDate, groupList);
  return true;
}

async function removePlan(planId) {
  if (!state.selectedDate) return;
  const remaining = getPlansForDate(state.selectedDate).filter((plan) => plan.id !== planId);
  await persistDay(state.selectedDate, remaining.map((plan) => plan.group_id));
}

async function clearSelectedDay() {
  if (!state.selectedDate) return;
  await persistDay(state.selectedDate, []);
}

async function movePlan(planId, targetDate) {
  const dragging = state.draggingPlan;
  if (!dragging) return;
  const sourceDate = dragging.sourceDate;
  if (!sourceDate || sourceDate === targetDate) {
    state.draggingPlan = null;
    return;
  }

  const sourcePlans = getPlansForDate(sourceDate);
  if (!sourcePlans.length) {
    state.draggingPlan = null;
    showToast('이동할 학습이 없습니다.', 'info');
    return;
  }

  if (!sourcePlans.some((plan) => plan.id === planId)) {
    state.draggingPlan = null;
    await loadPlansForCurrentRange({ keepSelection: true });
    showToast('이동할 학습을 찾을 수 없습니다.', 'error');
    return;
  }

  const targetPlans = getPlansForDate(targetDate);
  const seenGroupIds = new Set();
  const mergedGroupIds = [];

  for (const plan of targetPlans) {
    if (seenGroupIds.has(plan.group_id)) continue;
    seenGroupIds.add(plan.group_id);
    mergedGroupIds.push(plan.group_id);
  }

  for (const plan of sourcePlans) {
    if (seenGroupIds.has(plan.group_id)) continue;
    seenGroupIds.add(plan.group_id);
    mergedGroupIds.push(plan.group_id);
  }

  const targetResult = await persistDay(targetDate, mergedGroupIds, { silent: true });
  if (targetResult === null) {
    state.draggingPlan = null;
    return;
  }

  const sourceResult = await persistDay(sourceDate, [], { silent: true });
  if (sourceResult === null) {
    state.draggingPlan = null;
    return;
  }

  showToast('모든 학습 계획을 이동했습니다.', 'success');
  state.draggingPlan = null;
}

function clearDropTargets() {
  calendarGrid?.querySelectorAll('.calendar-day.is-drop-target').forEach((el) => {
    el.classList.remove('is-drop-target');
  });
}

function beginPlanDrag(planId, dateIso, element) {
  state.draggingPlan = { planId: Number(planId), sourceDate: dateIso };
  element.classList.add('is-dragging');
}

function endPlanDrag(element, { clearState = true } = {}) {
  if (element) {
    element.classList.remove('is-dragging');
  }
  clearDropTargets();
  if (clearState) {
    state.draggingPlan = null;
  }
}

function handlePlanDragStart(event) {
  const target = event.currentTarget;
  const planId = target.dataset.planId;
  const dateIso = target.dataset.date || state.selectedDate;
  if (!planId || !dateIso) return;
  beginPlanDrag(planId, dateIso, target);
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', planId);
}

function handlePlanDragEnd(event) {
  endPlanDrag(event.currentTarget);
}

function handlePlanTouchStart(event) {
  if (event.touches && event.touches.length > 1) {
    return;
  }
  const target = event.currentTarget;
  const planId = target.dataset.planId;
  const dateIso = target.dataset.date || state.selectedDate;
  if (!planId || !dateIso) return;
  if (touchDrag.timeoutId) {
    clearTimeout(touchDrag.timeoutId);
  }
  touchDrag.active = true;
  touchDrag.started = false;
  touchDrag.sourceEl = target;
  touchDrag.dropTarget = null;
  touchDrag.planId = planId;
  touchDrag.dateIso = dateIso;
  const touch = event.touches && event.touches[0];
  touchDrag.startX = touch ? touch.clientX : 0;
  touchDrag.startY = touch ? touch.clientY : 0;
  touchDrag.timeoutId = window.setTimeout(() => {
    touchDrag.started = true;
    beginPlanDrag(planId, dateIso, target);
  }, 200);
}

function handleGlobalTouchMove(event) {
  if (!touchDrag.active) return;
  const touch = event.touches && event.touches[0];
  if (!touch) return;
  if (!touchDrag.started) {
    const deltaX = touch.clientX - touchDrag.startX;
    const deltaY = touch.clientY - touchDrag.startY;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance > 10) {
      resetTouchDrag();
    }
    return;
  }
  if (!state.draggingPlan) return;
  if (event.cancelable) {
    event.preventDefault();
  }
  const element = document.elementFromPoint(touch.clientX, touch.clientY);
  const dropTarget = element ? element.closest('.calendar-day') : null;
  if (dropTarget !== touchDrag.dropTarget) {
    if (touchDrag.dropTarget) {
      touchDrag.dropTarget.classList.remove('is-drop-target');
    }
    if (dropTarget) {
      dropTarget.classList.add('is-drop-target');
    }
    touchDrag.dropTarget = dropTarget;
  }
}

function resetTouchDrag() {
  if (touchDrag.timeoutId) {
    clearTimeout(touchDrag.timeoutId);
  }
  touchDrag.timeoutId = null;
  touchDrag.active = false;
  touchDrag.started = false;
  touchDrag.sourceEl = null;
  touchDrag.dropTarget = null;
  touchDrag.planId = null;
  touchDrag.dateIso = null;
  touchDrag.startX = 0;
  touchDrag.startY = 0;
}

function handleGlobalTouchEnd(event) {
  if (!touchDrag.active && !touchDrag.started) return;
  if (touchDrag.timeoutId) {
    clearTimeout(touchDrag.timeoutId);
    touchDrag.timeoutId = null;
  }
  const started = touchDrag.started;
  const sourceEl = touchDrag.sourceEl;
  const dropTarget = touchDrag.dropTarget;
  const dragging = state.draggingPlan;
  resetTouchDrag();
  if (!started) {
    return;
  }
  if (event.cancelable) {
    event.preventDefault();
  }
  if (!dragging) {
    endPlanDrag(sourceEl);
    return;
  }
  const targetDate = dropTarget?.dataset.date;
  if (targetDate && targetDate !== dragging.sourceDate) {
    endPlanDrag(sourceEl, { clearState: false });
    movePlan(dragging.planId, targetDate);
  } else {
    endPlanDrag(sourceEl);
  }
}

function handleGlobalTouchCancel(event) {
  if (!touchDrag.active && !touchDrag.started) return;
  if (touchDrag.timeoutId) {
    clearTimeout(touchDrag.timeoutId);
    touchDrag.timeoutId = null;
  }
  const started = touchDrag.started;
  const sourceEl = touchDrag.sourceEl;
  resetTouchDrag();
  if (!started) {
    return;
  }
  if (event.cancelable) {
    event.preventDefault();
  }
  endPlanDrag(sourceEl);
}

function handleDayDragEnter(event) {
  if (!state.draggingPlan) return;
  event.preventDefault();
  event.currentTarget.classList.add('is-drop-target');
}

function handleDayDragOver(event) {
  if (!state.draggingPlan) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
}

function handleDayDragLeave(event) {
  event.currentTarget.classList.remove('is-drop-target');
}

function handleDayDrop(event) {
  if (!state.draggingPlan) return;
  event.preventDefault();
  const targetDate = event.currentTarget.dataset.date;
  event.currentTarget.classList.remove('is-drop-target');
  if (!targetDate) return;
  if (targetDate === state.draggingPlan.sourceDate) return;
  movePlan(state.draggingPlan.planId, targetDate);
}

function selectDate(iso, options = {}) {
  if (!iso) return;
  const selected = parseISODate(iso);
  if (!selected) return;
  const { openModal = true } = options;
  const shouldChangeMonth = !isSameMonth(selected, state.currentMonth);
  state.selectedDate = iso;
  if (shouldChangeMonth) {
    state.currentMonth = startOfMonth(selected);
    loadPlansForCurrentRange({
      keepSelection: true,
      onRendered: () => {
        ensureMemoLoaded(iso);
        if (openModal) {
          openPlanModal();
        }
      },
    });
  } else {
    renderCalendar();
    renderDetail();
    ensureMemoLoaded(iso);
    if (openModal) {
      openPlanModal();
    }
  }
}

async function loadPlansForCurrentRange(options = {}) {
  const { keepSelection = false, onRendered = null } = options;
  const monthStart = startOfMonth(state.currentMonth);
  const monthEnd = endOfMonth(state.currentMonth);
  const rangeStart = addDays(monthStart, -monthStart.getDay());
  const rangeEnd = addDays(monthEnd, 6 - monthEnd.getDay());
  try {
    state.timezoneOffset = new Date().getTimezoneOffset();
    const params = new URLSearchParams({
      start: formatISODate(rangeStart),
      end: formatISODate(rangeEnd),
    });
    params.set('tz_offset', String(state.timezoneOffset));
    const data = await api(`/study-plans?${params.toString()}`);
    const plans = Array.isArray(data) ? data : [];
    state.plansByDate.clear();
    const memoByDate = new Map();
    plans.forEach((plan) => {
      const iso = plan.study_date;
      if (!iso) {
        return;
      }
      const list = state.plansByDate.get(iso) || [];
      list.push(plan);
      state.plansByDate.set(iso, list);
      if (!memoByDate.has(iso) && Object.prototype.hasOwnProperty.call(plan, 'day_memo')) {
        memoByDate.set(iso, plan.day_memo);
      }
    });
    for (const [iso, list] of state.plansByDate.entries()) {
      setPlansForDate(iso, list);
    }
    memoByDate.forEach((memoValue, iso) => {
      setSavedMemo(iso, memoValue, { markLoaded: true });
    });

    if (!keepSelection) {
      const todayIso = formatISODate(today);
      const todayDate = parseISODate(todayIso);
      if (todayDate && isSameMonth(todayDate, state.currentMonth)) {
        state.selectedDate = todayIso;
      } else {
        state.selectedDate = formatISODate(monthStart);
      }
    } else if (state.selectedDate) {
      const selected = parseISODate(state.selectedDate);
      if (selected && !isSameMonth(selected, state.currentMonth)) {
        const todayIso = formatISODate(today);
        const todayDate = parseISODate(todayIso);
        state.selectedDate = todayDate && isSameMonth(todayDate, state.currentMonth)
          ? todayIso
          : formatISODate(monthStart);
      }
    }

    if (monthLabel) {
      monthLabel.textContent = formatMonthLabel(state.currentMonth);
    }
    renderCalendar();
    renderDetail();
    if (state.selectedDate) {
      ensureMemoLoaded(state.selectedDate);
    } else {
      updateMemoControls();
    }
    if (typeof onRendered === 'function') {
      onRendered();
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function updatePlanDate(planId, currentDate) {
  if (!Number.isFinite(planId)) return;
  const input = document.createElement('input');
  input.type = 'date';
  input.value = currentDate || '';
  input.setAttribute('aria-hidden', 'true');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  input.style.pointerEvents = 'none';
  input.style.width = '0';
  input.style.height = '0';
  document.body.appendChild(input);

  const cleanup = () => {
    input.removeEventListener('change', handleChange);
    input.removeEventListener('blur', cleanup);
    input.remove();
  };

  const handleChange = () => {
    const value = input.value;
    cleanup();
    if (!value) {
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      showToast('올바른 날짜를 선택하세요.', 'error');
      return;
    }
    movePlan(planId, value);
  };

  input.addEventListener('change', handleChange);
  input.addEventListener('blur', cleanup, { once: true });

  if (typeof input.showPicker === 'function') {
    input.showPicker();
  } else {
    input.click();
  }
}

function handleDetailAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'remove') {
    const planId = Number(button.dataset.planId);
    if (Number.isFinite(planId)) {
      removePlan(planId);
    }
    return;
  }
  if (action === 'change') {
    const planId = Number(button.dataset.planId);
    const planDate = button.dataset.planDate;
    if (Number.isFinite(planId)) {
      updatePlanDate(planId, planDate || state.selectedDate);
    }
    return;
  }
  const folderId = button.dataset.folderId;
  const groupId = button.dataset.groupId;
  if (!folderId || !groupId) return;
  if (action === 'memorize') {
    const url = new URL('/static/memorize.html', window.location.origin);
    url.searchParams.set('folder_id', folderId);
    url.searchParams.set('group_id', groupId);
    window.location.href = url.toString();
  } else if (action === 'exam') {
    const url = new URL('/static/exam.html', window.location.origin);
    url.searchParams.set('folder_id', folderId);
    url.searchParams.set('group_ids', groupId);
    window.location.href = url.toString();
  }
}

if (detailList) {
  detailList.addEventListener('click', handleDetailAction);
}

if ('ontouchstart' in window || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)) {
  document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
  document.addEventListener('touchend', handleGlobalTouchEnd, { passive: false });
  document.addEventListener('touchcancel', handleGlobalTouchCancel, { passive: false });
}

if (clearDayButton) {
  clearDayButton.addEventListener('click', () => {
    clearSelectedDay();
  });
}

if (folderSelect) {
  folderSelect.addEventListener('change', (event) => {
    const value = Number(event.target.value);
    state.activeFolderId = Number.isFinite(value) && value > 0 ? value : null;
    fetchGroupsForFolder(state.activeFolderId);
  });
}

if (groupSelect) {
  groupSelect.addEventListener('change', () => {
    updatePlanSubmitState();
  });
}

if (planMemoTextarea) {
  planMemoTextarea.addEventListener('input', (event) => {
    if (!state.selectedDate) return;
    const value = typeof event.target?.value === 'string' ? event.target.value : planMemoTextarea.value;
    setDraftMemo(state.selectedDate, value);
    updateMemoControls();
  });
}

if (planMemoClearButton) {
  planMemoClearButton.addEventListener('click', () => {
    if (!state.selectedDate) return;
    setDraftMemo(state.selectedDate, '');
    if (planMemoTextarea) {
      planMemoTextarea.value = '';
    }
    updateMemoControls();
  });
}

if (planMemoForm) {
  planMemoForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await saveMemoForSelectedDate();
  });
}

if (planForm) {
  planForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!state.selectedDate) {
      showToast('먼저 날짜를 선택하세요.', 'error');
      return;
    }
    const selectedOptions = Array.from(groupSelect?.selectedOptions || []);
    const groupIds = selectedOptions
      .map((option) => Number(option.value))
      .filter((value) => Number.isFinite(value));
    if (!groupIds.length) {
      showToast('추가할 그룹을 선택하세요.', 'error');
      return;
    }
    addGroupsToSelectedDate(groupIds).then((added) => {
      if (!added) {
        updatePlanSubmitState();
        refreshGroupAvailability();
        return;
      }
      if (groupSelect) {
        Array.from(groupSelect.options).forEach((option) => {
          option.selected = false;
        });
      }
      updatePlanSubmitState();
      refreshGroupAvailability();
    });
  });
}

if (planModal) {
  planModal.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.matches('[data-plan-close]')) {
      event.preventDefault();
      closePlanModal();
    }
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.isPlanModalOpen) {
    event.preventDefault();
    closePlanModal();
  }
});

if (prevMonthBtn) {
  prevMonthBtn.addEventListener('click', () => {
    state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() - 1, 1);
    loadPlansForCurrentRange();
  });
}

if (nextMonthBtn) {
  nextMonthBtn.addEventListener('click', () => {
    state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() + 1, 1);
    loadPlansForCurrentRange();
  });
}

async function init() {
  try {
    await Session.ensureAuthenticated();
    await fetchFolders();
    await loadPlansForCurrentRange();
  } catch (error) {
    if (error.message !== 'unauthenticated') {
      console.error(error);
      showToast('세션을 확인하는 중 오류가 발생했습니다.', 'error');
    }
  }
}

updateMemoControls();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
  });
} else {
  init();
}
