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

  it('returns real revenue, order count, AOV and wins banked', async () => {
    const installedAt = new Date('2026-04-09T13:24:58.140Z');
    (prisma.store.findUnique as any).mockResolvedValue({
      id: 's1', shopDomain: 'shop.myshopify.com', accessToken: 'tok', installedAt,
      config: { autopilot: { completedCount: 3 } },
    });
    (prisma.experiment.findMany as any).mockResolvedValue([
      { name: 'Trust Badges', status: 'WINNER_FOUND', liftPercent: 4.2, endedAt: new Date('2026-05-20T00:00:00Z') },
    ]);

    const res = await call('s1');
    const body = await res.json();
    expect(body.revenue30d).toBe(1500);
    expect(body.orders30d).toBe(10);
    expect(body.aov).toBe(150);               // 1500 / 10
    expect(body.winsBanked).toBe(3);
    expect(body.since).toBe(installedAt.toISOString());
    expect(body.currency).toBe('USD');
    expect(body.activity).toHaveLength(1);
    expect(body.activity[0].name).toBe('Trust Badges');
  });

  it('returns the roadmap and suggestions payload', async () => {
    (prisma.store.findUnique as any).mockResolvedValue({
      id: 's3', shopDomain: 'shop.myshopify.com', accessToken: 'tok',
      config: { autopilot: { completedCount: 0 }, addons: {} },
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
    expect(body.since).toBeNull();
    expect(body.aov).toBe(150);
  });
});
