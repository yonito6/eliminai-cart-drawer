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

  // ── Shopify fallback: when our own data is thin, estimate from Shopify orders ──
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
        // Industry average: ~3-5% of cart opens become orders
        // Using 4% as a middle estimate
        const estimatedDailyCartOpens = Math.round(dailyOrders / 0.04);
        shopifyEstimate = {
          dailyCartOpens: Math.max(estimatedDailyCartOpens, dailyOrders),
          dailyOrders,
          source: 'shopify',
        };
      }
    } catch (e) {
      // Shopify API unavailable — skip fallback silently
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
