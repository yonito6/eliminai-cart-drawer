const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const exp = await p.experiment.findFirst({ where: { status: 'RUNNING' } });
  const allAssignments = await p.variantAssignment.findMany({
    where: { experimentId: exp.id },
    orderBy: { assignedAt: 'asc' },
    select: { variantId: true, assignedAt: true },
  });

  // Running balance over time
  let aCount = 0, bCount = 0;
  const variants = exp.variants;
  const vA = variants[0].id, vB = variants[1].id;

  console.log('Running balance (every 10th assignment):');
  for (let i = 0; i < allAssignments.length; i++) {
    if (allAssignments[i].variantId === vA) aCount++;
    else bCount++;
    if ((i + 1) % 10 === 0 || i === allAssignments.length - 1) {
      console.log(`  #${i+1}: A=${aCount} B=${bCount} (diff=${Math.abs(aCount-bCount)}, ratio=${(aCount/(aCount+bCount)*100).toFixed(1)}%)`);
    }
  }

  // Check: are returning visitors (same localStorage token) being re-assigned?
  // Look for session tokens that appear in VisitorSession table with visitCount > 1
  const sessions = await p.visitorSession.findMany({
    where: {
      storeId: exp.storeId,
      createdAt: { gte: new Date(exp.startedAt) },
    },
    orderBy: { visitCount: 'desc' },
    take: 10,
    select: { sessionToken: true, visitCount: true, isReturning: true },
  });
  console.log('\nTop returning visitors:');
  for (const s of sessions) {
    console.log(`  token=${s.sessionToken.slice(0,20)}... visits=${s.visitCount} returning=${s.isReturning}`);
  }

  await p.$disconnect();
})();
