'use client';

import React, { useMemo, useRef, useState } from 'react';
import RichTextEditor from './rich-text-editor';

type Position = 'above-checkout' | 'top' | 'bottom';

interface CustomCodeBlock {
  html: string;
  position: Position;
}

interface CustomCodeConfig {
  blocks?: CustomCodeBlock[];
  hideBuiltInTrustLine?: boolean;
  // legacy single-block shape
  html?: string;
  position?: Position;
}

export interface CustomCodeAddonEditorProps {
  config: CustomCodeConfig;
  themeFont?: string;
  onPreviewChange: (patch: Record<string, any>) => void;
  onSave: (fullConfig: Record<string, any>) => void;
}

const PURPLE = '#7c3aed';
const GRAY_TEXT = '#374151';

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: GRAY_TEXT,
  display: 'block',
  marginBottom: 6,
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: '#fafafa',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  color: '#111827',
  fontSize: 13,
  boxSizing: 'border-box',
};

const POSITION_OPTIONS: { value: Position; label: string }[] = [
  { value: 'above-checkout', label: 'Above checkout button (recommended)' },
  { value: 'top', label: 'Top of footer' },
  { value: 'bottom', label: 'Bottom of footer' },
];

function normalizeBlocks(config: CustomCodeConfig): CustomCodeBlock[] {
  if (Array.isArray(config?.blocks) && config.blocks.length) {
    return config.blocks.map((b) => ({
      html: typeof b?.html === 'string' ? b.html : '',
      position: (b?.position as Position) ?? 'above-checkout',
    }));
  }
  if (typeof config?.html === 'string' && config.html.trim()) {
    return [{ html: config.html, position: (config.position as Position) ?? 'above-checkout' }];
  }
  return [{ html: '', position: 'above-checkout' }];
}

export default function CustomCodeAddonEditor({
  config,
  themeFont,
  onPreviewChange,
  onSave,
}: CustomCodeAddonEditorProps) {
  const [blocks, setBlocks] = useState<CustomCodeBlock[]>(() => normalizeBlocks(config));
  const [hideTrust, setHideTrust] = useState<boolean>(!!config?.hideBuiltInTrustLine);
  const savedRef = useRef<string>(JSON.stringify({ blocks: normalizeBlocks(config), hideTrust: !!config?.hideBuiltInTrustLine }));
  const [saving, setSaving] = useState(false);

  const isDirty = useMemo(
    () => JSON.stringify({ blocks, hideTrust }) !== savedRef.current,
    [blocks, hideTrust],
  );

  function pushPreview(nextBlocks: CustomCodeBlock[], nextHide: boolean) {
    onPreviewChange({ blocks: nextBlocks, hideBuiltInTrustLine: nextHide });
  }

  function updateBlock(i: number, patch: Partial<CustomCodeBlock>) {
    setBlocks((prev) => {
      const next = prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b));
      pushPreview(next, hideTrust);
      return next;
    });
  }

  function addBlock() {
    setBlocks((prev) => {
      const next = [...prev, { html: '', position: 'above-checkout' as Position }];
      pushPreview(next, hideTrust);
      return next;
    });
  }

  function removeBlock(i: number) {
    setBlocks((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      const safe = next.length ? next : [{ html: '', position: 'above-checkout' as Position }];
      pushPreview(safe, hideTrust);
      return safe;
    });
  }

  function moveBlock(i: number, dir: -1 | 1) {
    setBlocks((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      pushPreview(next, hideTrust);
      return next;
    });
  }

  function toggleHide(v: boolean) {
    setHideTrust(v);
    pushPreview(blocks, v);
  }

  function handleSave() {
    setSaving(true);
    // Drop empty blocks on save; keep at least an empty array.
    const cleaned = blocks.filter((b) => b.html.trim().length > 0);
    const payload = { blocks: cleaned, hideBuiltInTrustLine: hideTrust, html: '', position: 'above-checkout' };
    savedRef.current = JSON.stringify({ blocks, hideTrust });
    onSave(payload);
    setSaving(false);
  }

  function handleDiscard() {
    const restored = JSON.parse(savedRef.current) as { blocks: CustomCodeBlock[]; hideTrust: boolean };
    setBlocks(restored.blocks);
    setHideTrust(restored.hideTrust);
    pushPreview(restored.blocks, restored.hideTrust);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {blocks.map((block, i) => (
        <div
          key={i}
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 12,
            background: '#fff',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: PURPLE }}>
              HTML block {i + 1}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => moveBlock(i, -1)}
                disabled={i === 0}
                title="Move up"
                style={{ border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: i === 0 ? 'default' : 'pointer', padding: '2px 8px', opacity: i === 0 ? 0.4 : 1 }}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveBlock(i, 1)}
                disabled={i === blocks.length - 1}
                title="Move down"
                style={{ border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: i === blocks.length - 1 ? 'default' : 'pointer', padding: '2px 8px', opacity: i === blocks.length - 1 ? 0.4 : 1 }}
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeBlock(i)}
                title="Remove this block"
                style={{ border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 6, background: '#fff', cursor: 'pointer', padding: '2px 8px' }}
              >
                Remove
              </button>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Custom HTML</label>
            <RichTextEditor
              value={block.html}
              placeholder="e.g. a 30-day risk-free returns badge"
              onChange={(v) => updateBlock(i, { html: v })}
              themeFont={themeFont}
            />
          </div>

          <div>
            <label style={labelStyle}>Position in footer</label>
            <select
              value={block.position}
              onChange={(e) => updateBlock(i, { position: e.target.value as Position })}
              style={selectStyle}
            >
              {POSITION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addBlock}
        style={{
          alignSelf: 'flex-start',
          border: `1px dashed ${PURPLE}`,
          color: PURPLE,
          background: '#faf5ff',
          borderRadius: 6,
          padding: '8px 14px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        + Add another HTML block
      </button>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={hideTrust}
          onChange={(e) => toggleHide(e.target.checked)}
          style={{ width: 16, height: 16 }}
        />
        <span style={{ fontSize: 13, color: GRAY_TEXT }}>
          Hide built-in returns line (use if one of your blocks is a returns badge)
        </span>
      </label>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || saving}
          style={{
            background: isDirty ? PURPLE : '#e5e7eb',
            color: isDirty ? '#fff' : '#9ca3af',
            border: 'none',
            borderRadius: 6,
            padding: '8px 18px',
            fontSize: 13,
            fontWeight: 600,
            cursor: isDirty ? 'pointer' : 'default',
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {isDirty && (
          <button
            type="button"
            onClick={handleDiscard}
            style={{ background: '#fff', color: GRAY_TEXT, border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 18px', fontSize: 13, cursor: 'pointer' }}
          >
            Discard
          </button>
        )}
      </div>
    </div>
  );
}
