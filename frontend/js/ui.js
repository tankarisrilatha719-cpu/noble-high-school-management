// Keyboard and screen-reader support shared by every dialog on the site.
// Dialogs are opened throughout app.js by adding the "active" class, so this
// watches for that class instead of requiring every call site to change.
(function () {
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const DIALOG_SELECTOR = '.modal-overlay, .lightbox-overlay, .nav-drawer';
  const openStack = [];

  function visibleFocusables(root) {
    return Array.from(root.querySelectorAll(FOCUSABLE)).filter(el => el.offsetParent !== null || el === document.activeElement);
  }

  function onOpen(dialog) {
    if (openStack.some(entry => entry.dialog === dialog)) return;
    openStack.push({ dialog, returnTo: document.activeElement });
    // Wait a frame so content rendered by the opener is in place.
    requestAnimationFrame(() => {
      if (!dialog.classList.contains('active')) return;
      if (dialog.contains(document.activeElement)) return;
      const box = dialog.querySelector('[role="dialog"]') || dialog;
      // Start on the first real control rather than the close button.
      const items = visibleFocusables(box);
      const first = items.find(el => !el.classList.contains('modal-close') && !el.classList.contains('nav-drawer-close')) || items[0];
      if (first) first.focus({ preventScroll: true });
      else { box.setAttribute('tabindex', '-1'); box.focus({ preventScroll: true }); }
    });
  }

  function onClose(dialog) {
    const idx = openStack.findIndex(entry => entry.dialog === dialog);
    if (idx === -1) return;
    const [entry] = openStack.splice(idx, 1);
    // Only restore focus if it was lost (another dialog may have taken it).
    const active = document.activeElement;
    if (entry.returnTo && document.contains(entry.returnTo) && (!active || active === document.body || dialog.contains(active))) {
      entry.returnTo.focus({ preventScroll: true });
    }
  }

  function watch(dialog) {
    new MutationObserver(() => {
      if (dialog.classList.contains('active')) onOpen(dialog);
      else onClose(dialog);
    }).observe(dialog, { attributes: true, attributeFilter: ['class'] });
  }

  function closeTop() {
    const entry = openStack[openStack.length - 1];
    if (!entry) return false;
    const dialog = entry.dialog;
    if (dialog.id === 'lightboxOverlay' && typeof closeLightbox === 'function') { closeLightbox(); return true; }
    if (dialog.id === 'navDrawer' && typeof closeNavDrawer === 'function') { closeNavDrawer(); return true; }
    const closeBtn = dialog.querySelector('.modal-close');
    if (closeBtn) { closeBtn.click(); return true; }
    if (typeof closeModal === 'function') { closeModal(dialog.id); return true; }
    return false;
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (closeTop()) e.preventDefault();
      return;
    }
    if (e.key !== 'Tab') return;
    const entry = openStack[openStack.length - 1];
    if (!entry) return;
    const box = entry.dialog.querySelector('[role="dialog"]') || entry.dialog;
    const items = visibleFocusables(box);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (!box.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // Elements given role="button" (e.g. clickable cards rendered by app.js)
  // respond to Enter and Space like real buttons.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target;
    if (el && el.getAttribute && el.getAttribute('role') === 'button' && el.tagName !== 'BUTTON') {
      e.preventDefault();
      el.click();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll(DIALOG_SELECTOR).forEach(watch);
  });
})();

// Show/hide the panel named by a button's aria-controls.
function toggleDisclosure(btn) {
  const panel = document.getElementById(btn.getAttribute('aria-controls'));
  if (!panel) return;
  panel.hidden = !panel.hidden;
  btn.setAttribute('aria-expanded', String(!panel.hidden));
}

// True when the visitor has asked the OS for less motion; sliders check this
// before auto-advancing.
function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
