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

  // Count UNIQUE sessions per event type — 1 user = 1 count regardless of repeat opens
  const totalCartOpens = (await prisma.event.groupBy({
    by: ['sessionId'],
    where: { storeId: store.id, eventType: 'CART_OPENED' },
  })).length;
  const totalCheckouts = (await prisma.event.groupBy({
    by: ['sessionId'],
    where: { storeId: store.id, eventType: 'CHECKOUT_CLICKED' },
  })).length;
  const totalOrders = (await prisma.event.groupBy({
    by: ['sessionId'],
    where: { storeId: store.id, eventType: 'ORDER_COMPLETED' },
  })).length;

  const activeExperiments = await prisma.experiment.count({
    where: { storeId: store.id, status: 'RUNNING' },
  });
  const completedExperiments = await prisma.experiment.count({
    where: { storeId: store.id, status: { in: ['WINNER_FOUND', 'NO_DIFFERENCE'] } },
  });

  // Last 7 days activity (unique sessions)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentSessions = await prisma.visitorSession.count({
    where: { storeId: store.id, firstSeenAt: { gte: sevenDaysAgo } },
  });
  const recentCartOpens = (await prisma.event.groupBy({
    by: ['sessionId'],
    where: { storeId: store.id, eventType: 'CART_OPENED', createdAt: { gte: sevenDaysAgo } },
  })).length;
  const recentCheckouts = (await prisma.event.groupBy({
    by: ['sessionId'],
    where: { storeId: store.id, eventType: 'CHECKOUT_CLICKED', createdAt: { gte: sevenDaysAgo } },
  })).length;

  // Shopify fallback: when our own data is thin, estimate from Shopify orders
  let shopifyEstimate: { dailyCartOpens: number; dailyOrders: number; source: string } | null = null;

  if (recentCartOpens < 50) {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const apiVersion = '2025-01';
      const countUrl = `https://${store.shopDomain}/admin/api/${apiVersion}/orders/count.json?created_at_min=${thirtyDaysAgo.toISOString()}&status=any`;

      const shopRes = await fetch(countUrl, {
        headers: { 'X-Shopify-Access-Token': store.accessToken },
      });

      if (shopRes.ok) {
        const { count } = await shopRes.json();
        const dailyOrders = Math.round(count / 30);
        const estimatedDailyCartOpens = Math.round(dailyOrders / 0.04);
        shopifyEstimate = {
          dailyCartOpens: Math.max(estimatedDailyCartOpens, dailyOrders),
          dailyOrders,
          source: 'shopify',
        };
      }
    } catch (e) {
      // Shopify API unavailable
    }
  }

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
    shopifyEstimate,
  });
}
