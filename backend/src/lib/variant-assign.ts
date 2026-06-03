import { prisma } from './prisma';
import { pickVariant } from './thompson';
import { computeSegment } from './segment';

interface AssignResult {
  experiment: { id: string; slot: string; features: Record<string, any> } | null;
  variant: string | null;
  isNew: boolean;
  sessionId: string;
  segment: string;
}

export async function assignVariant(
  storeId: string,
  sessionToken: string,
  deviceType: 'MOBILE' | 'DESKTOP' | 'TABLET',
  isReturning: boolean,
  referralSource?: string,
  country?: string,
  visitCount?: number,
  hasCustomerId?: boolean,
): Promise<AssignResult> {
  // 1. Find active experiment for this store
  const experiment = await prisma.experiment.findFirst({
    where: { storeId, status: 'RUNNING' },
    orderBy: { startedAt: 'desc' },
  });

  // 2. Compute initial segment from client signals
  const initialSegment = hasCustomerId ? 'EXISTING_CUSTOMER' as const
    : isReturning ? 'RETURNING_BROWSER' as const
    : 'NEW_VISITOR' as const;

  // 3. Find or create visitor session (retry on unique constraint race)
  let session;
  try {
    session = await prisma.visitorSession.upsert({
      where: { sessionToken },
      update: {
        // Update visit count if client reports higher
        ...(visitCount && visitCount > 1 ? { visitCount } : {}),
        ...(hasCustomerId ? { hasCustomerId: true } : {}),
      },
      create: {
        storeId,
        sessionToken,
        deviceType,
        isReturning,
        segment: initialSegment,
        visitCount: visitCount || 1,
        hasCustomerId: hasCustomerId || false,
        referralSource,
        country,
      },
    });
  } catch (e: any) {
    // Race condition: another request created the same session — just find it
    if (e.code === 'P2002') {
      session = await prisma.visitorSession.findUnique({ where: { sessionToken } });
      if (!session) throw e;
    } else {
      throw e;
    }
  }

  // 4. No active experiment = baseline phase
  if (!experiment) {
    return { experiment: null, variant: null, isNew: true, sessionId: session.id, segment: session.segment };
  }

  // 4. Check for existing assignment (stickiness)
  const existing = await prisma.variantAssignment.findUnique({
    where: {
      experimentId_sessionId: {
        experimentId: experiment.id,
        sessionId: session.id,
      },
    },
  });

  if (existing) {
    const variants = experiment.variants as any[];
    const variantData = variants.find((v: any) => v.id === existing.variantId);
    return {
      experiment: { id: experiment.id, slot: experiment.slot, features: variantData?.features || {} },
      variant: existing.variantId,
      isNew: false,
      sessionId: session.id,
      segment: session.segment,
    };
  }

  // 5. New assignment via Thompson Sampling weights + adaptive balancing
  const trafficSplit = experiment.trafficSplit as Record<string, number>;

  // Adaptive balancing: count current assignments per variant and bias toward the underdog
  // This ensures near-perfect 50/50 (or whatever the target split is) at all times
  const assignmentCounts = await prisma.variantAssignment.groupBy({
    by: ['variantId'],
    where: { experimentId: experiment.id },
    _count: true,
  });
  const countMap: Record<string, number> = {};
  for (const a of assignmentCounts) countMap[a.variantId] = a._count;

  const balancedSplit = { ...trafficSplit };
  const variantIds = Object.keys(trafficSplit);
  if (variantIds.length === 2) {
    const [idA, idB] = variantIds;
    const countA = countMap[idA] || 0;
    const countB = countMap[idB] || 0;
    const total = countA + countB;

    if (total >= 10) { // Only balance after enough data
      const targetA = trafficSplit[idA]; // e.g. 0.5
      const actualA = countA / total;
      const gap = actualA - targetA; // positive = A has too many

      // Bias strength: stronger correction for bigger gaps, capped at 80/20
      // gap of 0.05 (5% off) → nudge by ~0.10, gap of 0.10 → nudge by ~0.20
      const nudge = Math.min(0.30, Math.abs(gap) * 2);

      if (gap > 0.02) {
        // A has too many → give B more probability
        balancedSplit[idA] = Math.max(0.20, targetA - nudge);
        balancedSplit[idB] = 1 - balancedSplit[idA];
      } else if (gap < -0.02) {
        // B has too many → give A more probability
        balancedSplit[idB] = Math.max(0.20, trafficSplit[idB] - nudge);
        balancedSplit[idA] = 1 - balancedSplit[idB];
      }
    }
  }

  const variantId = pickVariant(balancedSplit);

  try {
    await prisma.variantAssignment.create({
      data: {
        storeId,
        experimentId: experiment.id,
        sessionId: session.id,
        variantId,
      },
    });
  } catch (e: any) {
    // Race condition: another request already assigned this session
    if (e.code === 'P2002') {
      const raceWinner = await prisma.variantAssignment.findUnique({
        where: {
          experimentId_sessionId: {
            experimentId: experiment.id,
            sessionId: session.id,
          },
        },
      });
      if (raceWinner) {
        const rv = (experiment.variants as any[]).find((v: any) => v.id === raceWinner.variantId);
        return {
          experiment: { id: experiment.id, slot: experiment.slot, features: rv?.features || {} },
          variant: raceWinner.variantId,
          isNew: false,
          sessionId: session.id,
          segment: session.segment,
        };
      }
    }
    throw e;
  }

  const variants = experiment.variants as any[];
  const variantData = variants.find((v: any) => v.id === variantId);

  return {
    experiment: { id: experiment.id, slot: experiment.slot, features: variantData?.features || {} },
    variant: variantId,
    isNew: true,
    sessionId: session.id,
    segment: session.segment,
  };
}
