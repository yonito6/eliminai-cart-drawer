// Cart Editor Defaults — the REAL effective values the live cart drawer ships
// with (mirrors CONTROL_HTML / REAL_CART_CSS in cart-constants.ts and the
// storefront v14-complete.js). The editor seeds its controls from these so the
// UI shows the cart's true current value (e.g. "SECURE CHECKOUT", lock icon)
// instead of empty placeholders. These are display/seed defaults only — they
// are NOT written into the saved draft unless the user actually changes a field.

// ── Checkout button icon SVG paths ────────────────────────────────────
// The lock path is byte-identical to the one baked into CONTROL_HTML so the
// preview's default render and a `icon:'lock'` override produce the same SVG.
export const CHECKOUT_ICON_PATHS = {
  lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
  arrow: 'M16.01 11H4v2h12.01v3L20 12l-3.99-4z',
  cart: 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z',
} as const;

export type CheckoutIcon = 'none' | 'arrow' | 'lock' | 'cart';

// Corner-radius enum → CSS value (the live cart has NO modifier CSS classes,
// so both preview and v14 apply this as an inline style for guaranteed parity).
export const CHECKOUT_RADIUS_PX: Record<'sharp' | 'soft' | 'rounded' | 'pill', string> = {
  sharp: '0',
  soft: '8px',
  rounded: '14px',
  pill: '999px',
};

// Height enum → button padding (applied inline, same reasoning as radius).
export const CHECKOUT_HEIGHT_PADDING: Record<'S' | 'M' | 'L' | 'XL', string> = {
  S: '10px 24px',
  M: '14px 24px',
  L: '18px 24px',
  XL: '22px 24px',
};

// ── Header maps ───────────────────────────────────────────────────────
// Padding scale → CSS value. `comfortable` is byte-identical to the live
// `.ccd-header` rule (20px 20px 8px) so the default render and a
// `padding:'comfortable'` override produce the same box.
export const HEADER_PADDING: Record<'compact' | 'comfortable' | 'roomy', string> = {
  compact: '12px 20px 6px',
  comfortable: '20px 20px 8px',
  roomy: '28px 20px 12px',
};

// Height preset → min-height. `slim` is the current auto height; `tall` adds
// vertical breathing room. Applied inline (no modifier CSS exists).
export const HEADER_MIN_HEIGHT: Record<'slim' | 'tall', string> = {
  slim: 'auto',
  tall: '72px',
};

// Close-button icon size enum → px. `M` matches the current 22px svg.
export const CLOSE_ICON_SIZE_PX: Record<'S' | 'M' | 'L', string> = {
  S: '18px',
  M: '22px',
  L: '28px',
};

export type CloseIcon = 'x' | 'chevron' | 'arrow';

// Close-icon SVG markup. `x` is byte-identical to the one baked into the live
// drawer. Used by BOTH the preview renderer and (re-implemented identically)
// the storefront v14 applyEditorOverrides for guaranteed parity.
export const CLOSE_ICON_SVG: Record<CloseIcon, string> = {
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"></polyline></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>',
};

// Returns the SVG markup for a header close icon. Falls back to the `x` icon
// for an unknown/undefined value.
export function renderCloseIcon(icon: CloseIcon | undefined): string {
  return CLOSE_ICON_SVG[(icon ?? 'x') as CloseIcon] ?? CLOSE_ICON_SVG.x;
}

export const CART_DEFAULTS = {
  checkoutButton: {
    label: 'SECURE CHECKOUT',
    icon: 'lock' as CheckoutIcon,
    bgColor: '#111111',
    bgHoverColor: '#222222',
    textColor: '#ffffff',
    radius: 'soft' as const,
    height: 'M' as const,
    fontWeight: 700,
    letterSpacing: 1,
    fullWidth: true,
    loadingAnim: 'spinner' as const,
  },
  header: {
    title: 'Your cart',
    headingLevel: 'h2' as const,
    titleAlignment: 'side' as const,
    titleFontSize: 22,
    titleFontWeight: 'bold' as const,
    titleColor: '#111111',
    bgColor: '#ffffff',
    borderStyle: 'none' as const,
    padding: 'comfortable' as const,
    heightPreset: 'slim' as const,
    showItemCountBadge: false,
    badgeColor: '#eeeeee',
    closeIcon: 'x' as CloseIcon,
    closeButton: {
      position: 'right' as const,
      iconSize: 'M' as const,
      strokeWeight: 'normal' as const,
      border: 'none' as const,
      bgColor: '#ffffff',
      bgHoverColor: '#f5f5f5',
      iconColor: '#111111',
      borderColor: '#111111',
      borderHoverColor: '#111111',
    },
  },
  milestoneBar: {
    // Templates default empty → keep the engine's per-tier/fallback message.
    // When set, they OVERRIDE the message (vars: {{amount}}, {{tierName}}).
    preUnlockTemplate: '',
    unlockedTemplate: '',
    celebrationAnim: true,        // reached-icon pulse currently always plays
    fillColor: '#111111',         // reached icon / progress fill
    trackColor: '#dddddd',        // --ccd-progress-bg fallback
    height: 3,                    // .ccd-progress__line thickness (px)
    position: 'top' as const,     // current placement (top of contents)
    textSize: 15,                 // .ccd-progress__message font-size (px)
    textWeight: 400,              // message weight (normal)
  },
} as const;

// ── Custom SVG sanitizer ──────────────────────────────────────────────
// Allows a merchant-supplied <svg> while removing script execution vectors:
// <script> blocks, on* event handlers, and javascript:/data: URIs. Returns ''
// when the input does not look like an svg. Used by BOTH the preview renderer
// and (re-implemented identically) the storefront v14 applyEditorOverrides.
export function sanitizeSvgIcon(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  let s = raw.trim();
  if (!/^<svg[\s>]/i.test(s)) return '';
  // Drop <script>…</script> blocks
  s = s.replace(/<script[\s\S]*?<\/script\s*>/gi, '');
  // Drop <script ...> self-closing / unclosed
  s = s.replace(/<\/?script[^>]*>/gi, '');
  // Drop on*="..." / on*='...' / on*=word event handlers
  s = s.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
  s = s.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
  s = s.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');
  // Neutralize javascript: URIs
  s = s.replace(/javascript:/gi, '');
  return s;
}

// Validates a file-picked svg before it is stored in checkoutButton.iconCustom.
// Returns the trimmed svg text when the file is a usable <svg> (so it mirrors the
// paste flow: raw text in, sanitization happens at render via sanitizeSvgIcon),
// or null when the file is not an svg (PNG bytes, plain text, empty, non-string).
export function prepareUploadedSvgIcon(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!sanitizeSvgIcon(trimmed)) return null;
  return trimmed;
}

// Returns the SVG markup for a checkout-button icon. `iconCustom`, when present
// and the icon is not 'none', overrides the built-in icon. Returns '' for 'none'
// or an unknown icon.
export function renderCheckoutIcon(icon: CheckoutIcon | undefined, iconCustom?: string): string {
  if (icon === 'none') return '';
  if (iconCustom) {
    const clean = sanitizeSvgIcon(iconCustom);
    if (clean) return clean;
  }
  const key = (icon ?? 'lock') as Exclude<CheckoutIcon, 'none'>;
  const path = (CHECKOUT_ICON_PATHS as Record<string, string>)[key];
  if (!path) return '';
  return `<svg viewBox="0 0 24 24"><path d="${path}"></path></svg>`;
}
