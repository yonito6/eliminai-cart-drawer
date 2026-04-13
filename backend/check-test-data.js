const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const exp = await p.experiment.findFirst({
    where: { status: 'RUNNING' },
    include: { _count: { select: { assignments: true } } }
  });
  if (!exp) { console.log('No running experiment'); await p.$disconnect(); return; }
  console.log('Experiment:', exp.slot, '| confidence:', exp.confidence, '| liftPercent:', exp.liftPercent);
  console.log('Started:', exp.startedAt);
  console.log('Total assignments:', exp._count.assignments);
  const variants = exp.variants;
  for (const v of variants) {
    const visitors = await p.variantAssignment.count({ where: { experimentId: exp.id, variantId: v.id } });
    const cartOpens = (await p.event.groupBy({ by: ['sessionId'], where: { assignment: { experimentId: exp.id, variantId: v.id }, eventType: 'CART_OPENED' } })).length;
    const checkouts = (await p.event.groupBy({ by: ['sessionId'], where: { assignment: { experimentId: exp.id, variantId: v.id }, eventType: 'CHECKOUT_CLICKED' } })).length;
    const orders = (await p.event.groupBy({ by: ['sessionId'], where: { assignment: { experimentId: exp.id, variantId: v.id }, eventType: 'ORDER_COMPLETED' } })).length;
    console.log('\n  Variant', v.id, ':', v.name);
    console.log('    visitors:', visitors, '| cartOpens:', cartOpens, '| checkouts:', checkouts, '| orders:', orders);
    if (cartOpens > 0) {
      console.log('    checkoutRate:', (checkouts/cartOpens*100).toFixed(1)+'%', '| orderRate:', (orders/cartOpens*100).toFixed(1)+'%');
    }
    console.log('    Thompson successes:', v.successes, '| failures:', v.failures);
  }

  // Check what Thompson uses for lift calculation
  const vArr = variants;
  if (vArr.length >= 2) {
    const means = vArr.map(v => {
      const a = (v.successes || 0) + 1;
      const b = (v.failures || 0) + 1;
      return { id: v.id, name: v.name, mean: a / (a + b), successes: v.successes, failures: v.failures };
    });
    means.sort((a, b) => b.mean - a.mean);
    console.log('\nThompson means:');
    for (const m of means) {
      console.log('  ', m.name, ':', m.mean.toFixed(4), '(s:', m.successes, 'f:', m.failures, ')');
    }
    if (means.length >= 2) {
      const lift = (means[0].mean - means[1].mean) / means[1].mean * 100;
      console.log('Computed lift:', lift.toFixed(1) + '%');
    }
  }

  await p.$disconnect();
})();
