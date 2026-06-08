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

describe('POST addons/test — explicit (manual builder) variants', () => {
  const manualBody = {
    addonKey: 'expressPayments',
    dimensionKey: 'position',
    name: 'Express buttons — Above vs Below',
    variants: [
      { id: 'pos_above', label: 'Above (A)', features: { position: 'above' } },
      { id: 'pos_below', label: 'Below (B)', features: { position: 'below' } },
    ],
  };

  it('uses explicit variants verbatim instead of auto-generating', async () => {
    const res = await POST(makeReq(manualBody), params);
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.experiment.name).toBe('Express buttons — Above vs Below');
    expect(json.experiment.dimensionKey).toBe('position');
    const feats = json.experiment.variants.map((v: any) => v.features);
    expect(feats).toContainEqual({ position: 'above' });
    expect(feats).toContainEqual({ position: 'below' });
    // NOT the auto _enabled path — proves the builder bypassed buildVariantsForSlot
    expect(feats).not.toContainEqual({ _enabled: true });
  });

  it('does not look up completed tests for explicit variants (skips auto-build)', async () => {
    await POST(makeReq(manualBody), params);
    // findMany is the auto-build "what's been tested" query — must not run on the explicit path
    expect((prisma.experiment.findMany as any)).not.toHaveBeenCalled();
  });

  it('defaults to an even A/B traffic split when none provided', async () => {
    const res = await POST(makeReq(manualBody), params);
    const json = await res.json();
    const split = (prisma.experiment.create as any).mock.calls[0][0].data.trafficSplit;
    expect(split.pos_above).toBeCloseTo(0.5);
    expect(split.pos_below).toBeCloseTo(0.5);
    expect(json.experiment.status).toBe('RUNNING');
  });

  it('honours a caller-supplied trafficSplit', async () => {
    await POST(makeReq({ ...manualBody, trafficSplit: { pos_above: 0.7, pos_below: 0.3 } }), params);
    const split = (prisma.experiment.create as any).mock.calls[0][0].data.trafficSplit;
    expect(split.pos_above).toBeCloseTo(0.7);
    expect(split.pos_below).toBeCloseTo(0.3);
  });

  it('rejects fewer than 2 variants', async () => {
    const res = await POST(makeReq({ ...manualBody, variants: [manualBody.variants[0]] }), params);
    expect(res.status).toBe(400);
    expect((prisma.experiment.create as any)).not.toHaveBeenCalled();
  });

  it('rejects variants with duplicate ids', async () => {
    const dup = [
      { id: 'x', label: 'A', features: { position: 'above' } },
      { id: 'x', label: 'B', features: { position: 'below' } },
    ];
    const res = await POST(makeReq({ ...manualBody, variants: dup }), params);
    expect(res.status).toBe(400);
    expect((prisma.experiment.create as any)).not.toHaveBeenCalled();
  });

  it('rejects a variant missing id/label/features', async () => {
    const bad = [
      { id: 'a', label: 'A', features: { position: 'above' } },
      { id: 'b', label: 'B' }, // no features
    ];
    const res = await POST(makeReq({ ...manualBody, variants: bad }), params);
    expect(res.status).toBe(400);
    expect((prisma.experiment.create as any)).not.toHaveBeenCalled();
  });

  it('still pauses an existing running test in the same slot', async () => {
    await POST(makeReq(manualBody), params);
    expect((prisma.experiment.updateMany as any)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ storeId: 'store1', slot: 'expressPayments', status: 'RUNNING' }),
        data: expect.objectContaining({ status: 'PAUSED' }),
      }),
    );
  });
});
