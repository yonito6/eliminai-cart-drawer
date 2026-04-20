const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const exp = await p.experiment.findFirst({ where: { status: 'RUNNING' } });

  // Sample session tokens to understand format
  const sample = await p.visitorSession.findMany({
    where: { storeId: exp.storeId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { sessionToken: true, createdAt: true, isReturning: true, visitCount: true }
  });
  console.log('Recent sessions:');
  sample.forEach(s => console.log('  ' + s.sessionToken.substring(0, 40) + '... returning=' + s.isReturning + ' visits=' + s.visitCount));

  // Sessions per day
  const allSessions = await p.visitorSession.findMany({
    where: { storeId: exp.storeId },
    select: { createdAt: true }
  });
  const byDay = {};
  for (const s of allSessions) {
    const day = s.createdAt.toISOString().substring(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  }
  console.log('\nSessions per day:');
  Object.entries(byDay).sort().forEach(([d, c]) => console.log('  ' + d + ': ' + c));
  console.log('Total unique sessions:', allSessions.length);

  // What does Shopify see? Approx unique visitors = sessions with visitCount=1 or isReturning=false
  const newVisitors = await p.visitorSession.count({ where: { storeId: exp.storeId, isReturning: false } });
  const returning = await p.visitorSession.count({ where: { storeId: exp.storeId, isReturning: true } });
  console.log('\nNew visitors:', newVisitors, '| Returning:', returning);

  // Check: do tokens use localStorage or sessionStorage?
  // If sessionStorage → new tab = new session = inflated count
  // Look for how many sessions a single "visitor" generates
  // We can check by looking at tokens with similar timestamps from same IP (but we don't store IP)
  // Instead: check how many sessions per hour (spikes = page-refresh duplication)
  const byHour = {};
  for (const s of allSessions) {
    const hour = s.createdAt.toISOString().substring(0, 13);
    byHour[hour] = (byHour[hour] || 0) + 1;
  }
  const hourEntries = Object.entries(byHour).sort();
  console.log('\nSessions per hour (last 48h):');
  hourEntries.slice(-48).forEach(([h, c]) => console.log('  ' + h + ': ' + c));

  await p.$disconnect();
})();
