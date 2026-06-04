import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchOrdersWindow } from '@/lib/shopify-orders';
import { computeAov } from '@/lib/cro-baseline';
import { CRO_SUGGESTIONS } from '@/lib/cro-suggestions';
import { buildOptimizeQueueRich } from '@/lib/autopilot';
import { ADDON_DEFINITIONS } from '@/lib/addon-definitions';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WEEKS = 8; // 8 weeks ≈ 56 days, within Shopify's ~60-day order window

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const store = await prisma.store.findUnique({ where: { id: params.id } });
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const cfg = (store.config as Record<string, any>) ?? {};
  let currency = store.currency ?? 'USD';

  // Real weekly revenue for the last 8 weeks, straight from Shopify orders.
  // Oldest week first. The headline uses the most recent 4 weeks; the graph
  // shows the full 8-week trend. This is the only fully verifiable data we
  // have: revenue and order count per week.
  const now = Date.now();
  const buckets = Array.from({ length: WEEKS }, (_, i) => {
    const end = new Date(now - (WEEKS - 1 - i) * WEEK_MS);
    const start = new Date(end.getTime() - WEEK_MS);
    return { start, end };
  });
  const weekAggs = await Promise.all(
    buckets.map(b =>
      fetchOrdersWindow(store.shopDomain, store.accessToken, b.start.toISOString(), b.end.toISOString())
        .catch(e => {
          console.error('[cro] weekly shopify fetch failed', e);
          return { orderCount: 0, totalRevenue: 0, currency };
        }),
    ),
  );
  const recentCurrency = weekAggs.map(a => a.currency).find(Boolean);
  if (recentCurrency) currency = recentCurrency;

  const trend = buckets.map((b, i) => ({
    weekStart: b.start.toISOString(),
    revenue: weekAggs[i].totalRevenue,
    orders: weekAggs[i].orderCount,
  }));

  // Headline window = most recent 4 weeks.
  const last4 = weekAggs.slice(-4);
  const revenue = Math.round(last4.reduce((s, a) => s + a.totalRevenue, 0) * 100) / 100;
  const orders = last4.reduce((s, a) => s + a.orderCount, 0);
  const aov = computeAov(revenue, orders);

  const completed = await prisma.experiment.findMany({
    where: { storeId: store.id, status: { in: ['WINNER_FOUND', 'NO_DIFFERENCE'] } },
    orderBy: { endedAt: 'desc' },
    select: { name: true, status: true, liftPercent: true, endedAt: true, slot: true, winnerVariantId: true, variants: true },
    take: 50,
  });

  // Real "wins": A/B tests that proved a winner. Used for the headline count,
  // cumulative lift, and graph markers.
  const wonTests = completed.filter(e => e.status === 'WINNER_FOUND');
  const winsBanked = wonTests.length;
  const cumulativeLift = Math.round(wonTests.reduce((s, e) => s + (e.liftPercent ?? 0), 0) * 10) / 10;
  const wins = wonTests
    .filter(e => e.endedAt)
    .map(e => ({ name: e.name, lift: e.liftPercent, endedAt: (e.endedAt as Date).toISOString() }));

  // Roadmap: real autopilot queue + the active running test. Degrade gracefully.
  let roadmap: { active: any; queue: any[]; phase: string } = { active: null, queue: [], phase: 'complete' };
  let isTesting = false;
  try {
    const testedSlots = completed.map(e => (e as any).slot).filter(Boolean) as string[];
    const winners: Record<string, any> = {};
    for (const e of completed) {
      const slot = (e as any).slot;
      const wvId = (e as any).winnerVariantId;
      const variants = (e as any).variants;
      if (slot && wvId && Array.isArray(variants)) {
        const wv = variants.find((v: any) => v.id === wvId);
        winners[slot] = wv?.features ?? {};
      }
    }
    const { queue, phase } = buildOptimizeQueueRich(ADDON_DEFINITIONS as any, testedSlots, winners);
    const running = await prisma.experiment.findFirst({
      where: { storeId: store.id, status: 'RUNNING' },
      select: { name: true, slot: true },
    });
    isTesting = !!running;
    const active = running ? { name: running.name, slot: running.slot } : (queue[0] ?? null);
    roadmap = { active, queue, phase };
  } catch (e) {
    console.error('[cro] roadmap build failed', e);
  }

  const activatedSuggestions = cfg.croSuggestions?.activated ?? [];

  return NextResponse.json({
    currency,
    since: store.installedAt ? new Date(store.installedAt).toISOString() : null,
    windowLabel: 'last 4 weeks',
    revenue,
    orders,
    aov,
    winsBanked,
    cumulativeLift,
    isTesting,
    activity: completed.map(e => ({
      name: e.name,
      status: e.status,
      liftPercent: e.liftPercent,
      endedAt: e.endedAt,
    })),
    trend,
    wins,
    roadmap,
    suggestions: CRO_SUGGESTIONS,
    activatedSuggestions,
  });
}
