'use client';

// Shared form controls for Cart Editor element editors.
// All controls are uncontrolled-friendly: they accept `value | undefined` and
// emit string/number/boolean via onChange. When value is undefined, the input
// renders empty (placeholder); the field is only saved once the user types/clicks.
//
// Visual style mirrors the rest of the dashboard: 12-13px labels, 13px inputs,
// purple accent (#7c3aed) for focus/active.

import React from 'react';

const PURPLE = '#7c3aed';
const BORDER = '#d1d5db';
const TEXT = '#374151';
const MUTED = '#6b7280';

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#9ca3af',
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: TEXT }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 11, color: MUTED }}>{hint}</span>}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '7px 10px',
  fontSize: 13,
  border: `1px solid ${BORDER}`,
  borderRadius: 6,
  background: '#fff',
  color: TEXT,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

export function TextInput({
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <input
      type="text"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      style={inputStyle}
    />
  );
}

export function Textarea({
  value,
  onChange,
  rows,
  placeholder,
  maxLength,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <textarea
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      rows={rows ?? 3}
      placeholder={placeholder}
      maxLength={maxLength}
      style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
    />
  );
}

export function Select<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | undefined;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value as T)}
      style={inputStyle}
    >
      {value === undefined && <option value="" disabled>— choose —</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function Radio<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | undefined;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              padding: '6px 10px',
              fontSize: 12,
              fontWeight: active ? 600 : 500,
              borderRadius: 5,
              border: `1px solid ${active ? PURPLE : BORDER}`,
              background: active ? PURPLE : '#fff',
              color: active ? '#fff' : TEXT,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean | undefined;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  const on = value === true;
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: 0,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          width: 34,
          height: 20,
          borderRadius: 999,
          background: on ? PURPLE : '#d1d5db',
          position: 'relative',
          transition: 'background 0.15s',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: on ? 16 : 2,
            width: 16,
            height: 16,
            borderRadius: 999,
            background: '#fff',
            transition: 'left 0.15s',
          }}
        />
      </span>
      {label && <span style={{ fontSize: 12, color: TEXT }}>{label}</span>}
    </button>
  );
}

export function ColorInput({
  value,
  onChange,
  placeholder,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const hex = (value || '').match(/^#[0-9a-fA-F]{6}$/) ? value : (value || '').match(/^#[0-9a-fA-F]{3}$/) ? expandShortHex(value!) : '#000000';
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input
        type="color"
        value={hex || '#000000'}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 36,
          height: 32,
          padding: 0,
          border: `1px solid ${BORDER}`,
          borderRadius: 5,
          background: '#fff',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      />
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '#000000'}
        style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }}
        maxLength={9}
      />
    </div>
  );
}

function expandShortHex(short: string): string {
  const h = short.slice(1);
  return '#' + h.split('').map((c) => c + c).join('');
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  unit,
}: {
  value: number | undefined;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  const v = value ?? min;
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 1}
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: PURPLE }}
      />
      <span style={{ fontSize: 12, color: TEXT, fontFamily: 'monospace', minWidth: 48, textAlign: 'right' }}>
        {v}{unit ?? ''}
      </span>
    </div>
  );
}

export function StringArrayInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[] | undefined;
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const arr = value ?? [];
  const text = arr.join('\n');
  return (
    <textarea
      value={text}
      onChange={(e) => onChange(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
      placeholder={placeholder ?? 'One per line'}
      rows={3}
      style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace' }}
    />
  );
}
