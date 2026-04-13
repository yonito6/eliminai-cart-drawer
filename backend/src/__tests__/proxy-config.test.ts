/**
 * BLAST RADIUS MAP — POST /api/proxy/config (new endpoint)
 * Target: backend/src/app/api/proxy/config/route.ts (new file)
 *
 * CALLERS: Shopify App Proxy (cart drawer JS) — external, no internal callers yet
 *
 * DEPENDENCIES USED (not modified):
 *   - verifyAppProxySignature (hmac.ts) — covered by its own tests
 *   - assignVariant (variant-assign.ts) — covered by its own tests
 *   - prisma.store.findUnique — new use in this route
 *   - prisma.store.update (baselineCartOpens increment) — new write path
 *
 * SHARED STATE WRITTEN:
 *   - Store.baselineCartOpens (incremented when no experiment)
 *
 * CROSS-PATH RISK:
 *   - Task 8 (POST /api/proxy/event) will also do HMAC + store lookup —
 *     response contract from this endpoint must stay stable
 *   - Task 9 (cart drawer JS) reads experiment.variant and experiment.features
 *     from this response — shape must not change
 *
 * LOCK TESTS (behavior that must never regress):
 *   - LOCK-1: Invalid HMAC → 401
 *   - LOCK-2: Missing shop or sessionToken → 400
 *   - LOCK-3: Unknown store → 404
 *   - LOCK-4: Inactive store → 404
 *   - LOCK-5: Baseline (no experiment) increments baselineCartOpens
 *   - LOCK-6: Experiment assignment → returns experiment shape with id/variant/features
 *   - LOCK-7: Response always has Cache-Control: no-store
 *   - LOCK-8: sessionId always returned
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

// Mock dependencies
vi.mock('../lib/prisma', () => ({
  prisma: {
    store: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../lib/variant-assign', () => ({
  assignVariant: vi.fn(),
}));

vi.mock('../lib/hmac', () => ({
  verifyAppProxySignature: vi.fn(),
}));

import { prisma } from '../lib/prisma';
import { assignVariant } from '../lib/variant-assign';
import { verifyAppProxySignature } from '../lib/hmac';

// Dynamic import to pick up mocks
const getHandler = async () => {
  const mod = await import('../app/api/proxy/config/route');
  return mod.POST;
};

// Helper: build a NextRequest with query params and JSON body
function makeRequest(
  queryParams: Record<string, string>,
  body: Record<string, any> = {}
): NextRequest {
  const url = new URL('https://eliminai.ai/api/proxy/config');
  for (const [k, v] of Object.entries(queryParams)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_QUERY = {
  shop: 'test.myshopify.com',
  timestamp: '1712678400',
  signature: 'valid_sig',
};

const MOCK_STORE = {
  id: 'store_abc',
  shopDomain: 'test.myshopify.com',
  isActive: true,
  config: { showTrustBadges: false },
  currency: 'USD',
};

describe('POST /api/proxy/config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (verifyAppProxySignature as any).mockReturnValue(true);
    (prisma.store.findUnique as any).mockResolvedValue(MOCK_STORE);
    (prisma.store.update as any).mockResolvedValue(MOCK_STORE);
    (assignVariant as any).mockResolvedValue({
      experiment: null,
      variant: null,
      isNew: true,
      sessionId: 'sess_xyz',
    });
    // Reset module cache so each test gets a fresh handler
    vi.resetModules();
  });

  // LOCK-1: Invalid HMAC → 401
  it('LOCK-1: returns 401 when HMAC signature is invalid', async () => {
    (verifyAppProxySignature as any).mockReturnValue(false);
    const POST = (await getHandler());
    const req = makeRequest(VALID_QUERY, { sessionToken: 'tok1' });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBeDefined();
    expect(json.error).not.toBeUndefined();
    // Must NOT have called store lookup after auth failure
    expect(prisma.store.findUnique).not.toHaveBeenCalled();
  });

  // LOCK-2: Missing sessionToken → 400
  it('LOCK-2: returns 400 when sessionToken is missing', async () => {
    const POST = (await getHandler());
    const req = makeRequest(VALID_QUERY, {}); // no sessionToken
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // LOCK-2b: Missing shop → 400
  it('LOCK-2b: returns 400 when shop is missing from query', async () => {
    const POST = (await getHandler());
    const req = makeRequest({ timestamp: '123', signature: 'x' }, { sessionToken: 'tok1' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // LOCK-3: Unknown store → 404
  it('LOCK-3: returns 404 when store is not found', async () => {
    (prisma.store.findUnique as any).mockResolvedValue(null);
    const POST = (await getHandler());
    const req = makeRequest(VALID_QUERY, { sessionToken: 'tok1' });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  // LOCK-4: Inactive store → 404
  it('LOCK-4: returns 404 when store exists but is inactive', async () => {
    (prisma.store.findUnique as any).mockResolvedValue({ ...MOCK_STORE, isActive: false });
    const POST = (await getHandler());
    const req = makeRequest(VALID_QUERY, { sessionToken: 'tok1' });
    const res = await POST(req);
    expect(res.status).toBe(404);
    // Must not assign variant for inactive store
    expect(assignVariant).not.toHaveBeenCalled();
  });

  // LOCK-5: Baseline (no experiment) increments baselineCartOpens
  it('LOCK-5: increments baselineCartOpens when no experiment is running', async () => {
    (assignVariant as any).mockResolvedValue({
      experiment: null,
      variant: null,
      isNew: true,
      sessionId: 'sess_xyz',
    });
    const POST = (await getHandler());
    const req = makeRequest(VALID_QUERY, { sessionToken: 'tok1' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(prisma.store.update).toHaveBeenCalledWith({
      where: { id: MOCK_STORE.id },
      data: { baselineCartOpens: { increment: 1 } },
    });
    const json = await res.json();
    expect(json.experiment).toBeNull();
  });

  // LOCK-5b: When experiment IS assigned, do NOT increment baselineCartOpens
  it('LOCK-5b: does NOT increment baselineCartOpens when experiment is assigned', async () => {
    (assignVariant as any).mockResolvedValue({
      experiment: { id: 'exp1', features: { showTrustBadges: true } },
      variant: 'treatment',
      isNew: true,
      sessionId: 'sess_xyz',
    });
    const POST = (await getHandler());
    const req = makeRequest(VALID_QUERY, { sessionToken: 'tok1' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(prisma.store.update).not.toHaveBeenCalled();
  });

  // LOCK-6: Experiment assignment → returns correct shape
  it('LOCK-6: returns experiment id, variant, and features when experiment is assigned', async () => {
    (assignVariant as any).mockResolvedValue({
      experiment: { id: 'exp1', features: { showTrustBadges: true } },
      variant: 'treatment',
      isNew: true,
      sessionId: 'sess_exp',
    });
    const POST = (await getHandler());
    const req = makeRequest(VALID_QUERY, { sessionToken: 'tok2' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.experiment).toEqual({
      id: 'exp1',
      variant: 'treatment',
      features: { showTrustBadges: true },
    });
    expect(json.sessionId).toBe('sess_exp');
    expect(json.cartConfig).toEqual(MOCK_STORE.config);
    expect(json.currency).toBe('USD');
  });

  // LOCK-7: Cache-Control header always present
  it('LOCK-7: response always includes Cache-Control: no-store header', async () => {
    const POST = (await getHandler());
    const req = makeRequest(VALID_QUERY, { sessionToken: 'tok1' });
    const res = await POST(req);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });

  // LOCK-8: sessionId always in response
  it('LOCK-8: response always includes sessionId', async () => {
    const POST = (await getHandler());
    const req = makeRequest(VALID_QUERY, { sessionToken: 'tok1' });
    const res = await POST(req);
    const json = await res.json();
    expect(json.sessionId).toBeDefined();
    expect(typeof json.sessionId).toBe('string');
  });

  // LOCK-9: assignVariant called with correct params including optional fields
  it('LOCK-9: passes deviceType, isReturning, referralSource, country to assignVariant', async () => {
    const POST = (await getHandler());
    const req = makeRequest(VALID_QUERY, {
      sessionToken: 'tok1',
      deviceType: 'MOBILE',
      isReturning: true,
      referralSource: 'instagram',
      country: 'US',
    });
    await POST(req);
    expect(assignVariant).toHaveBeenCalledWith(
      MOCK_STORE.id,
      'tok1',
      'MOBILE',
      true,
      'instagram',
      'US',
      1,
      false
    );
  });

  // LOCK-9b: defaults for optional params
  it('LOCK-9b: defaults deviceType to DESKTOP and isReturning to false when not provided', async () => {
    const POST = (await getHandler());
    const req = makeRequest(VALID_QUERY, { sessionToken: 'tok1' });
    await POST(req);
    expect(assignVariant).toHaveBeenCalledWith(
      MOCK_STORE.id,
      'tok1',
      'DESKTOP',
      false,
      undefined,
      undefined,
      1,
      false
    );
  });
});
