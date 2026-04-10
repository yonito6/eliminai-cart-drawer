/**
 * Autopilot mode — breadth-first optimization strategy.
 * Phase 1 (Quick Sweep): Test each activated addon ON vs OFF for fast wins.
 * Phase 2 (Fine-tune): Test individual dimensions on winning addons.
 * 
 * Rationale: Trust Badges ON vs OFF = +5%. Fine-tuning badge text = maybe +1%.
 * But testing a whole new feature (Scarcity) ON vs OFF = potentially another +4%.
 * Breadth-first maximizes total improvement in 30 days.
 */

// Category priority: trust > scarcity > shipping > upsell > social
const CATEGORY_PRIORITY: Record<string, number> = {
  trust: 1,
  scarcity: 2,
  shipping: 3,
  upsell: 4,
  social: 5,
};

interface AddonDef {
  key: string;
  category: string;
  testable: boolean;
  estimatedImpact?: string;
  dimensions: Array<{ key: string; testable: boolean; options?: string[] }>;
}

export type OptimizationPhase = 'quick-sweep' | 'fine-tune' | 'complete';

export interface QueueItem {
  slot: string;      // e.g. "trustBadges:enabled" or "trustBadges:text"
  addonKey: string;
  dimension: string;  // "enabled" for ON/OFF, or dimension key
  phase: OptimizationPhase;
  reason: string;     // Why this test is recommended
}

/**
 * Build optimization queue sorted by expected impact.
 * Phase 1 (quick-sweep): ON vs OFF for all activated untested addons
 * Phase 2 (fine-tune): Dimension tests for winning addons
 */
export function buildOptimizeQueue(
  addonDefs: AddonDef[],
  testedSlots: string[],
  winners: Record<string, any>,
): string[] {
  const queue: string[] = [];

  // Sort addons by category priority
  const sorted = [...addonDefs]
    .filter(d => d.testable)
    .sort((a, b) => (CATEGORY_PRIORITY[a.category] ?? 99) - (CATEGORY_PRIORITY[b.category] ?? 99));

  // Phase 1: Quick Sweep — ON/OFF for untested addons (breadth-first)
  for (const def of sorted) {
    if (!testedSlots.includes(def.key)) {
      queue.push(`${def.key}:enabled`);
    }
  }

  // Phase 2: Fine-tune — Dimension tests ONLY for winning addons
  for (const def of sorted) {
    if (winners[def.key]) {
      for (const dim of def.dimensions) {
        if (dim.testable) {
          const dimSlot = `${def.key}:${dim.key}`;
          if (!testedSlots.includes(dimSlot)) {
            queue.push(dimSlot);
          }
        }
      }
    }
  }

  return queue;
}

/**
 * Build a rich queue with phase info and recommendations.
 */
export function buildOptimizeQueueRich(
  addonDefs: AddonDef[],
  testedSlots: string[],
  winners: Record<string, any>,
): { queue: QueueItem[]; phase: OptimizationPhase } {
  const queue: QueueItem[] = [];

  const sorted = [...addonDefs]
    .filter(d => d.testable)
    .sort((a, b) => (CATEGORY_PRIORITY[a.category] ?? 99) - (CATEGORY_PRIORITY[b.category] ?? 99));

  // Phase 1: Quick Sweep
  let hasQuickSweep = false;
  for (const def of sorted) {
    if (!testedSlots.includes(def.key)) {
      hasQuickSweep = true;
      queue.push({
        slot: `${def.key}:enabled`,
        addonKey: def.key,
        dimension: 'enabled',
        phase: 'quick-sweep',
        reason: `Test if ${def.key} improves conversions (${def.estimatedImpact || 'impact TBD'})`,
      });
    }
  }

  // Phase 2: Fine-tune (only after ALL quick-sweep tests are done)
  if (!hasQuickSweep) {
    for (const def of sorted) {
      if (winners[def.key]) {
        for (const dim of def.dimensions) {
          if (dim.testable) {
            const dimSlot = `${def.key}:${dim.key}`;
            if (!testedSlots.includes(dimSlot)) {
              queue.push({
                slot: dimSlot,
                addonKey: def.key,
                dimension: dim.key,
                phase: 'fine-tune',
                reason: `Fine-tune ${dim.key} for extra lift on top of ${def.key} win`,
              });
            }
          }
        }
      }
    }
  }

  const phase: OptimizationPhase = queue.length === 0
    ? 'complete'
    : hasQuickSweep ? 'quick-sweep' : 'fine-tune';

  return { queue, phase };
}

/**
 * Pick the next test to run from the queue.
 */
export function pickNextTest(queue: string[]): string | null {
  return queue.length > 0 ? queue[0] : null;
}

/**
 * Apply winner features to store config, saving previous config for rollback.
 */
export function applyWinner(
  currentConfig: Record<string, any>,
  addonKey: string,
  winnerFeatures: Record<string, any>,
): { addons: Record<string, any> } {
  const addons = { ...(currentConfig.addons || currentConfig) };
  const current = addons[addonKey] || { enabled: false, config: {} };

  addons[addonKey] = {
    ...current,
    config: { ...(current.config || {}), ...winnerFeatures },
    previousConfig: {
      config: { ...(current.config || {}) },
      savedAt: new Date().toISOString(),
      reason: 'winner' as const,
    },
    lastWinner: {
      features: winnerFeatures,
      appliedAt: new Date().toISOString(),
    },
  };

  return { addons };
}
