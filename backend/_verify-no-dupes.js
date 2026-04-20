const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const exp = await p.experiment.findFirst({ where: { status: 'RUNNING' } });

  // 1. Total assignments
  const total = await p.variantAssignment.count({ where: { experimentId: exp.id } });

  // 2. Unique session IDs
  const unique = await p.variantAssignment.findMany({
    where: { experimentId: exp.id },
    select: { sessionId: true },
    distinct: ['sessionId'],
  });

  // 3. Any session assigned to >1 variant?
  const all = await p.variantAssignment.findMany({
    where: { experimentId: exp.id },
    select: { sessionId: true, variantId: true },
  });
  const bySession = {};
  for (const a of all) {
    if (!bySession[a.sessionId]) bySession[a.sessionId] = new Set();
    bySession[a.sessionId].add(a.variantId);
  }
  const multiVariant = Object.entries(bySession).filter(([, vs]) => vs.size > 1);

  // 4. Any session token appearing more than once?
  const countPerSession = {};
  for (const a of all) {
    countPerSession[a.sessionId] = (countPerSession[a.sessionId] || 0) + 1;
  }
  const duplicateRows = Object.entries(countPerSession).filter(([, c]) => c > 1);

  // 5. Check localStorage token format — all should start with ecart_
  const tokenPatterns = {};
  for (const a of all) {
    const prefix = a.sessionId.slice(0, 10);
    tokenPatterns[prefix] = (tokenPatterns[prefix] || 0) + 1;
  }

  console.log('=== DUPLICATE VISITOR CHECK ===');
  console.log('Total assignment rows:', total);
  console.log('Unique session IDs:', unique.length);
  console.log('Duplicates (same session, multiple rows):', duplicateRows.length);
  console.log('Multi-variant sessions (same session, different variants):', multiVariant.length);
  console.log('');
  console.log(total === unique.length ? '✅ NO DUPLICATES — every row is a unique session' : '❌ DUPLICATES FOUND');
  console.log(multiVariant.length === 0 ? '✅ NO CROSS-VARIANT LEAKS — every session sees only one variant' : '❌ CROSS-VARIANT LEAK');
  console.log('');

  // 6. Check VisitorSession table for same token appearing multiple times
  const sessions = await p.visitorSession.findMany({
    where: { storeId: exp.storeId },
    select: { sessionToken: true, id: true },
  });
  const tokenToSessions = {};
  for (const s of sessions) {
    if (!tokenToSessions[s.sessionToken]) tokenToSessions[s.sessionToken] = [];
    tokenToSessions[s.sessionToken].push(s.id);
  }
  const multiSessionTokens = Object.entries(tokenToSessions).filter(([, ids]) => ids.length > 1);
  console.log('VisitorSession tokens with multiple DB rows:', multiSessionTokens.length);
  if (multiSessionTokens.length > 0) {
    console.log('  (same localStorage token creating multiple server sessions)');
    console.log('  Examples:', multiSessionTokens.slice(0, 3).map(([t, ids]) => t.slice(0, 25) + '... = ' + ids.length + ' rows'));
  } else {
    console.log('✅ NO DUPLICATE SESSIONS — each localStorage token = exactly 1 server session');
  }

  await p.$disconnect();
})();
