const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const exp = await p.experiment.findFirst({ where: { status: 'RUNNING' } });
  if (!exp) { console.log('No running experiment'); await p.$disconnect(); return; }
  console.log('Experiment:', exp.id, exp.name);
  console.log('Old notes.sampleTargetPerVariant:', (exp.notes || {}).sampleTargetPerVariant);
  console.log('Old notes.baselinePurchaseRate:', (exp.notes || {}).baselinePurchaseRate);

  const notes = Object.assign({}, exp.notes || {});
  delete notes.sampleTargetPerVariant;
  delete notes.baselinePurchaseRate;

  await p.experiment.update({
    where: { id: exp.id },
    data: { notes },
  });

  console.log('\nCleared — dashboard will now use new defaults (600 target, 3% rate = ~18 orders/variant = ~36 total)');
  await p.$disconnect();
})();
