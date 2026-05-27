'use client';

import React, { useState, useRef, useEffect } from 'react';
import { sanitizeLabelHtml } from '@/lib/addon-definitions';

interface TermsCheckboxConfig {
  labelHtml?: string;
  errorMessage?: string;
  blockCheckoutIfUnchecked?: boolean;
}

export interface TermsCheckboxAddonEditorProps {
  config: TermsCheckboxConfig;
  onPreviewChange: (patch: Record<string, any>) => void;
  onSave: (fullConfig: Record<string, any>) => void;
}

const transition = 'all 0.25s cubic-bezier(0.4,0,0.2,1)';
const PURPLE = '#7c3aed';
const GRAY_TEXT = '#374151';
const DEFAULT_LABEL = 'I agree to the <a href="/policies/terms-of-service">Terms of Service</a>';
const DEFAULT_ERROR = 'Please agree to the terms before continuing';

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

export default function TermsCheckboxAddonEditor({
  config,
  onPreviewChange,
  onSave,
}: TermsCheckboxAddonEditorProps) {
  const [labelHtml, setLabelHtml] = useState<string>(config.labelHtml ?? DEFAULT_LABEL);
  const [errorMessage, setErrorMessage] = useState<string>(config.errorMessage ?? DEFAULT_ERROR);
  const [blockCheckout, setBlockCheckout] = useState<boolean>(
    config.blockCheckoutIfUnchecked !== false,
  );

  const savedRef = useRef<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sanitization preview — show warning if input would be stripped
  const sanitized = sanitizeLabelHtml(labelHtml);
  const wouldBeStripped = sanitized !== labelHtml;

  function buildPayload(overrides: Record<string, any> = {}) {
    return {
      labelHtml: overrides.labelHtml ?? labelHtml,
      errorMessage: overrides.errorMessage ?? errorMessage,
      blockCheckoutIfUnchecked: overrides.blockCheckoutIfUnchecked ?? blockCheckout,
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
    // Sanitize before save to ensure stored value is XSS-safe
    const safePayload = { ...buildPayload(), labelHtml: sanitizeLabelHtml(labelHtml) };
    setSaving(true);
    onSave(safePayload);
    savedRef.current = JSON.stringify(safePayload);
    setLabelHtml(safePayload.labelHtml);
    setIsDirty(false);
    setTimeout(() => setSaving(false), 300);
  };

  const handleDiscard = () => {
    const saved = JSON.parse(savedRef.current) as TermsCheckboxConfig;
    setLabelHtml(saved.labelHtml ?? DEFAULT_LABEL);
    setErrorMessage(saved.errorMessage ?? DEFAULT_ERROR);
    setBlockCheckout(saved.blockCheckoutIfUnchecked !== false);
    onPreviewChange(saved);
    setIsDirty(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={labelStyle}>
          Checkbox label (supports <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 3 }}>&lt;a&gt;</code> tags only)
        </label>
        <textarea
          value={labelHtml}
          onChange={(e) => {
            setLabelHtml(e.target.value);
            pushPreview({ labelHtml: e.target.value });
          }}
          rows={3}
          style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical' }}
        />
        {wouldBeStripped && (
          <div
            style={{
              marginTop: 6,
              padding: '8px 10px',
              background: '#fef3c7',
              border: '1px solid #fde68a',
              borderRadius: 6,
              fontSize: 11,
              color: '#92400e',
            }}
          >
            ⚠️ Some HTML will be removed on save for security. Only <code>&lt;a&gt;</code> tags with safe <code>href</code>/<code>target</code>/<code>rel</code> attributes are allowed. <code>javascript:</code> and <code>data:</code> hrefs are blocked.
          </div>
        )}
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
          Preview:{' '}
          <span dangerouslySetInnerHTML={{ __html: sanitized }} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Error message if unchecked</label>
        <input
          type="text"
          value={errorMessage}
          onChange={(e) => {
            setErrorMessage(e.target.value);
            pushPreview({ errorMessage: e.target.value });
          }}
          style={inputStyle}
        />
      </div>

      <div>
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: GRAY_TEXT }}
        >
          <input
            type="checkbox"
            checked={blockCheckout}
            onChange={(e) => {
              setBlockCheckout(e.target.checked);
              pushPreview({ blockCheckoutIfUnchecked: e.target.checked });
            }}
            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: PURPLE }}
          />
          <span>Block checkout if unchecked</span>
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
