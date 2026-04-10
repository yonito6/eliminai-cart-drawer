import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateThompsonSampling } from '@/lib/thompson';
import { applyWinner, pickNextTest } from '@/lib/autopilot';
import { addExperimentNote } from '@/lib/test-safety';
import { getAddonDefinitions } from '@/lib/addon-definitions';

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

  for (const exp of experiments) {
    const variants = exp.variants as any[];
    const variantStats = [];

    for (const v of variants) {
      const cartOpens = await prisma.event.count({
        where: {
          assignment: { experimentId: exp.id, variantId: v.id },
          eventType: 'CART_OPENED',
        },
      });
      const checkoutClicks = await prisma.event.count({
        where: {
          assignment: { experimentId: exp.id, variantId: v.id },
          eventType: 'CHECKOUT_CLICKED',
        },
      });
      variantStats.push({
        id: v.id,
        successes: checkoutClicks,
        failures: Math.max(0, cartOpens - checkoutClicks),
      });
    }

    // Run Thompson Sampling
    const ts = calculateThompsonSampling(variantStats);
    const daysRunning = Math.floor((Date.now() - new Date(exp.startedAt).getTime()) / 86400000);

    // Decision logic
    let newStatus = exp.status;
    let winnerVariantId = exp.winnerVariantId;
    let endedAt = exp.endedAt;

    if (ts.confidence >= 0.95 && ts.liftPercent > 1) {
      newStatus = 'WINNER_FOUND';
      winnerVariantId = ts.winnerId;
      endedAt = new Date();
    } else if (ts.confidence >= 0.95 && ts.liftPercent <= 1) {
      newStatus = 'NO_DIFFERENCE';
      endedAt = new Date();
    } else if (daysRunning >= exp.maxDays && ts.confidence < 0.80) {
      newStatus = 'NO_DIFFERENCE';
      endedAt = new Date();
    }

    // Safety check: 48h rolling checkout rate
    if (exp.store.baselineCheckoutRate && exp.store.baselineCheckoutRate > 0) {
      const since48h = new Date(Date.now() - 48 * 3600000);
      const recentOpens = await prisma.event.count({
        where: { storeId: exp.storeId, eventType: 'CART_OPENED', createdAt: { gte: since48h } },
      });
      const recentClicks = await prisma.event.count({
        where: { storeId: exp.storeId, eventType: 'CHECKOUT_CLICKED', createdAt: { gte: since48h } },
      });
      if (recentOpens > 20) {
        const recentRate = recentClicks / recentOpens;
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
      confidence: ts.confidence,
      liftPercent: ts.liftPercent,
      status: newStatus,
      trafficSplit: ts.trafficSplit,
    });
  }

  // 2. Aggregate daily summaries
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 86400000);

  for (const exp of experiments) {
    const variants = exp.variants as any[];
    for (const v of variants) {
      const cartOpens = await prisma.event.count({
        where: {
          assignment: { experimentId: exp.id, variantId: v.id },
          eventType: 'CART_OPENED',
          createdAt: { gte: yesterday, lt: today },
        },
      });
      const checkoutClicks = await prisma.event.count({
        where: {
          assignment: { experimentId: exp.id, variantId: v.id },
          eventType: 'CHECKOUT_CLICKED',
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
          cartOpens,
          checkoutClicks,
        },
        update: { cartOpens, checkoutClicks },
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
