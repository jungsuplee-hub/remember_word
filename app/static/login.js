const loginForm = document.querySelector('#login-form');
const loginFeedback = document.querySelector('#login-feedback');
const resetRequestForm = document.querySelector('#reset-request-form');
const resetRequestFeedback = document.querySelector('#reset-request-feedback');
const resetConfirmForm = document.querySelector('#reset-confirm-form');
const resetConfirmFeedback = document.querySelector('#reset-confirm-feedback');
const forgotPasswordTrigger = document.querySelector('#forgot-password-trigger');
const forgotPasswordHint = document.querySelector('#forgot-password-hint');
const resetRequestSection = document.querySelector('[data-reset-request-section]');
const resetConfirmSection = document.querySelector('[data-reset-confirm-section]');
const resetRequestEmailInput = resetRequestForm?.querySelector('input[name="email"]');
const resetConfirmTokenInput = resetConfirmForm?.querySelector('input[name="token"]');
const toast = document.querySelector('#toast');
const socialButtons = document.querySelectorAll('[data-social-login]');
const loginUsernameInput = loginForm?.querySelector('input[name="username"]');
const loginPasswordInput = loginForm?.querySelector('input[name="password"]');
const LOGIN_AUTO_SUBMIT_WINDOW_MS = 5000;
const loginPageLoadedAt = Date.now();
let loginAutoSubmitAttempted = false;
let loginFormInteractionDetected = false;

function showToast(message, type = 'info') {
  if (!toast) return;
  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
}

function setFeedback(element, message, type = 'info') {
  if (!element) return;
  element.textContent = message;
  element.dataset.type = type;
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

function markLoginFormInteraction() {
  loginFormInteractionDetected = true;
  if (loginUsernameInput) {
    delete loginUsernameInput.dataset.autofilled;
  }
  if (loginPasswordInput) {
    delete loginPasswordInput.dataset.autofilled;
  }
}

function registerLoginInteractionWatchers() {
  if (!loginForm) {
    return;
  }
  loginForm.addEventListener('keydown', markLoginFormInteraction, { once: true });
  loginForm.addEventListener('mousedown', markLoginFormInteraction, { once: true });
  loginForm.addEventListener('touchstart', markLoginFormInteraction, { once: true });
}

function attemptAutoSubmitLogin() {
  if (!loginForm || loginAutoSubmitAttempted) {
    return false;
  }
  if (!loginUsernameInput || !loginPasswordInput) {
    return false;
  }
  const username = loginUsernameInput.value?.trim();
  const password = loginPasswordInput.value;
  if (!username || !password) {
    return false;
  }
  if (loginFormInteractionDetected) {
    return false;
  }
  const hasAutofillSignal =
    loginUsernameInput.dataset.autofilled === 'true' ||
    loginPasswordInput.dataset.autofilled === 'true';
  const withinAutoSubmitWindow = Date.now() - loginPageLoadedAt <= LOGIN_AUTO_SUBMIT_WINDOW_MS;
  if (!hasAutofillSignal && !withinAutoSubmitWindow) {
    return false;
  }
  loginAutoSubmitAttempted = true;
  loginFormInteractionDetected = true;
  loginForm.requestSubmit();
  return true;
}

function initLoginAutofillAutomation() {
  if (!loginForm || !loginUsernameInput || !loginPasswordInput) {
    return;
  }

  const handleAutofillAnimation = (event) => {
    if (event.animationName === 'authAutofillStart') {
      event.target.dataset.autofilled = 'true';
      window.requestAnimationFrame(() => attemptAutoSubmitLogin());
    }
    if (event.animationName === 'authAutofillCancel') {
      delete event.target.dataset.autofilled;
    }
  };

  loginUsernameInput.addEventListener('animationstart', handleAutofillAnimation);
  loginPasswordInput.addEventListener('animationstart', handleAutofillAnimation);

  loginUsernameInput.addEventListener('input', () => {
    delete loginUsernameInput.dataset.autofilled;
  });
  loginPasswordInput.addEventListener('input', () => {
    delete loginPasswordInput.dataset.autofilled;
  });

  loginUsernameInput.addEventListener('change', () => attemptAutoSubmitLogin());
  loginPasswordInput.addEventListener('change', () => attemptAutoSubmitLogin());

  let attempts = 0;
  const intervalId = setInterval(() => {
    attempts += 1;
    const shouldStop = attempts * 250 >= LOGIN_AUTO_SUBMIT_WINDOW_MS;
    if (attemptAutoSubmitLogin() || shouldStop) {
      clearInterval(intervalId);
    }
  }, 250);

  document.addEventListener(
    'visibilitychange',
    () => {
      if (!document.hidden) {
        window.setTimeout(() => attemptAutoSubmitLogin(), 120);
      }
    },
    { once: true },
  );

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      loginAutoSubmitAttempted = false;
      loginFormInteractionDetected = false;
      registerLoginInteractionWatchers();
      window.setTimeout(() => attemptAutoSubmitLogin(), 120);
    }
  });
}

async function handleLogin(event) {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const payload = {
    username: formData.get('username').trim(),
    password: formData.get('password'),
  };
  if (!payload.username || !payload.password) {
    setFeedback(loginFeedback, '아이디와 비밀번호를 입력하세요.', 'error');
    return;
  }
  try {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = data.detail || '로그인에 실패했습니다. 아이디와 비밀번호를 확인하세요.';
      setFeedback(loginFeedback, message, 'error');
      return;
    }
    setFeedback(loginFeedback, '로그인 성공! 곧 이동합니다.', 'success');
    const nextUrl = getNextUrl();
    window.location.href = nextUrl;
  } catch (error) {
    console.error(error);
    setFeedback(loginFeedback, '로그인 처리 중 오류가 발생했습니다.', 'error');
  }
}

async function handleResetRequest(event) {
  event.preventDefault();
  const formData = new FormData(resetRequestForm);
  const email = formData.get('email').trim();
  if (!email) {
    setFeedback(resetRequestFeedback, '이메일을 입력하세요.', 'error');
    return;
  }
  revealResetConfirmSection();
  try {
    const res = await fetch('/auth/request-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = data.detail || '재설정을 요청할 수 없습니다. 다시 시도하세요.';
      setFeedback(resetRequestFeedback, message, 'error');
      return;
    }
    const data = await res.json().catch(() => ({}));
    setFeedback(
      resetRequestFeedback,
      data.message || '비밀번호 재설정 안내를 이메일로 전송했습니다.',
      'success',
    );
    revealResetConfirmSection({ focusToken: true });
  } catch (error) {
    console.error(error);
    setFeedback(resetRequestFeedback, '요청 처리 중 오류가 발생했습니다.', 'error');
  }
}

function revealResetConfirmSection({ focusToken = false } = {}) {
  if (!resetConfirmSection) return;
  const wasHidden = resetConfirmSection.classList.contains('hidden');
  resetConfirmSection.classList.remove('hidden');
  if (wasHidden) {
    resetConfirmSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (focusToken) {
    window.requestAnimationFrame(() => {
      resetConfirmTokenInput?.focus();
    });
  }
}

async function handleResetConfirm(event) {
  event.preventDefault();
  const formData = new FormData(resetConfirmForm);
  const token = formData.get('token').trim();
  const newPassword = formData.get('new_password');
  if (!token || !newPassword) {
    setFeedback(resetConfirmFeedback, '토큰과 새 비밀번호를 입력하세요.', 'error');
    return;
  }
  try {
    const res = await fetch('/auth/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: newPassword }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = data.detail || '토큰이 올바르지 않거나 만료되었습니다.';
      setFeedback(resetConfirmFeedback, message, 'error');
      return;
    }
    setFeedback(resetConfirmFeedback, '비밀번호가 재설정되었습니다. 새 비밀번호로 로그인하세요.', 'success');
    showToast('비밀번호 재설정 완료. 로그인해주세요.');
    resetConfirmForm.reset();
  } catch (error) {
    console.error(error);
    setFeedback(resetConfirmFeedback, '비밀번호 재설정 중 오류가 발생했습니다.', 'error');
  }
}

function revealForgotPasswordSections(event) {
  event.preventDefault();
  if (resetRequestSection) {
    resetRequestSection.classList.remove('hidden');
  }
  if (resetConfirmSection) {
    resetConfirmSection.classList.add('hidden');
  }
  if (forgotPasswordHint) {
    forgotPasswordHint.classList.add('hidden');
  }
  resetRequestSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.requestAnimationFrame(() => {
    resetRequestEmailInput?.focus();
  });
}

async function checkExistingSession() {
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

if (loginForm) {
  loginForm.addEventListener('submit', handleLogin);
  registerLoginInteractionWatchers();
  initLoginAutofillAutomation();
}
if (resetRequestForm) {
  resetRequestForm.addEventListener('submit', handleResetRequest);
}
if (resetConfirmForm) {
  resetConfirmForm.addEventListener('submit', handleResetConfirm);
}

if (forgotPasswordTrigger) {
  forgotPasswordTrigger.addEventListener('click', revealForgotPasswordSections);
}

if (socialButtons.length) {
  socialButtons.forEach((button) => {
    button.addEventListener('click', () => startSocialLogin(button.dataset.socialLogin));
  });
}

document.addEventListener('DOMContentLoaded', checkExistingSession);
