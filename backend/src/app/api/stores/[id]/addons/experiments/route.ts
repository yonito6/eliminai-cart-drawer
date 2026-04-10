import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/stores/:id/addons/experiments — get active experiments per addon
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const experiments = await prisma.experiment.findMany({
    where: { storeId: params.id, status: { in: ['RUNNING', 'WINNER_FOUND', 'NO_DIFFERENCE'] } },
    orderBy: { startedAt: 'desc' },
    include: {
      _count: { select: { assignments: true } },
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
          return {
            ...v,
            visitors,
            cartOpens,
            checkoutClicks,
            checkoutRate: cartOpens > 0 ? +(checkoutClicks / cartOpens * 100).toFixed(1) : 0,
          };
        })
      );
      return {
        id: exp.id,
        name: exp.name,
        slot: exp.slot,
        status: exp.status,
        confidence: exp.confidence,
        liftPercent: exp.liftPercent ?? 0,
        winnerVariantId: exp.winnerVariantId,
        trafficSplit: exp.trafficSplit,
        totalVisitors: exp._count.assignments,
        startedAt: exp.startedAt,
        endedAt: exp.endedAt,
        variantStats,
      };
    })
  );

  // Group by slot (addon key) — return only the latest per slot
  const bySlot: Record<string, any> = {};
  for (const exp of enriched) {
    if (!bySlot[exp.slot]) {
      bySlot[exp.slot] = exp;
    }
  }

  return NextResponse.json({ experiments: bySlot });
}
