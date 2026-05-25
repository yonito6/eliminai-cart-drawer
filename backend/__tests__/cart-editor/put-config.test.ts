import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
process.env.CART_EDITOR_API_ENABLED = 'true';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    store: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

import { PUT } from '@/app/api/cart-editor/[storeId]/config/route';
import { prisma } from '@/lib/prisma';
import { revalidateTag } from 'next/cache';

const mockFindUnique = prisma.store.findUnique as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.store.update as ReturnType<typeof vi.fn>;
const mockRevalidateTag = revalidateTag as ReturnType<typeof vi.fn>;

function makeRequest(storeId: string, body: unknown, ifMatch: string) {
  return new NextRequest(`http://localhost/api/cart-editor/${storeId}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'If-Match': ifMatch },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PUT /api/cart-editor/[storeId]/config', () => {
  it('returns 429 when rate limit exceeded', async () => {
    // Use a unique storeId so this test has its own rate-limit bucket
    const storeId = 'rl-test-store-put-ratelimit';
    mockFindUnique.mockResolvedValue({ editorOverrides: null, editorOverridesVersion: 0 });
    mockUpdate.mockResolvedValue({ editorOverrides: { schemaVersion: 1 }, editorOverridesVersion: 1 });

    let lastRes: Response | null = null;
    // PUT limiter allows 10/60s - send 11
    for (let i = 0; i <= 10; i++) {
      mockFindUnique.mockResolvedValue({ editorOverrides: null, editorOverridesVersion: i });
      mockUpdate.mockResolvedValue({ editorOverrides: { schemaVersion: 1 }, editorOverridesVersion: i + 1 });
      const req = makeRequest(storeId, { editorOverrides: {} }, `"ce-${i}"`);
      lastRes = await PUT(req, { params: { storeId } });
    }
    expect(lastRes!.status).toBe(429);
    expect(lastRes!.headers.get('Retry-After')).toBe('60');
  });

  it('returns 400 on invalid JSON body', async () => {
    const storeId = 'json-err-store-put';
    const req = new NextRequest(`http://localhost/api/cart-editor/${storeId}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-Match': '"ce-0"' },
      body: '{not valid json',
    });
    const res = await PUT(req, { params: { storeId } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid json/i);
  });

  it('returns 400 when body is JSON null', async () => {
    const storeId = 'null-body-store-put';
    const req = new NextRequest(`http://localhost/api/cart-editor/${storeId}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-Match': '"ce-0"' },
      body: 'null',
    });
    const res = await PUT(req, { params: { storeId } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/body must be a json object/i);
  });

  it('returns 400 when body is a JSON array', async () => {
    const storeId = 'array-body-store-put';
    const req = new NextRequest(`http://localhost/api/cart-editor/${storeId}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-Match': '"ce-0"' },
      body: JSON.stringify([]),
    });
    const res = await PUT(req, { params: { storeId } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/body must be a json object/i);
  });

  it('returns 400 with conflictPath when body contains addon-owned path', async () => {
    const storeId = 'conflict-store-put';
    const req = makeRequest(
      storeId,
      { addons: { milestone: { tiers: [{ threshold: 50 }] } } },
      '"ce-0"'
    );
    const res = await PUT(req, { params: { storeId } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/addon/i);
    expect(body.conflictPath).toBe('addons.milestone.tiers');
  });

  it('returns 400 on Zod validation failure with path and message', async () => {
    const storeId = 'zod-err-store-put';
    // widthDesktop min is 320, sending 100 triggers validation error
    const req = makeRequest(
      storeId,
      { editorOverrides: { global: { widthDesktop: 100 } } },
      '"ce-0"'
    );
    const res = await PUT(req, { params: { storeId } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/validation/i);
    expect(body.path).toBeDefined();
    expect(body.message).toBeDefined();
  });

  it('returns 404 for unknown storeId', async () => {
    mockFindUnique.mockResolvedValue(null);
    const storeId = 'no-such-store-put';
    const req = makeRequest(storeId, { editorOverrides: {} }, '"ce-0"');
    const res = await PUT(req, { params: { storeId } });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it('returns 409 on If-Match version mismatch with currentVersion in body and ETag header', async () => {
    const storeId = 'version-mismatch-store-put';
    mockFindUnique.mockResolvedValue({ editorOverrides: {}, editorOverridesVersion: 5 });
    // Client thinks version is 3 but server has 5
    const req = makeRequest(storeId, { editorOverrides: {} }, '"ce-3"');
    const res = await PUT(req, { params: { storeId } });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.currentVersion).toBe(5);
    expect(res.headers.get('ETag')).toBe('"ce-5"');
  });

  it('returns 200 with updated editorOverrides and incremented version + ETag', async () => {
    const storeId = 'happy-path-store-put';
    const overrides = { header: { title: 'My Cart' } };
    mockFindUnique.mockResolvedValue({ editorOverrides: null, editorOverridesVersion: 0 });
    mockUpdate.mockResolvedValue({
      editorOverrides: { schemaVersion: 1, header: { title: 'My Cart' } },
      editorOverridesVersion: 1,
    });

    const req = makeRequest(storeId, { editorOverrides: overrides }, '"ce-0"');
    const res = await PUT(req, { params: { storeId } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.editorOverrides).toBeDefined();
    expect(body.editorOverridesVersion).toBe(1);
    expect(res.headers.get('ETag')).toBe('"ce-1"');
  });

  it('calls prisma update with { increment: 1 } on editorOverridesVersion', async () => {
    const storeId = 'update-shape-store-put';
    mockFindUnique.mockResolvedValue({ editorOverrides: null, editorOverridesVersion: 2 });
    mockUpdate.mockResolvedValue({
      editorOverrides: { schemaVersion: 1 },
      editorOverridesVersion: 3,
    });

    const req = makeRequest(storeId, { editorOverrides: {} }, '"ce-2"');
    await PUT(req, { params: { storeId } });

    expect(mockUpdate).toHaveBeenCalledOnce();
    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.where.id).toBe(storeId);
    expect(updateCall.data.editorOverridesVersion).toEqual({ increment: 1 });
    expect(updateCall.data.editorOverrides).toBeDefined();
  });

  it('calls revalidateTag(cart-config:{storeId}) after successful update', async () => {
    const storeId = 'revalidate-store-put';
    mockFindUnique.mockResolvedValue({ editorOverrides: null, editorOverridesVersion: 0 });
    mockUpdate.mockResolvedValue({
      editorOverrides: { schemaVersion: 1 },
      editorOverridesVersion: 1,
    });

    const req = makeRequest(storeId, { editorOverrides: {} }, '"ce-0"');
    await PUT(req, { params: { storeId } });

    expect(mockRevalidateTag).toHaveBeenCalledWith(`cart-config:${storeId}`);
  });

  it('bumps version by exactly 1 across two sequential writes', async () => {
    const storeId = 'seq-write-store-put';

    // Write 1: version 0 -> 1
    mockFindUnique.mockResolvedValueOnce({ editorOverrides: null, editorOverridesVersion: 0 });
    mockUpdate.mockResolvedValueOnce({
      editorOverrides: { schemaVersion: 1 },
      editorOverridesVersion: 1,
    });
    const req1 = makeRequest(storeId, { editorOverrides: {} }, '"ce-0"');
    const res1 = await PUT(req1, { params: { storeId } });
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.editorOverridesVersion).toBe(1);
    expect(res1.headers.get('ETag')).toBe('"ce-1"');

    // Write 2: version 1 -> 2
    mockFindUnique.mockResolvedValueOnce({ editorOverrides: { schemaVersion: 1 }, editorOverridesVersion: 1 });
    mockUpdate.mockResolvedValueOnce({
      editorOverrides: { schemaVersion: 1, header: { title: 'Updated' } },
      editorOverridesVersion: 2,
    });
    const req2 = makeRequest(
      storeId,
      { editorOverrides: { header: { title: 'Updated' } } },
      '"ce-1"'
    );
    const res2 = await PUT(req2, { params: { storeId } });
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.editorOverridesVersion).toBe(2);
    expect(res2.headers.get('ETag')).toBe('"ce-2"');
  });

  it('returns 404 when feature flag is disabled', async () => {
    process.env.CART_EDITOR_API_ENABLED = 'false';
    const storeId = 'flag-disabled-put';
    const req = makeRequest(storeId, { editorOverrides: {} }, '"ce-0"');
    const res = await PUT(req, { params: { storeId } });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/disabled/i);
    process.env.CART_EDITOR_API_ENABLED = 'true';
  });
});
