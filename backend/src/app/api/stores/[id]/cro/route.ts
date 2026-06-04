import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchOrders30d } from '@/lib/shopify-orders';
import { computeAov } from '@/lib/cro-baseline';
import { CRO_SUGGESTIONS } from '@/lib/cro-suggestions';
import { buildOptimizeQueueRich } from '@/lib/autopilot';
import { ADDON_DEFINITIONS } from '@/lib/addon-definitions';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const store = await prisma.store.findUnique({ where: { id: params.id } });
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const cfg = (store.config as Record<string, any>) ?? {};
  let currency = store.currency ?? 'USD';

  // Real store performance over the last 30 days, straight from Shopify orders.
  // This is the only fully verifiable data we have: revenue, order count, AOV.
  let revenue30d: number | null = null;
  let orders30d: number | null = null;
  let aov: number | null = null;
  try {
    const agg = await fetchOrders30d(store.shopDomain, store.accessToken);
    revenue30d = agg.totalRevenue;
    orders30d = agg.orderCount;
    aov = computeAov(agg.totalRevenue, agg.orderCount);
    currency = agg.currency || currency;
  } catch (e) {
    console.error('[cro] shopify 30d fetch failed', e);
  }

  const winsBanked = cfg.autopilot?.completedCount ?? 0;

  const completed = await prisma.experiment.findMany({
    where: { storeId: store.id, status: { in: ['WINNER_FOUND', 'NO_DIFFERENCE'] } },
    orderBy: { endedAt: 'desc' },
    select: { name: true, status: true, liftPercent: true, endedAt: true, slot: true, winnerVariantId: true, variants: true },
    take: 50,
  });

  // Milestones: addons that have banked a winner.
  const addonsCfg = (cfg.addons as Record<string, any>) ?? {};
  const milestones = Object.entries(addonsCfg)
    .filter(([, a]) => a?.lastWinner?.appliedAt)
    .map(([k, a]) => ({
      date: a.lastWinner.appliedAt,
      addonKey: k,
      label: a.lastWinner.label ?? k,
      lift: a.lastWinner.lift ?? null,
    }));

  // Roadmap: real autopilot queue + the active running test. Degrade gracefully.
  let roadmap: { active: any; queue: any[]; phase: string } = { active: null, queue: [], phase: 'complete' };
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
    const active = running ? { name: running.name, slot: running.slot } : (queue[0] ?? null);
    roadmap = { active, queue, phase };
  } catch (e) {
    console.error('[cro] roadmap build failed', e);
  }

  const activatedSuggestions = cfg.croSuggestions?.activated ?? [];

  return NextResponse.json({
    currency,
    since: store.installedAt ? new Date(store.installedAt).toISOString() : null,
    revenue30d,
    orders30d,
    aov,
    winsBanked,
    activity: completed.map(e => ({
      name: e.name,
      status: e.status,
      liftPercent: e.liftPercent,
      endedAt: e.endedAt,
    })),
    milestones,
    roadmap,
    suggestions: CRO_SUGGESTIONS,
    activatedSuggestions,
  });
}
