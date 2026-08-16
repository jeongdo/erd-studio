/**
 * ARGUS renderer benchmark descriptor.
 * Only active LAB candidate is the WebGL2 LOD renderer.
 */
(() => {
  'use strict';
  if (typeof schemaData === 'undefined') return;

  const source = schemaData.performance_100000;
  if (!source) return;

  const descriptor = {
    tabName: 'LAB WebGL LOD 100K',
    icon: 'fa-solid fa-layer-group',
    title: 'ARGUS Renderer Lab · WebGL2 LOD / Cluster (100,000 Tables)',
    performanceSample: true,
    performanceKey: 'lab-webgl-lod-100000',
    argusRenderer: 'webgl-lod'
  };

  Object.defineProperties(descriptor, {
    tables: { enumerable: true, get: () => source.tables },
    relations: { enumerable: true, get: () => source.relations }
  });

  schemaData.performance_lab_webgl_lod_100000 = descriptor;
})();
