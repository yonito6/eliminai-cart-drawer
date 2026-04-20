const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();
(async () => {
  const exp = await p.experiment.findFirst({
    where: {
      store: { shopDomain: 'eleganto-3011.myshopify.com' },
      slot: 'trustBadges',
      status: 'RUNNING'
    }
  });
  if (!exp) { console.log('No running experiment'); await p.$disconnect(); return; }

  console.log('=== Trust Badges Experiment ===');
  console.log('ID:', exp.id);
  console.log('Confidence:', exp.confidence);
  console.log('Lift:', exp.liftPercent, '%');
  console.log('Traffic split:', JSON.stringify(exp.trafficSplit));
  console.log('Variants:', JSON.stringify(exp.variants, null, 2));
  console.log('');

  // Count assignments per variantId
  const assignments = await p.variantAssignment.groupBy({
    by: ['variantId'],
    where: { experimentId: exp.id },
    _count: true
  });
  console.log('=== Assignment Split ===');
  let total = 0;
  for (const a of assignments) total += a._count;
  for (const a of assignments) {
    console.log('variantId ' + a.variantId + ': ' + a._count + ' (' + (a._count/total*100).toFixed(1) + '%)');
  }
  console.log('Total:', total);

  // Events per variantId
  for (const a of assignments) {
    const evts = await p.event.groupBy({
      by: ['eventType'],
      where: { assignment: { experimentId: exp.id, variantId: a.variantId } },
      _count: true
    });
    console.log('\nvariantId ' + a.variantId + ':');
    for (const e of evts) console.log('  ' + e.eventType + ': ' + e._count);
  }

  await p.$disconnect();
})();
