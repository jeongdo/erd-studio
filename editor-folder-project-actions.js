/** Folder-project command overrides: prefer folder UX without accidental legacy fallbacks. */
(() => {
  'use strict';

  const E = window.ERDEditor;
  const P = E?.Project;
  const Actions = E?.Actions;
  if (!E || !P || !Actions) return;

  Actions.register({
    id: 'file.open',
    label: '프로젝트 폴더 열기…',
    icon: 'fa-regular fa-folder-open',
    shortcut: 'Ctrl+O',
    run: () => {
      if (typeof E.FolderProject?.openFolder === 'function') return E.FolderProject.openFolder();
      return P.Workspace?.openProjectFile?.();
    }
  });

  Actions.register({
    id: 'file.save',
    label: '프로젝트 폴더 저장…',
    icon: 'fa-regular fa-floppy-disk',
    shortcut: 'Ctrl+S',
    run: () => {
      if (typeof E.FolderProject?.saveFolder === 'function') return E.FolderProject.saveFolder();
      return P.exportFile?.();
    }
  });
})();
