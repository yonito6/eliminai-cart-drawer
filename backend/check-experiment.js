const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const exps = await p.experiment.findMany({
    where: { status: 'RUNNING' },
    select: { id: true, slot: true, liftPercent: true, confidence: true, trafficSplit: true, variants: true, startedAt: true }
  });
  for (const e of exps) {
    console.log('--- Experiment:', e.slot, '---');
    console.log('liftPercent:', e.liftPercent, '| confidence:', e.confidence);
    console.log('trafficSplit:', JSON.stringify(e.trafficSplit));
    console.log('startedAt:', e.startedAt);
    const variants = e.variants;
    for (const v of variants) {
      console.log('  Variant', v.id, ':', v.name, '| successes:', v.successes, '| failures:', v.failures);
    }
  }
  await p.$disconnect();
})();
