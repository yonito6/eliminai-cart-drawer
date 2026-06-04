import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchOrders30d } from '@/lib/shopify-orders';
import { buildBaseline, computeAov, type CroBaseline } from '@/lib/cro-baseline';
import { computeLift } from '@/lib/cro-lift';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const store = await prisma.store.findUnique({ where: { id: params.id } });
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const cfg = (store.config as Record<string, any>) ?? {};
  let baseline: CroBaseline | null = cfg.cro?.baseline ?? null;

  // Backfill for stores installed before this feature.
  const wantRefresh = req.nextUrl.searchParams.get('refresh') === '1';
  if ((!baseline || wantRefresh) && store.accessToken && store.shopDomain) {
    try {
      const agg = await fetchOrders30d(store.shopDomain, store.accessToken);
      baseline = buildBaseline(agg);
      await prisma.store.update({
        where: { id: store.id },
        data: { config: { ...cfg, cro: { ...(cfg.cro ?? {}), baseline } } },
      });
    } catch (e) {
      console.error('[cro] backfill failed', e);
    }
  }

  // Current AOV from the latest 30 days of orders.
  let currentAov: number | null = null;
  let currency = baseline?.currency ?? store.currency ?? 'USD';
  try {
    const agg = await fetchOrders30d(store.shopDomain, store.accessToken);
    currentAov = computeAov(agg.totalRevenue, agg.orderCount);
    currency = agg.currency || currency;
  } catch (e) {
    console.error('[cro] current aov failed', e);
  }

  // Current cart checkout rate from recent DailySummary rows (last 30 days).
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const summaries = await prisma.dailySummary.findMany({
    where: { storeId: store.id, date: { gte: since } },
    select: { cartOpens: true, checkoutClicks: true },
  });
  const opens = summaries.reduce((s, r) => s + (r.cartOpens ?? 0), 0);
  const clicks = summaries.reduce((s, r) => s + (r.checkoutClicks ?? 0), 0);
  const currentCheckoutRate = opens > 0 ? Math.round((clicks / opens) * 100000) / 100000 : null;

  const baselineSnap = { aov: baseline?.aov ?? null, checkoutRate: store.baselineCheckoutRate ?? null };
  const currentSnap = { aov: currentAov, checkoutRate: currentCheckoutRate };
  const lift = computeLift(baselineSnap, currentSnap);

  const completed = await prisma.experiment.findMany({
    where: { storeId: store.id, status: { in: ['WINNER_FOUND', 'NO_DIFFERENCE'] } },
    orderBy: { endedAt: 'desc' },
    select: { name: true, status: true, liftPercent: true, endedAt: true },
    take: 50,
  });

  return NextResponse.json({
    currency,
    baselineCheckoutRate: store.baselineCheckoutRate ?? null,
    baseline,
    current: { aov: currentAov, checkoutRate: currentCheckoutRate },
    lift,
    activity: completed.map(e => ({
      name: e.name,
      status: e.status,
      liftPercent: e.liftPercent,
      endedAt: e.endedAt,
    })),
  });
}
