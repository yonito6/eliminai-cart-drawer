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
});
