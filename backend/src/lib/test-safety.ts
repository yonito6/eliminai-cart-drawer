/**
 * Test safety — mid-test change protection.
 * Classifies change risk and manages experiment timeline notes.
 */

interface MinimalExperiment {
  id: string;
  slot: string;
  status: string;
}

const CART_SLOTS = [
  'trustBadges', 'scarcityTimer', 'shippingProtection',
  'freeShippingBar', 'upsellRecommendations', 'socialProof',
  'checkout', 'layout', 'colors',
];

/**
 * Classify change risk relative to running experiments.
 * - high: same slot as running test (hard block)
 * - medium: different cart-related slot (soft warning)
 * - low: unrelated settings (allow silently)
 */
export function classifyChangeRisk(
  changingSlot: string,
  runningExperiments: MinimalExperiment[],
): 'high' | 'medium' | 'low' {
  const activeSlots = runningExperiments
    .filter(e => e.status === 'RUNNING')
    .map(e => e.slot);

  if (activeSlots.length === 0) return 'low';
  if (activeSlots.includes(changingSlot)) return 'high';
  if (CART_SLOTS.includes(changingSlot)) return 'medium';
  return 'low';
}

type NoteType =
  | 'started'
  | 'paused'
  | 'resumed'
  | 'settings_changed'
  | 'invalidated'
  | 'winner_found'
  | 'winner_applied'
  | 'user_event'
  | 'external_event'
  | 'traffic_anomaly'
  | 'conversion_shift'
  | 'segment_drift';

interface ExperimentNote {
  timestamp: string;
  type: NoteType;
  detail: string;
}

/**
 * Add a note to the experiment timeline.
 */
export function addExperimentNote(
  existingNotes: ExperimentNote[] | null | undefined,
  type: NoteType,
  detail: string,
): ExperimentNote[] {
  const notes = [...(Array.isArray(existingNotes) ? existingNotes : [])];
  notes.push({
    timestamp: new Date().toISOString(),
    type,
    detail,
  });
  return notes;
}
