import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ADDON_DEFINITIONS } from '@/lib/addon-definitions';
import { buildVariantsForSlot } from '@/lib/test-variants';

// POST /api/stores/:id/addons/test — start a test for an addon
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const store = await prisma.store.findUnique({ where: { id: params.id } });
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body?.addonKey) {
    return NextResponse.json({ error: 'addonKey required' }, { status: 400 });
  }

  const { addonKey, dimensionKey } = body;
  const definition = ADDON_DEFINITIONS.find((d) => d.key === addonKey);
  if (!definition) {
    return NextResponse.json({ error: 'Unknown addon' }, { status: 400 });
  }

  // Pause any existing experiment for this addon slot
  await prisma.experiment.updateMany({
    where: { storeId: params.id, slot: addonKey, status: 'RUNNING' },
    data: { status: 'PAUSED', endedAt: new Date() },
  });

  // Check what tests have already been completed for this addon
  const completedTests = await prisma.experiment.findMany({
    where: { storeId: params.id, slot: addonKey, status: { in: ['WINNER_FOUND', 'NO_DIFFERENCE'] } },
    select: { name: true },
  });
  const completedNames = new Set(completedTests.map((e) => e.name));

  // Determine what to test next
  const cfg = (store.config as any)?.addons?.[addonKey]?.config || {};
  const built = buildVariantsForSlot(definition as any, {
    completedNames,
    currentConfig: cfg,
    dimensionKey,
  });
  if ('error' in built) {
    return NextResponse.json({ error: built.error }, { status: 400 });
  }
  const { testName, dimensionKey: testDimensionKey, variants, trafficSplit } = built;

  const experiment = await prisma.experiment.create({
    data: {
      storeId: params.id,
      name: testName,
      slot: addonKey,
      status: 'RUNNING',
      variants,
      trafficSplit,
      maxDays: 14,
    },
  });

  return NextResponse.json({
    experiment: {
      id: experiment.id,
      name: experiment.name,
      slot: experiment.slot,
      dimensionKey: testDimensionKey,
      variants,
      status: 'RUNNING',
      confidence: 0,
      liftPercent: 0,
      startedAt: experiment.startedAt,
    },
  }, { status: 201 });
}

// DELETE /api/stores/:id/addons/test?addonKey=xxx — stop a test
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const addonKey = req.nextUrl.searchParams.get('addonKey');
  if (!addonKey) {
    return NextResponse.json({ error: 'addonKey required' }, { status: 400 });
  }

  const updated = await prisma.experiment.updateMany({
    where: { storeId: params.id, slot: addonKey, status: 'RUNNING' },
    data: { status: 'PAUSED', endedAt: new Date() },
  });

  return NextResponse.json({ stopped: updated.count });
}

// PATCH /api/stores/:id/addons/test?addonKey=xxx — resume a paused test
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const addonKey = req.nextUrl.searchParams.get('addonKey');
  if (!addonKey) {
    return NextResponse.json({ error: 'addonKey required' }, { status: 400 });
  }

  // Find the most recent paused experiment for this slot
  const paused = await prisma.experiment.findFirst({
    where: { storeId: params.id, slot: addonKey, status: 'PAUSED' },
    orderBy: { startedAt: 'desc' },
  });

  if (!paused) {
    return NextResponse.json({ error: 'No paused test found' }, { status: 404 });
  }

  // Resume: set status back to RUNNING, clear endedAt
  await prisma.experiment.update({
    where: { id: paused.id },
    data: { status: 'RUNNING', endedAt: null },
  });

  return NextResponse.json({ resumed: true, experimentId: paused.id });
}
