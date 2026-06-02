'use client';

import React, { useState, useRef, useEffect } from 'react';

interface ExpressPaymentsConfig {
  position?: 'above' | 'below';
  hiddenWallets?: string[];
}

// Only PayPal can be controlled by this app. Apple Pay, Google Pay and Shop Pay
// are rendered inside Shopify's <shopify-accelerated-checkout-cart> closed shadow
// root and are unreachable from the storefront — those are managed in Shopify
// checkout settings, not here.
const WALLETS: Array<{ key: string; label: string }> = [
  { key: 'paypal', label: 'PayPal' },
];

export interface ExpressPaymentsAddonEditorProps {
  config: ExpressPaymentsConfig;
  onPreviewChange: (patch: Record<string, any>) => void;
  onSave: (fullConfig: Record<string, any>) => void;
}

const transition = 'all 0.25s cubic-bezier(0.4,0,0.2,1)';
const PURPLE = '#7c3aed';
const GRAY_TEXT = '#374151';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: '#fafafa',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  color: '#111827',
  fontSize: 13,
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: GRAY_TEXT,
  display: 'block',
  marginBottom: 6,
};

export default function ExpressPaymentsAddonEditor({
  config,
  onPreviewChange,
  onSave,
}: ExpressPaymentsAddonEditorProps) {
  const [position, setPosition] = useState<'above' | 'below'>(config.position ?? 'below');
  const [hiddenWallets, setHiddenWallets] = useState<string[]>(
    Array.isArray(config.hiddenWallets) ? config.hiddenWallets : [],
  );

  const savedRef = useRef<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  function buildPayload(overrides: Record<string, any> = {}) {
    return {
      position: overrides.position ?? position,
      hiddenWallets: overrides.hiddenWallets ?? hiddenWallets,
    };
  }

  function toggleWallet(key: string, show: boolean) {
    const next = show
      ? hiddenWallets.filter((k) => k !== key)
      : hiddenWallets.includes(key)
        ? hiddenWallets
        : [...hiddenWallets, key];
    setHiddenWallets(next);
    pushPreview({ hiddenWallets: next });
  }

  useEffect(() => {
    savedRef.current = JSON.stringify(buildPayload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pushPreview(overrides: Record<string, any> = {}) {
    const payload = buildPayload(overrides);
    onPreviewChange(payload);
    setIsDirty(JSON.stringify(payload) !== savedRef.current);
  }

  const handleSave = () => {
    const payload = buildPayload();
    setSaving(true);
    onSave(payload);
    savedRef.current = JSON.stringify(payload);
    setIsDirty(false);
    setTimeout(() => setSaving(false), 300);
  };

  const handleDiscard = () => {
    const saved = JSON.parse(savedRef.current) as ExpressPaymentsConfig;
    setPosition(saved.position ?? 'below');
    setHiddenWallets(Array.isArray(saved.hiddenWallets) ? saved.hiddenWallets : []);
    onPreviewChange(saved);
    setIsDirty(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Native availability note */}
      <div
        style={{
          padding: 12,
          background: '#f5f3ff',
          border: '1px solid #ddd6fe',
          borderRadius: 8,
          fontSize: 12,
          lineHeight: 1.5,
          color: '#4c1d95',
        }}
      >
        Express wallets are rendered by Shopify natively. Apple Pay, Google Pay and
        Shop Pay live inside Shopify&rsquo;s sealed checkout component and can only
        be turned on/off in your Shopify checkout settings &mdash; not here. PayPal
        is the one wallet this app can hide directly, with the toggle below.
      </div>

      {/* PayPal Show/Hide */}
      <div>
        <label style={labelStyle}>PayPal button</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {WALLETS.map((w) => {
            const shown = !hiddenWallets.includes(w.key);
            return (
              <label
                key={w.key}
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: GRAY_TEXT, cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={shown}
                  onChange={(e) => toggleWallet(w.key, e.target.checked)}
                />
                {w.label}
              </label>
            );
          })}
        </div>
      </div>

      {/* PayPal caveat */}
      <div
        style={{
          padding: 10,
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 8,
          fontSize: 12,
          lineHeight: 1.5,
          color: '#92400e',
        }}
      >
        Heads up: PayPal renders inside its own iframe. We hide its container, which
        works in most themes, but PayPal can occasionally resist being hidden by
        CSS. If it still shows after hiding, it&rsquo;s the iframe — let us know.
      </div>

      {/* Position */}
      <div>
        <label style={labelStyle}>Position relative to checkout button</label>
        <select
          value={position}
          onChange={(e) => {
            const v = e.target.value as 'above' | 'below';
            setPosition(v);
            pushPreview({ position: v });
          }}
          style={inputStyle}
        >
          <option value="below">Below checkout button</option>
          <option value="above">Above checkout button</option>
        </select>
      </div>

      {/* Save / Discard */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          style={{
            padding: '8px 20px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 8,
            border: 'none',
            background: saving ? '#a78bfa' : !isDirty ? '#d1d5db' : PURPLE,
            color: '#fff',
            cursor: saving || !isDirty ? 'default' : 'pointer',
            transition,
            boxShadow: !isDirty ? 'none' : `0 2px 8px ${PURPLE}40`,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {isDirty && (
          <button
            onClick={handleDiscard}
            disabled={saving}
            style={{
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: '#fff',
              color: GRAY_TEXT,
              cursor: saving ? 'default' : 'pointer',
              transition,
            }}
          >
            Discard
          </button>
        )}
      </div>
    </div>
  );
}
