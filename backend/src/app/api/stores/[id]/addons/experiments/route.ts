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
      return {
        id: exp.id,
        name: exp.name,
        slot: exp.slot,
        status: exp.status,
        confidence: exp.confidence,
        expectedLoss: (exp as any).expectedLoss ?? null,
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

  return NextResponse.json({ experiments: bySlot, dailyTraffic });
}
