import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    store: { findUnique: vi.fn(), update: vi.fn() },
    dailySummary: { findMany: vi.fn().mockResolvedValue([]) },
    experiment: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
  },
}));
vi.mock('../lib/shopify-orders', () => ({
  // Each weekly window returns the same aggregate; the route fetches 8 weeks
  // and the headline sums the most recent 4.
  fetchOrdersWindow: vi.fn().mockResolvedValue({ orderCount: 10, totalRevenue: 1500, currency: 'USD' }),
}));

import { prisma } from '../lib/prisma';
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

  it('returns headline revenue/orders/AOV from the last 4 weeks plus the 8-week trend', async () => {
    const installedAt = new Date('2026-04-09T13:24:58.140Z');
    (prisma.store.findUnique as any).mockResolvedValue({
      id: 's1', shopDomain: 'shop.myshopify.com', accessToken: 'tok', installedAt,
      config: {},
    });
    (prisma.experiment.findMany as any).mockResolvedValue([]);
    (prisma.experiment.findFirst as any).mockResolvedValue(null);

    const res = await call('s1');
    const body = await res.json();
    // 4 most-recent weeks × (1500 revenue, 10 orders)
    expect(body.revenue).toBe(6000);
    expect(body.orders).toBe(40);
    expect(body.aov).toBe(150);               // 6000 / 40
    expect(body.windowLabel).toBe('last 4 weeks');
    expect(body.since).toBe(installedAt.toISOString());
    expect(body.currency).toBe('USD');
    // full 8-week trend, oldest first
    expect(Array.isArray(body.trend)).toBe(true);
    expect(body.trend).toHaveLength(8);
    expect(body.trend[0].revenue).toBe(1500);
    expect(body.trend[0].orders).toBe(10);
    expect(typeof body.trend[0].weekStart).toBe('string');
  });

  it('counts WINNER_FOUND experiments as wins banked with cumulative lift and win markers', async () => {
    (prisma.store.findUnique as any).mockResolvedValue({
      id: 's2', shopDomain: 'shop.myshopify.com', accessToken: 'tok', config: {},
    });
    (prisma.experiment.findMany as any).mockResolvedValue([
      { name: 'Trust Badges', status: 'WINNER_FOUND', liftPercent: 59, endedAt: new Date('2026-05-20T00:00:00Z'), slot: 'trustBadges', winnerVariantId: null, variants: [] },
      { name: 'Sticky Bar', status: 'WINNER_FOUND', liftPercent: 12.4, endedAt: new Date('2026-05-25T00:00:00Z'), slot: 'stickyBar', winnerVariantId: null, variants: [] },
      { name: 'Free Ship Meter', status: 'NO_DIFFERENCE', liftPercent: 0, endedAt: new Date('2026-05-27T00:00:00Z'), slot: 'shipMeter', winnerVariantId: null, variants: [] },
    ]);
    (prisma.experiment.findFirst as any).mockResolvedValue(null);

    const res = await call('s2');
    const body = await res.json();
    expect(body.winsBanked).toBe(2);          // only WINNER_FOUND
    expect(body.cumulativeLift).toBe(71.4);   // 59 + 12.4
    expect(body.wins).toHaveLength(2);
    expect(body.wins[0].name).toBe('Trust Badges');
    expect(body.activity).toHaveLength(3);     // all completed experiments
  });

  it('flags isTesting when a RUNNING experiment exists', async () => {
    (prisma.store.findUnique as any).mockResolvedValue({
      id: 's5', shopDomain: 'shop.myshopify.com', accessToken: 'tok', config: {},
    });
    (prisma.experiment.findMany as any).mockResolvedValue([]);
    (prisma.experiment.findFirst as any).mockResolvedValue({ name: 'Express Buttons', slot: 'expressPayments' });

    const res = await call('s5');
    const body = await res.json();
    expect(body.isTesting).toBe(true);
    expect(body.roadmap.active).toEqual({ name: 'Express Buttons', slot: 'expressPayments' });
  });

  it('returns the roadmap and suggestions payload', async () => {
    (prisma.store.findUnique as any).mockResolvedValue({
      id: 's3', shopDomain: 'shop.myshopify.com', accessToken: 'tok',
      config: { addons: {} },
    });
    (prisma.experiment.findMany as any).mockResolvedValue([]);
    (prisma.experiment.findFirst as any).mockResolvedValue(null);

    const res = await call('s3');
    const body = await res.json();
    expect(Array.isArray(body.suggestions)).toBe(true);
    expect(body.suggestions.length).toBe(5);
    expect(body.roadmap).toBeDefined();
    expect(Array.isArray(body.roadmap.queue)).toBe(true);
    expect(body.winsBanked).toBe(0);
    expect(body.isTesting).toBe(false);
  });

  it('defaults wins banked to 0 and since to null when not set', async () => {
    (prisma.store.findUnique as any).mockResolvedValue({
      id: 's4', shopDomain: 'shop.myshopify.com', accessToken: 'tok',
      installedAt: null, config: {},
    });
    (prisma.experiment.findMany as any).mockResolvedValue([]);
    (prisma.experiment.findFirst as any).mockResolvedValue(null);

    const res = await call('s4');
    const body = await res.json();
    expect(body.winsBanked).toBe(0);
    expect(body.cumulativeLift).toBe(0);
    expect(body.since).toBeNull();
    expect(body.aov).toBe(150);
  });
});
