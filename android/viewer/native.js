// Android owns the full-screen window. Keep the same canvas in place as it expands.
let expandedRoot = null;
window.nativeExit = () => {
  if (!expandedRoot) return;
  const root = expandedRoot;
  expandedRoot = null;
  root.classList.remove('is-expanded');
  document.body.classList.remove('native-expanded');
  document.body.dataset.expanded = 'false';
  const button = root.querySelector('[data-action=expand]');
  button.textContent = 'Expand';
  button.setAttribute('aria-expanded','false');
  window.Trainer?.expanded(false);
  dispatchEvent(new Event('resize'));
};
document.addEventListener('click', event => {
  const button = event.target.closest('[data-action=expand],[data-action=fullscreen]');
  if (!button) return;
  event.preventDefault();event.stopImmediatePropagation();
  if (expandedRoot) { window.nativeExit();return; }
  expandedRoot = button.closest('.player-card');
  expandedRoot.classList.add('is-expanded');
  document.body.classList.add('native-expanded');
  document.body.dataset.expanded = 'true';
  const toggle = expandedRoot.querySelector('[data-action=expand]');
  toggle.textContent = 'Close';toggle.setAttribute('aria-expanded','true');
  window.Trainer?.expanded(true);
  dispatchEvent(new Event('resize'));
}, true);
