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

  let testName: string;
  let testDimensionKey: string;
  let variants: { id: string; label: string; features: Record<string, any> }[];
  let trafficSplit: Record<string, number>;

  // Manual builder path: caller hand-picked Variant A and Variant B and passed them
  // explicitly. Use them verbatim — do NOT auto-generate. (Auto path is the `else`.)
  const explicit = Array.isArray(body.variants) ? body.variants : null;
  if (explicit) {
    const valid = explicit.length >= 2
      && explicit.every((v: any) =>
        v && typeof v.id === 'string' && v.id.length > 0
        && typeof v.label === 'string' && v.label.length > 0
        && v.features && typeof v.features === 'object');
    const ids = explicit.map((v: any) => v?.id);
    const uniqueIds = new Set(ids).size === ids.length;
    if (!valid || !uniqueIds) {
      return NextResponse.json(
        { error: 'variants must be 2+ items, each with a unique id, a label, and a features object' },
        { status: 400 },
      );
    }

    variants = explicit.map((v: any) => ({ id: v.id, label: v.label, features: v.features }));
    testName = typeof body.name === 'string' && body.name.trim()
      ? body.name.trim()
      : `${definition.label} — A/B test`;
    testDimensionKey = dimensionKey || 'custom';

    if (body.trafficSplit && typeof body.trafficSplit === 'object') {
      trafficSplit = body.trafficSplit;
    } else {
      trafficSplit = {};
      const even = 1 / variants.length;
      variants.forEach((v) => { trafficSplit[v.id] = even; });
    }
  } else {
    // Auto-generate path: check what's already been tested, then build the next variants.
    const completedTests = await prisma.experiment.findMany({
      where: { storeId: params.id, slot: addonKey, status: { in: ['WINNER_FOUND', 'NO_DIFFERENCE'] } },
      select: { name: true },
    });
    const completedNames = new Set(completedTests.map((e) => e.name));

    const cfg = (store.config as any)?.addons?.[addonKey]?.config || {};
    const built = buildVariantsForSlot(definition as any, {
      completedNames,
      currentConfig: cfg,
      dimensionKey,
    });
    if ('error' in built) {
      return NextResponse.json({ error: built.error }, { status: 400 });
    }
    testName = built.testName;
    testDimensionKey = built.dimensionKey;
    variants = built.variants;
    trafficSplit = built.trafficSplit;
  }

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
