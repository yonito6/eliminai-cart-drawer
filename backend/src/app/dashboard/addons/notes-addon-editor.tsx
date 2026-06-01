'use client';

import React, { useState, useRef, useEffect } from 'react';

interface NotesConfig {
  label?: string;
  placeholder?: string;
  maxChars?: number;
  position?: 'above-checkout' | 'top' | 'bottom';
}

export interface NotesAddonEditorProps {
  config: NotesConfig;
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

export default function NotesAddonEditor({ config, onPreviewChange, onSave }: NotesAddonEditorProps) {
  const [label, setLabel] = useState<string>(config.label ?? 'Add a note to your order');
  const [placeholder, setPlaceholder] = useState<string>(config.placeholder ?? '');
  const [maxChars, setMaxChars] = useState<number>(
    typeof config.maxChars === 'number' ? config.maxChars : 250,
  );
  const [position, setPosition] = useState<'above-checkout' | 'top' | 'bottom'>(config.position ?? 'above-checkout');

  const savedRef = useRef<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  function buildPayload(overrides: Record<string, any> = {}) {
    return {
      label: overrides.label ?? label,
      placeholder: overrides.placeholder ?? placeholder,
      maxChars: overrides.maxChars ?? maxChars,
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
    const saved = JSON.parse(savedRef.current) as NotesConfig;
    setLabel(saved.label ?? 'Add a note to your order');
    setPlaceholder(saved.placeholder ?? '');
    setMaxChars(typeof saved.maxChars === 'number' ? saved.maxChars : 250);
    setPosition(saved.position ?? 'above-checkout');
    onPreviewChange(saved);
    setIsDirty(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={labelStyle}>Field label</label>
        <input
          type="text"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            pushPreview({ label: e.target.value });
          }}
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Placeholder</label>
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
        <label style={labelStyle}>Max characters (0 = unlimited)</label>
        <input
          type="number"
          min={0}
          max={1000}
          value={maxChars}
          onChange={(e) => {
            const raw = e.target.value;
            const n = raw === '' ? 0 : Math.max(0, Math.min(1000, Number(raw) || 0));
            setMaxChars(n);
            pushPreview({ maxChars: n });
          }}
          style={{ ...inputStyle, width: 140 }}
        />
      </div>

      <div>
        <label style={labelStyle}>Position in footer</label>
        <select
          value={position}
          onChange={(e) => {
            const v = e.target.value as 'above-checkout' | 'top' | 'bottom';
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
