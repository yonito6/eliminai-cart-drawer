/**
 * Autopilot mode — automatic sequential A/B test optimization.
 * Builds queue by priority, picks next test, applies winners.
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
  dimensions: Array<{ key: string; testable: boolean; options?: string[] }>;
}

/**
 * Build optimization queue sorted by expected impact.
 * Priority 1: WITH vs WITHOUT for untested addons
 * Priority 2: Dimension tests for winning addons
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

  // Priority 1: WITH/WITHOUT for untested addons
  for (const def of sorted) {
    if (!testedSlots.includes(def.key)) {
      queue.push(`${def.key}:enabled`);
    }
  }

  // Priority 2: Dimension tests for winning addons
  for (const def of sorted) {
    if (winners[def.key]) {
      for (const dim of def.dimensions) {
        if (dim.testable) {
          queue.push(`${def.key}:${dim.key}`);
        }
      }
    }
  }

  return queue;
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
