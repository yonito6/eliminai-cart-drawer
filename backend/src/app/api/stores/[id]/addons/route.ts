import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  ADDON_DEFINITIONS,
  getDefaultAddonsConfig,
  getAddonDefinition,
} from '@/lib/addon-definitions';
import { classifyChangeRisk, addExperimentNote } from '@/lib/test-safety';

// --- Helpers -----------------------------------------------------------

function parseStoreConfig(store: { config: any }): Record<string, any> {
  if (typeof store.config === "string") {
    try {
      return JSON.parse(store.config);
    } catch {
      return {};
    }
  }
  return (store.config as Record<string, any>) ?? {};
}

function buildOptimizeQueue(
  addons: Record<string, any>,
): string[] {
  return Object.entries(addons)
    .filter(([, v]) => v.mode === "auto-optimize" && v.optimizeState)
    .sort(
      ([, a], [, b]) =>
        (a.optimizeState?.queuePosition ?? Infinity) -
        (b.optimizeState?.queuePosition ?? Infinity),
    )
    .map(([key]) => key);
}

// --- GET /api/stores/:id/addons -----------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const store = await prisma.store.findUnique({ where: { id: params.id } });
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const cfg = parseStoreConfig(store);
  const addons = cfg.addons ?? getDefaultAddonsConfig().addons;
  const optimizeQueue = buildOptimizeQueue(addons);

  return NextResponse.json({
    addons,
    optimizeQueue,
    definitions: ADDON_DEFINITIONS,
  });
}

// --- PATCH /api/stores/:id/addons ---------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const store = await prisma.store.findUnique({ where: { id: params.id } });
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const body = await req.json();
  const { addonKey, enabled, mode, config: patchConfig } = body as {
    addonKey: string;
    enabled?: boolean;
    mode?: 'off' | 'locked' | 'auto-optimize';
    config?: Record<string, any>;
  };

  // Check for running experiments — return risk level
  const runningExperiments = await prisma.experiment.findMany({
    where: { storeId: params.id, status: 'RUNNING' },
    select: { id: true, slot: true, status: true, notes: true },
  });
  const changeRisk = classifyChangeRisk(addonKey, runningExperiments);

  // If client sent dryRun=true, just return the risk level
  if (body.dryRun) {
    return NextResponse.json({ changeRisk, runningExperiments: runningExperiments.map(e => ({ id: e.id, slot: e.slot })) });
  }

  // Add note to running experiments about settings change
  if (changeRisk === 'medium' && runningExperiments.length > 0) {
    for (const exp of runningExperiments) {
      const notes = addExperimentNote(
        (exp.notes as any[]) || [],
        'settings_changed',
        `Other settings changed during test: ${addonKey}`
      );
      await prisma.experiment.update({ where: { id: exp.id }, data: { notes } });
    }
  }

  if (!addonKey) {
    return NextResponse.json(
      { error: "addonKey is required" },
      { status: 400 },
    );
  }

  const definition = getAddonDefinition(addonKey);
  if (!definition) {
    return NextResponse.json(
      { error: `Unknown addon: ${addonKey}` },
      { status: 400 },
    );
  }

  // Read current config
  const cfg = parseStoreConfig(store);
  const defaults = getDefaultAddonsConfig();
  const addons: Record<string, any> = cfg.addons ?? defaults.addons;

  // Ensure addon entry exists
  if (!addons[addonKey]) {
    addons[addonKey] = { ...defaults.addons[addonKey] };
  }

  const addon = addons[addonKey];

  // Merge enabled flag
  if (enabled !== undefined) {
    addon.enabled = enabled;
    if (!enabled) {
      addon.mode = "off";
      addon.optimizeState = null;
    }
  }

  // Merge mode
  if (mode !== undefined) {
    addon.mode = mode;

    if (mode === "off") {
      addon.enabled = false;
      addon.optimizeState = null;
    } else if (mode === "locked") {
      addon.optimizeState = null;
    } else if (mode === "auto-optimize") {
      addon.enabled = true;

      // Count testable dimensions for this addon
      const testableDimensions = definition.dimensions.filter(
        (d) => d.testable,
      ).length;

      // Queue position = existing auto-optimize count + 1
      const existingAutoOptimize = Object.entries(addons).filter(
        ([k, v]: [string, any]) =>
          k !== addonKey && v.mode === "auto-optimize",
      ).length;

      addon.optimizeState = {
        queuePosition: existingAutoOptimize + 1,
        step: 0,
        totalSteps: testableDimensions,
      };
    }
  }

  // Merge config overrides
  if (patchConfig && typeof patchConfig === "object") {
    addon.config = { ...addon.config, ...patchConfig };
  }

  // Save back
  const updatedCfg = { ...cfg, addons };
  await prisma.store.update({
    where: { id: params.id },
    data: { config: updatedCfg },
  });

  const optimizeQueue = buildOptimizeQueue(addons);

  return NextResponse.json({ addons, optimizeQueue, changeRisk });
}