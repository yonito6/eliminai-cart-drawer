// backend/src/__tests__/test-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    store: { findUnique: vi.fn() },
    experiment: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), findMany: vi.fn().mockResolvedValue([]), create: vi.fn() },
  },
}));
import { prisma } from '../lib/prisma';
import { NextRequest } from 'next/server';

async function post(id: string, body: any) {
  const { POST } = await import('../app/api/stores/[id]/addons/test/route');
  return POST(new NextRequest(`http://x/api/stores/${id}/addons/test`, { method: 'POST', body: JSON.stringify(body) }) as any, { params: { id } });
}

describe('POST /addons/test (locked behavior)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('first test for an untested addon is with-vs-without', async () => {
    (prisma.store.findUnique as any).mockResolvedValue({ id: 's1', config: {} });
    (prisma.experiment.create as any).mockImplementation(({ data }: any) => Promise.resolve({ id: 'e1', startedAt: new Date(), ...data }));

    const res = await post('s1', { addonKey: 'trustBadges' });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.experiment.dimensionKey).toBe('_enabled');
    expect(body.experiment.variants.map((v: any) => v.id)).toEqual(['with_addon', 'without_addon']);
    expect((prisma.experiment.create as any).mock.calls[0][0].data.slot).toBe('trustBadges');
    expect((prisma.experiment.create as any).mock.calls[0][0].data.maxDays).toBe(14);
  });
});
