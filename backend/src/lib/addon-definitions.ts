// Addon Definitions - Central registry of all cart addons
// and which dimensions are eligible for A/B testing via Thompson Sampling.

// ─── Interfaces ──────────────────────────────────────────────────────

export interface AddonDimension {
  key: string;
  label: string;
  type: 'select' | 'text' | 'number' | 'checkboxes' | 'toggle' | 'color';
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

// ─── Reward Tier Types ───────────────────────────────────────────────

export interface GiftProduct {
  handle: string;
  variantId: number;
  title: string;
  imageUrl?: string;
  price?: string;
}

export interface RewardTier {
  id: string;
  label: string;
  goal: number;
  icon: string;
  customIconUrl?: string;
  beforeText: string;
  afterText: string;
  /** @deprecated Use giftProducts instead */
  giftProduct?: GiftProduct | null;
  giftProducts: GiftProduct[];
}

export const REWARD_ICONS: Record<string, { label: string; svg: string }> = {
  shipping: {
    label: 'Shipping',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>',
  },
  tag: {
    label: 'Tag / Deal',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/></svg>',
  },
  gift: {
    label: 'Gift',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z"/></svg>',
  },
  star: {
    label: 'Star',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>',
  },
  heart: {
    label: 'Heart',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
  },
  crown: {
    label: 'Crown / VIP',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg>',
  },
  percent: {
    label: 'Discount',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>',
  },
  fire: {
    label: 'Fire',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/></svg>',
  },
  trophy: {
    label: 'Trophy',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>',
  },
  box: {
    label: 'Package',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 3H4c-1.1 0-2 .9-2 2v2h20V5c0-1.1-.9-2-2-2zM2 19c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9H2v10zm8-8h4v2h-4v-2z"/></svg>',
  },
  bolt: {
    label: 'Lightning',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 21h-1l1-7H7.5c-.88 0-.33-.75-.31-.78C8.48 10.94 10.42 7.54 13.01 3h1l-1 7h3.51c.4 0 .62.19.4.66C12.97 17.55 11 21 11 21z"/></svg>',
  },
  clock: {
    label: 'Limited Time',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>',
  },
  ribbon: {
    label: 'Exclusive',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 2v18l8-4 8 4V2H4zm14 14.47l-6-3-6 3V4h12v12.47z"/></svg>',
  },
  sparkle: {
    label: 'Sparkle',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z"/><path d="M19 1l-1.26 2.75L15 5l2.74 1.26L19 9l1.25-2.74L23 5l-2.75-1.25z" opacity=".6"/><path d="M19 15l-.62 1.38L17 17l1.38.62L19 19l.62-1.38L21 17l-1.38-.62z" opacity=".6"/></svg>',
  },
  diamond: {
    label: 'Diamond',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5L2 9l10 12L22 9l-3-6zM9.62 8l1.5-3h1.76l1.5 3H9.62zM11 10v6.68L5.44 10H11zm2 0h5.56L13 16.68V10zm6.26-2h-2.65l-1.5-3h2.65l1.5 3zM6.24 5h2.65l-1.5 3H4.74l1.5-3z"/></svg>',
  },
  lock: {
    label: 'Secure',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>',
  },
  cart: {
    label: 'Cart',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>',
  },
  truck: {
    label: 'Fast Delivery',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5H15V3H3c-1.1 0-2 .9-2 2v9h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2V9.65l-3.08-3.64zM6 15.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm12 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM3 7h4v4H1V7h2zm14 0h1.5l2.09 2.53H17V7z"/></svg>',
  },
  coins: {
    label: 'Savings',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15 4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/><path d="M3 12c0-2.61 1.67-4.83 4-5.65V4.26C3.55 5.15 1 8.27 1 12s2.55 6.85 6 7.74v-2.09c-2.33-.82-4-3.04-4-5.65z"/><path d="M15 8h-2v3h-3v2h3v3h2v-3h3v-2h-3z"/></svg>',
  },
  medal: {
    label: 'Medal',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 1l1.27 2.58L16 11.2l-2 1.95.47 2.76L12 14.69l-2.47 1.22L10 13.15l-2-1.95 2.73-.62L12 8z"/><path d="M20 2H4v2l4.86 3.64a6.95 6.95 0 016.28 0L20 4V2z"/></svg>',
  },
};

// ─── Addon Definitions Array ─────────────────────────────────────────

export const ADDON_DEFINITIONS: AddonDefinition[] = [
  {
    key: 'trustBadges',
    label: 'Trust Badges',
    icon: '🛡️',
    description:
      'Display payment provider icons and security badges to reduce purchase anxiety.',
    estimatedImpact: '+2-10% conversion',
    impactMetric: 'conversion',
    dimensions: [
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
          { value: 'shop-pay', label: 'Shop Pay' },
          { value: 'discover', label: 'Discover' },
          { value: 'klarna', label: 'Klarna' },
          { value: 'afterpay', label: 'Afterpay' },
          { value: 'stripe', label: 'Stripe' },
        ],
        default: ['visa', 'mastercard', 'amex', 'discover', 'paypal', 'apple-pay', 'google-pay'],
      },
    ],
    defaultConfig: { position: 'below-checkout', icons: ['visa', 'mastercard', 'amex', 'discover', 'paypal', 'apple-pay', 'google-pay'] },
  },

  {
    key: 'scarcityTimer',
    label: 'Scarcity Timer',
    icon: '⏱️',
    description:
      'Add a countdown timer to create urgency and encourage faster checkout.',
    estimatedImpact: '+2-8% conversion',
    impactMetric: 'conversion',
    dimensions: [
      {
        key: 'text',
        label: 'Timer Text',
        type: 'text',
        testable: true,
        default: '<span style="color:#d32f2f">Your cart is reserved for <strong>{time}</strong></span>',
        placeholder: 'Use {time} for the countdown',
      },
      {
        key: 'duration',
        label: 'Duration (minutes)',
        type: 'number',
        testable: true,
        min: 1,
        max: 60,
        default: 10,
      },
      {
        key: 'onComplete',
        label: 'When timer reaches 0',
        type: 'select',
        testable: false,
        options: [
          { value: 'hide', label: 'Hide timer' },
          { value: 'reset', label: 'Reset and start over' },
        ],
        default: 'hide',
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
      { key: 'pulseAnimation', label: 'Pulse Animation', type: 'toggle', testable: false, default: true },
    ],
    defaultConfig: {
      text: '<span style="color:#d32f2f">Your cart is reserved for <strong>{time}</strong></span>',
      duration: 10,
      onComplete: 'hide',
      position: 'below-header',
      pulseAnimation: true,
    },
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
    ],
    defaultConfig: {
      description: 'Covers lost, stolen, or damaged packages',
      defaultOn: true,
      pricingMode: 'single',
      price: 4.99,
      tiers: [],
      iconId: 'box-shield',
      iconUrl: null,
      productId: null,
      handle: null,
      variantId: 0,
    },
  },

  {
    key: 'freeShippingBar',
    label: 'Rewards',
    icon: '🏆',
    description:
      'Set item or dollar-based reward tiers (free shipping, buy-X-get-Y, gifts, etc.) to encourage larger orders.',
    estimatedImpact: '+10-20% AOV',
    impactMetric: 'aov',
    // Rewards uses a custom tier editor — dimensions only has position (for A/B testing).
    // The tiers config is stored in config.tiers[] and managed by RewardsTierEditor.
    dimensions: [
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
    defaultConfig: {
      position: 'above-items',
      thresholdMode: 'items',       // 'items' | 'dollars'
      highestTierOnly: false,        // only award highest eligible reward
      allRewardsUnlockedText: '🎉 You\'ve unlocked all rewards!',
      milestoneAnimation: true,             // enable/disable milestone animation
      milestoneAnimationType: 'pulse',      // 'pulse' | 'bounce' | 'heartbeat' | 'shake' | 'none'
      giftShowComparePrice: true,           // show crossed-out original price next to "Free"
      giftHideDiscountLabel: true,           // hide gift discount label from discount row and gift line item
      tiers: [],
    },
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
        type: 'text',
        testable: true,
        placeholder: 'You may also like',
        default: '<div style="text-align:center"><strong>You may also like</strong></div>',
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
        key: 'maxProducts',
        label: 'Max Products',
        type: 'number',
        testable: true,
        min: 1,
        max: 6,
        default: 3,
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
    defaultConfig: {
      source: 'shopify-recommendations',
      headline: '<div style="text-align:center"><strong>You may also like</strong></div>',
      layout: 'horizontal-scroll',
      maxProducts: 3,
      position: 'below-items',
      manualProducts: [], // [{ handle, variantId, title, image, price }]
    },
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

  {
    key: 'notes',
    label: 'Order Notes',
    icon: '📝',
    description: 'Let shoppers add a note to their order.',
    estimatedImpact: 'AOV neutral, conversion +1-2%',
    impactMetric: 'conversion',
    dimensions: [
      { key: 'label', label: 'Field label', type: 'text', testable: false, default: 'Add a note to your order' },
      { key: 'placeholder', label: 'Placeholder', type: 'text', testable: false, default: '' },
      { key: 'maxChars', label: 'Max characters (0 = unlimited)', type: 'number', testable: false, default: 250, min: 0, max: 1000 },
      {
        key: 'position',
        label: 'Position in footer',
        type: 'select',
        testable: true,
        options: [
          { value: 'top', label: 'Top of footer' },
          { value: 'bottom', label: 'Bottom of footer' },
        ],
        default: 'bottom',
      },
    ],
    defaultConfig: {
      enabled: false,
      label: 'Add a note to your order',
      placeholder: '',
      maxChars: 250,
      position: 'bottom',
    },
  },

  {
    key: 'discountCode',
    label: 'Discount Code Field',
    icon: '🏷️',
    description: 'Inline discount code input in cart.',
    estimatedImpact: 'Conversion +2-5% (when used with promos)',
    impactMetric: 'conversion',
    dimensions: [
      { key: 'placeholder', label: 'Input placeholder', type: 'text', testable: false, default: 'Discount code' },
      { key: 'applyButtonLabel', label: 'Apply button label', type: 'text', testable: false, default: 'Apply' },
      {
        key: 'position',
        label: 'Position',
        type: 'select',
        testable: true,
        options: [
          { value: 'top', label: 'Top of footer' },
          { value: 'bottom', label: 'Bottom of footer' },
        ],
        default: 'bottom',
      },
      { key: 'showAppliedBadge', label: 'Show applied-discount badge', type: 'toggle', testable: false, default: true },
    ],
    defaultConfig: {
      enabled: false,
      placeholder: 'Discount code',
      applyButtonLabel: 'Apply',
      position: 'bottom',
      showAppliedBadge: true,
    },
  },

  {
    key: 'termsCheckbox',
    label: 'Terms & Conditions',
    icon: '☑️',
    description: 'Required agreement checkbox above the checkout button.',
    estimatedImpact: 'Legal compliance; minor conversion impact',
    impactMetric: 'conversion',
    dimensions: [
      {
        key: 'labelHtml',
        label: 'Checkbox label (supports <a> tags only)',
        type: 'text',
        testable: false,
        default: 'I agree to the <a href="/policies/terms-of-service">Terms of Service</a>',
      },
      {
        key: 'errorMessage',
        label: 'Error if unchecked',
        type: 'text',
        testable: false,
        default: 'Please agree to the terms before continuing',
      },
      {
        key: 'blockCheckoutIfUnchecked',
        label: 'Block checkout if unchecked',
        type: 'toggle',
        testable: false,
        default: true,
      },
    ],
    defaultConfig: {
      enabled: false,
      labelHtml: 'I agree to the <a href="/policies/terms-of-service">Terms of Service</a>',
      errorMessage: 'Please agree to the terms before continuing',
      blockCheckoutIfUnchecked: true,
    },
  },

  {
    key: 'expressPayments',
    label: 'Express Checkout Buttons',
    icon: '⚡',
    description: 'Show Shop Pay, Apple Pay, PayPal, and more directly in the cart.',
    estimatedImpact: 'Conversion +8-15%',
    impactMetric: 'conversion',
    dimensions: [
      {
        key: 'providers',
        label: 'Show providers',
        type: 'checkboxes',
        testable: false,
        checkboxOptions: [
          { value: 'shopPay', label: 'Shop Pay' },
          { value: 'googlePay', label: 'Google Pay' },
          { value: 'paypal', label: 'PayPal' },
          { value: 'applePay', label: 'Apple Pay' },
          { value: 'amazonPay', label: 'Amazon Pay' },
          { value: 'metaPay', label: 'Meta Pay' },
        ],
        default: { shopPay: true, googlePay: true, paypal: true, applePay: true, amazonPay: false, metaPay: false },
      },
      {
        key: 'position',
        label: 'Position relative to checkout button',
        type: 'select',
        testable: true,
        options: [
          { value: 'above', label: 'Above checkout button' },
          { value: 'below', label: 'Below checkout button' },
        ],
        default: 'above',
      },
      {
        key: 'layout',
        label: 'Layout',
        type: 'select',
        testable: true,
        options: [
          { value: 'stacked', label: 'Stacked (full-width buttons)' },
          { value: 'row', label: 'Row (compact)' },
        ],
        default: 'stacked',
      },
      { key: 'separatorLabel', label: 'Separator label (empty = none)', type: 'text', testable: false, default: 'or' },
    ],
    defaultConfig: {
      enabled: true,
      providers: { shopPay: true, googlePay: true, paypal: true, applePay: true, amazonPay: false, metaPay: false },
      position: 'above',
      layout: 'stacked',
      separatorLabel: 'or',
    },
  },

  {
    key: 'lowStockBadge',
    label: 'Only X Left Badge',
    icon: '🔥',
    description:
      'Show an "Only X left!" scarcity badge on a cart line item. Two modes: Auto (real Shopify inventory) or Fake (auto-attaches to the Nth unique product added).',
    estimatedImpact: '+3-9% conversion',
    impactMetric: 'conversion',
    dimensions: [
      {
        key: 'mode',
        label: 'Mode',
        type: 'select',
        testable: true,
        options: [
          { value: 'fake', label: 'Fake scarcity (auto-pick Nth product)' },
          { value: 'auto', label: 'Auto (real Shopify inventory)' },
        ],
        default: 'fake',
      },
      {
        key: 'target',
        label: 'Which product gets the badge (Fake mode)',
        type: 'select',
        testable: true,
        options: [
          { value: '1', label: '1st different product added' },
          { value: '2', label: '2nd different product added' },
          { value: '3', label: '3rd different product added' },
          { value: 'last', label: 'Last product added' },
          { value: 'random', label: 'Random product in cart' },
        ],
        default: '2',
      },
      {
        key: 'fakeQty',
        label: 'Number shown in badge (Fake mode)',
        type: 'number',
        testable: true,
        min: 1,
        max: 20,
        default: 1,
      },
      {
        key: 'threshold',
        label: 'Inventory threshold (Auto mode — show badge when stock ≤ this)',
        type: 'number',
        testable: true,
        min: 1,
        max: 100,
        default: 5,
      },
      {
        key: 'text',
        label: 'Badge text',
        type: 'text',
        testable: true,
        default: 'Only {n} left!',
        placeholder: 'Use {n} for the quantity',
      },
      {
        key: 'icon',
        label: 'Icon',
        type: 'select',
        testable: false,
        options: [
          { value: 'fire', label: '🔥 Fire' },
          { value: 'clock', label: '⏰ Clock' },
          { value: 'warning', label: '⚠️ Warning' },
          { value: 'none', label: 'No icon' },
        ],
        default: 'fire',
      },
      {
        key: 'blockAddToCart',
        label: 'Block customer from adding more',
        type: 'toggle',
        testable: false,
        default: true,
      },
      {
        key: 'toastMessage',
        label: 'Toast shown when block is hit',
        type: 'text',
        testable: false,
        default: 'Only {n} left — already in your cart!',
        placeholder: 'Use {n} for the quantity',
      },
    ],
    defaultConfig: {
      mode: 'fake',
      target: '2',
      fakeQty: 1,
      threshold: 5,
      text: 'Only {n} left!',
      icon: 'fire',
      blockAddToCart: true,
      toastMessage: 'Only {n} left — already in your cart!',
    },
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

// ─── HTML Sanitizer for termsCheckbox.labelHtml ──────────────────────
//
// Allows ONLY <a> tags with a strict allowlist of attributes (href, target, rel).
// Strips everything else. Rejects javascript: and data: in href. Caps output at
// 500 chars. Server-side only — never trust client output.

const ALLOWED_ANCHOR_ATTRS = new Set(['href', 'target', 'rel']);

function isSafeHref(href: string): boolean {
  const trimmed = href.trim().toLowerCase();
  if (trimmed.startsWith('javascript:')) return false;
  if (trimmed.startsWith('data:')) return false;
  if (trimmed.startsWith('vbscript:')) return false;
  return true;
}

/**
 * Sanitize an HTML string intended for a checkbox label.
 *
 * - Strips all tags except <a>
 * - On <a>: keeps only href/target/rel attributes
 * - Rejects javascript:, data:, vbscript: schemes in href (drops the tag entirely)
 * - Removes event-handler attributes (onclick, onerror, etc.)
 * - Truncates output to 500 characters
 *
 * Returns the sanitized string. Never throws.
 */
export function sanitizeLabelHtml(input: unknown): string {
  if (typeof input !== 'string') return '';

  // First pass: remove dangerous nested elements wholesale (their contents too)
  let out = input
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script\b[^>]*\/?>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi, '')
    .replace(/<iframe\b[^>]*\/?>/gi, '');

  // Second pass: walk tags. Keep only <a>...</a> with safe attrs; drop everything else.
  out = out.replace(/<\/?\s*([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (full, rawTag, rawAttrs) => {
    const tag = String(rawTag).toLowerCase();
    const isClose = full.startsWith('</');

    if (tag !== 'a') {
      // Strip the tag entirely (but its text content remains)
      return '';
    }

    if (isClose) return '</a>';

    // Parse attributes from rawAttrs; keep only allowed ones with safe values
    const kept: string[] = [];
    const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
    let m: RegExpExecArray | null;
    while ((m = attrRegex.exec(String(rawAttrs))) !== null) {
      const name = m[1].toLowerCase();
      const value = m[2] ?? m[3] ?? m[4] ?? '';
      if (!ALLOWED_ANCHOR_ATTRS.has(name)) continue;
      if (name === 'href' && !isSafeHref(value)) {
        // Whole <a> is unsafe — drop the tag entirely
        return '';
      }
      // Escape any double-quotes in value to prevent breaking attr
      const safe = value.replace(/"/g, '&quot;');
      kept.push(`${name}="${safe}"`);
    }
    return kept.length > 0 ? `<a ${kept.join(' ')}>` : '<a>';
  });

  // Final length cap
  if (out.length > 500) out = out.slice(0, 500);
  return out;
}
