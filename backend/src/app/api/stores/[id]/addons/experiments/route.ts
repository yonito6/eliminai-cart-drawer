import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateSampleTarget, calculateConsistency } from '@/lib/thompson';

// GET /api/stores/:id/addons/experiments — get active experiments per addon
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const experiments = await prisma.experiment.findMany({
    where: { storeId: params.id, status: { in: ['RUNNING', 'PAUSED', 'WINNER_FOUND', 'NO_DIFFERENCE'] } },
    orderBy: { startedAt: 'desc' },
    include: {
      _count: { select: { assignments: true } },
      dailySummaries: true,
    },
  });

  // Enrich with per-variant stats
  const enriched = await Promise.all(
    experiments.map(async (exp) => {
      const variants = exp.variants as any[];
      const variantStats = await Promise.all(
        variants.map(async (v: any) => {
          const visitors = await prisma.variantAssignment.count({
            where: { experimentId: exp.id, variantId: v.id },
          });
          // Unique sessions — 1 user = 1 count
          const cartOpens = (await prisma.event.groupBy({
            by: ['sessionId'],
            where: {
              assignment: { experimentId: exp.id, variantId: v.id },
              eventType: 'CART_OPENED',
            },
          })).length;
          const checkoutClicks = (await prisma.event.groupBy({
            by: ['sessionId'],
            where: {
              assignment: { experimentId: exp.id, variantId: v.id },
              eventType: 'CHECKOUT_CLICKED',
            },
          })).length;
          const orders = (await prisma.event.groupBy({
            by: ['sessionId'],
            where: {
              assignment: { experimentId: exp.id, variantId: v.id },
              eventType: 'ORDER_COMPLETED',
            },
          })).length;
          return {
            ...v,
            visitors,
            cartOpens,
            checkoutClicks,
            checkoutRate: cartOpens > 0 ? +(checkoutClicks / cartOpens * 100).toFixed(1) : 0,
            orders,
            purchaseRate: cartOpens > 0 ? +(orders / cartOpens * 100).toFixed(1) : 0,
          };
        })
      );
      // Smart sample target based on observed purchase rate (orders/cart-opens)
      const totalCartOpens = variantStats.reduce((s: number, v: any) => s + v.cartOpens, 0);
      const totalOrders = variantStats.reduce((s: number, v: any) => s + v.orders, 0);
      // Use observed rate when we have orders, otherwise assume 3% (typical Shopify store)
      // Without this, 0 orders → 0% rate → sample target explodes to 6000+
      const observedPurchaseRate = totalOrders > 0 ? totalOrders / totalCartOpens : 0.03;

      // Get stored notes for daily leaders + consistency
      const expNotes = (exp as any).notes || {};
      const dailyLeaders = expNotes.dailyLeaders || [];
      const consistency = calculateConsistency(dailyLeaders);

      // Smart sample target with consistency multiplier
      const sampleTarget = calculateSampleTarget(observedPurchaseRate, variants.length);
      const adjustedTargetPerVariant = Math.ceil(sampleTarget.nPerVariant * consistency.multiplier);

      // Dynamic order target — derived from store's conversion rate
      const targetOrdersPerVariant = Math.max(25, Math.ceil(sampleTarget.nPerVariant * Math.max(0.005, observedPurchaseRate)));
      const adjustedOrderTarget = Math.ceil(targetOrdersPerVariant * consistency.multiplier);
      const minOrdersAcrossVariants = Math.min(...variantStats.map((v: any) => v.orders));
      const dataMaturity = Math.min(1.0, minOrdersAcrossVariants / adjustedOrderTarget);

      // Current detectable lift — what can we see right now?
      const currentN = Math.min(...variantStats.map((v: any) => v.cartOpens)) || 1;
      const p1 = Math.max(0.005, Math.min(observedPurchaseRate, 0.50));
      const currentDelta = Math.sqrt(6.175 * 2 * p1 * (1 - p1) / currentN);
      const currentDetectableLift = p1 > 0 ? Math.min((currentDelta / p1) * 100, 999) : 999;

      // Legacy field for backward compat
      const clampedMin = adjustedTargetPerVariant;

      // Per-segment visitor breakdown
      const segmentCounts = await prisma.variantAssignment.groupBy({
        by: ['variantId'],
        where: { experimentId: exp.id },
        _count: true,
      });
      // Get segment distribution across all visitors in this experiment
      const segmentBreakdown = await prisma.visitorSession.groupBy({
        by: ['segment'],
        where: {
          assignments: { some: { experimentId: exp.id } },
        },
        _count: true,
      });
      const segmentStats: Record<string, number> = {};
      for (const sb of segmentBreakdown) {
        segmentStats[sb.segment] = sb._count;
      }

      // Build per-day breakdown from LIVE events (not dailySummaries — cron can miss days)
      const dailyByDate: Record<string, Record<string, any>> = {};
      for (const v of variants) {
        // Get all events for this variant, grouped by date
        const events = await prisma.event.findMany({
          where: { assignment: { experimentId: exp.id, variantId: (v as any).id } },
          select: { eventType: true, sessionId: true, createdAt: true },
        });
        // Group by date, then deduplicate by sessionId per eventType
        const byDate: Record<string, { opens: Set<string>; checkouts: Set<string>; orders: Set<string> }> = {};
        for (const e of events) {
          const dateStr = e.createdAt.toISOString().split('T')[0];
          if (!byDate[dateStr]) byDate[dateStr] = { opens: new Set(), checkouts: new Set(), orders: new Set() };
          if (e.eventType === 'CART_OPENED') byDate[dateStr].opens.add(e.sessionId);
          else if (e.eventType === 'CHECKOUT_CLICKED') byDate[dateStr].checkouts.add(e.sessionId);
          else if (e.eventType === 'ORDER_COMPLETED') byDate[dateStr].orders.add(e.sessionId);
        }
        for (const [dateStr, sets] of Object.entries(byDate)) {
          if (!dailyByDate[dateStr]) dailyByDate[dateStr] = {};
          dailyByDate[dateStr][(v as any).id] = {
            cartOpens: sets.opens.size,
            checkouts: sets.checkouts.size,
            orders: sets.orders.size,
            revenue: 0,
            visitors: sets.opens.size,
          };
        }
      }
      const dailyBreakdown = Object.entries(dailyByDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, byVariant]) => ({ date, variants: byVariant }));

      return {
        id: exp.id,
        name: exp.name,
        slot: exp.slot,
        status: exp.status,
        confidence: exp.confidence,
        expectedLoss: (exp as any).expectedLoss ?? null,
        liftPercent: exp.liftPercent,
        winnerVariantId: exp.winnerVariantId,
        trafficSplit: exp.trafficSplit,
        totalVisitors: exp._count.assignments,
        startedAt: exp.startedAt,
        endedAt: exp.endedAt,
        variantStats,
        segmentStats,
        dailyBreakdown,
        explorationMinPerVariant: clampedMin,
        // Smart sample size fields
        sampleTargetPerVariant: adjustedTargetPerVariant,
        sampleTargetTotal: adjustedTargetPerVariant * variants.length,
        minOrdersPerVariant: adjustedOrderTarget,
        baselinePurchaseRate: observedPurchaseRate,
        // Consistency fields
        dailyLeaders,
        consistency: consistency.score,
        consistencyMultiplier: consistency.multiplier,
        consistencyMessage: consistency.message,
        // ── Smooth dampening fields (new) ──
        dataMaturity,
        targetOrdersPerVariant: adjustedOrderTarget,
        currentDetectableLift,
      };
    })
  );

  // Calculate daily traffic from last 7 days (unique cart-open sessions)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const recentCartSessions = await prisma.event.groupBy({
    by: ['sessionId'],
    where: { storeId: params.id, eventType: 'CART_OPENED', createdAt: { gte: sevenDaysAgo } },
  });
  const dailyTraffic = Math.max(1, Math.round(recentCartSessions.length / 7));

  // Group by slot (addon key) — return only the latest per slot
  const bySlot: Record<string, any> = {};
  for (const exp of enriched) {
    if (!bySlot[exp.slot]) {
      bySlot[exp.slot] = exp;
    }
  }

  // Estimated daily orders: from real experiment data, or Shopify baseline, or fallback
  const store = await prisma.store.findUnique({ where: { id: params.id }, select: { config: true } });
  const storeConfig = (store?.config as any) || {};
  const recentOrderSessions = await prisma.event.groupBy({
    by: ['sessionId'],
    where: { storeId: params.id, eventType: 'ORDER_COMPLETED', createdAt: { gte: sevenDaysAgo } },
  });
  const observedDailyOrders = recentOrderSessions.length > 0 ? Math.max(1, Math.round(recentOrderSessions.length / 7)) : 0;
  const estimatedDailyOrders = observedDailyOrders || storeConfig.estimatedDailyOrders || 10;

  return NextResponse.json({ experiments: bySlot, dailyTraffic, estimatedDailyOrders });
}

// PATCH /api/stores/:id/addons/experiments — rebalance a running experiment
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await req.json().catch(() => null);
  if (!body?.experimentId) {
    return NextResponse.json({ error: 'Missing experimentId' }, { status: 400 });
  }

  const experiment = await prisma.experiment.findFirst({
    where: { id: body.experimentId, storeId: params.id, status: 'RUNNING' },
  });
  if (!experiment) {
    return NextResponse.json({ error: 'Experiment not found or not running' }, { status: 404 });
  }

  // Reset traffic split to equal distribution
  const variants = experiment.variants as any[];
  const equalSplit: Record<string, number> = {};
  for (const v of variants) {
    equalSplit[v.id] = 1 / variants.length;
  }

  await prisma.experiment.update({
    where: { id: experiment.id },
    data: { trafficSplit: equalSplit },
  });

  return NextResponse.json({ ok: true, trafficSplit: equalSplit });
}
