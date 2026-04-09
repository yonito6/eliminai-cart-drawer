// Addon Definitions - Central registry of all cart addons
// and which dimensions are eligible for A/B testing via Thompson Sampling.

// ─── Interfaces ──────────────────────────────────────────────────────

export interface AddonDimension {
  key: string;
  label: string;
  type: 'select' | 'text' | 'number' | 'checkboxes' | 'toggle';
  testable: boolean;
  options?: { value: string; label: string }[];
  checkboxOptions?: { value: string; label: string }[];
  default: any;
  min?: number;
  max?: number;
  placeholder?: string;
}

export interface AddonDefinition {
  key: string;
  label: string;
  icon: string;
  description: string;
  estimatedImpact: string;
  impactMetric: string;
  dimensions: AddonDimension[];
  defaultConfig: Record<string, any>;
}

// ─── Addon Definitions Array ─────────────────────────────────────────

export const ADDON_DEFINITIONS: AddonDefinition[] = [
  {
    key: 'trustBadges',
    label: 'Trust Badges',
    icon: '🛡',
    description:
      'Display payment provider icons and security badges to reduce purchase anxiety.',
    estimatedImpact: '+2-10% conversion',
    impactMetric: 'conversion',
    dimensions: [
      {
        key: 'style',
        label: 'Badge Style',
        type: 'select',
        testable: true,
        options: [
          { value: 'icons-labels', label: 'Icons + Labels' },
          { value: 'icons-only', label: 'Icons Only' },
          { value: 'compact-strip', label: 'Compact Strip' },
        ],
        default: 'icons-labels',
      },
      {
        key: 'text',
        label: 'Badge Text',
        type: 'text',
        testable: true,
        default: 'Secure checkout powered by Shopify',
        placeholder: 'e.g. 100% Secure Payment',
      },
      {
        key: 'position',
        label: 'Position',
        type: 'select',
        testable: true,
        options: [
          { value: 'below-checkout', label: 'Below Checkout Button' },
          { value: 'above-checkout', label: 'Above Checkout Button' },
          { value: 'below-items', label: 'Below Cart Items' },
        ],
        default: 'below-checkout',
      },
      {
        key: 'icons',
        label: 'Payment Icons',
        type: 'checkboxes',
        testable: false,
        checkboxOptions: [
          { value: 'visa', label: 'Visa' },
          { value: 'mastercard', label: 'Mastercard' },
          { value: 'amex', label: 'Amex' },
          { value: 'paypal', label: 'PayPal' },
          { value: 'apple-pay', label: 'Apple Pay' },
          { value: 'google-pay', label: 'Google Pay' },
        ],
        default: ['visa', 'mastercard', 'amex', 'paypal'],
      },
    ],
    defaultConfig: { style: 'icons-labels', text: 'Secure checkout powered by Shopify', position: 'below-checkout', icons: ['visa', 'mastercard', 'amex', 'paypal'] },
  },

  {
    key: 'scarcityTimer',
    label: 'Scarcity Timer',
    icon: '⏱',
    description:
      'Add a countdown timer to create urgency and encourage faster checkout.',
    estimatedImpact: '+2-8% conversion',
    impactMetric: 'conversion',
    dimensions: [
      {
        key: 'textTemplate',
        label: 'Timer Text',
        type: 'select',
        testable: true,
        options: [
          { value: 'reserve-expires', label: 'Your cart is reserved for {time}' },
          { value: 'demand-warning', label: 'High demand! Complete checkout in {time}' },
          { value: 'offer-expires', label: 'This offer expires in {time}' },
        ],
        default: 'reserve-expires',
      },
      {
        key: 'duration',
        label: 'Timer Duration',
        type: 'select',
        testable: true,
        options: [
          { value: '10', label: '10 minutes' },
          { value: '15', label: '15 minutes' },
          { value: '20', label: '20 minutes' },
        ],
        default: '15',
      },
      {
        key: 'style',
        label: 'Timer Style',
        type: 'select',
        testable: true,
        options: [
          { value: 'subtle-text', label: 'Subtle Text' },
          { value: 'bold-banner', label: 'Bold Banner' },
          { value: 'animated-pulse', label: 'Animated Pulse' },
        ],
        default: 'subtle-text',
      },
      {
        key: 'position',
        label: 'Position',
        type: 'select',
        testable: true,
        options: [
          { value: 'below-header', label: 'Below Header' },
          { value: 'above-checkout', label: 'Above Checkout Button' },
          { value: 'floating-top', label: 'Floating Top' },
        ],
        default: 'below-header',
      },
    ],
    defaultConfig: { textTemplate: 'reserve-expires', duration: '15', style: 'subtle-text', position: 'below-header' },
  },

  {
    key: 'shippingProtection',
    label: 'Shipping Protection',
    icon: '🔒',
    description:
      'Offer optional shipping protection as a cart line item to boost revenue.',
    estimatedImpact: '+15-25% attach rate',
    impactMetric: 'attach_rate',
    dimensions: [
      {
        key: 'price',
        label: 'Protection Price',
        type: 'number',
        testable: false,
        default: 4.99,
        min: 0.99,
        max: 19.99,
        placeholder: '4.99',
      },
      {
        key: 'description',
        label: 'Description Text',
        type: 'text',
        testable: true,
        default: 'Covers lost, stolen, or damaged packages',
        placeholder: 'Describe what the protection covers',
      },
      {
        key: 'defaultOn',
        label: 'Enabled by Default',
        type: 'toggle',
        testable: true,
        default: true,
      },
      {
        key: 'style',
        label: 'Display Style',
        type: 'select',
        testable: true,
        options: [
          { value: 'compact', label: 'Compact' },
          { value: 'detailed', label: 'Detailed' },
        ],
        default: 'compact',
      },
    ],
    defaultConfig: { price: 4.99, description: 'Covers lost, stolen, or damaged packages', defaultOn: true, style: 'compact' },
  },

  {
    key: 'freeShippingBar',
    label: 'Free Shipping Bar',
    icon: '📦',
    description:
      'Show progress toward free shipping to increase average order value.',
    estimatedImpact: '+10-20% AOV',
    impactMetric: 'aov',
    dimensions: [
      {
        key: 'threshold',
        label: 'Free Shipping Threshold',
        type: 'number',
        testable: false,
        default: 75,
        min: 10,
        max: 500,
        placeholder: '75',
      },
      {
        key: 'textTemplate',
        label: 'Bar Text',
        type: 'select',
        testable: true,
        options: [
          { value: 'spend-more', label: 'Spend {amount} more for FREE shipping!' },
          { value: 'almost-there', label: 'You\'re only {amount} away from free shipping!' },
        ],
        default: 'spend-more',
      },
      {
        key: 'style',
        label: 'Bar Style',
        type: 'select',
        testable: true,
        options: [
          { value: 'thin-bar', label: 'Thin Bar' },
          { value: 'full-progress', label: 'Full Progress Bar' },
        ],
        default: 'full-progress',
      },
      {
        key: 'position',
        label: 'Position',
        type: 'select',
        testable: true,
        options: [
          { value: 'header', label: 'Header' },
          { value: 'above-items', label: 'Above Cart Items' },
          { value: 'below-items', label: 'Below Cart Items' },
        ],
        default: 'above-items',
      },
    ],
    defaultConfig: { threshold: 75, textTemplate: 'spend-more', style: 'full-progress', position: 'above-items' },
  },

  {
    key: 'upsellRecommendations',
    label: 'Upsell Recommendations',
    icon: '🎁',
    description:
      'Show product recommendations in the cart to increase order value.',
    estimatedImpact: '+10-25% AOV',
    impactMetric: 'aov',
    dimensions: [
      {
        key: 'source',
        label: 'Recommendation Source',
        type: 'select',
        testable: false,
        options: [
          { value: 'shopify-recommendations', label: 'Shopify Recommendations' },
          { value: 'manual', label: 'Manual Selection' },
          { value: 'ai-selected', label: 'AI Selected' },
        ],
        default: 'shopify-recommendations',
      },
      {
        key: 'headline',
        label: 'Section Headline',
        type: 'select',
        testable: true,
        options: [
          { value: 'you-may-also-like', label: 'You may also like' },
          { value: 'complete-your-order', label: 'Complete your order' },
          { value: 'customers-also-bought', label: 'Customers also bought' },
        ],
        default: 'you-may-also-like',
      },
      {
        key: 'layout',
        label: 'Layout',
        type: 'select',
        testable: true,
        options: [
          { value: 'single-card', label: 'Single Card' },
          { value: 'horizontal-scroll', label: 'Horizontal Scroll' },
          { value: 'stacked-list', label: 'Stacked List' },
        ],
        default: 'horizontal-scroll',
      },
      {
        key: 'position',
        label: 'Position',
        type: 'select',
        testable: true,
        options: [
          { value: 'below-items', label: 'Below Cart Items' },
          { value: 'above-footer', label: 'Above Footer' },
          { value: 'after-checkout', label: 'After Checkout Button' },
        ],
        default: 'below-items',
      },
    ],
    defaultConfig: { source: 'shopify-recommendations', headline: 'you-may-also-like', layout: 'horizontal-scroll', position: 'below-items' },
  },

  {
    key: 'socialProof',
    label: 'Social Proof',
    icon: '👥',
    description:
      'Display real-time social proof notifications to build trust and urgency.',
    estimatedImpact: '+1-5% conversion',
    impactMetric: 'conversion',
    dimensions: [
      {
        key: 'textTemplate',
        label: 'Notification Text',
        type: 'select',
        testable: true,
        options: [
          { value: 'people-viewing', label: '{count} people are viewing this right now' },
          { value: 'bought-today', label: '{count} bought today' },
          { value: 'in-carts', label: 'In {count} carts right now' },
        ],
        default: 'people-viewing',
      },
      {
        key: 'style',
        label: 'Display Style',
        type: 'select',
        testable: true,
        options: [
          { value: 'subtle-text', label: 'Subtle Text' },
          { value: 'badge-animated', label: 'Animated Badge' },
          { value: 'toast', label: 'Toast Notification' },
        ],
        default: 'subtle-text',
      },
      {
        key: 'position',
        label: 'Position',
        type: 'select',
        testable: true,
        options: [
          { value: 'header', label: 'Header' },
          { value: 'above-checkout', label: 'Above Checkout Button' },
          { value: 'floating', label: 'Floating' },
        ],
        default: 'header',
      },
    ],
    defaultConfig: { textTemplate: 'people-viewing', style: 'subtle-text', position: 'header' },
  },

];

// ─── Helper Functions ────────────────────────────────────────────────

/**
 * Look up a single addon definition by its key.
 */
export function getAddonDefinition(
  key: string,
): AddonDefinition | undefined {
  return ADDON_DEFINITIONS.find((d) => d.key === key);
}

/**
 * Build a fresh default addons config object with every addon disabled.
 * Used when initialising a new store or resetting to defaults.
 */
export function getDefaultAddonsConfig(): {
  addons: Record<
    string,
    {
      enabled: false;
      mode: 'off';
      config: Record<string, any>;
      optimizeState: null;
      results: null;
    }
  >;
  optimizeQueue: string[];
} {
  const addons: Record<
    string,
    {
      enabled: false;
      mode: 'off';
      config: Record<string, any>;
      optimizeState: null;
      results: null;
    }
  > = {};

  for (const def of ADDON_DEFINITIONS) {
    addons[def.key] = {
      enabled: false,
      mode: 'off',
      config: { ...def.defaultConfig },
      optimizeState: null,
      results: null,
    };
  }

  return { addons, optimizeQueue: [] };
}
