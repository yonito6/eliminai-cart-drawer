import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateThompsonSampling, buildCrossStorePriors, getOptimalBatchInterval } from '@/lib/thompson';

/**
 * Adaptive batch cron — call this hourly.
 * It only processes stores whose optimal batch interval has elapsed.
 * High traffic (500+/day): processes every call (hourly)
 * Medium traffic (50-499/day): processes every 6th call (~6 hours)
 * Low traffic (<50/day): processes every 24th call (~daily, handled by nightly)
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const results: any[] = [];
  const skipped: string[] = [];

  // Get all running experiments grouped by store
  const experiments = await prisma.experiment.findMany({
    where: { status: 'RUNNING' },
    include: { store: true },
  });

  // Group by store
  const byStore: Record<string, typeof experiments> = {};
  for (const exp of experiments) {
    const list = byStore[exp.storeId] || [];
    list.push(exp);
    byStore[exp.storeId] = list;
  }

  // Pre-fetch cross-store priors
  const completedExperiments = await prisma.experiment.findMany({
    where: { status: { in: ['WINNER_FOUND', 'NO_DIFFERENCE'] } },
    select: { slot: true, variants: true },
  });
  const crossStoreData = (completedExperiments as any[]).map(e => ({
    slot: e.slot,
    variants: (e.variants as any[]).map((v: any) => ({
      id: v.id,
      successes: v.successes ?? 0,
      failures: v.failures ?? 0,
    })),
  }));

  for (const [storeId, storeExperiments] of Object.entries(byStore)) {
    const store = storeExperiments[0].store;

    // Estimate daily traffic
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const recentCartSessions = await prisma.event.groupBy({
      by: ['sessionId'],
      where: { storeId, eventType: 'CART_OPENED', createdAt: { gte: sevenDaysAgo } },
    });
    const dailyTraffic = Math.max(1, Math.round(recentCartSessions.length / 7));
    const optimalInterval = getOptimalBatchInterval(dailyTraffic);

    // Check if enough time has passed since last processing
    // We use the experiment's updatedAt or a metadata field
    // For simplicity: hourly cron only processes high-traffic stores (interval=1)
    // Medium-traffic stores process if current hour is divisible by 6
    // Low-traffic stores skip (handled by nightly cron)
    const currentHour = now.getUTCHours();

    if (optimalInterval === 1) {
      // High traffic: always process
    } else if (optimalInterval === 6) {
      if (currentHour % 6 !== 0) {
        skipped.push(`${store.shopDomain} (medium traffic, next at hour divisible by 6)`);
        continue;
      }
    } else {
      // Low traffic: skip, nightly handles it
      skipped.push(`${store.shopDomain} (low traffic, nightly only)`);
      continue;
    }

    // Process each experiment for this store
    for (const exp of storeExperiments) {
      const variants = exp.variants as any[];
      const variantStats = [];

      for (const v of variants) {
        const uniqueCartSessions = await prisma.event.groupBy({
          by: ['sessionId'],
          where: {
            assignment: { experimentId: exp.id, variantId: v.id },
            eventType: 'CART_OPENED',
          },
        });
        const uniqueOrderSessions = await prisma.event.groupBy({
          by: ['sessionId'],
          where: {
            assignment: { experimentId: exp.id, variantId: v.id },
            eventType: 'ORDER_COMPLETED',
          },
        });

        // Thompson optimizes for ORDERS (not checkouts)
        variantStats.push({
          id: v.id,
          successes: uniqueOrderSessions.length,
          failures: Math.max(0, uniqueCartSessions.length - uniqueOrderSessions.length),
        });
      }

      const trafficTier = dailyTraffic >= 500 ? 'high' as const
        : dailyTraffic >= 50 ? 'medium' as const
        : 'low' as const;

      const priors = buildCrossStorePriors(crossStoreData, exp.slot, trafficTier);

      // Calculate daily orders for dynamic hard floor
      const orderEvents7d = await prisma.event.groupBy({
        by: ['sessionId'],
        where: { storeId, eventType: 'ORDER_COMPLETED', createdAt: { gte: sevenDaysAgo } },
      });
      const dailyOrders = Math.max(0, Math.round(orderEvents7d.length / 7));

      const ts = calculateThompsonSampling(variantStats, {
        priors,
        dailyTraffic,
        dailyOrders,
      });

      // Adaptive cron only rebalances live traffic. Winner/NO_DIFFERENCE decisions
      // belong solely to the nightly cron (it has the full timeline inputs). The
      // `where: status: 'RUNNING'` filter already prevents touching terminal experiments.
      await prisma.experiment.update({
        where: { id: exp.id },
        data: {
          confidence: ts.confidence,
          expectedLoss: ts.expectedLoss,
          liftPercent: ts.liftPercent,
          trafficSplit: ts.trafficSplit,
        },
      });

      results.push({
        experimentId: exp.id,
        store: store.shopDomain,
        slot: exp.slot,
        confidence: ts.confidence,
        expectedLoss: ts.expectedLoss,
        dailyTraffic,
        batchInterval: `${optimalInterval}h`,
      });
    }
  }

  return NextResponse.json({
    processed: results.length,
    skipped: skipped.length,
    results,
    skippedStores: skipped,
  });
}
