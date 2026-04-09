'use client';

interface CartPreviewProps {
  variant: string;
  features: Record<string, boolean>;
  label: string;
  color: string;
}

const MOCK_ITEMS = [
  { name: 'Orbit Quartz Watch \u2014 Gold', price: 10499, qty: 1 },
  { name: 'Classic Leather Strap \u2014 Black', price: 2999, qty: 1 },
];

function fmt(cents: number) {
  return '$' + (cents / 100).toFixed(2);
}

export default function CartPreview({ variant, features, label, color }: CartPreviewProps) {
  const subtotal = MOCK_ITEMS.reduce((s, i) => s + i.price * i.qty, 0);
  const freeShippingGoal = 15000;
  const progress = Math.min(100, (subtotal / freeShippingGoal) * 100);
  const remaining = Math.max(0, freeShippingGoal - subtotal);

  return (
    <div style={{ background: '#1a1a2e', borderRadius: 12, overflow: 'hidden', border: '1px solid ' + color + '40', maxWidth: 360, width: '100%' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', background: color + '15', borderBottom: '1px solid ' + color + '30', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color }}>{label}</span>
        <span style={{ fontSize: 11, color: '#64748b', background: '#0f172a', padding: '2px 8px', borderRadius: 10 }}>{variant}</span>
      </div>

      {/* Cart Title */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #ffffff10', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>Your Cart (2)</span>
        <span style={{ fontSize: 18, color: '#64748b' }}>\u00d7</span>
      </div>

      {/* Shipping Protection */}
      <div style={{ padding: '8px 16px', background: '#ffffff08', borderBottom: '1px solid #ffffff08', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>\ud83d\udee1\ufe0f</span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Shipping Protection</span>
        </div>
        <div style={{ width: 32, height: 18, borderRadius: 10, background: '#22c55e', position: 'relative' as const }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute' as const, top: 2, right: 2 }} />
        </div>
      </div>

      {/* Progress Bar */}
      {features.showProgressBar && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #ffffff08' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
            {remaining > 0 ? '\ud83d\ude9a $' + (remaining / 100).toFixed(2) + ' away from FREE shipping!' : '\u2705 You qualify for FREE shipping!'}
          </div>
          <div style={{ height: 4, background: '#334155', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: progress + '%', background: 'linear-gradient(90deg, #22c55e, #4ade80)', borderRadius: 2 }} />
          </div>
        </div>
      )}

      {/* Items */}
      <div style={{ padding: '8px 0' }}>
        {MOCK_ITEMS.map((item, i) => (
          <div key={i} style={{ padding: '8px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 50, height: 50, borderRadius: 6, background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
              {i === 0 ? '\u231a' : '\ud83d\udcff'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: '#e2e8f0', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Qty: {item.qty}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{fmt(item.price)}</div>
          </div>
        ))}
      </div>

      {/* Upsells */}
      {features.showUpsells && (
        <div style={{ margin: '0 16px 8px', padding: 10, background: '#ffffff08', borderRadius: 8, border: '1px dashed #475569' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>You might also like</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 4, background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>\ud83d\udc8e</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#e2e8f0' }}>Sapphire Pendant</div>
              <div style={{ fontSize: 11, color: '#4ade80' }}>$49.99</div>
            </div>
            <button style={{ fontSize: 10, padding: '4px 8px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4 }}>Add</button>
          </div>
        </div>
      )}

      {/* Social Proof */}
      {features.showSocialProof && (
        <div style={{ padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
          <span style={{ fontSize: 11, color: '#94a3b8' }}>23 people viewing this right now</span>
        </div>
      )}

      {/* Scarcity Timer */}
      {features.showScarcityTimer && (
        <div style={{ margin: '4px 16px 8px', padding: '8px 12px', background: '#7f1d1d20', borderRadius: 6, border: '1px solid #7f1d1d50', textAlign: 'center' as const }}>
          <span style={{ fontSize: 12, color: '#fca5a5' }}>\ud83d\udd25 Cart reserved for <strong>14:59</strong> \u2014 items selling fast!</span>
        </div>
      )}

      {/* Subtotal + Checkout */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #ffffff10' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>Subtotal</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>{fmt(subtotal)}</span>
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>Shipping & taxes at checkout</div>
        <button style={{
          width: '100%', padding: features.stickyCheckout ? '14px 0' : '12px 0',
          background: 'linear-gradient(135deg, #c9a55c, #d4af37)',
          color: '#1a1a2e', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
          boxShadow: features.stickyCheckout ? '0 -4px 12px rgba(201,165,92,0.3)' : 'none',
        }}>
          CHECKOUT \u2022 {fmt(subtotal)}
        </button>
        {features.stickyCheckout && (
          <div style={{ fontSize: 10, color: '#64748b', textAlign: 'center' as const, marginTop: 4 }}>\ud83d\udccc Stays visible on scroll</div>
        )}
      </div>

      {/* Trust Badges */}
      {features.showTrustBadges && (
        <div style={{ padding: '8px 16px 12px', borderTop: '1px solid #ffffff08', textAlign: 'center' as const }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 6 }}>
            {['Visa', 'MC', 'Amex', 'PayPal'].map(n => (
              <div key={n} style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2 }}>
                <div style={{
                  width: 28, height: 20, borderRadius: 3,
                  background: n === 'Visa' ? '#1A1F71' : n === 'MC' ? '#EB001B' : n === 'Amex' ? '#006FCF' : '#003087',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: '#fff', fontWeight: 700,
                }}>{n}</div>
                <span style={{ fontSize: 9, color: '#64748b' }}>{n}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            \ud83d\udd12 Secure Checkout \u00b7 Money-Back Guarantee
          </div>
        </div>
      )}

      <div style={{ padding: '6px 16px 10px', textAlign: 'center' as const }}>
        <span style={{ fontSize: 10, color: '#475569' }}>
          {Object.values(features).filter(Boolean).length} feature{Object.values(features).filter(Boolean).length !== 1 ? 's' : ''} active
        </span>
      </div>
    </div>
  );
}
