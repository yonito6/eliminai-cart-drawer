'use client';

interface CartPreviewProps {
  variant: string;
  features: Record<string, boolean>;
  label: string;
  color: string;
}

export default function CartPreview({ variant, features, label, color }: CartPreviewProps) {
  const activeFeatures = Object.entries(features || {}).filter(([, v]) => v).map(([k]) => k);

  const featureLabels: Record<string, string> = {
    showTrustBadges: 'Trust Badges',
    showScarcityTimer: 'Scarcity Timer',
    showProgressBar: 'Free Shipping Bar',
    showUpsells: 'Upsell Recommendations',
    stickyCheckout: 'Sticky Checkout',
    showSocialProof: 'Social Proof',
  };

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '2px solid ' + color, maxWidth: 380, width: '100%', background: '#fff' }}>
      <div style={{ padding: '10px 16px', background: color, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{label}</span>
        <span style={{ fontSize: 11, color: '#ffffffcc', background: '#ffffff30', padding: '2px 8px', borderRadius: 10 }}>{variant}</span>
      </div>
      <div style={{ padding: '16px' }}>
        {activeFeatures.length === 0 ? (
          <div style={{ textAlign: 'center' as const, padding: '20px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>\u2205</div>
            <div style={{ fontSize: 13 }}>No features enabled</div>
            <div style={{ fontSize: 11, color: '#d1d5db' }}>Baseline cart experience</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
            {activeFeatures.map(key => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#166534', fontWeight: 500 }}>{featureLabels[key] || key}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ padding: '8px 16px 12px', borderTop: '1px solid #f3f4f6', textAlign: 'center' as const }}>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>
          {activeFeatures.length} feature{activeFeatures.length !== 1 ? 's' : ''} active \u2022 50% traffic
        </span>
      </div>
    </div>
  );
}
