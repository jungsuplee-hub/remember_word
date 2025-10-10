const registerForm = document.querySelector('#register-form');
const registerFeedback = document.querySelector('#register-feedback');
const toast = document.querySelector('#toast');
const socialButtons = document.querySelectorAll('[data-social-login]');

function showToast(message, type = 'info') {
  if (!toast) return;
  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
}

function setFeedback(message, type = 'info') {
  if (!registerFeedback) return;
  registerFeedback.textContent = message;
  registerFeedback.dataset.type = type;
}

function getNextUrl() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');
  if (next && next.startsWith('/')) {
    return next;
  }
  return '/';
}

function startSocialLogin(provider) {
  if (!provider) return;
  const nextUrl = getNextUrl();
  const target = new URL(`/auth/oauth/${provider}`, window.location.origin);
  if (nextUrl) {
    target.searchParams.set('next', nextUrl);
  }
  window.location.href = target.toString();
}

async function handleRegister(event) {
  event.preventDefault();
  const formData = new FormData(registerForm);
  const username = (formData.get('username') || '').trim();
  const name = (formData.get('name') || '').trim();
  const emailRaw = formData.get('email');
  const email = typeof emailRaw === 'string' ? emailRaw.trim() : '';
  const password = formData.get('password');
  const confirmPassword = formData.get('confirm_password');

  const payload = {
    username,
    name,
    email,
    password,
  };

  if (!username || !name || !password) {
    setFeedback('필수 입력 항목을 모두 채워주세요.', 'error');
    return;
  }

  if (password.length < 6) {
    setFeedback('비밀번호는 6자 이상이어야 합니다.', 'error');
    return;
  }

  if (password !== confirmPassword) {
    setFeedback('비밀번호와 확인 비밀번호가 일치하지 않습니다.', 'error');
    return;
  }

  if (!email) {
    delete payload.email;
  }

  try {
    const res = await fetch('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = data.detail || '회원가입을 완료할 수 없습니다. 입력 정보를 확인해주세요.';
      setFeedback(message, 'error');
      return;
    }

    setFeedback('회원가입이 완료되었습니다. 잠시 후 이동합니다.', 'success');
    showToast('회원가입이 완료되었습니다.');
    const nextUrl = getNextUrl();
    setTimeout(() => {
      window.location.href = nextUrl;
    }, 400);
  } catch (error) {
    console.error(error);
    setFeedback('회원가입 처리 중 오류가 발생했습니다.', 'error');
  }
}

async function redirectIfLoggedIn() {
  try {
    const res = await fetch('/auth/session');
    if (res.ok) {
      const nextUrl = getNextUrl();
      window.location.href = nextUrl;
    }
  } catch (error) {
    console.error('세션 확인 실패', error);
  }
}

if (registerForm) {
  registerForm.addEventListener('submit', handleRegister);
}

if (socialButtons.length) {
  socialButtons.forEach((button) => {
    button.addEventListener('click', () => startSocialLogin(button.dataset.socialLogin));
  });
}

document.addEventListener('DOMContentLoaded', redirectIfLoggedIn);
