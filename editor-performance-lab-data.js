/**
 * ARGUS renderer benchmark descriptors.
 * All 100k GPU variants share the exact same table/relation objects so
 * rendering strategy—not dataset shape—is the primary variable.
 */
(() => {
  'use strict';

  if (typeof schemaData === 'undefined') return;

  const source1k = schemaData.performance_1000;
  const source100k = schemaData.performance_100000;
  if (!source1k || !source100k) return;

  function alias(source, meta) {
    const descriptor = { ...meta, performanceSample: true };
    Object.defineProperties(descriptor, {
      tables: { enumerable: true, get: () => source.tables },
      relations: { enumerable: true, get: () => source.relations }
    });
    return descriptor;
  }

  schemaData.performance_lab_dom_1000 = alias(source1k, {
    tabName: 'LAB DOM/SVG 1K',
    icon: 'fa-solid fa-code',
    title: 'ARGUS Renderer Lab · DOM + SVG (1,000 Tables)',
    performanceKey: 'lab-dom-1000',
    argusRenderer: 'dom-svg'
  });

  schemaData.performance_lab_webgl_geometry_100000 = alias(source100k, {
    tabName: 'LAB WebGL GEO 100K',
    icon: 'fa-solid fa-microchip',
    title: 'ARGUS Renderer Lab · Pure WebGL2 Geometry (100,000 Tables)',
    performanceKey: 'lab-webgl-geometry-100000',
    argusRenderer: 'webgl-geometry'
  });

  schemaData.performance_lab_webgl_lod_100000 = alias(source100k, {
    tabName: 'LAB WebGL LOD 100K',
    icon: 'fa-solid fa-layer-group',
    title: 'ARGUS Renderer Lab · WebGL2 LOD / Cluster (100,000 Tables)',
    performanceKey: 'lab-webgl-lod-100000',
    argusRenderer: 'webgl-lod'
  });
})();
