const sessionManager = window.Session;
const form = document.querySelector('#hanja-meaning-form');
const fileInput = document.querySelector('#hanja-meaning-file');
const resetButton = document.querySelector('#hanja-meaning-reset');
const feedback = document.querySelector('#hanja-meaning-feedback');
const toast = document.querySelector('#toast');
const submitButton = form ? form.querySelector('button[type="submit"]') : null;

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

function resetForm() {
  if (form) {
    form.reset();
  }
  setFeedback('', 'info');
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

async function ensureAdminAccess() {
  if (!sessionManager) return;
  try {
    const user = await sessionManager.ensureAuthenticated();
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

  try {
    const response = await fetch('/admin/utilities/hanja-meanings', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 403) {
        setFeedback('관리자 권한이 필요합니다.', 'error');
        showToast('관리자 계정으로 로그인해야 합니다.', 'error');
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

    const blob = await response.blob();
    const processed = Number(response.headers.get('X-Meaning-Processed') || '0');
    const filled = Number(response.headers.get('X-Meaning-Filled') || '0');
    const existing = Number(response.headers.get('X-Meaning-Existing') || '0');
    const missing = Number(response.headers.get('X-Meaning-Missing') || '0');
    const filename = parseFilename(response.headers.get('Content-Disposition'));

    downloadBlob(blob, filename);

    const summary = `총 ${processed}건 중 ${filled}건에 뜻을 입력했습니다. (이미 값이 있는 행 ${existing}건, 미완료 ${missing}건)`;
    setFeedback(summary, 'success');
    showToast('엑셀 파일을 다운로드했습니다.', 'success');
  } catch (error) {
    console.error(error);
    setFeedback(error.message || '파일 처리 중 문제가 발생했습니다.', 'error');
    showToast('처리 중 오류가 발생했습니다.', 'error');
  } finally {
    setLoadingState(false);
  }
}

if (form) {
  form.addEventListener('submit', handleSubmit);
}

if (resetButton) {
  resetButton.addEventListener('click', resetForm);
}

ensureAdminAccess();
