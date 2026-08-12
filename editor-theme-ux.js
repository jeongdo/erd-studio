/** Preserve application-shell state while switching visual themes. */
(() => {
  'use strict';

  const THEMES = [
    'theme-cyber-navy',
    'theme-industrial-slate',
    'theme-charcoal-gray',
    'theme-midnight-gold',
    'theme-paper-light'
  ];
  const DEFAULT_THEME = 'theme-cyber-navy';

  function applyTheme(themeName) {
    const next = THEMES.includes(themeName) ? themeName : DEFAULT_THEME;

    // Never replace body.className here. Desktop-shell, visibility and future
    // application-state classes must survive a purely visual theme switch.
    document.body.classList.remove(...THEMES);
    document.body.classList.add(next);
    localStorage.setItem('erd_theme', next);

    const select = document.getElementById('theme-select');
    if (select) select.value = next;

    const accentColor = getComputedStyle(document.body)
      .getPropertyValue('--accent-blue')
      .trim();
    const arrowPath = document.getElementById('arrow-path');
    if (arrowPath && accentColor) {
      arrowPath.setAttribute('fill', accentColor);
      arrowPath.setAttribute('stroke', accentColor);
    }

    window.updateConnections?.();
    document.dispatchEvent(new CustomEvent('erd:theme-changed', { detail: { theme: next } }));
    return next;
  }

  window.changeTheme = applyTheme;
  window.ERDTheme = { apply: applyTheme, themes: [...THEMES] };
})();
