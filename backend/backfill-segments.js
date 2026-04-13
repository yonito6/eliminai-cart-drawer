const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

/**
 * Backfill visitor segments for all existing sessions.
 * Checks each session's events to determine the correct segment.
 */
(async () => {
  const sessions = await p.visitorSession.findMany({
    select: { id: true, storeId: true, isReturning: true },
  });
  console.log(`Found ${sessions.length} sessions to backfill`);

  let updated = 0;
  for (const s of sessions) {
    // Check for ORDER_COMPLETED
    const hasOrder = await p.event.findFirst({
      where: { sessionId: s.id, eventType: 'ORDER_COMPLETED' },
      select: { id: true },
    });
    if (hasOrder) {
      await p.visitorSession.update({ where: { id: s.id }, data: { segment: 'EXISTING_CUSTOMER' } });
      updated++;
      continue;
    }

    // Check for CHECKOUT
    const hasCheckout = await p.event.findFirst({
      where: { sessionId: s.id, eventType: { in: ['CHECKOUT_CLICKED', 'CHECKOUT_STARTED'] } },
      select: { id: true },
    });
    if (hasCheckout) {
      await p.visitorSession.update({ where: { id: s.id }, data: { segment: 'CHECKOUT_ABANDONER' } });
      updated++;
      continue;
    }

    // Returning
    if (s.isReturning) {
      await p.visitorSession.update({ where: { id: s.id }, data: { segment: 'RETURNING_BROWSER' } });
      updated++;
      continue;
    }

    // Already NEW_VISITOR (default)
  }

  console.log(`Backfilled ${updated} sessions`);

  // Print summary
  const counts = await p.visitorSession.groupBy({
    by: ['segment'],
    _count: true,
  });
  console.log('\nSegment distribution:');
  for (const c of counts) {
    console.log(`  ${c.segment}: ${c._count}`);
  }

  await p.$disconnect();
})();
