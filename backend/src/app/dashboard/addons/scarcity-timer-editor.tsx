'use client';

import React, { useState, useRef, useEffect } from 'react';
import RichTextEditor from './rich-text-editor';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScarcityTimerConfig {
  text?: string;
  duration?: number;
  alignment?: 'left' | 'center' | 'right';
  onComplete?: 'hide' | 'reset';
  position?: 'below-header' | 'above-checkout' | 'floating-top';
  pulseAnimation?: boolean;
  // Legacy fields tolerated for migration from older configs
  textTemplate?: string;
  style?: string;
}

export interface ScarcityTimerEditorProps {
  config: ScarcityTimerConfig;
  /** Called on every field change — for instant preview (no persistence) */
  onPreviewChange: (patch: Record<string, any>) => void;
  /** Called when user clicks Save — persists to DB */
  onSave: (fullConfig: Record<string, any>) => void;
  themeFont?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const transition = 'all 0.25s cubic-bezier(0.4,0,0.2,1)';
const PURPLE = '#7c3aed';
const GRAY_TEXT = '#374151';
const DEFAULT_TEXT = '<span style="color:#d32f2f">Your cart is reserved for <strong>{time}</strong></span>';

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

// ─── Component ──────────────────────────────────────────────────────────────

export default function ScarcityTimerEditor({
  config,
  onPreviewChange,
  onSave,
  themeFont,
}: ScarcityTimerEditorProps) {
  // Local state — initialize from config (with migration from legacy fields)
  const [text, setText] = useState<string>(config.text ?? DEFAULT_TEXT);
  const [duration, setDuration] = useState<number>(
    typeof config.duration === 'number'
      ? config.duration
      : typeof config.duration === 'string'
        ? Number(config.duration) || 10
        : 10,
  );
  const [onComplete, setOnComplete] = useState<'hide' | 'reset'>(
    config.onComplete ?? 'hide',
  );
  const [position, setPosition] = useState<'below-header' | 'above-checkout' | 'floating-top'>(
    config.position ?? 'below-header',
  );
  const [pulseAnimation, setPulseAnimation] = useState<boolean>(
    config.pulseAnimation !== false,
  );

  // Dirty tracking
  const savedConfigRef = useRef<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Build payload ──────────────────────────────────────────────────
  function buildPayload(overrides: Record<string, any> = {}) {
    return {
      text: overrides.text ?? text,
      duration: overrides.duration ?? duration,
      onComplete: overrides.onComplete ?? onComplete,
      position: overrides.position ?? position,
      pulseAnimation: overrides.pulseAnimation ?? pulseAnimation,
    };
  }

  // Initialize savedConfigRef once on mount with normalized payload
  useEffect(() => {
    savedConfigRef.current = JSON.stringify(buildPayload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Push preview ──
  function pushPreview(overrides: Record<string, any> = {}) {
    const payload = buildPayload(overrides);
    onPreviewChange(payload);
    setIsDirty(JSON.stringify(payload) !== savedConfigRef.current);
  }

  // ── Save ──
  const handleSave = () => {
    const payload = buildPayload();
    setSaving(true);
    onSave(payload);
    savedConfigRef.current = JSON.stringify(payload);
    setIsDirty(false);
    // Brief visual feedback
    setTimeout(() => setSaving(false), 300);
  };

  // ── Discard ──
  const handleDiscard = () => {
    const saved = JSON.parse(savedConfigRef.current) as ScarcityTimerConfig;
    setText(saved.text ?? DEFAULT_TEXT);
    setDuration(typeof saved.duration === 'number' ? saved.duration : 10);
    setOnComplete(saved.onComplete ?? 'hide');
    setPosition(saved.position ?? 'below-header');
    setPulseAnimation(saved.pulseAnimation !== false);
    onPreviewChange(saved);
    setIsDirty(false);
  };

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Timer Text — RichTextEditor with {time} token */}
      <div>
        <label
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: GRAY_TEXT,
            display: 'block',
            marginBottom: 6,
          }}
        >
          Timer Text
        </label>
        <RichTextEditor
          value={text}
          placeholder="Use {time} for the countdown"
          themeFont={themeFont}
          themeColor="#d32f2f"
          onChange={(v) => {
            setText(v);
            pushPreview({ text: v });
          }}
        />
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
          Use <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 3 }}>{'{time}'}</code> to insert the countdown (e.g. <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 3 }}>09:42</code>).
        </div>
      </div>

      {/* Duration (minutes) */}
      <div>
        <label
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: GRAY_TEXT,
            display: 'block',
            marginBottom: 6,
          }}
        >
          Duration (minutes)
        </label>
        <input
          type="number"
          min={1}
          max={60}
          value={duration}
          onChange={(e) => {
            const raw = e.target.value;
            const n = raw === '' ? 1 : Math.max(1, Math.min(60, Number(raw) || 1));
            setDuration(n);
            pushPreview({ duration: n });
          }}
          style={{ ...inputStyle, width: 120 }}
        />
      </div>

      {/* On Complete */}
      <div>
        <label
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: GRAY_TEXT,
            display: 'block',
            marginBottom: 6,
          }}
        >
          When timer reaches 0
        </label>
        <select
          value={onComplete}
          onChange={(e) => {
            const v = e.target.value as 'hide' | 'reset';
            setOnComplete(v);
            pushPreview({ onComplete: v });
          }}
          style={inputStyle}
        >
          <option value="hide">Hide timer</option>
          <option value="reset">Reset and start over</option>
        </select>
      </div>

      {/* Position */}
      <div>
        <label
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: GRAY_TEXT,
            display: 'block',
            marginBottom: 6,
          }}
        >
          Position
        </label>
        <select
          value={position}
          onChange={(e) => {
            const v = e.target.value as 'below-header' | 'above-checkout' | 'floating-top';
            setPosition(v);
            pushPreview({ position: v });
          }}
          style={inputStyle}
        >
          <option value="below-header">Below Header</option>
          <option value="above-checkout">Above Checkout Button</option>
          <option value="floating-top">Floating Top</option>
        </select>
      </div>

      {/* Pulse Animation */}
      <div>
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: GRAY_TEXT }}
        >
          <input
            type="checkbox"
            checked={pulseAnimation}
            onChange={(e) => {
              setPulseAnimation(e.target.checked);
              pushPreview({ pulseAnimation: e.target.checked });
            }}
            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: PURPLE }}
          />
          <span>Pulse Animation</span>
        </label>
      </div>

      {/* Save / Discard Buttons */}
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
          onMouseEnter={(e) => isDirty && !saving && (e.currentTarget.style.transform = 'scale(1.02)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
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
