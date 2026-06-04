import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../lib/prisma', () => ({ prisma: { store: { findUnique: vi.fn(), update: vi.fn() } } }));
import { prisma } from '../lib/prisma';
import { NextRequest } from 'next/server';

async function post(id: string, key: string) {
  const { POST } = await import('../app/api/stores/[id]/cro/suggestions/route');
  return POST(new NextRequest(`http://x/api/stores/${id}/cro/suggestions`, {
    method: 'POST', body: JSON.stringify({ key }),
  }), { params: { id } });
}

describe('POST cro/suggestions', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('adds a valid suggestion key to config.croSuggestions.activated', async () => {
    (prisma.store.findUnique as any).mockResolvedValue({ id: 's1', config: {} });
    const res = await post('s1', 'freeReturns');
    expect(res.status).toBe(200);
    expect(prisma.store.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        config: expect.objectContaining({
          croSuggestions: { activated: ['freeReturns'] },
        }),
      }),
    }));
  });
  it('rejects an unknown suggestion key', async () => {
    (prisma.store.findUnique as any).mockResolvedValue({ id: 's1', config: {} });
    const res = await post('s1', 'bogus');
    expect(res.status).toBe(400);
    expect(prisma.store.update).not.toHaveBeenCalled();
  });
});
