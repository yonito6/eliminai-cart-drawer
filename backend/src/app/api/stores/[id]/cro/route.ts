import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchOrders30d, fetchOrdersWindow } from '@/lib/shopify-orders';
import { buildBaseline, computeAov, type CroBaseline } from '@/lib/cro-baseline';
import { computeLift } from '@/lib/cro-lift';
import { buildConversionSeries, windowConversion } from '@/lib/cro-conversion';
import { computeValue } from '@/lib/cro-value';
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
  const croCfg: Record<string, any> = { ...(cfg.cro ?? {}) };
  let cfgDirty = false;
  const wantRefresh = req.nextUrl.searchParams.get('refresh') === '1';

  let baseline: CroBaseline | null = croCfg.baseline ?? null;
  let currency = baseline?.currency ?? store.currency ?? 'USD';

  // Keep a recent baseline object around (currency + display only).
  if ((!baseline || wantRefresh) && store.accessToken && store.shopDomain) {
    try {
      const agg = await fetchOrders30d(store.shopDomain, store.accessToken);
      baseline = buildBaseline(agg);
      croCfg.baseline = baseline;
      cfgDirty = true;
    } catch (e) {
      console.error('[cro] backfill failed', e);
    }
  }

  // Real "before the cart" AOV: orders in the 30 days BEFORE the cart was
  // installed. For stores that predate this feature the old code re-read the
  // recent window, which made "before" equal "now" (~$0 lift). Capture the
  // genuine pre-install window once and cache it. A computed-but-empty window
  // (no pre-install orders) yields null — we do NOT fall back to recent data.
  const installedAt = store.installedAt ? new Date(store.installedAt) : null;
  let aovBefore: number | null = croCfg.preInstall ? (croCfg.preInstall.aov ?? null) : (baseline?.aov ?? null);
  if ((croCfg.preInstall == null || wantRefresh) && installedAt && store.accessToken && store.shopDomain) {
    try {
      const preSince = new Date(installedAt.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const preUntil = installedAt.toISOString();
      const preAgg = await fetchOrdersWindow(store.shopDomain, store.accessToken, preSince, preUntil);
      const pre = {
        aov: preAgg.orderCount > 0 ? computeAov(preAgg.totalRevenue, preAgg.orderCount) : null,
        orderCount: preAgg.orderCount,
        capturedAt: new Date().toISOString(),
      };
      aovBefore = pre.aov;
      croCfg.preInstall = pre;
      cfgDirty = true;
    } catch (e) {
      console.error('[cro] pre-install baseline failed', e);
    }
  }

  if (cfgDirty) {
    try {
      await prisma.store.update({ where: { id: store.id }, data: { config: { ...cfg, cro: croCfg } } });
    } catch (e) {
      console.error('[cro] config persist failed', e);
    }
  }

  // Current AOV from the latest 30 days of orders.
  let currentAov: number | null = null;
  try {
    const agg = await fetchOrders30d(store.shopDomain, store.accessToken);
    currentAov = computeAov(agg.totalRevenue, agg.orderCount);
    currency = agg.currency || currency;
  } catch (e) {
    console.error('[cro] current aov failed', e);
  }

  // Conversion history is anchored to install (full history), not the last 30
  // days, so a 2-month-old store can actually see its trend. Checkout rate and
  // the monthly run-rate still use a recent 30-day slice.
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sinceInstall = installedAt ?? since30;
  const summaries = await prisma.dailySummary.findMany({
    where: { storeId: store.id, date: { gte: sinceInstall } },
    select: { cartOpens: true, checkoutClicks: true, uniqueVisitors: true, ordersCompleted: true, date: true },
  });
  const recent30 = summaries.filter(r => new Date(r.date as any) >= since30);
  const opens = recent30.reduce((s, r) => s + (r.cartOpens ?? 0), 0);
  const clicks = recent30.reduce((s, r) => s + (r.checkoutClicks ?? 0), 0);
  const currentCheckoutRate = opens > 0 ? Math.round((clicks / opens) * 100000) / 100000 : null;
  const recentVisitors = recent30.reduce((s, r) => s + (r.uniqueVisitors ?? 0), 0);
  const recentOrders = recent30.reduce((s, r) => s + (r.ordersCompleted ?? 0), 0);

  const baselineSnap = { aov: aovBefore, checkoutRate: store.baselineCheckoutRate ?? null };
  const currentSnap = { aov: currentAov, checkoutRate: currentCheckoutRate };
  const lift = computeLift(baselineSnap, currentSnap);

  const completed = await prisma.experiment.findMany({
    where: { storeId: store.id, status: { in: ['WINNER_FOUND', 'NO_DIFFERENCE'] } },
    orderBy: { endedAt: 'desc' },
    select: { name: true, status: true, liftPercent: true, endedAt: true, slot: true, winnerVariantId: true, variants: true },
    take: 50,
  });

  // ---- Momentum dashboard payload ----
  const rows = summaries as Array<{ date: any; uniqueVisitors?: number; ordersCompleted?: number }>;
  const totalVisitors = rows.reduce((s, r) => s + (r.uniqueVisitors ?? 0), 0);
  const totalOrders = rows.reduce((s, r) => s + (r.ordersCompleted ?? 0), 0);
  const { before, now } = windowConversion(rows as any, 7);
  const trend = buildConversionSeries(rows as any);
  const winsBanked = cfg.autopilot?.completedCount ?? 0;

  const value = {
    ...computeValue({
      before, now,
      visitors: totalVisitors,
      ordersNow: totalOrders,
      aovBefore,
      aovNow: currentAov,
      winsBanked,
    }),
    thisWeekRevenue: 0,
  };

  // "This week vs prior week": run the same calc over the last 14 distinct days.
  try {
    const key = (d: any) => (typeof d === 'string' ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10));
    const days = Array.from(new Set(rows.map(r => key(r.date)))).sort();
    const last14 = new Set(days.slice(-14));
    const recent = rows.filter(r => last14.has(key(r.date)));
    const tw = windowConversion(recent as any, 7);
    value.thisWeekRevenue = computeValue({
      before: tw.before, now: tw.now,
      visitors: tw.now.visitors, ordersNow: tw.now.orders,
      aovBefore, aovNow: currentAov, winsBanked: 0,
    }).extraRevenue;
  } catch (e) {
    console.error('[cro] this-week calc failed', e);
  }

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
    value,
    before: {
      conversion: before.conversion,
      aov: aovBefore,
      ordersPerMonth: Math.round(before.conversion * recentVisitors),
    },
    now: {
      conversion: now.conversion,
      aov: currentAov,
      ordersPerMonth: recentOrders,
    },
    trend,
    milestones,
    fuel: { visitors: totalVisitors },
    roadmap,
    suggestions: CRO_SUGGESTIONS,
    activatedSuggestions,
  });
}
