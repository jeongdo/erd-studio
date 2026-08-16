/**
 * ARGUS renderer benchmark descriptor.
 * Active LAB candidate: WebGL2 viewport culling without semantic LOD/tiles.
 */
(() => {
  'use strict';
  if (typeof schemaData === 'undefined') return;

  const source = schemaData.performance_100000;
  if (!source) return;

  const descriptor = {
    tabName: 'LAB WebGL CULL 100K',
    icon: 'fa-solid fa-filter',
    title: 'ARGUS Renderer Lab · WebGL2 Viewport Culling / No LOD (100,000 Tables)',
    performanceSample: true,
    performanceKey: 'lab-webgl-cull-100000',
    argusRenderer: 'webgl-cull'
  };

  Object.defineProperties(descriptor, {
    tables: { enumerable: true, get: () => source.tables },
    relations: { enumerable: true, get: () => source.relations }
  });

  schemaData.performance_lab_webgl_lod_100000 = descriptor;
})();
