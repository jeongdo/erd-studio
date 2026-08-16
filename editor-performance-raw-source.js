/** v1 rebuild: keep the 100k sample as a hidden RAW data source, not a visible tab. */
(() => {
  'use strict';

  if (typeof schemaData === 'undefined') return;
  const source = schemaData.performance_100000;
  if (!source) return;

  Object.defineProperty(schemaData, 'performance_100000', {
    configurable: true,
    enumerable: false,
    writable: true,
    value: source
  });
})();
