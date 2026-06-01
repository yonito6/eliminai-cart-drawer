'use client';

import React, { useState, useRef, useEffect } from 'react';

interface ExpressPaymentsConfig {
  position?: 'above' | 'below';
}

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

  const savedRef = useRef<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  function buildPayload(overrides: Record<string, any> = {}) {
    return {
      position: overrides.position ?? position,
    };
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
        Express wallets are rendered by Shopify natively — only the ones your
        store&rsquo;s checkout actually supports appear (e.g. Shop Pay, Apple Pay,
        PayPal, Google Pay). There&rsquo;s nothing to toggle: if your shop
        doesn&rsquo;t offer a wallet, it never shows.
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
