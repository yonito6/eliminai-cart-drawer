'use client';

import React, { useState, useRef, useEffect } from 'react';

type Provider = 'shopPay' | 'googlePay' | 'paypal' | 'applePay' | 'amazonPay' | 'metaPay';

type ProvidersMap = Record<Provider, boolean>;

interface ExpressPaymentsConfig {
  providers?: Partial<ProvidersMap>;
  position?: 'above' | 'below';
  layout?: 'stacked' | 'row';
  separatorLabel?: string;
}

export interface ExpressPaymentsAddonEditorProps {
  config: ExpressPaymentsConfig;
  onPreviewChange: (patch: Record<string, any>) => void;
  onSave: (fullConfig: Record<string, any>) => void;
}

const transition = 'all 0.25s cubic-bezier(0.4,0,0.2,1)';
const PURPLE = '#7c3aed';
const GRAY_TEXT = '#374151';

const PROVIDER_DEFS: { value: Provider; label: string; bg: string; fg: string }[] = [
  { value: 'shopPay', label: 'Shop Pay', bg: '#5a31f4', fg: '#fff' },
  { value: 'googlePay', label: 'Google Pay', bg: '#000', fg: '#fff' },
  { value: 'paypal', label: 'PayPal', bg: '#ffc439', fg: '#003087' },
  { value: 'applePay', label: 'Apple Pay', bg: '#000', fg: '#fff' },
  { value: 'amazonPay', label: 'Amazon Pay', bg: '#ff9900', fg: '#000' },
  { value: 'metaPay', label: 'Meta Pay', bg: '#0866ff', fg: '#fff' },
];

const DEFAULT_PROVIDERS: ProvidersMap = {
  shopPay: true,
  googlePay: true,
  paypal: true,
  applePay: true,
  amazonPay: false,
  metaPay: false,
};

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

function normalizeProviders(p?: Partial<ProvidersMap>): ProvidersMap {
  return { ...DEFAULT_PROVIDERS, ...(p ?? {}) };
}

export default function ExpressPaymentsAddonEditor({
  config,
  onPreviewChange,
  onSave,
}: ExpressPaymentsAddonEditorProps) {
  const [providers, setProviders] = useState<ProvidersMap>(normalizeProviders(config.providers));
  const [position, setPosition] = useState<'above' | 'below'>(config.position ?? 'above');
  const [layout, setLayout] = useState<'stacked' | 'row'>(config.layout ?? 'stacked');
  const [separatorLabel, setSeparatorLabel] = useState<string>(config.separatorLabel ?? 'or');

  const savedRef = useRef<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  function buildPayload(overrides: Record<string, any> = {}) {
    return {
      providers: overrides.providers ?? providers,
      position: overrides.position ?? position,
      layout: overrides.layout ?? layout,
      separatorLabel: overrides.separatorLabel ?? separatorLabel,
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

  const toggleProvider = (key: Provider) => {
    const next = { ...providers, [key]: !providers[key] };
    setProviders(next);
    pushPreview({ providers: next });
  };

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
    setProviders(normalizeProviders(saved.providers));
    setPosition(saved.position ?? 'above');
    setLayout(saved.layout ?? 'stacked');
    setSeparatorLabel(saved.separatorLabel ?? 'or');
    onPreviewChange(saved);
    setIsDirty(false);
  };

  const enabledProviders = PROVIDER_DEFS.filter((p) => providers[p.value]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Provider toggles */}
      <div>
        <label style={labelStyle}>Show providers</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {PROVIDER_DEFS.map((p) => {
            const checked = providers[p.value];
            return (
              <div
                key={p.value}
                onClick={() => toggleProvider(p.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  background: checked ? '#eff6ff' : '#f9fafb',
                  border: `2px solid ${checked ? '#3b82f6' : '#e5e7eb'}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition,
                  userSelect: 'none',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 28,
                    height: 18,
                    background: p.bg,
                    color: p.fg,
                    borderRadius: 3,
                    fontSize: 8,
                    fontWeight: 700,
                    textAlign: 'center',
                    lineHeight: '18px',
                  }}
                >
                  {p.label.split(' ')[0]}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: checked ? 600 : 400,
                    color: checked ? '#1e40af' : GRAY_TEXT,
                  }}
                >
                  {p.label}
                </span>
              </div>
            );
          })}
        </div>
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
          <option value="above">Above checkout button</option>
          <option value="below">Below checkout button</option>
        </select>
      </div>

      {/* Layout */}
      <div>
        <label style={labelStyle}>Layout</label>
        <select
          value={layout}
          onChange={(e) => {
            const v = e.target.value as 'stacked' | 'row';
            setLayout(v);
            pushPreview({ layout: v });
          }}
          style={inputStyle}
        >
          <option value="stacked">Stacked (full-width buttons)</option>
          <option value="row">Row (compact)</option>
        </select>
      </div>

      {/* Separator label */}
      <div>
        <label style={labelStyle}>Separator label (empty = no separator)</label>
        <input
          type="text"
          value={separatorLabel}
          onChange={(e) => {
            setSeparatorLabel(e.target.value);
            pushPreview({ separatorLabel: e.target.value });
          }}
          style={inputStyle}
        />
      </div>

      {/* Mini preview */}
      {enabledProviders.length > 0 && (
        <div>
          <label style={labelStyle}>Preview</label>
          <div
            style={{
              padding: 12,
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              display: 'flex',
              flexDirection: layout === 'stacked' ? 'column' : 'row',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            {enabledProviders.map((p) => (
              <div
                key={p.value}
                style={{
                  background: p.bg,
                  color: p.fg,
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  textAlign: 'center',
                  flex: layout === 'stacked' ? 'unset' : '1 1 auto',
                  minWidth: layout === 'row' ? 60 : undefined,
                }}
              >
                {p.label}
              </div>
            ))}
          </div>
          {separatorLabel && (
            <div
              style={{
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: 11,
                margin: '8px 0',
                fontStyle: 'italic',
              }}
            >
              — {separatorLabel} —
            </div>
          )}
        </div>
      )}

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
