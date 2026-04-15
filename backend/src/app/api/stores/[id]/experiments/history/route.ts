import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/stores/[id]/experiments/history — all experiments + summary
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const experiments = await prisma.experiment.findMany({
    where: { storeId: params.id },
    orderBy: { startedAt: 'desc' },
    include: {
      dailySummaries: true,
      _count: { select: { assignments: true } },
    },
  });

  const enriched = await Promise.all(experiments.map(async (exp) => {
    const variants = exp.variants as any[];
    const durationDays = exp.endedAt
      ? Math.ceil((new Date(exp.endedAt).getTime() - new Date(exp.startedAt).getTime()) / 86400000)
      : Math.ceil((Date.now() - new Date(exp.startedAt).getTime()) / 86400000);

    // Build per-variant stats from daily summaries + fallback to raw events
    const variantStats = await Promise.all(variants.map(async (v: any) => {
      const summaries = exp.dailySummaries.filter(s => s.variantId === v.id);
      let totalCartOpens = summaries.reduce((s, d) => s + d.cartOpens, 0);
      let totalCheckouts = summaries.reduce((s, d) => s + d.checkoutClicks, 0);
      let totalOrders = summaries.reduce((s, d) => s + d.ordersCompleted, 0);
      const totalRevenue = summaries.reduce((s, d) => s + d.totalRevenue, 0);
      let totalVisitors = summaries.reduce((s, d) => s + d.uniqueVisitors, 0);

      // If daily summaries are empty/incomplete, compute from raw events
      if (totalCartOpens === 0 && totalOrders === 0) {
        const [cartSessions, checkoutSessions, orderSessions] = await Promise.all([
          prisma.event.groupBy({ by: ['sessionId'], where: { assignment: { experimentId: exp.id, variantId: v.id }, eventType: 'CART_OPENED' } }),
          prisma.event.groupBy({ by: ['sessionId'], where: { assignment: { experimentId: exp.id, variantId: v.id }, eventType: 'CHECKOUT_CLICKED' } }),
          prisma.event.groupBy({ by: ['sessionId'], where: { assignment: { experimentId: exp.id, variantId: v.id }, eventType: 'ORDER_COMPLETED' } }),
        ]);
        totalCartOpens = cartSessions.length;
        totalCheckouts = checkoutSessions.length;
        totalOrders = orderSessions.length;
      }

      // Visitors: use daily summaries if available, else count assignments
      if (totalVisitors === 0) {
        totalVisitors = await prisma.variantAssignment.count({
          where: { experimentId: exp.id, variantId: v.id },
        });
      }

      return {
        ...v,
        stats: {
          visitors: totalVisitors,
          cartOpens: totalCartOpens,
          checkouts: totalCheckouts,
          orders: totalOrders,
          revenue: totalRevenue,
          checkoutRate: totalCartOpens > 0 ? (totalCheckouts / totalCartOpens * 100).toFixed(1) : '0.0',
        },
      };
    }));

    // Build per-day breakdown grouped by date
    const dailyByDate: Record<string, Record<string, any>> = {};
    for (const s of exp.dailySummaries) {
      const dateStr = new Date(s.date).toISOString().split('T')[0];
      if (!dailyByDate[dateStr]) dailyByDate[dateStr] = {};
      dailyByDate[dateStr][s.variantId] = {
        cartOpens: s.cartOpens,
        checkouts: s.checkoutClicks,
        orders: s.ordersCompleted,
        revenue: s.totalRevenue,
        visitors: s.uniqueVisitors,
      };
    }
    const dailyBreakdown = Object.entries(dailyByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, byVariant]) => ({ date, variants: byVariant }));

    return {
      id: exp.id,
      name: exp.name,
      slot: exp.slot,
      status: exp.status,
      variants: variantStats,
      winnerVariantId: exp.winnerVariantId,
      confidence: Math.round((exp.confidence || 0) * 100) / 100,
      liftPercent: exp.liftPercent,
      startedAt: exp.startedAt,
      endedAt: exp.endedAt,
      durationDays,
      notes: Array.isArray(exp.notes) ? exp.notes : buildNotesFromObject(exp.notes, exp.startedAt, exp.endedAt),
      tournament: exp.tournament || null,
      totalVisitors: variantStats.reduce((s, v) => s + v.stats.visitors, 0),
      dailyBreakdown,
    };
  }));

  // Summary stats
  const completed = enriched.filter(e => ['WINNER_FOUND', 'NO_DIFFERENCE', 'REVERTED'].includes(e.status));
  const winners = completed.filter(e => e.status === 'WINNER_FOUND');
  const cumulativeLift = winners.reduce((s, e) => s + (e.liftPercent || 0), 0);
  const bestChange = winners.length > 0
    ? winners.reduce((best, e) => (e.liftPercent || 0) > (best.liftPercent || 0) ? e : best)
    : null;

  return NextResponse.json({
    experiments: enriched,
    summary: {
      totalTests: completed.length,
      activeTests: enriched.filter(e => e.status === 'RUNNING').length,
      winRate: completed.length > 0 ? (winners.length / completed.length * 100).toFixed(0) : '0',
      cumulativeLift: cumulativeLift.toFixed(1),
      bestChange: bestChange ? { name: bestChange.name, lift: bestChange.liftPercent } : null,
    },
  });
}

function buildNotesFromObject(notes: any, startedAt: Date, endedAt: Date | null) {
  if (!notes || typeof notes !== 'object') return [];
  const timeline: Array<{ timestamp: string; type: string; detail: string }> = [];
  timeline.push({ timestamp: new Date(startedAt).toISOString(), type: 'start', detail: 'Experiment started' });
  if (notes.endReason) {
    timeline.push({ timestamp: endedAt ? new Date(endedAt).toISOString() : new Date().toISOString(), type: 'end', detail: notes.endReason });
  } else if (endedAt) {
    timeline.push({ timestamp: new Date(endedAt).toISOString(), type: 'end', detail: 'Experiment ended' });
  }
  if (notes.consistency !== undefined) {
    timeline.push({ timestamp: endedAt ? new Date(endedAt).toISOString() : new Date().toISOString(), type: 'info', detail: 'Consistency score: ' + (notes.consistency * 100).toFixed(0) + '%' });
  }
  return timeline;
}
