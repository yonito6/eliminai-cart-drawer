import { z } from 'zod';

// Hex color: 3 or 6 digits only. 8-digit (alpha) is rejected.
const hexColor = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  .transform((s) => {
    const h = s.slice(1).toLowerCase();
    if (h.length === 3) return '#' + h.split('').map(c => c + c).join('');
    return '#' + h;
  });

const safeString = (max: number) => z.string().max(max);

// Require single leading slash (not //) or https:// — rejects protocol-relative URLs.
const ctaLink = z.string().max(500).refine(
  (v) => (/^\/[^/]/.test(v) || v === '/') || /^https:\/\//.test(v),
  { message: 'ctaLink must be a relative path or https URL' }
);

const fontFamily = z.string().max(100).regex(/^[a-zA-Z0-9 ,\-_'"]+$/);

const headerSchema = z.object({
  title: safeString(200).optional(),
  showItemCountBadge: z.boolean().optional(),
  badgeColor: hexColor.optional(),
  closeIcon: z.enum(['x', 'chevron', 'arrow']).optional(),
  bgColor: hexColor.optional(),
  borderStyle: z.enum(['none', 'line', 'shadow']).optional(),
  padding: z.enum(['compact', 'comfortable', 'roomy']).optional(),
}).strict();

const milestoneBarSchema = z.object({
  preUnlockTemplate: safeString(200).optional(),
  unlockedTemplate: safeString(200).optional(),
  celebrationAnim: z.boolean().optional(),
  fillColor: hexColor.optional(),
  trackColor: hexColor.optional(),
  height: z.number().int().min(2).max(40).optional(),
  position: z.enum(['top', 'underHeader', 'aboveCheckout']).optional(),
  textSize: z.number().min(8).max(32).optional(),
  textWeight: z.number().int().min(100).max(900).optional(),
}).strict();

const lineItemSchema = z.object({
  imageSize: z.enum(['S', 'M', 'L']).optional(),
  imageShape: z.enum(['square', 'rounded', 'circle']).optional(),
  showVariant: z.boolean().optional(),
  showSku: z.boolean().optional(),
  qtyControl: z.enum(['minusPlus', 'stepper', 'dropdown']).optional(),
  removeStyle: z.enum(['x', 'trash', 'text']).optional(),
  showCompareAtPrice: z.boolean().optional(),
  showSavingsBadge: z.boolean().optional(),
  separator: z.enum(['line', 'spacing', 'card']).optional(),
  titleSize: z.number().min(8).max(32).optional(),
  titleWeight: z.number().int().min(100).max(900).optional(),
}).strict();

const emptyStateSchema = z.object({
  heading: safeString(200).optional(),
  subtext: safeString(200).optional(),
  icon: safeString(200).optional(),
  ctaLabel: safeString(200).optional(),
  ctaLink: ctaLink.optional(),
  ctaInheritsCheckoutStyle: z.boolean().optional(),
}).strict();

const footerSchema = z.object({
  showSubtotal: z.boolean().optional(),
  showShippingNote: z.boolean().optional(),
  showTaxNote: z.boolean().optional(),
  showYouSaved: z.boolean().optional(),
  showCrossedOutSubtotal: z.boolean().optional(),
  totalOutsideButton: z.boolean().optional(),
  totalLabel: safeString(200).optional(),
  totalSize: z.number().min(8).max(48).optional(),
  totalWeight: z.number().int().min(100).max(900).optional(),
  bgStyle: z.enum(['transparent', 'surface', 'accent']).optional(),
  borderTop: z.enum(['none', 'line', 'shadow']).optional(),
  showGiftNote: z.boolean().optional(),
}).strict();

const checkoutButtonSchema = z.object({
  label: safeString(200).optional(),
  bgColor: hexColor.optional(),
  bgHoverColor: hexColor.optional(),
  textColor: hexColor.optional(),
  radius: z.enum(['sharp', 'soft', 'rounded', 'pill']).optional(),
  height: z.enum(['S', 'M', 'L', 'XL']).optional(),
  fontWeight: z.number().int().min(100).max(900).optional(),
  letterSpacing: z.number().min(-2).max(10).optional(),
  icon: z.enum(['none', 'arrow', 'lock', 'cart']).optional(),
  fullWidth: z.boolean().optional(),
  loadingAnim: z.enum(['spinner', 'dots', 'shimmer']).optional(),
}).strict();

const trustLineSchema = z.object({
  text: safeString(200).optional(),
  showLockIcon: z.boolean().optional(),
  paymentIcons: z.record(z.string().max(40), z.boolean()).optional(),
  position: z.enum(['above', 'below']).optional(),
  textSize: z.number().min(8).max(24).optional(),
  textColor: hexColor.optional(),
}).strict();

const paletteSchema = z.object({
  bg: hexColor.optional(),
  surface: hexColor.optional(),
  text: hexColor.optional(),
  muted: hexColor.optional(),
  accent: hexColor.optional(),
  border: hexColor.optional(),
  success: hexColor.optional(),
  danger: hexColor.optional(),
}).strict();

const globalSchema = z.object({
  side: z.enum(['left', 'right']).optional(),
  widthDesktop: z.number().int().min(320).max(800).optional(),
  widthMobilePct: z.number().int().min(50).max(100).optional(),
  backdropColor: hexColor.optional(),
  backdropOpacity: z.number().min(0).max(1).optional(),
  openAnim: z.enum(['slide', 'fade', 'scale']).optional(),
  openDurationMs: z.number().int().min(100).max(600).optional(),
  palette: paletteSchema.optional(),
  fontFamily: fontFamily.optional(),
  baseFontSize: z.number().int().min(10).max(24).optional(),
  headingScale: z.number().min(1.0).max(1.8).optional(),
  spacing: z.enum(['compact', 'comfortable', 'roomy']).optional(),
  radius: z.enum(['sharp', 'soft', 'rounded']).optional(),
  // customCss intentionally NOT declared — .strict() rejects it
}).strict();

export const editorOverridesSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  header: headerSchema.optional(),
  milestoneBar: milestoneBarSchema.optional(),
  lineItem: lineItemSchema.optional(),
  emptyState: emptyStateSchema.optional(),
  footer: footerSchema.optional(),
  checkoutButton: checkoutButtonSchema.optional(),
  trustLine: trustLineSchema.optional(),
  global: globalSchema.optional(),
}).strict();

export type EditorOverrides = z.infer<typeof editorOverridesSchema>;

// Paths owned by the Addons tab — Cart Editor PUT must reject if body contains any of these
export const addonOwnedPaths = new Set<string>([
  'addons.milestone.enabled',
  'addons.milestone.tiers',
  'addons.trustLine.enabled',
  'addons.trustLine.providers',
  'addons.giftNote.enabled',
  'addons.giftNote.charLimit',
  'addons.giftNote.validation',
]);

/**
 * Recursively walks a body (objects and arrays) and returns the first addon-owned
 * path found, or null.
 *
 * Arrays are path-transparent: elements are walked with the same prefix as the
 * containing property. This prevents the array-bypass attack where addon-owned
 * paths are wrapped in an array to evade the dotted-path check.
 * e.g. { addons: [{ milestone: { tiers: [] } }] } still yields 'addons.milestone.tiers'.
 */
export function findAddonOwnedConflict(body: unknown, prefix = ''): string | null {
  if (!body || typeof body !== 'object') return null;
  if (Array.isArray(body)) {
    for (const element of body) {
      const inner = findAddonOwnedConflict(element, prefix);
      if (inner) return inner;
    }
    return null;
  }
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (addonOwnedPaths.has(path)) return path;
    if (v && typeof v === 'object') {
      const inner = findAddonOwnedConflict(v, path);
      if (inner) return inner;
    }
  }
  return null;
}
