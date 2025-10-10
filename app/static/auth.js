const isAdminUser = (user) => {
  if (!user) return false;
  const { is_admin: rawIsAdmin } = user;
  if (typeof rawIsAdmin === 'boolean') {
    return rawIsAdmin;
  }
  if (typeof rawIsAdmin === 'string') {
    const normalized = rawIsAdmin.trim().toLowerCase();
    return normalized === 'true' || normalized === '1';
  }
  if (typeof rawIsAdmin === 'number') {
    return rawIsAdmin === 1;
  }
  return false;
};

const Session = {
  user: null,
  listeners: new Set(),
  async ensureAuthenticated() {
    if (this.user) return this.user;
    try {
      const res = await fetch('/auth/session');
      if (!res.ok) {
        if (res.status === 401) {
          this.redirectToLogin();
          throw new Error('unauthenticated');
        }
        throw new Error('세션 정보를 불러오지 못했습니다.');
      }
      this.user = await res.json();
      this.notify();
      return this.user;
    } catch (error) {
      if (error.message === 'unauthenticated') {
        throw error;
      }
      console.error(error);
      throw error;
    }
  },
  async refresh() {
    this.user = null;
    return this.ensureAuthenticated();
  },
  redirectToLogin() {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/static/login.html?next=${next}`;
  },
  subscribe(callback) {
    if (typeof callback === 'function') {
      this.listeners.add(callback);
      if (this.user !== null) {
        callback(this.user);
      }
    }
    return () => this.listeners.delete(callback);
  },
  notify() {
    this.listeners.forEach((callback) => {
      try {
        callback(this.user);
      } catch (err) {
        console.error(err);
      }
    });
  },
  async logout() {
    await fetch('/auth/logout', { method: 'POST' });
    this.user = null;
    this.notify();
    this.redirectToLogin();
  },
  isAdmin(user = this.user) {
    return isAdminUser(user);
  },
};

window.Session = Session;

document.addEventListener('DOMContentLoaded', () => {
  const applyRoleVisibility = (user) => {
    const requiresAdmin = document.querySelectorAll('[data-requires-admin]');
    const isAdmin = Session.isAdmin(user);
    requiresAdmin.forEach((element) => {
      if (!element) return;
      element.hidden = !isAdmin;
      element.classList.toggle('hidden', !isAdmin);
      if (isAdmin) {
        element.removeAttribute('hidden');
        element.setAttribute('aria-hidden', 'false');
      } else {
        element.setAttribute('aria-hidden', 'true');
      }
    });
  };

  Session.subscribe(applyRoleVisibility);

  const isPublic = document.body?.dataset?.public === 'true';
  if (!isPublic) {
    Session.ensureAuthenticated().catch((error) => {
      if (error.message !== 'unauthenticated') {
        console.error(error);
      }
    });
  }
});
