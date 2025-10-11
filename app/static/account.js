const passwordForm = document.querySelector('#password-form');
const passwordFeedback = document.querySelector('#password-feedback');
const toast = document.querySelector('#toast');
const userGreeting = document.querySelector('#user-greeting');
const adminLink = document.querySelector('#admin-link');
const logoutButton = document.querySelector('#logout-button');
const accountLink = document.querySelector('#account-link');
const accountName = document.querySelector('#account-name');
const accountUsername = document.querySelector('#account-username');
const accountEmail = document.querySelector('#account-email');
const accountLastLogin = document.querySelector('#account-last-login');
const accountLoginCount = document.querySelector('#account-login-count');
const accountPassThreshold = document.querySelector('#account-pass-threshold');
const preferencesForm = document.querySelector('#preferences-form');
const preferencesFeedback = document.querySelector('#preferences-feedback');
const passThresholdInput = document.querySelector('#exam-pass-threshold');
const sessionManager = window.Session;

function showToast(message, type = 'info') {
  if (!toast) return;
  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
}

function setFeedback(message, type = 'info') {
  if (!passwordFeedback) return;
  passwordFeedback.textContent = message;
  passwordFeedback.dataset.type = type;
}

function setPreferencesFeedback(message, type = 'info') {
  if (!preferencesFeedback) return;
  preferencesFeedback.textContent = message;
  preferencesFeedback.dataset.type = type;
}

function normalizeThreshold(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 90;
  return Math.min(100, Math.max(0, Math.round(numeric)));
}

function formatThreshold(value) {
  if (!Number.isFinite(value)) return '-';
  return `${value}%`;
}

function updatePreferencesForm(user) {
  if (!passThresholdInput) return;
  const threshold = normalizeThreshold(user?.exam_pass_threshold);
  passThresholdInput.value = threshold;
  setPreferencesFeedback('', 'info');
}

function formatDateTime(value) {
  if (!value) return '-';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('ko-KR');
  } catch (error) {
    console.error('날짜 형식 변환 실패', error);
    return '-';
  }
}

function updateAccountSummary(user) {
  if (!user) return;
  if (accountName) accountName.textContent = user.name || '-';
  if (accountUsername) accountUsername.textContent = user.username || '-';
  if (accountEmail) accountEmail.textContent = user.email || '-';
  if (accountLastLogin) accountLastLogin.textContent = formatDateTime(user.last_login_at);
  if (accountLoginCount) accountLoginCount.textContent = `${user.login_count ?? 0}회`;
  if (accountPassThreshold) {
    const threshold = normalizeThreshold(user.exam_pass_threshold);
    accountPassThreshold.textContent = formatThreshold(threshold);
  }
  updatePreferencesForm(user);
}

function updateUserMenu(user) {
  if (!user) return;
  const isAdmin = sessionManager?.isAdmin
    ? sessionManager.isAdmin(user)
    : Boolean(user?.is_admin);
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
  updateAccountSummary(user);
}

if (sessionManager) {
  sessionManager.subscribe(updateUserMenu);
}

if (logoutButton && sessionManager) {
  logoutButton.addEventListener('click', (event) => {
    event.preventDefault();
    sessionManager.logout();
  });
}

async function handlePasswordChange(event) {
  event.preventDefault();
  const formData = new FormData(passwordForm);
  const currentPassword = formData.get('current_password');
  const newPassword = formData.get('new_password');
  const confirmPassword = formData.get('confirm_password');

  if (!currentPassword || !newPassword || !confirmPassword) {
    setFeedback('모든 필드를 입력하세요.', 'error');
    return;
  }

  if (newPassword !== confirmPassword) {
    setFeedback('새 비밀번호가 일치하지 않습니다.', 'error');
    return;
  }

  try {
    const res = await fetch('/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = data.detail || '비밀번호를 변경할 수 없습니다. 현재 비밀번호를 확인하세요.';
      setFeedback(message, 'error');
      return;
    }
    setFeedback('비밀번호가 변경되었습니다.', 'success');
    passwordForm.reset();
    showToast('비밀번호가 변경되었습니다.');
  } catch (error) {
    console.error(error);
    setFeedback('비밀번호 변경 중 오류가 발생했습니다.', 'error');
  }
}

async function init() {
  if (sessionManager) {
    const user = await sessionManager.ensureAuthenticated();
    updateAccountSummary(user);
  }
}

if (passwordForm) {
  passwordForm.addEventListener('submit', handlePasswordChange);
}

async function handlePreferencesSubmit(event) {
  event.preventDefault();
  if (!passThresholdInput) return;

  const rawValue = passThresholdInput.value;
  const trimmed = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!trimmed) {
    setPreferencesFeedback('0 이상 100 이하의 숫자를 입력하세요.', 'error');
    passThresholdInput.focus();
    return;
  }
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) {
    setPreferencesFeedback('숫자만 입력할 수 있습니다.', 'error');
    passThresholdInput.focus();
    return;
  }
  const normalized = normalizeThreshold(numeric);
  passThresholdInput.value = normalized;

  try {
    const res = await fetch('/auth/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exam_pass_threshold: normalized }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = data.detail || '설정을 저장할 수 없습니다. 잠시 후 다시 시도하세요.';
      setPreferencesFeedback(message, 'error');
      return;
    }
    const user = await res.json();
    setPreferencesFeedback('시험 합격 기준이 저장되었습니다.', 'success');
    updateAccountSummary(user);
    if (sessionManager) {
      sessionManager.user = user;
      sessionManager.notify();
    }
    showToast('시험 합격 기준이 업데이트되었습니다.');
  } catch (error) {
    console.error(error);
    setPreferencesFeedback('설정을 저장하는 동안 오류가 발생했습니다.', 'error');
  }
}

if (preferencesForm) {
  preferencesForm.addEventListener('submit', handlePreferencesSubmit);
}

init().catch((error) => {
  console.error(error);
  showToast('세션을 확인하는 중 오류가 발생했습니다.', 'error');
});
