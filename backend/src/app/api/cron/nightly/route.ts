import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateThompsonSampling, buildCrossStorePriors } from '@/lib/thompson';
import { decideVerdict, countConsecutiveLeaderDays, MAX_DAYS } from '@/lib/winner-decision';
import { progressAutopilot } from '@/lib/autopilot-engine';
import { shouldRevertForCheckoutDrop } from '@/lib/checkout-safety';

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
    const displayStats = [];

    for (const v of variants) {
      // Count UNIQUE sessions (not raw events) — one user = one data point
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
      const uniqueOrderSessions = await prisma.event.groupBy({
        by: ['sessionId'],
        where: {
          assignment: { experimentId: exp.id, variantId: v.id },
          eventType: 'ORDER_COMPLETED',
        },
      });

      const uniqueOpens = uniqueCartSessions.length;
      const uniqueCheckouts = uniqueCheckoutSessions.length;
      const uniqueOrders = uniqueOrderSessions.length;

      // Thompson optimizes for ORDERS (not checkouts)
      // successes = orders, failures = cart opens without order
      variantStats.push({
        id: v.id,
        successes: uniqueOrders,
        failures: Math.max(0, uniqueOpens - uniqueOrders),
      });
      // Display stats — checkout rate shown on dashboard but NOT used by algorithm
      displayStats.push({
        id: v.id,
        cartOpens: uniqueOpens,
        checkouts: uniqueCheckouts,
        orders: uniqueOrders,
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

    // Derive RUNNING-day timeline from DailySummary (one row-set per active date).
    // runningDays counts distinct DailySummary days, NOT raw calendar age: summaries lag by
    // a day, so a brand-new experiment reads 0 here until the first nightly run aggregates yesterday.
    const summaryRows = await prisma.dailySummary.findMany({
      where: { experimentId: exp.id },
      select: { date: true },
      distinct: ['date'],
    });
    const runningDates = summaryRows.map(r => new Date(r.date));
    const runningDays = runningDates.length;
    const hasSaturday = runningDates.some(d => d.getUTCDay() === 6);
    const hasSunday = runningDates.some(d => d.getUTCDay() === 0);

    // Calculate daily orders for dynamic hard floor
    const recentOrderSessions = await prisma.event.groupBy({
      by: ['sessionId'],
      where: { storeId: exp.storeId, eventType: 'ORDER_COMPLETED', createdAt: { gte: sevenDaysAgo } },
    });
    const dailyOrders = Math.max(0, Math.round(recentOrderSessions.length / 7));

    // Run Thompson Sampling — optimizes for order rate (orders / cart opens)
    const ts = calculateThompsonSampling(variantStats, {
      priors,
      dailyTraffic,
      displayStats,
      dailyOrders,
    });

    // ── Track daily leader for consistency scoring ──
    const existingNotes = (exp.notes as any) || {};
    const dailyLeaders: Array<{ date: string; leaderId: string; liftPct: number }> =
      existingNotes.dailyLeaders || [];

    // Add today's leader (based on observed order rates)
    const todayStr = new Date().toISOString().slice(0, 10);
    if (ts.orderRates && Object.keys(ts.orderRates).length >= 2) {
      const sortedByRate = Object.entries(ts.orderRates).sort((a, b) => b[1] - a[1]);
      const todayLeader = sortedByRate[0][0];
      const todayLift = sortedByRate[1][1] > 0
        ? ((sortedByRate[0][1] - sortedByRate[1][1]) / sortedByRate[1][1]) * 100
        : 0;
      const existingIdx = dailyLeaders.findIndex(d => d.date === todayStr);
      if (existingIdx >= 0) {
        dailyLeaders[existingIdx] = { date: todayStr, leaderId: todayLeader, liftPct: todayLift };
      } else {
        dailyLeaders.push({ date: todayStr, leaderId: todayLeader, liftPct: todayLift });
      }
    }

    // Observed purchase rate — retained for notes + future-prior context.
    const totalObs = variantStats.reduce((s, v) => s + v.successes + v.failures, 0);
    const totalSuccesses = variantStats.reduce((s, v) => s + v.successes, 0);
    // Use observed rate when we have orders, otherwise assume 3% (typical Shopify store).
    const observedPurchaseRate = totalSuccesses > 0
      ? totalSuccesses / totalObs
      : 0.03;

    // Decision — single source of truth in winner-decision.ts
    let newStatus = exp.status;
    let winnerVariantId = exp.winnerVariantId;
    let endedAt = exp.endedAt;
    let inconclusive = false;

    const candidateId = ts.winnerCandidateId;
    const leaderOrders = candidateId
      ? (variantStats.find(v => v.id === candidateId)?.successes ?? 0)
      : 0;
    const loserOrders = Math.min(...variantStats.map(v => v.successes));
    const consecutiveLeaderDays = countConsecutiveLeaderDays(dailyLeaders, candidateId);

    const verdict = decideVerdict({
      confidence: ts.confidence,
      expectedLoss: ts.expectedLoss,
      liftPercent: ts.liftPercent,
      winnerCandidateId: candidateId,
      leaderOrders,
      loserOrders,
      targetOrdersPerVariant: ts.targetOrdersPerVariant,
      dynamicLossThreshold: ts.dynamicLossThreshold,
      visitorsPerDay: dailyTraffic,
      runningDays,
      hasSaturday,
      hasSunday,
      consecutiveLeaderDays,
      maxDays: exp.maxDays ?? MAX_DAYS,   // nullish guard — decideVerdict clamps to MAX_DAYS internally
    });

    if (verdict.kind === 'WINNER') {
      newStatus = 'WINNER_FOUND';
      winnerVariantId = verdict.winnerId;
      endedAt = new Date();
    } else if (verdict.kind === 'NO_DIFFERENCE') {
      newStatus = 'NO_DIFFERENCE';
      endedAt = new Date();
    } else if (verdict.kind === 'INCONCLUSIVE') {
      // No INCONCLUSIVE enum value — persist as NO_DIFFERENCE + a note flag.
      newStatus = 'NO_DIFFERENCE';
      endedAt = new Date();
      inconclusive = true;
    }
    // verdict.kind === 'WAIT' → leave RUNNING

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
      if (shouldRevertForCheckoutDrop({
        openSessions: recentOpenSessions.length,
        checkoutSessions: recentCheckoutSessions.length,
        baselineCheckoutRate: exp.store.baselineCheckoutRate,
      })) {
        newStatus = 'REVERTED';
        endedAt = new Date();
      }
    }

    // Update experiment — persist daily leaders + verdict in notes
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
        notes: {
          ...existingNotes,
          dailyLeaders,
          baselinePurchaseRate: observedPurchaseRate,
          minOrdersPerVariant: ts.minOrdersPerVariant,
          verdict: verdict.kind,
          verdictReason: verdict.reason,
          inconclusive,
        },
      },
    });

    // Auto-progress autopilot: apply winner + start next queued test (only on terminal verdict).
    const terminal = newStatus === 'WINNER_FOUND' || newStatus === 'NO_DIFFERENCE' || newStatus === 'REVERTED';
    const autopilotEnabled = ((exp.store.config as any)?.autopilot?.enabled) === true;
    if (terminal && autopilotEnabled) {
      const winnerVariant = (exp.variants as any[]).find(v => v.id === winnerVariantId);
      try {
        await progressAutopilot(prisma, exp.storeId, {
          slot: exp.slot,
          status: newStatus as any,
          winnerFeatures: winnerVariant?.features || {},
          liftPercent: ts.liftPercent,
        });
      } catch (e) {
        console.error('[engine] progression failed for', exp.id, e);
      }
    }

    results.push({
      experimentId: exp.id,
      store: exp.store.shopDomain,
      slot: exp.slot,
      confidence: ts.confidence,
      expectedLoss: ts.expectedLoss,
      liftPercent: ts.liftPercent,
      status: newStatus,
      reason: verdict.reason,
      trafficSplit: ts.trafficSplit,
      dailyTraffic,
      crossStorePriors: Object.keys(priors).length > 0,
      orderRates: ts.orderRates,
      checkoutRates: ts.checkoutRates,
    });
  }

  // 2. Aggregate daily summaries (also unique sessions)
  // Dates throughout this file are UTC-based: the @db.Date summary date is written at
  // UTC midnight (here) and read back by the weekend gate via getUTCDay(), so the stored
  // calendar day and recovered weekday stay correct regardless of server timezone.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
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

      // Count unique visitors (assignments created yesterday for this variant)
      const dailyVisitors = await prisma.variantAssignment.count({
        where: {
          experimentId: exp.id,
          variantId: v.id,
          assignedAt: { gte: yesterday, lt: today },
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
          uniqueVisitors: dailyVisitors,
        },
        update: {
          cartOpens: dailyOpenSessions.length,
          checkoutClicks: dailyCheckoutSessions.length,
          ordersCompleted: dailyOrderSessions.length,
          uniqueVisitors: dailyVisitors,
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
