const state = {
  today: new Date(),
  todayIso: '',
  plans: [],
  planMap: new Map(),
};

const userGreeting = document.querySelector('#user-greeting');
const logoutButton = document.querySelector('#logout-button');
const adminLink = document.querySelector('#admin-link');
const accountLink = document.querySelector('#account-link');
const titleEl = document.querySelector('#today-title');
const subtitleEl = document.querySelector('#today-subtitle');
const emptyEl = document.querySelector('#today-empty');
const listEl = document.querySelector('#today-plan-list');
const toast = document.querySelector('#toast');
const historyModal = document.querySelector('#today-history-modal');
const historyTitle = document.querySelector('#today-history-title');
const historyList = document.querySelector('#today-history-list');
const historyEmpty = document.querySelector('#today-history-empty');
const historyCloseButtons = document.querySelectorAll('[data-history-close]');

function formatISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatKoreanDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}년 ${month}월 ${day}일`;
}

function parseISODateString(value) {
  if (!value || typeof value !== 'string') return null;
  const parts = value.split('-').map((part) => Number(part));
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  if (![year, month, day].every((part) => Number.isFinite(part))) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
}

function parseDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(value) {
  const date = parseDateTime(value);
  if (!date) return '시간 정보 없음';
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPlanKey(plan) {
  if (!plan) return '';
  return `${plan.study_date}:${plan.group_id}`;
}

function updatePlanMap(plans) {
  state.planMap = new Map();
  plans.forEach((plan) => {
    const key = getPlanKey(plan);
    if (key) {
      state.planMap.set(key, plan);
    }
  });
}

function renderHistoryList(plan) {
  if (!historyList || !historyEmpty) return;
  const sessions = Array.isArray(plan?.exam_sessions) ? [...plan.exam_sessions] : [];
  if (!sessions.length) {
    historyList.innerHTML = '';
    historyList.hidden = true;
    historyEmpty.hidden = false;
    return;
  }

  sessions.sort((a, b) => {
    const aTime = parseDateTime(a?.created_at)?.getTime() ?? 0;
    const bTime = parseDateTime(b?.created_at)?.getTime() ?? 0;
    return bTime - aTime;
  });

  historyList.innerHTML = '';
  sessions.forEach((session) => {
    const item = document.createElement('li');
    item.className = 'today-history-item';

    const topRow = document.createElement('div');
    topRow.className = 'today-history-item-top';

    const dateEl = document.createElement('span');
    dateEl.className = 'today-history-date';
    dateEl.textContent = formatDateTime(session.created_at);

    const badge = document.createElement('span');
    badge.className = `badge today-history-badge ${session.passed ? 'badge-pass' : 'badge-fail'}`;
    badge.textContent = session.passed ? 'Pass' : 'Fail';

    topRow.appendChild(dateEl);
    topRow.appendChild(badge);

    const bottomRow = document.createElement('div');
    bottomRow.className = 'today-history-item-bottom';

    const scoreEl = document.createElement('span');
    scoreEl.className = 'today-history-score';
    scoreEl.textContent = `${formatScore(session.score)}점`;

    const detailEl = document.createElement('span');
    detailEl.className = 'today-history-detail';
    detailEl.textContent = `${session.correct}/${session.total} 정답`;

    bottomRow.appendChild(scoreEl);
    bottomRow.appendChild(detailEl);

    item.appendChild(topRow);
    item.appendChild(bottomRow);

    historyList.appendChild(item);
  });

  historyEmpty.hidden = true;
  historyList.hidden = false;
}

function openHistoryModal(plan, planKey) {
  if (!historyModal) return;
  const studyDate = parseISODateString(plan?.study_date);
  const dateLabel = studyDate ? formatKoreanDate(studyDate) : plan?.study_date || '';
  if (historyTitle) {
    const baseTitle = plan?.group_name ? `${plan.group_name} 시험 이력` : '시험 이력';
    historyTitle.textContent = dateLabel ? `${dateLabel} · ${baseTitle}` : baseTitle;
  }
  if (historyEmpty) {
    const baseMessage = plan?.group_name
      ? `${plan.group_name} 시험 이력이 없습니다.`
      : '아직 시험 이력이 없습니다.';
    historyEmpty.textContent = baseMessage;
  }

  renderHistoryList(plan);

  if (planKey) {
    historyModal.dataset.planKey = planKey;
  } else {
    delete historyModal.dataset.planKey;
  }

  historyModal.removeAttribute('hidden');
  historyModal.classList.add('visible');
  document.body.classList.add('today-history-modal-open');

  const dialog = historyModal.querySelector('.today-history-dialog');
  if (dialog && typeof dialog.focus === 'function') {
    dialog.focus();
  }
}

function openHistoryModalByKey(planKey) {
  if (!planKey) {
    showToast('시험 이력을 불러올 수 없습니다.', 'error');
    return;
  }
  const plan = state.planMap.get(planKey);
  if (!plan) {
    showToast('시험 이력 정보를 찾을 수 없습니다.', 'error');
    return;
  }
  openHistoryModal(plan, planKey);
}

function closeHistoryModal() {
  if (!historyModal) return;
  historyModal.classList.remove('visible');
  historyModal.setAttribute('hidden', '');
  delete historyModal.dataset.planKey;
  document.body.classList.remove('today-history-modal-open');
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

function createPlanListItem(plan) {
  const item = document.createElement('li');
  item.className = 'today-plan-item';
  const planKey = getPlanKey(plan);
  if (planKey) {
    item.dataset.planKey = planKey;
  }
  if (plan?.is_completed) {
    item.classList.add('today-plan-item-completed');
  }

  const info = document.createElement('div');
  info.className = 'today-plan-info';
  info.innerHTML = `
    <span class="today-plan-folder">${plan.folder_name}</span>
    <span class="today-plan-group">${plan.group_name}</span>
  `;

  if (plan?.is_completed) {
    const status = document.createElement('span');
    status.className = 'today-plan-status';
    status.textContent = '공부완료';
    info.appendChild(status);
  }

  const actions = document.createElement('div');
  actions.className = 'today-plan-actions';

  const memorizeBtn = document.createElement('button');
  memorizeBtn.type = 'button';
  memorizeBtn.className = 'secondary';
  memorizeBtn.textContent = '암기하기';
  memorizeBtn.dataset.action = 'memorize';
  memorizeBtn.dataset.folderId = String(plan.folder_id);
  memorizeBtn.dataset.groupId = String(plan.group_id);

  const examBtn = document.createElement('button');
  examBtn.type = 'button';
  examBtn.className = 'primary';
  examBtn.textContent = '시험보기';
  examBtn.dataset.action = 'exam';
  examBtn.dataset.folderId = String(plan.folder_id);
  examBtn.dataset.groupId = String(plan.group_id);

  const historyBtn = document.createElement('button');
  historyBtn.type = 'button';
  historyBtn.className = 'today-plan-history-button';
  historyBtn.textContent = '시험 이력';
  historyBtn.dataset.action = 'history';
  if (planKey) {
    historyBtn.dataset.planKey = planKey;
  }

  actions.appendChild(memorizeBtn);
  actions.appendChild(examBtn);
  actions.appendChild(historyBtn);

  item.appendChild(info);
  item.appendChild(actions);
  return item;
}

function renderPlans() {
  const todayDate = new Date(state.todayIso.replace(/-/g, '/'));
  if (titleEl) {
    titleEl.textContent = `${formatKoreanDate(todayDate)} 학습계획입니다.`;
  }

  const plans = Array.isArray(state.plans) ? [...state.plans] : [];
  plans.sort((a, b) => {
    if (a.folder_name === b.folder_name) {
      return a.group_name.localeCompare(b.group_name, 'ko');
    }
    return a.folder_name.localeCompare(b.folder_name, 'ko');
  });

  if (!plans.length) {
    if (subtitleEl) {
      subtitleEl.textContent = '오늘은 아직 학습 계획이 없습니다.';
    }
    if (emptyEl) {
      emptyEl.hidden = false;
    }
    if (listEl) {
      listEl.innerHTML = '';
      listEl.hidden = true;
    }
    return;
  }

  if (subtitleEl) {
    subtitleEl.textContent = `오늘은 ${plans.length}개의 그룹을 학습해요.`;
  }
  if (emptyEl) {
    emptyEl.hidden = true;
  }
  if (!listEl) return;

  listEl.innerHTML = '';
  plans.forEach((plan) => {
    listEl.appendChild(createPlanListItem(plan));
  });
  listEl.hidden = false;
}

async function fetchTodayPlans() {
  const iso = state.todayIso;
  try {
    const params = new URLSearchParams({ start: iso, end: iso });
    const data = await api(`/study-plans?${params.toString()}`);
    const plans = Array.isArray(data) ? data : [];
    state.plans = plans
      .filter((plan) => plan.study_date === iso)
      .map((plan) => ({
        ...plan,
        exam_sessions: Array.isArray(plan.exam_sessions) ? plan.exam_sessions : [],
        is_completed: Boolean(plan.is_completed),
      }));
    updatePlanMap(state.plans);
    if (historyModal && !historyModal.hasAttribute('hidden')) {
      const activeKey = historyModal.dataset.planKey;
      if (activeKey && state.planMap.has(activeKey)) {
        const activePlan = state.planMap.get(activeKey);
        openHistoryModal(activePlan, activeKey);
      } else {
        closeHistoryModal();
      }
    }
    renderPlans();
  } catch (error) {
    console.error(error);
    showToast(error.message, 'error');
  }
}

function handlePlanAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const folderId = button.dataset.folderId;
  const groupId = button.dataset.groupId;
  if (!folderId || !groupId) return;

  if (button.dataset.action === 'memorize') {
    const url = new URL('/static/memorize.html', window.location.origin);
    url.searchParams.set('folder_id', folderId);
    url.searchParams.set('group_id', groupId);
    window.location.href = url.toString();
  } else if (button.dataset.action === 'exam') {
    const url = new URL('/static/exam.html', window.location.origin);
    url.searchParams.set('folder_id', folderId);
    url.searchParams.set('group_ids', groupId);
    window.location.href = url.toString();
  } else if (button.dataset.action === 'history') {
    const planKey = button.dataset.planKey || getPlanKey({ study_date: state.todayIso, group_id: Number(groupId) });
    openHistoryModalByKey(planKey);
  }
}

if (listEl) {
  listEl.addEventListener('click', handlePlanAction);
}

if (historyCloseButtons && historyCloseButtons.length) {
  historyCloseButtons.forEach((element) => {
    element.addEventListener('click', closeHistoryModal);
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && historyModal && !historyModal.hasAttribute('hidden')) {
    closeHistoryModal();
  }
});

function scheduleMidnightRefresh() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 5, 0);
  const timeout = next.getTime() - now.getTime();
  setTimeout(async () => {
    state.today = new Date();
    state.todayIso = formatISODate(state.today);
    await fetchTodayPlans();
    scheduleMidnightRefresh();
  }, timeout);
}

async function init() {
  state.todayIso = formatISODate(state.today);
  try {
    await Session.ensureAuthenticated();
    await fetchTodayPlans();
    scheduleMidnightRefresh();
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
