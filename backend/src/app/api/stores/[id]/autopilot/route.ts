import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildOptimizeQueue } from '@/lib/autopilot';
import { getAddonDefinitions } from '@/lib/addon-definitions';

// GET /api/stores/[id]/autopilot — get autopilot state
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const store = await prisma.store.findUnique({
    where: { id: params.id },
    select: { id: true, config: true },
  });
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const config = (store.config as any) || {};
  const autopilot = config.autopilot || {
    enabled: false,
    currentTestSlot: null,
    queue: [],
    completedCount: 0,
    totalLift: 0,
    startedAt: null,
  };

  return NextResponse.json({ autopilot });
}

// PATCH /api/stores/[id]/autopilot — toggle autopilot / update queue
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const store = await prisma.store.findUnique({
    where: { id: params.id },
    select: { id: true, config: true },
  });
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const body = await req.json();
  const config = (store.config as any) || {};
  const currentAutopilot = config.autopilot || {};

  // If enabling, generate queue
  if (body.enabled && !currentAutopilot.enabled) {
    const completedExps = await prisma.experiment.findMany({
      where: { storeId: params.id, status: { in: ['WINNER_FOUND', 'NO_DIFFERENCE'] } },
      select: { slot: true, winnerVariantId: true, variants: true },
    });

    const testedSlots = completedExps.map(e => e.slot);
    const winners: Record<string, any> = {};
    for (const exp of completedExps) {
      if (exp.winnerVariantId) {
        const winnerVariant = (exp.variants as any[]).find((v: any) => v.id === exp.winnerVariantId);
        if (winnerVariant) winners[exp.slot] = winnerVariant.features || {};
      }
    }

    const addonDefs = getAddonDefinitions();
    const queue = body.queue || buildOptimizeQueue(addonDefs as any, testedSlots, winners);

    config.autopilot = {
      enabled: true,
      currentTestSlot: null,
      queue,
      completedCount: currentAutopilot.completedCount || 0,
      totalLift: currentAutopilot.totalLift || 0,
      startedAt: new Date().toISOString(),
    };
  } else if (body.enabled === false) {
    config.autopilot = { ...currentAutopilot, enabled: false };
  } else {
    // Partial update (e.g., reorder queue)
    config.autopilot = { ...currentAutopilot, ...body };
  }

  await prisma.store.update({
    where: { id: params.id },
    data: { config },
  });

  return NextResponse.json({ autopilot: config.autopilot });
}
