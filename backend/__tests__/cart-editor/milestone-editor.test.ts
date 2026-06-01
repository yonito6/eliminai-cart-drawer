import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Static-analysis: the Milestone editor must SEED every control from the cart's
// real current values (CART_DEFAULTS.milestoneBar.*) so the UI shows the true value
// instead of an empty placeholder. Mirrors header-editor.test.ts.

const SRC = resolve(__dirname, '../../src/app/dashboard/cart-editor/element-editors/milestone-editor.tsx');
const code = readFileSync(SRC, 'utf8');

const MILESTONE_PATHS = [
  'milestoneBar.preUnlockTemplate',
  'milestoneBar.unlockedTemplate',
  'milestoneBar.celebrationAnim',
  'milestoneBar.fillColor',
  'milestoneBar.trackColor',
  'milestoneBar.height',
  'milestoneBar.position',
  'milestoneBar.textSize',
  'milestoneBar.textWeight',
];

describe('milestone-editor seeding', () => {
  it('imports CART_DEFAULTS from defaults', () => {
    expect(code).toMatch(/import\s*\{\s*CART_DEFAULTS\s*\}\s*from\s*['"]@\/lib\/cart-editor\/defaults['"]/);
  });

  for (const path of MILESTONE_PATHS) {
    it(`seeds ${path} from CART_DEFAULTS.${path}`, () => {
      expect(code).toContain(`?? CART_DEFAULTS.${path}`);
    });
  }
});
