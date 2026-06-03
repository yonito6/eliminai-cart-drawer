import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assignVariant } from '../lib/variant-assign';

// Mock prisma
vi.mock('../lib/prisma', () => ({
  prisma: {
    experiment: { findFirst: vi.fn() },
    visitorSession: { findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn() },
    variantAssignment: { findUnique: vi.fn(), create: vi.fn(), groupBy: vi.fn().mockResolvedValue([]) },
  },
}));

import { prisma } from '../lib/prisma';

describe('assignVariant', () => {
  const mockExperiment = {
    id: 'exp1',
    storeId: 'store1',
    slot: 'expressPayments',
    status: 'RUNNING',
    variants: [{ id: 'control', features: {} }, { id: 'treatment', features: { showTrustBadges: true } }],
    trafficSplit: { control: 0.5, treatment: 0.5 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns existing assignment for returning visitor', async () => {
    const mockSession = { id: 'sess1', storeId: 'store1', sessionToken: 'tok1' };
    const mockAssignment = { variantId: 'treatment', experimentId: 'exp1' };

    (prisma.experiment.findFirst as any).mockResolvedValue(mockExperiment);
    (prisma.visitorSession.upsert as any).mockResolvedValue(mockSession);
    (prisma.variantAssignment.findUnique as any).mockResolvedValue(mockAssignment);

    const result = await assignVariant('store1', 'tok1', 'DESKTOP', false);
    expect(result.variant).toBe('treatment');
    expect(result.isNew).toBe(false);
    // RED: the storefront needs the experiment's addon slot to know which addon
    // the running test targets (so it can apply the variant's setting override).
    expect(result.experiment?.slot).toBe('expressPayments');
  });

  it('returns the experiment slot for a new assignment (storefront needs it)', async () => {
    (prisma.experiment.findFirst as any).mockResolvedValue(mockExperiment);
    (prisma.visitorSession.upsert as any).mockResolvedValue({ id: 'sess_new', storeId: 'store1' });
    (prisma.variantAssignment.findUnique as any).mockResolvedValue(null);
    (prisma.variantAssignment.create as any).mockResolvedValue({ variantId: 'control' });

    const result = await assignVariant('store1', 'new_tok', 'MOBILE', false);
    expect(result.experiment?.slot).toBe('expressPayments');
  });

  it('creates new assignment for new visitor', async () => {
    (prisma.experiment.findFirst as any).mockResolvedValue(mockExperiment);
    (prisma.visitorSession.upsert as any).mockResolvedValue({ id: 'sess_new', storeId: 'store1' });
    (prisma.variantAssignment.findUnique as any).mockResolvedValue(null);
    (prisma.variantAssignment.create as any).mockResolvedValue({ variantId: 'control' });

    const result = await assignVariant('store1', 'new_tok', 'MOBILE', false);
    expect(result.variant).toBeDefined();
    expect(result.isNew).toBe(true);
  });

  it('returns null experiment when in baseline phase', async () => {
    (prisma.experiment.findFirst as any).mockResolvedValue(null);
    (prisma.visitorSession.upsert as any).mockResolvedValue({ id: 'sess_new' });

    const result = await assignVariant('store1', 'tok2', 'DESKTOP', false);
    expect(result.experiment).toBeNull();
    expect(result.variant).toBeNull();
  });
});
