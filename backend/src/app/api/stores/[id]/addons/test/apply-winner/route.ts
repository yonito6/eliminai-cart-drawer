import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applyWinner } from '@/lib/autopilot';

// POST /api/stores/[id]/addons/test/apply-winner
// Body: { experimentId, variantId }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await req.json();
  const { experimentId, variantId } = body;

  if (!experimentId || !variantId) {
    return NextResponse.json({ error: 'experimentId and variantId required' }, { status: 400 });
  }

  const experiment = await prisma.experiment.findUnique({
    where: { id: experimentId },
  });

  if (!experiment || experiment.storeId !== params.id) {
    return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
  }

  const variants = experiment.variants as any[];
  const winnerVariant = variants.find((v: any) => v.id === variantId);

  if (!winnerVariant) {
    return NextResponse.json({ error: 'Variant not found' }, { status: 404 });
  }

  // Get current store config
  const store = await prisma.store.findUnique({
    where: { id: params.id },
    select: { config: true },
  });

  const currentConfig = (store?.config as any) || {};
  const { addons } = applyWinner(currentConfig, experiment.slot, winnerVariant.features || {});

  // Update store config with winner
  await prisma.store.update({
    where: { id: params.id },
    data: {
      config: { ...currentConfig, addons },
    },
  });

  // Mark experiment as winner applied
  await prisma.experiment.update({
    where: { id: experimentId },
    data: {
      winnerVariantId: variantId,
      status: 'WINNER_FOUND',
      endedAt: experiment.endedAt || new Date(),
    },
  });

  return NextResponse.json({
    applied: true,
    slot: experiment.slot,
    winnerFeatures: winnerVariant.features,
  });
}
