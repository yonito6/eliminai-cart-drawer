import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Check stores
  const stores = await prisma.store.findMany({ select: { id: true, shopDomain: true, isActive: true, baselineCartOpens: true, baselineCheckoutRate: true, currency: true } });
  console.log('\n=== STORES ===');
  stores.forEach(s => console.log(`  ${s.shopDomain} (active=${s.isActive}, cartOpens=${s.baselineCartOpens}, checkoutRate=${s.baselineCheckoutRate})`));

  // Check experiments
  const experiments = await prisma.experiment.findMany({
    select: { id: true, name: true, slot: true, status: true, confidence: true, liftPercent: true, startedAt: true, variants: true, trafficSplit: true, winnerVariantId: true }
  });
  console.log('\n=== EXPERIMENTS ===');
  experiments.forEach(e => {
    console.log(`  ${e.name} [${e.status}] slot=${e.slot} confidence=${e.confidence?.toFixed(2)} lift=${e.liftPercent?.toFixed(1)}%`);
    console.log(`    started: ${e.startedAt}`);
    console.log(`    trafficSplit:`, JSON.stringify(e.trafficSplit));
    const variants = e.variants as any[];
    variants.forEach((v: any) => console.log(`    variant: ${v.id} → ${JSON.stringify(v.features)}`));
  });

  // Check sessions count
  const sessionCount = await prisma.visitorSession.count();
  console.log(`\n=== VISITOR SESSIONS: ${sessionCount} ===`);

  // Check events
  const eventCounts = await prisma.event.groupBy({ by: ['eventType'], _count: true });
  console.log('\n=== EVENTS ===');
  eventCounts.forEach(e => console.log(`  ${e.eventType}: ${e._count}`));

  // Check assignments
  const assignmentCount = await prisma.variantAssignment.count();
  console.log(`\n=== VARIANT ASSIGNMENTS: ${assignmentCount} ===`);

  // Check daily summaries
  const summaries = await prisma.dailySummary.findMany({ orderBy: { date: 'desc' }, take: 5 });
  console.log('\n=== RECENT DAILY SUMMARIES ===');
  summaries.forEach(s => console.log(`  ${s.date.toISOString().slice(0,10)} variant=${s.variantId} opens=${s.cartOpens} checkouts=${s.checkoutClicks} orders=${s.ordersCompleted}`));

  await prisma.$disconnect();
}

main().catch(console.error);
