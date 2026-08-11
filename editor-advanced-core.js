/** Shared helpers for ERD Studio advanced extensions. */
(() => {
  'use strict';
  const E = window.ERDEditor;
  if (!E) throw new Error('ERDEditor core must load first');
  const A = E.Advanced = E.Advanced || {};

  A.uid = prefix => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  A.nowLabel = () => new Date().toLocaleString('ko-KR', { hour12: false });
  A.normalizeName = value => String(value || '').trim().replace(/^["`\[]|["`\]]$/g, '').split('.').at(-1).replace(/^["`\[]|["`\]]$/g, '').toUpperCase().replace(/[^A-Z0-9_$#]/g, '_').replace(/_+/g, '_');
  A.csvNames = value => String(value ?? '').split(',').map(A.normalizeName).filter(Boolean);
  A.relationKey = r => `${r.from}|${E.columnArray(r.fromCol).join(',')}|${r.to}|${E.columnArray(r.toCol).join(',')}`;
  A.view = () => E.currentSchema();

  A.showToast = message => {
    let toast = document.getElementById('erd-editor-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'erd-editor-toast'; toast.className = 'erd-editor-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message; toast.classList.add('show');
    clearTimeout(A.showToast.timer);
    A.showToast.timer = setTimeout(() => toast.classList.remove('show'), 1800);
  };

  A.ensureDialog = (id, title, bodyHtml, wide = false) => {
    let dialog = document.getElementById(id);
    if (!dialog) {
      dialog = document.createElement('dialog'); dialog.id = id;
      dialog.className = `editor-dialog advanced-dialog${wide ? ' wide' : ''}`;
      document.body.appendChild(dialog);
    }
    dialog.innerHTML = `<div class="editor-dialog-header"><h3>${E.escapeHtml(title)}</h3><button type="button" class="btn-icon" data-dialog-close><i class="fa-solid fa-xmark"></i></button></div><div class="editor-dialog-body">${bodyHtml}</div>`;
    dialog.querySelector('[data-dialog-close]')?.addEventListener('click', () => dialog.close());
    return dialog;
  };

  A.rerender = () => { renderView(currentView); E.refreshSelection?.(); };
  A.mutate = (label, fn) => { E.pushUndo(); fn(); E.persist(); A.rerender(); A.showToast(label); };
})();
