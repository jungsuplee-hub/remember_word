const passwordForm = document.querySelector('#password-form');
const passwordFeedback = document.querySelector('#password-feedback');
const toast = document.querySelector('#toast');
const userGreeting = document.querySelector('#user-greeting');
const adminLink = document.querySelector('#admin-link');
const logoutButton = document.querySelector('#logout-button');
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

function updateUserMenu(user) {
  if (!user) return;
  if (userGreeting) {
    userGreeting.textContent = `${user.name}님`;
  }
  if (adminLink) {
    adminLink.hidden = !user.is_admin;
  }
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
    await sessionManager.ensureAuthenticated();
  }
}

if (passwordForm) {
  passwordForm.addEventListener('submit', handlePasswordChange);
}

init().catch((error) => {
  console.error(error);
  showToast('세션을 확인하는 중 오류가 발생했습니다.', 'error');
});
