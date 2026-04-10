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

  const enriched = experiments.map(exp => {
    const variants = exp.variants as any[];
    const durationDays = exp.endedAt
      ? Math.ceil((new Date(exp.endedAt).getTime() - new Date(exp.startedAt).getTime()) / 86400000)
      : Math.ceil((Date.now() - new Date(exp.startedAt).getTime()) / 86400000);

    // Build per-variant stats from daily summaries
    const variantStats = variants.map((v: any) => {
      const summaries = exp.dailySummaries.filter(s => s.variantId === v.id);
      const totalCartOpens = summaries.reduce((s, d) => s + d.cartOpens, 0);
      const totalCheckouts = summaries.reduce((s, d) => s + d.checkoutClicks, 0);
      const totalOrders = summaries.reduce((s, d) => s + d.ordersCompleted, 0);
      const totalRevenue = summaries.reduce((s, d) => s + d.totalRevenue, 0);
      return {
        ...v,
        stats: {
          visitors: summaries.reduce((s, d) => s + d.uniqueVisitors, 0),
          cartOpens: totalCartOpens,
          checkouts: totalCheckouts,
          orders: totalOrders,
          revenue: totalRevenue,
          checkoutRate: totalCartOpens > 0 ? (totalCheckouts / totalCartOpens * 100).toFixed(1) : '0.0',
        },
      };
    });

    return {
      id: exp.id,
      name: exp.name,
      slot: exp.slot,
      status: exp.status,
      variants: variantStats,
      winnerVariantId: exp.winnerVariantId,
      confidence: exp.confidence,
      liftPercent: exp.liftPercent,
      startedAt: exp.startedAt,
      endedAt: exp.endedAt,
      durationDays,
      notes: exp.notes || [],
      tournament: exp.tournament || null,
      totalVisitors: exp._count.assignments,
    };
  });

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
