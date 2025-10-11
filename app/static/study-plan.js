const today = new Date();

const state = {
  currentMonth: new Date(today.getFullYear(), today.getMonth(), 1),
  selectedDate: null,
  plansByDate: new Map(),
  folders: [],
  groupsByFolder: new Map(),
  activeFolderId: null,
  draggingPlan: null,
  isPlanModalOpen: false,
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

function showToast(message, type = 'info') {
  if (!toast) return;
  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
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

  actions.appendChild(memorizeBtn);
  actions.appendChild(examBtn);
  actions.appendChild(removeBtn);

  item.appendChild(info);
  item.appendChild(actions);

  item.addEventListener('dragstart', handlePlanDragStart);
  item.addEventListener('dragend', handlePlanDragEnd);

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

async function persistDay(dateIso, groupIds) {
  try {
    const payload = { group_ids: groupIds };
    const plans = await api(`/study-plans/${dateIso}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    const normalized = Array.isArray(plans) ? plans : [];
    setPlansForDate(dateIso, normalized);
    renderCalendar();
    if (state.selectedDate === dateIso) {
      renderDetail();
    }
    showToast('학습 계획을 저장했습니다.', 'success');
  } catch (error) {
    showToast(error.message, 'error');
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
  try {
    const updated = await api(`/study-plans/${planId}`, {
      method: 'PATCH',
      body: JSON.stringify({ study_date: targetDate }),
    });
    const updatedPlan = updated || null;
    if (!updatedPlan) {
      await loadPlansForCurrentRange({ keepSelection: true });
      return;
    }

    for (const [dateIso, plans] of state.plansByDate.entries()) {
      const index = plans.findIndex((plan) => plan.id === planId);
      if (index !== -1) {
        plans.splice(index, 1);
        if (!plans.length) {
          state.plansByDate.delete(dateIso);
        }
        break;
      }
    }

    const list = state.plansByDate.get(updatedPlan.study_date) || [];
    list.push(updatedPlan);
    setPlansForDate(updatedPlan.study_date, list);
    renderCalendar();
    renderDetail();
    showToast('학습 계획을 이동했습니다.', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    state.draggingPlan = null;
  }
}

function handlePlanDragStart(event) {
  const target = event.currentTarget;
  const planId = target.dataset.planId;
  const dateIso = target.dataset.date || state.selectedDate;
  if (!planId || !dateIso) return;
  state.draggingPlan = { planId: Number(planId), sourceDate: dateIso };
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', planId);
  target.classList.add('is-dragging');
}

function handlePlanDragEnd(event) {
  event.currentTarget.classList.remove('is-dragging');
  state.draggingPlan = null;
  calendarGrid?.querySelectorAll('.calendar-day.is-drop-target').forEach((el) => {
    el.classList.remove('is-drop-target');
  });
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
        if (openModal) {
          openPlanModal();
        }
      },
    });
  } else {
    renderCalendar();
    renderDetail();
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
    const params = new URLSearchParams({
      start: formatISODate(rangeStart),
      end: formatISODate(rangeEnd),
    });
    const data = await api(`/study-plans?${params.toString()}`);
    const plans = Array.isArray(data) ? data : [];
    state.plansByDate.clear();
    plans.forEach((plan) => {
      const iso = plan.study_date;
      const list = state.plansByDate.get(iso) || [];
      list.push(plan);
      state.plansByDate.set(iso, list);
    });
    for (const [iso, list] of state.plansByDate.entries()) {
      setPlansForDate(iso, list);
    }

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
    if (typeof onRendered === 'function') {
      onRendered();
    }
  } catch (error) {
    showToast(error.message, 'error');
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
  });
} else {
  init();
}
