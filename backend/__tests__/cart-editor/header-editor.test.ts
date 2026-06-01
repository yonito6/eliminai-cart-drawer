import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Static-analysis: the Header editor must SEED every control from the cart's
// real current values (CART_DEFAULTS.header.*) so the UI shows the true value
// instead of an empty placeholder. Mirrors checkout-button.test.ts.

const SRC = resolve(__dirname, '../../src/app/dashboard/cart-editor/element-editors/header-editor.tsx');
const code = readFileSync(SRC, 'utf8');

const HEADER_PATHS = [
  'header.title',
  'header.headingLevel',
  'header.titleAlignment',
  'header.titleFontSize',
  'header.titleFontWeight',
  'header.titleColor',
  'header.bgColor',
  'header.borderStyle',
  'header.padding',
  'header.heightPreset',
  'header.showItemCountBadge',
  'header.badgeColor',
  'header.closeIcon',
  'header.closeButton.position',
  'header.closeButton.iconSize',
  'header.closeButton.strokeWeight',
  'header.closeButton.border',
  'header.closeButton.bgColor',
  'header.closeButton.bgHoverColor',
  'header.closeButton.iconColor',
  'header.closeButton.borderColor',
  'header.closeButton.borderHoverColor',
];

describe('header-editor seeding', () => {
  it('imports CART_DEFAULTS from defaults', () => {
    expect(code).toMatch(/import\s*\{\s*CART_DEFAULTS\s*\}\s*from\s*['"]@\/lib\/cart-editor\/defaults['"]/);
  });

  for (const path of HEADER_PATHS) {
    it(`seeds ${path} from CART_DEFAULTS.${path}`, () => {
      expect(code).toContain(`?? CART_DEFAULTS.${path}`);
    });
  }
});
