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

// --- Helpers: demo vs live config ----------------------------------------

function getConfigField(req: NextRequest): 'config' | 'demoConfig' {
  const url = new URL(req.url);
  return url.searchParams.get('target') === 'demo' ? 'demoConfig' : 'config';
}

function parseTargetConfig(store: any, field: 'config' | 'demoConfig'): Record<string, any> {
  const raw = store[field];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return (raw as Record<string, any>) ?? {};
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

  const field = getConfigField(req);
  const cfg = parseTargetConfig(store, field);
  // If demo config is empty, fall back to live config as starting point
  const addons = cfg.addons ?? (field === 'demoConfig' ? parseStoreConfig(store).addons : null) ?? getDefaultAddonsConfig().addons;
  const optimizeQueue = buildOptimizeQueue(addons);

  return NextResponse.json({
    addons,
    optimizeQueue,
    definitions: ADDON_DEFINITIONS,
    target: field === 'demoConfig' ? 'demo' : 'live',
    demoThemeId: store.demoThemeId || null,
  });
}

// --- PATCH /api/stores/:id/addons ---------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
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
      await prisma.experiment.update({ where: { id: exp.id }, data: { notes: notes as any } });
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

  // Read current config (demo or live based on ?target=demo)
  const field = getConfigField(req);
  const cfg = parseTargetConfig(store, field);
  // If demo config is empty, start from live config
  const liveCfg = field === 'demoConfig' ? parseStoreConfig(store) : cfg;
  const defaults = getDefaultAddonsConfig();
  const addons: Record<string, any> = cfg.addons ?? liveCfg.addons ?? defaults.addons;

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

  // Save back to the correct field (demo or live)
  const updatedCfg = { ...cfg, addons };
  // Mirror addon changes to the OTHER config too (keeps demo/live addons in sync)
  const otherField = field === 'demoConfig' ? 'config' : 'demoConfig';
  const otherCfg = parseTargetConfig(store, otherField);
  const otherAddons = otherCfg.addons || {};
  otherAddons[addonKey] = { ...addon };
  const updatedOtherCfg = { ...otherCfg, addons: otherAddons };
  await prisma.store.update({
    where: { id: params.id },
    data: { [field]: updatedCfg, [otherField]: updatedOtherCfg },
  });

  const optimizeQueue = buildOptimizeQueue(addons);

  return NextResponse.json({ addons, optimizeQueue, changeRisk, target: field === 'demoConfig' ? 'demo' : 'live' });
  } catch (err: any) {
    console.error('PATCH /addons error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}