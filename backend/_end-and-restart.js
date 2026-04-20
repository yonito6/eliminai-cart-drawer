const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // 1. Find current running experiment
  const exp = await p.experiment.findFirst({
    where: { status: 'RUNNING' },
    include: { store: true },
  });

  if (!exp) {
    console.log('No running experiment found');
    await p.$disconnect();
    return;
  }

  console.log('=== CURRENT EXPERIMENT ===');
  console.log('ID:', exp.id);
  console.log('Store:', exp.storeId, '-', exp.store.shopDomain);
  console.log('Name:', exp.name);
  console.log('Slot:', exp.slot);
  console.log('Started:', exp.startedAt);
  console.log('Confidence:', exp.confidence);
  console.log('Lift:', exp.liftPercent);
  console.log('TrafficSplit:', JSON.stringify(exp.trafficSplit));

  // Count data
  const assignments = await p.variantAssignment.count({ where: { experimentId: exp.id } });
  console.log('Assignments:', assignments);

  // 2. End it — save as NO_DIFFERENCE (manual stop, data was inflated)
  await p.experiment.update({
    where: { id: exp.id },
    data: {
      status: 'NO_DIFFERENCE',
      endedAt: new Date(),
      notes: {
        ...(exp.notes || {}),
        endReason: 'Manual stop — session token bug caused inflated visitor counts. Restarting with fix.',
        endedBy: 'claude',
      },
    },
  });
  console.log('\n=== ENDED (saved as NO_DIFFERENCE) ===');

  // 3. Create fresh experiment with same config
  const variants = exp.variants;
  const trafficSplit = {};
  for (const v of variants) {
    trafficSplit[v.id] = 0.5;
  }

  const newExp = await p.experiment.create({
    data: {
      storeId: exp.storeId,
      name: exp.name,
      slot: exp.slot,
      status: 'RUNNING',
      variants: variants,
      trafficSplit: trafficSplit,
      maxDays: 14,
    },
  });

  console.log('\n=== NEW EXPERIMENT CREATED ===');
  console.log('ID:', newExp.id);
  console.log('Name:', newExp.name);
  console.log('Started:', newExp.startedAt);
  console.log('TrafficSplit:', JSON.stringify(newExp.trafficSplit));
  console.log('Status:', newExp.status);

  await p.$disconnect();
})();
