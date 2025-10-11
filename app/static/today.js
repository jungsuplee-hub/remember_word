const state = {
  today: new Date(),
  todayIso: '',
  plans: [],
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

  const info = document.createElement('div');
  info.className = 'today-plan-info';
  info.innerHTML = `
    <span class="today-plan-folder">${plan.folder_name}</span>
    <span class="today-plan-group">${plan.group_name}</span>
  `;

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

  actions.appendChild(memorizeBtn);
  actions.appendChild(examBtn);

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
    state.plans = plans.filter((plan) => plan.study_date === iso);
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
  }
}

if (listEl) {
  listEl.addEventListener('click', handlePlanAction);
}

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
