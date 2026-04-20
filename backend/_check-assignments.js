const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const exp = await p.experiment.findFirst({ where: { status: 'RUNNING' }, include: { store: true } });
  if (!exp) { console.log('No running experiment'); await p.$disconnect(); return; }

  const variants = exp.variants;
  console.log('Experiment:', exp.id, exp.name);
  console.log('Traffic split:', JSON.stringify(exp.trafficSplit));
  console.log('Variants:', variants.map(v => v.id + ' = ' + (v.label || v.name)).join(', '));
  console.log('');

  // Count assignments per variant
  for (const v of variants) {
    const total = await p.variantAssignment.count({
      where: { experimentId: exp.id, variantId: v.id },
    });
    const uniqueSessions = await p.variantAssignment.findMany({
      where: { experimentId: exp.id, variantId: v.id },
      select: { sessionId: true },
      distinct: ['sessionId'],
    });
    console.log(`${v.label || v.name}: ${total} assignments, ${uniqueSessions.length} unique sessions`);
  }

  // Check for sessions that have assignments to MULTIPLE variants (should be impossible)
  const allAssignments = await p.variantAssignment.findMany({
    where: { experimentId: exp.id },
    select: { sessionId: true, variantId: true },
  });

  const sessionVariants = {};
  for (const a of allAssignments) {
    if (!sessionVariants[a.sessionId]) sessionVariants[a.sessionId] = new Set();
    sessionVariants[a.sessionId].add(a.variantId);
  }

  const multiVariantSessions = Object.entries(sessionVariants).filter(([, vs]) => vs.size > 1);
  console.log('\nSessions assigned to multiple variants:', multiVariantSessions.length);
  if (multiVariantSessions.length > 0) {
    console.log('Examples:', multiVariantSessions.slice(0, 5).map(([sid, vs]) => sid + ' -> ' + [...vs].join(',')));
  }

  // Check for duplicate sessionIds (same session assigned multiple times to same variant)
  const duplicates = await p.variantAssignment.groupBy({
    by: ['sessionId', 'variantId'],
    where: { experimentId: exp.id },
    _count: true,
    having: { sessionId: { _count: { gt: 1 } } },
  });
  console.log('Duplicate session+variant combos:', duplicates.length);

  // Check session token patterns
  const recentAssignments = await p.variantAssignment.findMany({
    where: { experimentId: exp.id },
    orderBy: { assignedAt: 'desc' },
    take: 20,
    select: { sessionId: true, variantId: true, assignedAt: true },
  });
  console.log('\nLast 20 assignments:');
  for (const a of recentAssignments) {
    const v = variants.find(vv => vv.id === a.variantId);
    console.log(`  ${a.assignedAt.toISOString().slice(0,19)} | ${a.sessionId.slice(0,20)}... | ${v?.label || v?.name || a.variantId}`);
  }

  // Total unique session tokens
  const uniqueTokens = await p.variantAssignment.findMany({
    where: { experimentId: exp.id },
    select: { sessionId: true },
    distinct: ['sessionId'],
  });
  console.log('\nTotal unique session tokens:', uniqueTokens.length);
  console.log('Total assignments:', allAssignments.length);

  await p.$disconnect();
})();
