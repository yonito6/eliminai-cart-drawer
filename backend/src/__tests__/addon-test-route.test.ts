/**
 * BLAST RADIUS MAP — follow-up A/B tests must produce REAL per-setting variants
 * Target: POST /api/stores/[id]/addons/test  (variant generation)
 *
 * CALLERS: dashboard startTest() → POST. apply-winner reads experiment.variants.
 * SHARED STATE: experiment.variants[].features feed variant-assign → proxy/config
 *   → v14 applyExperimentFeatures (renders the difference) and applyWinner (persists).
 *
 * LOCK: first test is always _enabled ON vs OFF (unchanged).
 * NEW: express 'hiddenWallets' (wallets) dimension → {hiddenWallets:[]} vs
 *      {hiddenWallets:['paypal']} (PayPal shown vs hidden — only reachable wallet).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    store: { findUnique: vi.fn() },
    experiment: { updateMany: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/stores/[id]/addons/test/route';

const params = { params: { id: 'store1' } };
const makeReq = (body: any) => ({ json: async () => body } as any);

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.store.findUnique as any).mockResolvedValue({
    id: 'store1',
    config: { addons: { expressPayments: { enabled: true, config: { position: 'below', hiddenWallets: [] } } } },
  });
  (prisma.experiment.updateMany as any).mockResolvedValue({ count: 0 });
  (prisma.experiment.create as any).mockImplementation(async ({ data }: any) => ({
    id: 'e1', startedAt: new Date(), ...data,
  }));
});

describe('POST addons/test — variant generation', () => {
  it('LOCK: first test is _enabled ON vs OFF', async () => {
    (prisma.experiment.findMany as any).mockResolvedValue([]); // nothing tested yet
    const res = await POST(makeReq({ addonKey: 'expressPayments' }), params);
    const json = await res.json();
    expect(json.experiment.dimensionKey).toBe('_enabled');
    const feats = json.experiment.variants.map((v: any) => v.features);
    expect(feats).toContainEqual({ _enabled: true });
    expect(feats).toContainEqual({ _enabled: false });
  });

  it('RED: hiddenWallets follow-up generates PayPal shown vs hidden arrays', async () => {
    // Enabled test already completed → follow-up dimension test is allowed.
    (prisma.experiment.findMany as any).mockResolvedValue([
      { name: 'Express Checkout Buttons — Enabled vs Disabled' },
    ]);
    const res = await POST(makeReq({ addonKey: 'expressPayments', dimensionKey: 'hiddenWallets' }), params);
    const json = await res.json();
    expect(json.experiment.dimensionKey).toBe('hiddenWallets');
    const feats = json.experiment.variants.map((v: any) => v.features);
    // exactly the two reachable states — paypal shown vs hidden
    expect(feats).toContainEqual({ hiddenWallets: [] });
    expect(feats).toContainEqual({ hiddenWallets: ['paypal'] });
    // first variant is the current state (PayPal currently shown → hiddenWallets [])
    expect(json.experiment.variants[0].features).toEqual({ hiddenWallets: [] });
    expect(json.experiment.variants[0].label).toContain('(current)');
  });
});
