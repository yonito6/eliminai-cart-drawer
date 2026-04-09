import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/stores/:id/stats — dashboard overview
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const store = await prisma.store.findUnique({ where: { id: params.id } });
  if (!store) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const totalSessions = await prisma.visitorSession.count({ where: { storeId: store.id } });
  const totalEvents = await prisma.event.count({ where: { storeId: store.id } });
  const totalCartOpens = await prisma.event.count({
    where: { storeId: store.id, eventType: 'CART_OPENED' },
  });
  const totalCheckouts = await prisma.event.count({
    where: { storeId: store.id, eventType: 'CHECKOUT_CLICKED' },
  });
  const totalOrders = await prisma.event.count({
    where: { storeId: store.id, eventType: 'ORDER_COMPLETED' },
  });

  const activeExperiments = await prisma.experiment.count({
    where: { storeId: store.id, status: 'RUNNING' },
  });
  const completedExperiments = await prisma.experiment.count({
    where: { storeId: store.id, status: { in: ['WINNER_FOUND', 'NO_DIFFERENCE'] } },
  });

  // Last 7 days activity
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentSessions = await prisma.visitorSession.count({
    where: { storeId: store.id, firstSeenAt: { gte: sevenDaysAgo } },
  });
  const recentCartOpens = await prisma.event.count({
    where: { storeId: store.id, eventType: 'CART_OPENED', createdAt: { gte: sevenDaysAgo } },
  });
  const recentCheckouts = await prisma.event.count({
    where: { storeId: store.id, eventType: 'CHECKOUT_CLICKED', createdAt: { gte: sevenDaysAgo } },
  });

  return NextResponse.json({
    store: {
      id: store.id,
      shopDomain: store.shopDomain,
      currency: store.currency,
      baselineCheckoutRate: store.baselineCheckoutRate,
      baselineCartOpens: store.baselineCartOpens,
    },
    totals: {
      sessions: totalSessions,
      events: totalEvents,
      cartOpens: totalCartOpens,
      checkouts: totalCheckouts,
      orders: totalOrders,
      checkoutRate: totalCartOpens > 0 ? (totalCheckouts / totalCartOpens * 100).toFixed(1) : '0.0',
    },
    experiments: {
      active: activeExperiments,
      completed: completedExperiments,
    },
    last7Days: {
      sessions: recentSessions,
      cartOpens: recentCartOpens,
      checkouts: recentCheckouts,
      checkoutRate: recentCartOpens > 0 ? (recentCheckouts / recentCartOpens * 100).toFixed(1) : '0.0',
    },
  });
}
