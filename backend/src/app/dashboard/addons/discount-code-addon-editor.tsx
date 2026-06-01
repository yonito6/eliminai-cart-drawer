'use client';

import React, { useState, useRef, useEffect } from 'react';

type DiscountCodePosition = 'above-checkout' | 'top' | 'bottom';

interface DiscountCodeConfig {
  placeholder?: string;
  applyButtonLabel?: string;
  applyButtonColor?: string;
  position?: DiscountCodePosition;
  showAppliedBadge?: boolean;
}

export interface DiscountCodeAddonEditorProps {
  config: DiscountCodeConfig;
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

export default function DiscountCodeAddonEditor({
  config,
  onPreviewChange,
  onSave,
}: DiscountCodeAddonEditorProps) {
  const [placeholder, setPlaceholder] = useState<string>(config.placeholder ?? 'Discount code');
  const [applyButtonLabel, setApplyButtonLabel] = useState<string>(config.applyButtonLabel ?? 'Apply');
  const [applyButtonColor, setApplyButtonColor] = useState<string>(config.applyButtonColor ?? '#111111');
  const [position, setPosition] = useState<DiscountCodePosition>(config.position ?? 'above-checkout');
  const [showAppliedBadge, setShowAppliedBadge] = useState<boolean>(config.showAppliedBadge !== false);

  const savedRef = useRef<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  function buildPayload(overrides: Record<string, any> = {}) {
    return {
      placeholder: overrides.placeholder ?? placeholder,
      applyButtonLabel: overrides.applyButtonLabel ?? applyButtonLabel,
      applyButtonColor: overrides.applyButtonColor ?? applyButtonColor,
      position: overrides.position ?? position,
      showAppliedBadge: overrides.showAppliedBadge ?? showAppliedBadge,
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
    const saved = JSON.parse(savedRef.current) as DiscountCodeConfig;
    setPlaceholder(saved.placeholder ?? 'Discount code');
    setApplyButtonLabel(saved.applyButtonLabel ?? 'Apply');
    setApplyButtonColor(saved.applyButtonColor ?? '#111111');
    setPosition(saved.position ?? 'above-checkout');
    setShowAppliedBadge(saved.showAppliedBadge !== false);
    onPreviewChange(saved);
    setIsDirty(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={labelStyle}>Input placeholder</label>
        <input
          type="text"
          value={placeholder}
          onChange={(e) => {
            setPlaceholder(e.target.value);
            pushPreview({ placeholder: e.target.value });
          }}
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Apply button label</label>
        <input
          type="text"
          value={applyButtonLabel}
          onChange={(e) => {
            setApplyButtonLabel(e.target.value);
            pushPreview({ applyButtonLabel: e.target.value });
          }}
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Apply button color</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="color"
            value={applyButtonColor}
            onChange={(e) => {
              setApplyButtonColor(e.target.value);
              pushPreview({ applyButtonColor: e.target.value });
            }}
            style={{
              width: 44,
              height: 32,
              padding: 0,
              border: '1px solid #d1d5db',
              borderRadius: 6,
              background: '#fff',
              cursor: 'pointer',
            }}
          />
          <input
            type="text"
            value={applyButtonColor}
            onChange={(e) => {
              const v = e.target.value;
              setApplyButtonColor(v);
              if (/^#[0-9a-fA-F]{3,8}$/.test(v)) {
                pushPreview({ applyButtonColor: v });
              }
            }}
            style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }}
            placeholder="#111111"
          />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Position</label>
        <select
          value={position}
          onChange={(e) => {
            const v = e.target.value as DiscountCodePosition;
            setPosition(v);
            pushPreview({ position: v });
          }}
          style={inputStyle}
        >
          <option value="above-checkout">Above checkout button (recommended)</option>
          <option value="top">Top of footer</option>
          <option value="bottom">Bottom of footer</option>
        </select>
      </div>

      <div>
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: GRAY_TEXT }}
        >
          <input
            type="checkbox"
            checked={showAppliedBadge}
            onChange={(e) => {
              setShowAppliedBadge(e.target.checked);
              pushPreview({ showAppliedBadge: e.target.checked });
            }}
            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: PURPLE }}
          />
          <span>Show applied-discount badge</span>
        </label>
      </div>

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
