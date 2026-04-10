import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateThompsonSampling, buildCrossStorePriors } from '@/lib/thompson';

export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: any[] = [];

  // 1. Process all RUNNING experiments
  const experiments = await prisma.experiment.findMany({
    where: { status: 'RUNNING' },
    include: { store: true },
  });

  // Pre-fetch cross-store priors from ALL completed experiments
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

  for (const exp of experiments) {
    const variants = exp.variants as any[];
    const variantStats = [];
    const purchaseStats = [];

    for (const v of variants) {
      // Count UNIQUE sessions (not raw events) — one user = one data point
      // regardless of how many times they opened the cart
      const uniqueCartSessions = await prisma.event.groupBy({
        by: ['sessionId'],
        where: {
          assignment: { experimentId: exp.id, variantId: v.id },
          eventType: 'CART_OPENED',
        },
      });
      const uniqueCheckoutSessions = await prisma.event.groupBy({
        by: ['sessionId'],
        where: {
          assignment: { experimentId: exp.id, variantId: v.id },
          eventType: 'CHECKOUT_CLICKED',
        },
      });

      const uniqueOpens = uniqueCartSessions.length;
      const uniqueCheckouts = uniqueCheckoutSessions.length;
      const uniqueOrderSessions = await prisma.event.groupBy({
        by: ["sessionId"],
        where: {
          assignment: { experimentId: exp.id, variantId: v.id },
          eventType: "ORDER_COMPLETED",
        },
      });
      const uniqueOrders = uniqueOrderSessions.length;

      variantStats.push({
        id: v.id,
        successes: uniqueCheckouts,
        failures: Math.max(0, uniqueOpens - uniqueCheckouts),
      });
      purchaseStats.push({
        id: v.id,
        orders: uniqueOrders,
        checkouts: uniqueCheckouts,
      });
    }

    // Estimate daily traffic for this store (last 7 days unique cart opens / 7)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const recentCartSessions = await prisma.event.groupBy({
      by: ['sessionId'],
      where: { storeId: exp.storeId, eventType: 'CART_OPENED', createdAt: { gte: sevenDaysAgo } },
    });
    const dailyTraffic = Math.max(1, Math.round(recentCartSessions.length / 7));

    // Determine traffic tier for cross-store prior scaling
    const trafficTier = dailyTraffic >= 500 ? 'high' as const
      : dailyTraffic >= 50 ? 'medium' as const
      : 'low' as const;

    // Build cross-store priors for this addon slot
    const priors = buildCrossStorePriors(crossStoreData, exp.slot, trafficTier);

    const daysRunning = Math.floor((Date.now() - new Date(exp.startedAt).getTime()) / 86400000);

    // Run Thompson Sampling with full options
    const ts = calculateThompsonSampling(variantStats, {
      priors,
      dailyTraffic,
      purchaseStats,
      minDaysRunning: daysRunning,
    });

    // Decision logic — Thompson now handles winner declaration internally
    // We just need to map its output to experiment status
    let newStatus = exp.status;
    let winnerVariantId = exp.winnerVariantId;
    let endedAt = exp.endedAt;

    if (ts.winnerId) {
      newStatus = 'WINNER_FOUND';
      winnerVariantId = ts.winnerId;
      endedAt = new Date();
    } else if (ts.reason?.includes('No meaningful difference') || ts.reason?.includes('Low impact detected')) {
      // Thompson flagged no meaningful difference or early low-impact stop
      newStatus = 'NO_DIFFERENCE';
      endedAt = new Date();
    } else if (daysRunning >= exp.maxDays && ts.confidence < 0.80) {
      // Ran out of time with low confidence
      newStatus = 'NO_DIFFERENCE';
      endedAt = new Date();
    }

    // Safety check: 48h rolling checkout rate (unique sessions)
    if (exp.store.baselineCheckoutRate && exp.store.baselineCheckoutRate > 0) {
      const since48h = new Date(Date.now() - 48 * 3600000);
      const recentOpenSessions = await prisma.event.groupBy({
        by: ['sessionId'],
        where: { storeId: exp.storeId, eventType: 'CART_OPENED', createdAt: { gte: since48h } },
      });
      const recentCheckoutSessions = await prisma.event.groupBy({
        by: ['sessionId'],
        where: { storeId: exp.storeId, eventType: 'CHECKOUT_CLICKED', createdAt: { gte: since48h } },
      });
      if (recentOpenSessions.length > 20) {
        const recentRate = recentCheckoutSessions.length / recentOpenSessions.length;
        if (recentRate < exp.store.baselineCheckoutRate * 0.95) {
          newStatus = 'REVERTED';
          endedAt = new Date();
        }
      }
    }

    // Update experiment
    await prisma.experiment.update({
      where: { id: exp.id },
      data: {
        confidence: ts.confidence,
        expectedLoss: ts.expectedLoss,
        liftPercent: ts.liftPercent,
        trafficSplit: ts.trafficSplit,
        status: newStatus as any,
        winnerVariantId,
        endedAt,
      },
    });

    results.push({
      experimentId: exp.id,
      store: exp.store.shopDomain,
      slot: exp.slot,
      confidence: ts.confidence,
      expectedLoss: ts.expectedLoss,
      liftPercent: ts.liftPercent,
      status: newStatus,
      reason: ts.reason,
      trafficSplit: ts.trafficSplit,
      dailyTraffic,
      crossStorePriors: Object.keys(priors).length > 0,
      checkoutRates: ts.checkoutRates,
      purchaseRates: ts.purchaseRates,
      compositeScores: ts.compositeScores,
    });
  }

  // 2. Aggregate daily summaries (also unique sessions)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 86400000);

  for (const exp of experiments) {
    const variants = exp.variants as any[];
    for (const v of variants) {
      const dailyOpenSessions = await prisma.event.groupBy({
        by: ['sessionId'],
        where: {
          assignment: { experimentId: exp.id, variantId: v.id },
          eventType: 'CART_OPENED',
          createdAt: { gte: yesterday, lt: today },
        },
      });
      const dailyCheckoutSessions = await prisma.event.groupBy({
        by: ['sessionId'],
        where: {
          assignment: { experimentId: exp.id, variantId: v.id },
          eventType: 'CHECKOUT_CLICKED',
          createdAt: { gte: yesterday, lt: today },
        },
      });

      const dailyOrderSessions = await prisma.event.groupBy({
        by: ['sessionId'],
        where: {
          assignment: { experimentId: exp.id, variantId: v.id },
          eventType: 'ORDER_COMPLETED',
          createdAt: { gte: yesterday, lt: today },
        },
      });

      await prisma.dailySummary.upsert({
        where: {
          experimentId_variantId_date: {
            experimentId: exp.id,
            variantId: v.id,
            date: yesterday,
          },
        },
        create: {
          storeId: exp.storeId,
          experimentId: exp.id,
          variantId: v.id,
          date: yesterday,
          currency: exp.store.currency,
          cartOpens: dailyOpenSessions.length,
          checkoutClicks: dailyCheckoutSessions.length,
          ordersCompleted: dailyOrderSessions.length,
        },
        update: {
          cartOpens: dailyOpenSessions.length,
          checkoutClicks: dailyCheckoutSessions.length,
          ordersCompleted: dailyOrderSessions.length,
        },
      });
    }
  }

  // 3. Prune old raw events (>30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const deleted = await prisma.event.deleteMany({
    where: { createdAt: { lt: thirtyDaysAgo } },
  });

  return NextResponse.json({
    experiments: results,
    aggregated: experiments.length,
    pruned: deleted.count,
  });
}
