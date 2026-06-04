export interface CroSuggestion {
  key: string;
  label: string;
  blurb: string;
  evidence: string;
  source: string;            // URL
  impact: string;            // human range, e.g. "+3-10% conversion"
  metric: 'conversion' | 'aov' | 'attach_rate';
  fit: 'high' | 'medium' | 'low';
  watchStar?: boolean;
}

export const CRO_SUGGESTIONS: CroSuggestion[] = [
  {
    key: 'freeReturns',
    label: 'Free-returns / money-back line',
    blurb: 'A risk-reversal microcopy line near checkout that addresses purchase anxiety.',
    evidence: 'A prominent money-back guarantee produced +30% CVR in a Shopify A/B test (single-store case — expect the lower half).',
    source: 'https://blendcommerce.com/blogs/ab-tests-shopify/30-33-increase-in-conversion-rate',
    impact: '+5-15% conversion', metric: 'conversion', fit: 'high',
  },
  {
    key: 'deliveryDate',
    label: 'Estimated delivery date',
    blurb: '"Get it by Tue, Jun 9" on cart lines and near the checkout button.',
    evidence: 'Baymard: 75% say an estimated delivery date influences buying; unclear timing drives ~22% of abandonment.',
    source: 'https://baymard.com/blog/current-state-of-checkout-ux',
    impact: '+2-6% conversion', metric: 'conversion', fit: 'high',
  },
  {
    key: 'checkoutMicrocopy',
    label: 'Checkout-button microcopy',
    blurb: 'Vary the button label ("Secure Checkout"), benefit subtext, colour and lock icon.',
    evidence: '"Add to Cart" beat alternatives by +9-13% across three sites; lowest-effort test for the A/B engine.',
    source: 'https://www.convertmate.io/blog/add-to-cart-vs-buy-now',
    impact: '+3-10% conversion', metric: 'conversion', fit: 'medium',
  },
  {
    key: 'giftEngraving',
    label: 'Engraving + gift options',
    blurb: '"This is a gift" toggle plus a paid engraving line item — high-margin AOV, lowers returns.',
    evidence: 'Personalisation/engraving commands a premium and lowers return rates in jewellery/watch ecommerce benchmarks.',
    source: 'https://branvas.com/blogs/news/jewelry-ecommerce-benchmarks-conversion-rate-aov',
    impact: 'high-margin AOV', metric: 'aov', fit: 'high', watchStar: true,
  },
  {
    key: 'bnpl',
    label: 'BNPL "4 payments of $X"',
    blurb: 'Installment framing for your $180+ price band (Shop Pay / Klarna / Afterpay).',
    evidence: 'Shopify merchant data: ~27% conversion and ~21% AOV lift from BNPL (discount provider hype like Klarna 35%).',
    source: 'https://www.shopify.com/blog/buy-now-pay-later',
    impact: '+3-10% conversion', metric: 'conversion', fit: 'high',
  },
];
