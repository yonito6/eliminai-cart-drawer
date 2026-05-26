import { describe, it, expect } from 'vitest';
import { editorOverridesSchema, addonOwnedPaths, findAddonOwnedConflict } from '@/lib/cart-editor/schema';

describe('editorOverrides Zod schema', () => {
  it('accepts an empty object and defaults schemaVersion to 1', () => {
    const r = editorOverridesSchema.parse({});
    expect(r.schemaVersion).toBe(1);
  });
  it('accepts schemaVersion: 1 explicitly', () => {
    expect(editorOverridesSchema.parse({ schemaVersion: 1 }).schemaVersion).toBe(1);
  });
  it('rejects schemaVersion > 1', () => {
    expect(() => editorOverridesSchema.parse({ schemaVersion: 2 })).toThrow();
  });
  it('accepts 3-digit and 6-digit hex; normalizes to 6-digit', () => {
    const r = editorOverridesSchema.parse({
      header: { badgeColor: '#fff' },
      checkoutButton: { bgColor: '#abcdef' },
    });
    expect(r.header!.badgeColor).toBe('#ffffff');
    expect(r.checkoutButton!.bgColor).toBe('#abcdef');
  });
  it('rejects 8-digit hex (alpha not supported)', () => {
    expect(() => editorOverridesSchema.parse({ global: { palette: { accent: '#11223344' } } })).toThrow();
  });
  it('rejects non-hex color', () => {
    expect(() => editorOverridesSchema.parse({ header: { badgeColor: 'red' } })).toThrow();
  });
  it('rejects drawer width 319 (below min)', () => {
    expect(() => editorOverridesSchema.parse({ global: { widthDesktop: 319 } })).toThrow();
  });
  it('rejects drawer width 1200 (above max)', () => {
    expect(() => editorOverridesSchema.parse({ global: { widthDesktop: 1200 } })).toThrow();
  });
  it('accepts widthMobilePct = 100', () => {
    editorOverridesSchema.parse({ global: { widthMobilePct: 100 } });
  });
  it('rejects emptyState.ctaLink = javascript:', () => {
    expect(() => editorOverridesSchema.parse({ emptyState: { ctaLink: 'javascript:alert(1)' } })).toThrow();
  });
  it('rejects emptyState.ctaLink = http://', () => {
    expect(() => editorOverridesSchema.parse({ emptyState: { ctaLink: 'http://x.com' } })).toThrow();
  });
  it('rejects protocol-relative ctaLink', () => {
    expect(() => editorOverridesSchema.parse({ emptyState: { ctaLink: '//evil.com/steal' } })).toThrow();
  });
  it('accepts emptyState.ctaLink = relative path', () => {
    editorOverridesSchema.parse({ emptyState: { ctaLink: '/collections/all' } });
  });
  it('accepts emptyState.ctaLink = https URL', () => {
    editorOverridesSchema.parse({ emptyState: { ctaLink: 'https://example.com/p' } });
  });
  it('rejects fontFamily with parens', () => {
    expect(() => editorOverridesSchema.parse({ global: { fontFamily: 'Times) expression(alert(1)' } })).toThrow();
  });
  it('rejects unknown keys (strict mode)', () => {
    expect(() => editorOverridesSchema.parse({ header: { bogus: 1, title: 'OK' } } as any)).toThrow();
  });
  it('allows partial overrides (header only)', () => {
    const r = editorOverridesSchema.parse({ header: { title: 'X' } });
    expect(r.milestoneBar).toBeUndefined();
  });
  it('rejects body containing global.customCss', () => {
    expect(() => editorOverridesSchema.parse({ global: { customCss: '.x{}' } } as any)).toThrow();
  });
  it('rejects addon-owned paths via addonOwnedPaths guard', () => {
    expect(addonOwnedPaths.has('addons.milestone.tiers')).toBe(true);
    expect(addonOwnedPaths.has('addons.trustLine.providers')).toBe(true);
  });
  it('blocks addon-owned path even when wrapped in array', () => {
    // Array bypass: wrapping addon-owned paths inside an array should still be detected
    const body = { addons: [{ milestone: { tiers: [] } }] };
    const conflict = findAddonOwnedConflict(body);
    // The walker must find addons.milestone.tiers even via array traversal
    expect(conflict).not.toBeNull();
  });

  // ── header.closeButton subgroup (new in spec rev 4) ──
  it('accepts header.closeButton with all valid fields', () => {
    const r = editorOverridesSchema.parse({
      header: {
        closeButton: {
          position: 'right',
          iconSize: 'M',
          strokeWeight: 'normal',
          border: 'thin',
          bgColor: '#ffffff',
          iconColor: '#000000',
        },
      },
    });
    expect(r.header!.closeButton!.position).toBe('right');
  });
  it('rejects header.closeButton.position = invalid enum', () => {
    expect(() => editorOverridesSchema.parse({
      header: { closeButton: { position: 'top' } },
    } as any)).toThrow();
  });
  it('rejects unknown key in header.closeButton (strict)', () => {
    expect(() => editorOverridesSchema.parse({
      header: { closeButton: { bogus: 1 } },
    } as any)).toThrow();
  });

  // ── header new visual fields ──
  it('accepts header.heightPreset = slim | tall', () => {
    editorOverridesSchema.parse({ header: { heightPreset: 'slim' } });
    editorOverridesSchema.parse({ header: { heightPreset: 'tall' } });
  });
  it('rejects header.heightPreset invalid value', () => {
    expect(() => editorOverridesSchema.parse({ header: { heightPreset: 'huge' } } as any)).toThrow();
  });
  it('accepts header.headingLevel h2/h3/h4', () => {
    editorOverridesSchema.parse({ header: { headingLevel: 'h2' } });
    editorOverridesSchema.parse({ header: { headingLevel: 'h4' } });
  });
  it('accepts header.titleAlignment side|center', () => {
    editorOverridesSchema.parse({ header: { titleAlignment: 'side' } });
    editorOverridesSchema.parse({ header: { titleAlignment: 'center' } });
  });
  it('accepts header.titleFontSize within 14-48', () => {
    editorOverridesSchema.parse({ header: { titleFontSize: 14 } });
    editorOverridesSchema.parse({ header: { titleFontSize: 48 } });
  });
  it('rejects header.titleFontSize > 48', () => {
    expect(() => editorOverridesSchema.parse({ header: { titleFontSize: 49 } })).toThrow();
  });
  it('rejects header.titleFontSize < 14', () => {
    expect(() => editorOverridesSchema.parse({ header: { titleFontSize: 12 } })).toThrow();
  });

  // ── footer.stickyFooter ──
  it('accepts footer.stickyFooter boolean', () => {
    const r = editorOverridesSchema.parse({ footer: { stickyFooter: true } });
    expect(r.footer!.stickyFooter).toBe(true);
  });
  it('rejects footer.stickyFooter non-boolean', () => {
    expect(() => editorOverridesSchema.parse({ footer: { stickyFooter: 'yes' } } as any)).toThrow();
  });

  // ── global.behavior subgroup ──
  it('accepts global.behavior with all valid fields', () => {
    const r = editorOverridesSchema.parse({
      global: {
        behavior: {
          openOnAddToCart: true,
          autoCloseOnCheckout: false,
          bodyScrollLock: true,
          mobileFullscreen: false,
          hideOnPages: ['/checkout', '/account/login'],
        },
      },
    });
    expect(r.global!.behavior!.openOnAddToCart).toBe(true);
    expect(r.global!.behavior!.hideOnPages).toHaveLength(2);
  });
  it('rejects unknown key in global.behavior (strict)', () => {
    expect(() => editorOverridesSchema.parse({
      global: { behavior: { bogus: 1 } },
    } as any)).toThrow();
  });
  it('rejects global.behavior.hideOnPages with >50 entries', () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => `/p/${i}`);
    expect(() => editorOverridesSchema.parse({
      global: { behavior: { hideOnPages: tooMany } },
    })).toThrow();
  });
  it('rejects global.behavior.hideOnPages with string >200 chars', () => {
    const longPath = '/' + 'a'.repeat(250);
    expect(() => editorOverridesSchema.parse({
      global: { behavior: { hideOnPages: [longPath] } },
    })).toThrow();
  });
});
