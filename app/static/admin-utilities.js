const sessionManager = window.Session;
const form = document.querySelector('#hanja-meaning-form');
const fileInput = document.querySelector('#hanja-meaning-file');
const resetButton = document.querySelector('#hanja-meaning-reset');
const feedback = document.querySelector('#hanja-meaning-feedback');
const downloadButton = document.querySelector('#hanja-meaning-download');
const toast = document.querySelector('#toast');
const userGreeting = document.querySelector('#user-greeting');
const adminLink = document.querySelector('#admin-link');
const accountLink = document.querySelector('#account-link');
const logoutButton = document.querySelector('#logout-button');
const submitButton = form ? form.querySelector('button[type="submit"]') : null;
const POLL_INTERVAL = 1200;

let pollTimeoutId = null;
let currentTask = null;
let lastDownloadUrl = null;

function showToast(message, type = 'info') {
  if (!toast) return;
  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
}

function setFeedback(message, type = 'info') {
  if (!feedback) return;
  feedback.textContent = message;
  if (message) {
    feedback.dataset.type = type;
  } else {
    delete feedback.dataset.type;
  }
}

function setLoadingState(isLoading) {
  if (submitButton) {
    submitButton.disabled = isLoading;
    submitButton.textContent = isLoading ? '처리 중...' : '뜻 자동 입력';
  }
  if (fileInput) {
    fileInput.disabled = isLoading;
  }
  if (resetButton) {
    resetButton.disabled = isLoading;
  }
}

function stopPolling() {
  if (pollTimeoutId) {
    clearTimeout(pollTimeoutId);
    pollTimeoutId = null;
  }
}

function resetForm() {
  if (form) {
    form.reset();
  }
  setFeedback('', 'info');
  stopPolling();
  currentTask = null;
  updateDownloadButton(null);
}

function updateDownloadButton(url) {
  if (!downloadButton) return;
  lastDownloadUrl = url || null;
  if (url) {
    downloadButton.href = url;
    downloadButton.hidden = false;
    downloadButton.classList.remove('hidden');
    downloadButton.setAttribute('aria-hidden', 'false');
    downloadButton.setAttribute('download', '');
  } else {
    downloadButton.removeAttribute('href');
    downloadButton.removeAttribute('download');
    downloadButton.hidden = true;
    downloadButton.classList.add('hidden');
    downloadButton.setAttribute('aria-hidden', 'true');
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'hanja_meaning.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function parseFilename(header) {
  if (!header) return 'hanja_meaning.xlsx';
  const match = header.match(/filename="?([^";]+)"?/i);
  if (match && match[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch (error) {
      console.error(error);
      return match[1];
    }
  }
  return 'hanja_meaning.xlsx';
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '';
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}시간 ${remainingMinutes}분 ${remainingSeconds}초`;
  }

  if (minutes > 0) {
    return `${minutes}분 ${remainingSeconds}초`;
  }

  return `${seconds}초`;
}

function scheduleNextPoll() {
  stopPolling();
  pollTimeoutId = setTimeout(pollTaskStatus, POLL_INTERVAL);
}

function formatProgressMessage(status) {
  const { total, processed, created_at: createdAt } = status;
  const percent = total > 0 ? Math.floor((processed / total) * 100) : 0;
  let message = '파일을 처리하는 중입니다...';
  if (total > 0) {
    message += ` ${percent}% (${processed}/${total})`;
  } else {
    message += ' (준비 중)';
  }

  if (createdAt) {
    const startedAt = new Date(createdAt).getTime();
    if (!Number.isNaN(startedAt)) {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const durationLabel = formatDuration(elapsed);
      if (durationLabel) {
        message += ` · 경과 ${durationLabel}`;
      }
    }
  }

  return message;
}

async function downloadResult(downloadUrl) {
  if (!downloadUrl) {
    throw new Error('다운로드할 파일이 준비되지 않았습니다.');
  }

  try {
    const response = await fetch(downloadUrl, { cache: 'no-store' });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || '파일 다운로드에 실패했습니다.');
    }

    const blob = await response.blob();
    const filename = parseFilename(response.headers.get('Content-Disposition'));
    downloadBlob(blob, filename);
    return 'fetched';
  } catch (error) {
    console.debug('Direct download failed, attempting fallback navigation.', error);
    const popup = window.open(downloadUrl, '_blank');
    if (popup) {
      return 'opened';
    }
    throw error;
  }
}

function summarizeCompletedStatus(status) {
  const parts = [];
  if (status.message) {
    parts.push(status.message);
  } else {
    parts.push(`처리 대상 ${status.total}건 중 ${status.filled}건에 뜻을 입력했습니다.`);
  }
  parts.push(`이미 값이 있는 행 ${status.existing}건`);
  parts.push(`미완료 ${status.missing}건`);
  return `${parts.join(', ')}.`;
}

async function pollTaskStatus() {
  if (!currentTask) return;

  try {
    const response = await fetch(currentTask.statusUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('진행 상태를 확인할 수 없습니다.');
    }

    const status = await response.json();

    if (status.status === 'failed') {
      stopPolling();
      currentTask = null;
      setLoadingState(false);
      setFeedback(status.message || '파일 처리 중 문제가 발생했습니다.', 'error');
      showToast('처리 중 오류가 발생했습니다.', 'error');
      return;
    }

    if (status.status === 'completed') {
      stopPolling();
      const downloadUrl = currentTask?.downloadUrl || lastDownloadUrl;
      setFeedback('파일 다운로드를 준비하는 중입니다...', 'info');
      try {
        let downloadMode = null;
        if (downloadUrl) {
          downloadMode = await downloadResult(downloadUrl);
        }
        const summary = summarizeCompletedStatus(status);
        let hint = '';
        if (downloadUrl) {
          hint =
            downloadMode === 'opened'
              ? ' 새 탭이 열리지 않았다면 아래 다운로드 버튼을 눌러 다시 받아주세요.'
              : ' 자동 다운로드가 시작되지 않았다면 아래 다운로드 버튼을 눌러 다시 받아주세요.';
        }
        updateDownloadButton(downloadUrl);
        setFeedback(`${summary}${hint}`, 'success');
        if (downloadMode === 'opened') {
          showToast('새 탭에서 다운로드를 시도했습니다.', 'info');
        } else if (downloadMode === 'fetched') {
          showToast('엑셀 파일을 다운로드했습니다.', 'success');
        } else {
          showToast('처리 결과를 확인하세요.', 'success');
        }
      } catch (error) {
        console.error(error);
        updateDownloadButton(downloadUrl);
        setFeedback(error.message || '파일 다운로드에 실패했습니다.', 'error');
        showToast('파일 다운로드 중 오류가 발생했습니다.', 'error');
      } finally {
        currentTask = null;
        setLoadingState(false);
      }
      return;
    }

    setFeedback(formatProgressMessage(status), 'info');
    scheduleNextPoll();
  } catch (error) {
    console.error(error);
    stopPolling();
    currentTask = null;
    setLoadingState(false);
    setFeedback('진행 상태를 불러오지 못했습니다. 다시 시도하세요.', 'error');
    showToast('진행 상태 확인에 실패했습니다.', 'error');
  }
}

async function ensureAdminAccess() {
  if (!sessionManager) return;
  try {
    const user = await sessionManager.ensureAuthenticated();
    updateUserMenu(user);
    if (!sessionManager.isAdmin(user)) {
      if (form) {
        form.classList.add('disabled');
      }
      if (submitButton) {
        submitButton.disabled = true;
      }
      if (resetButton) {
        resetButton.disabled = true;
      }
      if (fileInput) {
        fileInput.disabled = true;
      }
      setFeedback('관리자 권한이 필요합니다.', 'error');
      showToast('관리자 계정으로 로그인해야 합니다.', 'error');
    }
  } catch (error) {
    console.error(error);
    setFeedback('세션 정보를 확인할 수 없습니다. 다시 시도하세요.', 'error');
  }
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
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!form || !fileInput) return;

  if (!fileInput.files || fileInput.files.length === 0) {
    setFeedback('업로드할 엑셀 파일을 선택하세요.', 'error');
    fileInput.focus();
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  setLoadingState(true);
  setFeedback('파일을 처리하는 중입니다...', 'info');
  stopPolling();
  currentTask = null;

  updateDownloadButton(null);

  try {
    const response = await fetch('/admin/utilities/hanja-meanings', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 403) {
        setFeedback('관리자 권한이 필요합니다.', 'error');
        showToast('관리자 계정으로 로그인해야 합니다.', 'error');
        setLoadingState(false);
        return;
      }
      const errorText = await response.text();
      let message = errorText;
      try {
        const parsed = JSON.parse(errorText);
        if (parsed && parsed.detail) {
          message = parsed.detail;
        }
      } catch (parseError) {
        console.debug('Failed to parse error response', parseError);
      }
      throw new Error(message || '파일 처리에 실패했습니다.');
    }

    const payload = await response.json();
    currentTask = {
      id: payload.task_id,
      statusUrl: payload.status_url,
      downloadUrl: payload.download_url,
    };
    updateDownloadButton(null);

    setFeedback('업로드한 파일을 확인하고 있습니다...', 'info');
    pollTaskStatus();
  } catch (error) {
    console.error(error);
    setFeedback(error.message || '파일 처리 중 문제가 발생했습니다.', 'error');
    showToast('처리 중 오류가 발생했습니다.', 'error');
    setLoadingState(false);
  }
}

if (form) {
  form.addEventListener('submit', handleSubmit);
}

if (resetButton) {
  resetButton.addEventListener('click', resetForm);
}

if (downloadButton) {
  downloadButton.addEventListener('click', async (event) => {
    if (!lastDownloadUrl) {
      event.preventDefault();
      showToast('다운로드할 파일이 없습니다.', 'error');
      return;
    }

    event.preventDefault();
    downloadButton.setAttribute('aria-busy', 'true');
    try {
      const mode = await downloadResult(lastDownloadUrl);
      if (mode === 'opened') {
        showToast('새 탭에서 다운로드를 시도했습니다.', 'info');
      } else {
        showToast('엑셀 파일을 다운로드했습니다.', 'success');
      }
    } catch (error) {
      console.error(error);
      setFeedback(error.message || '파일 다운로드에 실패했습니다.', 'error');
      showToast('파일 다운로드 중 오류가 발생했습니다.', 'error');
    } finally {
      downloadButton.removeAttribute('aria-busy');
    }
  });
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

ensureAdminAccess();
