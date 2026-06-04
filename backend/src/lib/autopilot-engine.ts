// backend/src/lib/autopilot-engine.ts
import { pickNextTest, applyWinner } from './autopilot';
import { buildVariantsForSlot } from './test-variants';
import { ADDON_DEFINITIONS } from './addon-definitions';

export interface AutopilotState {
  enabled: boolean;
  currentTestSlot: string | null;
  queue: string[];
  completedCount: number;
  totalLift: number;
  startedAt: string | null;
}

export interface FinishedExperiment {
  slot: string;                 // addonKey, e.g. "trustBadges"
  status: 'WINNER_FOUND' | 'NO_DIFFERENCE' | 'REVERTED';
  winnerFeatures?: Record<string, any>;
  liftPercent?: number | null;
}

export interface NextAction {
  applyWinner: boolean;
  winnerFeatures: Record<string, any> | null;
  nextSlot: string | null;      // queue item "<addonKey>:<dimension>"
  autopilot: AutopilotState;
}

// queue item "trustBadges:enabled" → addonKey "trustBadges"
function addonKeyOf(queueItem: string): string {
  return queueItem.split(':')[0];
}

export function planNextAction(autopilot: AutopilotState, finished: FinishedExperiment): NextAction {
  const apply = finished.status === 'WINNER_FOUND';
  const lift = apply ? (finished.liftPercent ?? 0) : 0;

  // Remove ALL queue items for the finished addon (defensive: not just the head).
  const queue = (autopilot.queue || []).filter(item => addonKeyOf(item) !== finished.slot);
  const nextSlot = pickNextTest(queue);

  return {
    applyWinner: apply,
    winnerFeatures: apply ? (finished.winnerFeatures ?? {}) : null,
    nextSlot,
    autopilot: {
      ...autopilot,
      queue,
      completedCount: (autopilot.completedCount || 0) + 1,
      totalLift: Math.round(((autopilot.totalLift || 0) + lift) * 100) / 100,
      currentTestSlot: nextSlot,
    },
  };
}

export interface ProgressResult {
  autopilot: AutopilotState;
  appliedWinner: boolean;
  startedExperimentId: string | null;
}

// `prisma` is injected so this is unit-testable; the cron passes the real client.
export async function progressAutopilot(prisma: any, storeId: string, finished: FinishedExperiment): Promise<ProgressResult> {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  const config = (store?.config as any) || {};
  const autopilot: AutopilotState = config.autopilot;
  if (!autopilot?.enabled) {
    return { autopilot, appliedWinner: false, startedExperimentId: null };
  }

  const decision = planNextAction(autopilot, finished);
  let nextConfig = { ...config };

  // 1. Apply the winner to config.addons (reuse the shared, rollback-safe helper).
  if (decision.applyWinner) {
    const { addons } = applyWinner(nextConfig, finished.slot, decision.winnerFeatures || {});
    nextConfig = { ...nextConfig, addons };
  }

  // 2. Start the next test. CRITICAL: skip past any un-buildable slots
  //    (missing definition, exhausted dimensions) IN THE SAME TICK so a single
  //    bad slot can't stall progression for ~24h. The queue we end up with is
  //    the source of truth for currentTestSlot below.
  let startedExperimentId: string | null = null;
  let queue = [...decision.autopilot.queue];
  while (queue.length > 0) {
    const candidate = queue[0];
    const addonKey = candidate.split(':')[0];
    const definition = ADDON_DEFINITIONS.find((d: any) => d.key === addonKey);
    if (!definition) { queue = queue.slice(1); continue; }

    const completed = await prisma.experiment.findMany({
      where: { storeId, slot: addonKey, status: { in: ['WINNER_FOUND', 'NO_DIFFERENCE'] } },
      select: { name: true },
    });
    const completedNames = new Set<string>(completed.map((e: any) => e.name));
    const cfg = (nextConfig.addons?.[addonKey]?.config) || {};
    const built = buildVariantsForSlot(definition as any, { completedNames, currentConfig: cfg });
    if ('error' in built) { queue = queue.slice(1); continue; }

    const created = await prisma.experiment.create({
      data: {
        storeId,
        name: built.testName,
        slot: addonKey,
        status: 'RUNNING',
        variants: built.variants,
        trafficSplit: built.trafficSplit,
        maxDays: 14,
      },
    });
    startedExperimentId = created.id;
    break;
  }

  // Reconcile autopilot state with what we ACTUALLY started this tick. The
  // running test's slot stays at the head of the queue; if nothing was
  // buildable, the queue is empty and there is no current test.
  decision.autopilot.queue = queue;
  decision.autopilot.currentTestSlot = startedExperimentId ? queue[0] : null;

  // 3. Persist the new autopilot state + any winner config in one write.
  nextConfig.autopilot = decision.autopilot;
  await prisma.store.update({ where: { id: storeId }, data: { config: nextConfig } });

  return { autopilot: decision.autopilot, appliedWinner: decision.applyWinner, startedExperimentId };
}
