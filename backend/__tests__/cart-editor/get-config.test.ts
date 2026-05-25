import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

process.env.CART_EDITOR_API_ENABLED = 'true';

// Mock prisma before importing the route
vi.mock('@/lib/prisma', () => ({
  prisma: {
    store: {
      findUnique: vi.fn(),
    },
  },
}));

import { GET } from '@/app/api/cart-editor/[storeId]/config/route';
import { prisma } from '@/lib/prisma';

const mockFindUnique = prisma.store.findUnique as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/cart-editor/[storeId]/config', () => {
  it('returns 200 with editorOverrides null on fresh store', async () => {
    mockFindUnique.mockResolvedValue({
      editorOverrides: null,
      editorOverridesVersion: 0,
    });

    const storeId = 'store-abc-123';
    const req = new NextRequest(`http://localhost/api/cart-editor/${storeId}/config`);
    const res = await GET(req, { params: { storeId } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.editorOverrides).toBeNull();
    expect(body.editorOverridesVersion).toBe(0);
    expect(res.headers.get('ETag')).toBe('"ce-0"');
  });

  it('returns 404 for unknown storeId', async () => {
    mockFindUnique.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/cart-editor/nope/config');
    const res = await GET(req, { params: { storeId: 'nope' } });

    expect(res.status).toBe(404);
  });

  it('returns correct ETag for non-zero version', async () => {
    mockFindUnique.mockResolvedValue({
      editorOverrides: { schemaVersion: 1 },
      editorOverridesVersion: 7,
    });

    const req = new NextRequest('http://localhost/api/cart-editor/store-x/config');
    const res = await GET(req, { params: { storeId: 'store-x' } });

    expect(res.status).toBe(200);
    expect(res.headers.get('ETag')).toBe('"ce-7"');
    const body = await res.json();
    expect(body.editorOverridesVersion).toBe(7);
    expect(body.editorOverrides).toEqual({ schemaVersion: 1 });
  });

  it('sets Cache-Control: no-store', async () => {
    mockFindUnique.mockResolvedValue({
      editorOverrides: null,
      editorOverridesVersion: 0,
    });

    const req = new NextRequest('http://localhost/api/cart-editor/store-y/config');
    const res = await GET(req, { params: { storeId: 'store-y' } });

    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns 404 when feature flag is disabled', async () => {
    process.env.CART_EDITOR_API_ENABLED = 'false';
    const res = await GET(new NextRequest('http://localhost/api/cart-editor/x/config'), { params: { storeId: 'x' } });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/disabled/i);
    process.env.CART_EDITOR_API_ENABLED = 'true'; // restore for other tests
  });
});
