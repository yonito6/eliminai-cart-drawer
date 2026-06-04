// backend/src/__tests__/proxy-event-baseline.test.ts
/**
 * BLAST RADIUS MAP — baselineCheckoutRate runaway (>1) fix
 * Target: proxy/event/route.ts CHECKOUT_CLICKED baseline write (lines 91-102).
 * Root cause: cumulative clicks / frozen opens -> ratio exceeds 1 over time.
 * Consumers: cron/nightly safety-revert (176/188), cro+stats+dashboard display.
 * Fix: write ONCE (guard on null) + clamp [0,1]. Cron logic unchanged.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/hmac', () => ({ verifyAppProxySignature: () => true }));
vi.mock('../lib/rate-limit', () => ({
  sessionLimiter: { check: () => true },
  storeLimiter: { check: () => true },
}));
vi.mock('../lib/segment', () => ({ updateSessionSegment: vi.fn() }));
vi.mock('../lib/prisma', () => ({ prisma: {
  store: { findUnique: vi.fn(), update: vi.fn() },
  event: { findFirst: vi.fn(), create: vi.fn(), count: vi.fn() },
  visitorSession: { findUnique: vi.fn() },
}}));

import { prisma } from '../lib/prisma';
import { NextRequest } from 'next/server';

async function clickCheckout(store: any, clicks = 0) {
  (prisma.store.findUnique as any).mockResolvedValue(store);
  (prisma.visitorSession.findUnique as any).mockResolvedValue({ id: 'sess1' });
  (prisma.event.findFirst as any).mockResolvedValue(null);
  (prisma.event.create as any).mockResolvedValue({});
  (prisma.event.count as any).mockResolvedValue(clicks);
  const { POST } = await import('../app/api/proxy/event/route');
  return POST(new NextRequest('http://x/api/proxy/event?shop=shop.myshopify.com', {
    method: 'POST',
    body: JSON.stringify({ sessionToken: 'tok', eventType: 'CHECKOUT_CLICKED' }),
  }));
}

describe('proxy/event baseline checkout rate', () => {
  beforeEach(() => { vi.clearAllMocks(); process.env.SHOPIFY_API_SECRET = 'test'; });

  it('LOCK: still records the event (event.create called, 200)', async () => {
    const res = await clickCheckout(
      { id: 's1', baselineCartOpens: 100, baselineCheckoutRate: 0.12 }, 13);
    expect(res.status).toBe(200);
    expect(prisma.event.create).toHaveBeenCalled();
  });

  it('BUG: does NOT overwrite an existing baselineCheckoutRate (no runaway)', async () => {
    await clickCheckout(
      { id: 's1', baselineCartOpens: 100, baselineCheckoutRate: 0.12 }, 200);
    expect(prisma.store.update).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ baselineCheckoutRate: expect.anything() }),
    }));
  });

  it('captures a clamped fraction on FIRST observation only', async () => {
    await clickCheckout(
      { id: 's1', baselineCartOpens: 100, baselineCheckoutRate: null }, 13);
    expect(prisma.store.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ baselineCheckoutRate: 0.13 }),
    }));
  });

  it('clamps to 1 when cumulative clicks exceed frozen opens', async () => {
    await clickCheckout(
      { id: 's1', baselineCartOpens: 100, baselineCheckoutRate: null }, 250);
    expect(prisma.store.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ baselineCheckoutRate: 1 }),
    }));
  });
});
