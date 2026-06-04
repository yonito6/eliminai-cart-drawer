// backend/src/lib/autopilot-engine.ts
import { pickNextTest } from './autopilot';

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
