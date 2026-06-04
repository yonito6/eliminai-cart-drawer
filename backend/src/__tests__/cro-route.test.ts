import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    store: { findUnique: vi.fn(), update: vi.fn() },
    dailySummary: { findMany: vi.fn().mockResolvedValue([]) },
    experiment: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
  },
}));
vi.mock('../lib/shopify-orders', () => ({
  fetchOrders30d: vi.fn().mockResolvedValue({ orderCount: 10, totalRevenue: 1500, currency: 'USD' }),
  fetchOrdersWindow: vi.fn().mockResolvedValue({ orderCount: 0, totalRevenue: 0, currency: 'USD' }),
}));

import { prisma } from '../lib/prisma';
import { fetchOrdersWindow } from '../lib/shopify-orders';
import { NextRequest } from 'next/server';

async function call(id: string, url = `http://x/api/stores/${id}/cro`) {
  const { GET } = await import('../app/api/stores/[id]/cro/route');
  return GET(new NextRequest(url), { params: { id } });
}

describe('GET /api/stores/[id]/cro', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('404s when the store does not exist', async () => {
    (prisma.store.findUnique as any).mockResolvedValue(null);
    const res = await call('missing');
    expect(res.status).toBe(404);
  });

  it('returns baseline, current aov, lift and activity', async () => {
    (prisma.store.findUnique as any).mockResolvedValue({
      id: 's1', shopDomain: 'shop.myshopify.com', accessToken: 'tok',
      baselineCheckoutRate: 0.10,
      config: { cro: { baseline: { capturedAt: '2026-05-01T00:00:00.000Z', windowDays: 30, orders30d: 8, revenue30d: 1000, aov: 125, currency: 'USD' } } },
    });
    (prisma.dailySummary.findMany as any).mockResolvedValue([
      { cartOpens: 100, checkoutClicks: 13, date: '2026-05-15', uniqueVisitors: 50, ordersCompleted: 1 },
    ]);
    (prisma.experiment.findMany as any).mockResolvedValue([
      { name: 'Trust Badges', status: 'WINNER_FOUND', liftPercent: 4.2, endedAt: new Date('2026-05-20T00:00:00Z') },
    ]);

    const res = await call('s1');
    const body = await res.json();
    expect(body.baseline.aov).toBe(125);
    expect(body.current.aov).toBe(150);          // 1500 / 10
    expect(body.current.checkoutRate).toBeCloseTo(0.13, 5);
    expect(body.lift.aov).toEqual({ absolute: 25, percent: 20 });
    expect(body.activity).toHaveLength(1);
    expect(body.activity[0].name).toBe('Trust Badges');
    expect(body.baselineCheckoutRate).toBe(0.10);
  });

  it('returns the momentum payload (value, before/now, trend, fuel, roadmap, suggestions)', async () => {
    (prisma.store.findUnique as any).mockResolvedValue({
      id: 's3', shopDomain: 'shop.myshopify.com', accessToken: 'tok',
      baselineCheckoutRate: 0.1,
      config: {
        cro: { baseline: { aov: 168.2, currency: 'USD' } },
        autopilot: { completedCount: 3 },
        addons: {},
      },
    });
    (prisma.dailySummary.findMany as any).mockResolvedValue([
      { date: '2026-04-09', uniqueVisitors: 100, ordersCompleted: 1, cartOpens: 10, checkoutClicks: 5 },
      { date: '2026-06-03', uniqueVisitors: 100, ordersCompleted: 2, cartOpens: 10, checkoutClicks: 6 },
    ]);
    (prisma.experiment.findMany as any).mockResolvedValue([]);
    (prisma.experiment.findFirst as any).mockResolvedValue(null);
    const res = await call('s3');
    const body = await res.json();
    expect(body.value).toBeDefined();
    expect(body.value.winsBanked).toBe(3);
    expect(body.now.aov).toBe(150);               // from fetchOrders30d mock 1500/10
    expect(Array.isArray(body.trend)).toBe(true);
    expect(body.trend.length).toBe(2);
    expect(body.fuel.visitors).toBe(200);
    expect(Array.isArray(body.suggestions)).toBe(true);
    expect(body.suggestions.length).toBe(5);
    expect(body.roadmap).toBeDefined();
    expect(Array.isArray(body.roadmap.queue)).toBe(true);
  });

  it('uses a real pre-install Shopify window for AOV "before" (not the recent window)', async () => {
    // Store installed ~60 days ago, no cached preInstall yet.
    const installedAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    (prisma.store.findUnique as any).mockResolvedValue({
      id: 's4', shopDomain: 'shop.myshopify.com', accessToken: 'tok',
      baselineCheckoutRate: 0.1, installedAt,
      config: { cro: { baseline: { aov: 999, currency: 'USD' } } }, // stale recent backfill, must be ignored
    });
    // Pre-install window: real "before the cart" AOV = 1000/10 = 100.
    (fetchOrdersWindow as any).mockResolvedValue({ orderCount: 10, totalRevenue: 1000, currency: 'USD' });
    (prisma.dailySummary.findMany as any).mockResolvedValue([
      { date: '2026-04-09', uniqueVisitors: 100, ordersCompleted: 2, cartOpens: 10, checkoutClicks: 5 },
      { date: '2026-06-03', uniqueVisitors: 100, ordersCompleted: 6, cartOpens: 10, checkoutClicks: 6 },
    ]);
    (prisma.experiment.findMany as any).mockResolvedValue([]);
    (prisma.experiment.findFirst as any).mockResolvedValue(null);

    const res = await call('s4');
    const body = await res.json();
    // "before" AOV comes from the pre-install window (100), not the stale 999 baseline.
    expect(body.before.aov).toBe(100);
    // now AOV = 1500/10 = 150 → real AOV lift of +50.
    expect(body.value.aovLift).toBe(50);
    expect(fetchOrdersWindow).toHaveBeenCalled();
    // The captured pre-install baseline is persisted.
    expect(prisma.store.update).toHaveBeenCalled();
  });

  it('backfills the baseline when missing and refresh=1 is passed', async () => {
    (prisma.store.findUnique as any).mockResolvedValue({
      id: 's2', shopDomain: 'shop.myshopify.com', accessToken: 'tok',
      baselineCheckoutRate: null, currency: 'USD',
      config: {}, // no baseline yet
    });
    const res = await call('s2', 'http://x/api/stores/s2/cro?refresh=1');
    const body = await res.json();
    expect(prisma.store.update).toHaveBeenCalled();   // baseline written
    expect(body.baseline.aov).toBe(150);              // 1500 / 10 from the fetchOrders30d mock
  });
});
