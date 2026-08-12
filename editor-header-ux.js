/** Header UX fixes for controls that rely on unsupported icon aliases. */
(() => {
  'use strict';

  const inspectorButton = document.querySelector('button[onclick="toggleInspector()"][title="인스펙터"]');
  const inspectorIcon = inspectorButton?.querySelector('i');
  if (inspectorIcon) inspectorIcon.className = 'fa-solid fa-table-columns';
})();
