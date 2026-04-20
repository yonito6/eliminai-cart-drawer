const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const exp = await p.experiment.findFirst({ where: { status: 'RUNNING' } });
  if (!exp) { console.log('No running experiment'); await p.$disconnect(); return; }

  const notes = Object.assign({}, exp.notes || {});
  // Set sensible values directly so the dashboard shows correct numbers NOW
  // even before the new code deploys
  notes.sampleTargetPerVariant = 600;  // New default
  notes.baselinePurchaseRate = 0.03;   // 3% assumption until real data

  await p.experiment.update({
    where: { id: exp.id },
    data: { notes },
  });

  // 600 * 0.03 = 18 orders/variant, 36 total
  console.log('Set sampleTargetPerVariant=600, baselinePurchaseRate=0.03');
  console.log('Dashboard will now show: ~18 orders/variant = ~36 total');
  await p.$disconnect();
})();
