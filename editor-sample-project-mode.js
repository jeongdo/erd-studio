/** Treat every bundled sample, including Performance 300, as a normal project workspace. */
(() => {
  'use strict';

  const Samples = window.ERDStudioSamples;
  const performance = Samples?.get?.('performance_300');
  if (!Samples || !performance) return;

  performance.transient = false;

  const baseCreate = Samples.create.bind(Samples);
  Samples.create = id => {
    const schema = baseCreate(id);
    if (id === 'performance_300' && schema) delete schema.transient;
    return schema;
  };
})();
