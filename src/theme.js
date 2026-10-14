// Apply the saved preference before the stylesheet and page content render.
// New visitors start in dark mode; the toggle always offers the other theme.
(() => {
  const key = 'klobfactor-theme';
  const valid = value => value === 'light' ? 'light' : 'dark';
  let theme = 'dark';
  try { theme = valid(localStorage.getItem(key)); } catch {}
  function apply(value) {
    theme = valid(value);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#101612' : '#f6f7f2';
    for (const button of document.querySelectorAll('[data-theme-toggle]')) {
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      button.title = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
      button.querySelector('[data-theme-label]').textContent = theme === 'dark' ? 'Dark' : 'Light';
    }
  }
  apply(theme);
  document.addEventListener('DOMContentLoaded', () => {
    apply(theme);
    for (const button of document.querySelectorAll('[data-theme-toggle]')) {
      button.addEventListener('click', () => {
        apply(theme === 'dark' ? 'light' : 'dark');
        try { localStorage.setItem(key, theme); } catch {}
      });
    }
  });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) apply(event.newValue);
  });
})();
