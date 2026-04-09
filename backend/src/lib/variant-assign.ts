import { prisma } from './prisma';
import { pickVariant } from './thompson';

interface AssignResult {
  experiment: { id: string; features: Record<string, any> } | null;
  variant: string | null;
  isNew: boolean;
  sessionId: string;
}

export async function assignVariant(
  storeId: string,
  sessionToken: string,
  deviceType: 'MOBILE' | 'DESKTOP' | 'TABLET',
  isReturning: boolean,
  referralSource?: string,
  country?: string
): Promise<AssignResult> {
  // 1. Find active experiment for this store
  const experiment = await prisma.experiment.findFirst({
    where: { storeId, status: 'RUNNING' },
    orderBy: { startedAt: 'desc' },
  });

  // 2. Find or create visitor session
  let session = await prisma.visitorSession.findUnique({
    where: { sessionToken },
  });

  if (!session) {
    session = await prisma.visitorSession.create({
      data: {
        storeId,
        sessionToken,
        deviceType,
        isReturning,
        referralSource,
        country,
      },
    });
  }

  // 3. No active experiment = baseline phase
  if (!experiment) {
    return { experiment: null, variant: null, isNew: true, sessionId: session.id };
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
      experiment: { id: experiment.id, features: variantData?.features || {} },
      variant: existing.variantId,
      isNew: false,
      sessionId: session.id,
    };
  }

  // 5. New assignment via Thompson Sampling weights
  const trafficSplit = experiment.trafficSplit as Record<string, number>;
  const variantId = pickVariant(trafficSplit);

  await prisma.variantAssignment.create({
    data: {
      storeId,
      experimentId: experiment.id,
      sessionId: session.id,
      variantId,
    },
  });

  const variants = experiment.variants as any[];
  const variantData = variants.find((v: any) => v.id === variantId);

  return {
    experiment: { id: experiment.id, features: variantData?.features || {} },
    variant: variantId,
    isNew: true,
    sessionId: session.id,
  };
}
