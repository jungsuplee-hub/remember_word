const tableBody = document.querySelector('#admin-table-body');
const refreshButton = document.querySelector('#admin-refresh');
const toast = document.querySelector('#toast');
const userGreeting = document.querySelector('#user-greeting');
const logoutButton = document.querySelector('#logout-button');
const accountLink = document.querySelector('#account-link');
const sessionManager = window.Session;

function showToast(message, type = 'info') {
  if (!toast) return;
  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
}

function updateUserMenu(user) {
  if (!user) return;
  if (userGreeting) {
    userGreeting.textContent = `${user.name}님`;
  }
  if (accountLink) {
    accountLink.hidden = false;
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

function renderRows(rows) {
  if (!tableBody) return;
  if (!rows.length) {
    tableBody.innerHTML = '<tr><td colspan="9" class="empty">표시할 데이터가 없습니다.</td></tr>';
    return;
  }
  tableBody.innerHTML = rows
    .map((row) => {
      const lastLogin = row.last_login_at ? new Date(row.last_login_at).toLocaleString('ko-KR') : '-';
      const email = row.email || '-';
      return `
        <tr>
          <td>${row.name}</td>
          <td>${row.username || '-'}</td>
          <td>${email}</td>
          <td>${row.folder_count}</td>
          <td>${row.group_count}</td>
          <td>${row.word_count}</td>
          <td>${row.quiz_count}</td>
          <td>${row.login_count}</td>
          <td>${lastLogin}</td>
        </tr>
      `;
    })
    .join('');
}

async function fetchDashboard() {
  if (!sessionManager) return;
  try {
    await sessionManager.ensureAuthenticated();
    const res = await fetch('/admin/dashboard');
    if (!res.ok) {
      if (res.status === 403) {
        tableBody.innerHTML = '<tr><td colspan="9" class="empty">관리자 권한이 필요합니다.</td></tr>';
        showToast('관리자 계정으로 로그인해야 합니다.', 'error');
        return;
      }
      throw new Error('대시보드를 불러오지 못했습니다.');
    }
    const data = await res.json();
    renderRows(data);
  } catch (error) {
    console.error(error);
    if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="9" class="empty">데이터를 불러오는 중 오류가 발생했습니다.</td></tr>';
    }
    showToast('데이터를 불러오는 중 오류가 발생했습니다.', 'error');
  }
}

if (refreshButton) {
  refreshButton.addEventListener('click', () => fetchDashboard());
}

fetchDashboard();
