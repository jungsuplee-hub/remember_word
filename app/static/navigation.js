(() => {
  const headerMenu = document.querySelector('#header-menu');
  const headerMenuToggle = document.querySelector('.header-menu-toggle');
  const headerMenuBackdrop = document.querySelector('[data-mobile-menu-backdrop]');
  const mobileMenuMediaQuery = typeof window !== 'undefined'
    ? window.matchMedia('(max-width: 720px)')
    : null;

  let lastFocusedElementBeforeMenu = null;

  function syncHeaderMenuAccessibility(isMobile) {
    if (!headerMenu || !headerMenuToggle) return;
    if (isMobile) {
      const isExpanded = document.body.classList.contains('mobile-menu-open');
      headerMenu.setAttribute('aria-hidden', isExpanded ? 'false' : 'true');
      if (headerMenuBackdrop) {
        headerMenuBackdrop.setAttribute('aria-hidden', isExpanded ? 'false' : 'true');
      }
    } else {
      headerMenu.removeAttribute('aria-hidden');
      if (headerMenuBackdrop) {
        headerMenuBackdrop.setAttribute('aria-hidden', 'true');
      }
    }
  }

  function closeHeaderMenu({ restoreFocus = true } = {}) {
    if (!headerMenu || !headerMenuToggle) return;
    if (!document.body.classList.contains('mobile-menu-open')) return;
    document.body.classList.remove('mobile-menu-open');
    headerMenuToggle.setAttribute('aria-expanded', 'false');
    syncHeaderMenuAccessibility(mobileMenuMediaQuery?.matches ?? false);
    const focusTarget = restoreFocus ? lastFocusedElementBeforeMenu || headerMenuToggle : null;
    lastFocusedElementBeforeMenu = null;
    if (focusTarget instanceof HTMLElement) {
      focusTarget.focus();
    }
  }

  function openHeaderMenu() {
    if (!headerMenu || !headerMenuToggle) return;
    if (!(mobileMenuMediaQuery?.matches ?? false)) return;
    if (document.body.classList.contains('mobile-menu-open')) return;
    lastFocusedElementBeforeMenu =
      document.activeElement instanceof HTMLElement ? document.activeElement : headerMenuToggle;
    document.body.classList.add('mobile-menu-open');
    headerMenuToggle.setAttribute('aria-expanded', 'true');
    syncHeaderMenuAccessibility(true);
    const focusable = headerMenu.querySelector(
      'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable instanceof HTMLElement) {
      focusable.focus();
    }
  }

  if (!headerMenu || !headerMenuToggle) {
    return;
  }

  headerMenuToggle.addEventListener('click', () => {
    if (document.body.classList.contains('mobile-menu-open')) {
      closeHeaderMenu();
    } else {
      openHeaderMenu();
    }
  });

  if (headerMenuBackdrop) {
    headerMenuBackdrop.addEventListener('click', () => closeHeaderMenu({ restoreFocus: false }));
  }

  headerMenu.addEventListener('click', (event) => {
    if (!(mobileMenuMediaQuery?.matches ?? false)) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('a.link-button, button.link-button')) {
      closeHeaderMenu({ restoreFocus: false });
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.body.classList.contains('mobile-menu-open')) {
      event.preventDefault();
      closeHeaderMenu();
    }
  });

  if (mobileMenuMediaQuery) {
    mobileMenuMediaQuery.addEventListener('change', (query) => {
      if (!query.matches) {
        closeHeaderMenu({ restoreFocus: false });
      }
      syncHeaderMenuAccessibility(query.matches);
    });
    syncHeaderMenuAccessibility(mobileMenuMediaQuery.matches);
  } else {
    syncHeaderMenuAccessibility(false);
  }
})();
