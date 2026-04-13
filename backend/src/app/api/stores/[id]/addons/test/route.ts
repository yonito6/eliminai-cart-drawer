import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ADDON_DEFINITIONS } from '@/lib/addon-definitions';

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
  let variants: { id: string; label: string; features: Record<string, any> }[];
  let testName: string;
  let testDimensionKey: string;

  // FIRST TEST is always: WITH addon vs WITHOUT addon
  const enabledTestName = `${definition.label} — Enabled vs Disabled`;
  const hasTestedEnabled = completedNames.has(enabledTestName);

  if (!hasTestedEnabled && !dimensionKey) {
    // First test: with vs without
    testName = enabledTestName;
    testDimensionKey = '_enabled';
    variants = [
      { id: 'with_addon', label: `With ${definition.label}`, features: { _enabled: true } },
      { id: 'without_addon', label: `Without ${definition.label}`, features: { _enabled: false } },
    ];
  } else {
    // Subsequent tests: test specific dimensions
    const testableDims = definition.dimensions.filter((d) => d.testable);
    if (!testableDims.length) {
      return NextResponse.json({ error: 'No testable dimensions' }, { status: 400 });
    }

    // Pick the requested dimension, or the first untested one
    let dim;
    if (dimensionKey) {
      dim = testableDims.find((d) => d.key === dimensionKey);
    } else {
      dim = testableDims.find((d) => !completedNames.has(`${definition.label} — ${d.label}`)) || testableDims[0];
    }

    if (!dim) {
      return NextResponse.json({ error: 'Dimension not found or not testable' }, { status: 400 });
    }

    testName = `${definition.label} — ${dim.label}`;
    testDimensionKey = dim.key;
    const currentVal = cfg[dim.key] ?? dim.default;

    if (dim.type === 'select' && dim.options) {
      const currentOpt = dim.options.find((o) => o.value === currentVal) || dim.options[0];
      const altOpt = dim.options.find((o) => o.value !== currentVal) || dim.options[1];
      variants = [
        { id: `${dim.key}_${currentOpt.value}`, label: currentOpt.label + ' (current)', features: { [dim.key]: currentOpt.value } },
        { id: `${dim.key}_${altOpt.value}`, label: altOpt.label, features: { [dim.key]: altOpt.value } },
      ];
    } else if (dim.type === 'toggle') {
      variants = [
        { id: `${dim.key}_${currentVal ? 'on' : 'off'}`, label: `${dim.label}: ${currentVal ? 'On' : 'Off'} (current)`, features: { [dim.key]: !!currentVal } },
        { id: `${dim.key}_${currentVal ? 'off' : 'on'}`, label: `${dim.label}: ${currentVal ? 'Off' : 'On'}`, features: { [dim.key]: !currentVal } },
      ];
    } else if (dim.type === 'text') {
      const cur = currentVal || '';
      const alt = cur === 'Guaranteed Safe Checkout' ? 'Secure Payment' : 'Guaranteed Safe Checkout';
      variants = [
        { id: `${dim.key}_current`, label: cur ? `"${cur}" (current)` : '(none) (current)', features: { [dim.key]: cur } },
        { id: `${dim.key}_alt`, label: alt, features: { [dim.key]: alt } },
      ];
    } else {
      return NextResponse.json({ error: 'Cannot auto-generate variants for this type' }, { status: 400 });
    }
  }

  // Equal traffic split
  const trafficSplit: Record<string, number> = {};
  variants.forEach((v) => { trafficSplit[v.id] = 0.5; });

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
