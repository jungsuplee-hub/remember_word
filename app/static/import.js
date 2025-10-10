const importForm = document.querySelector('#import-form');
const importFileInput = document.querySelector('#import-file');
const importLanguageInput = document.querySelector('#import-language');
const importFeedback = document.querySelector('#import-feedback');
const submitButton = importForm ? importForm.querySelector('button[type="submit"]') : null;
const userGreeting = document.querySelector('#user-greeting');
const adminLink = document.querySelector('#admin-link');
const accountLink = document.querySelector('#account-link');
const logoutButton = document.querySelector('#logout-button');
let redirectTimer = null;

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

function setFeedback(message, type) {
  if (!importFeedback) return;
  importFeedback.textContent = message || '';
  if (type) {
    importFeedback.dataset.type = type;
  } else {
    delete importFeedback.dataset.type;
  }
}

async function handleImportSubmit(event) {
  event.preventDefault();
  if (redirectTimer) {
    clearTimeout(redirectTimer);
    redirectTimer = null;
  }

  const file = importFileInput?.files?.[0];
  if (!file) {
    setFeedback('업로드할 파일을 선택하세요.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('default_language', importLanguageInput?.value?.trim() || '기본');

  if (submitButton) {
    submitButton.disabled = true;
  }
  setFeedback('업로드 중입니다...', null);

  try {
    const res = await fetch('/words/import-structured', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      let detail = '가져오기 중 오류가 발생했습니다.';
      try {
        const error = await res.json();
        if (error?.detail) {
          detail = error.detail;
        }
      } catch (parseError) {
        // ignore parse error and keep default message
      }
      throw new Error(detail);
    }

    const summary = await res.json();
    const inserted = summary?.inserted ?? 0;
    const skipped = summary?.skipped ?? 0;
    const foldersCreated = summary?.folders_created ?? 0;
    const groupsCreated = summary?.groups_created ?? 0;

    const messageParts = [
      `총 ${inserted}개의 단어를 추가했습니다.`,
      `${skipped}개 행은 건너뛰었습니다.`,
      `새 폴더 ${foldersCreated}개, 새 그룹 ${groupsCreated}개가 생성되었습니다.`,
    ];

    setFeedback(messageParts.join(' '), 'success');
    importForm.reset();

    redirectTimer = setTimeout(() => {
      window.location.href = '/static/index.html';
    }, 1800);
  } catch (error) {
    setFeedback(error.message || '가져오기 중 오류가 발생했습니다.', 'error');
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

async function init() {
  try {
    await Session.ensureAuthenticated();
  } catch (error) {
    if (error.message !== 'unauthenticated') {
      console.error(error);
    }
    return;
  }

  if (importForm) {
    importForm.addEventListener('submit', handleImportSubmit);
  }
}

init();
