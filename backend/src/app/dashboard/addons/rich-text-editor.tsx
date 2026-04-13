'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  themeColor?: string;
  themeFont?: string;
  themeBg?: string;
}

/** Check if HTML already contains inline color (font color, style="color:", etc.) */
export function hasInlineColor(html: string): boolean {
  return /color\s*[:=]/i.test(html);
}

/** Wrap plain text with a color span if it has no inline color yet */
export function applyDefaultColor(html: string, color: string): string {
  if (!html || hasInlineColor(html)) return html;
  return `<span style="color: ${color}">${html}</span>`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return { r: 0, g: 0, b: 0 };
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

export default function RichTextEditor({ value, onChange, placeholder, themeColor, themeFont, themeBg }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showHtml, setShowHtml] = useState(false);
  const [htmlSource, setHtmlSource] = useState(value || '');
  const lastValueRef = useRef(value || '');
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!editorRef.current || showHtml) return;
    if (!initializedRef.current) {
      editorRef.current.innerHTML = value || '';
      lastValueRef.current = value || '';
      initializedRef.current = true;
      return;
    }
    if (value !== lastValueRef.current) {
      const sel = window.getSelection();
      const hadFocus = document.activeElement === editorRef.current;
      editorRef.current.innerHTML = value || '';
      lastValueRef.current = value || '';
      if (hadFocus && sel) {
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  }, [value, showHtml]);

  useEffect(() => {
    if (showHtml && value !== lastValueRef.current) {
      setHtmlSource(value || '');
      lastValueRef.current = value || '';
    }
  }, [value, showHtml]);

  const savedSelectionRef = useRef<Range | null>(null);

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  // Focus editor, restore selection, run execCommand, sync
  const focusRestoreExec = useCallback((cmd: string, val?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (sel && savedSelectionRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedSelectionRef.current);
    }
    document.execCommand(cmd, false, val);
    // Re-save selection after command (so subsequent commands work)
    const sel2 = window.getSelection();
    if (sel2 && sel2.rangeCount > 0) {
      savedSelectionRef.current = sel2.getRangeAt(0).cloneRange();
    }
    const html = editor.innerHTML;
    if (html !== lastValueRef.current) {
      lastValueRef.current = html;
      setHtmlSource(html);
      onChange(html);
    }
  }, [onChange]);

  const syncFromEditor = useCallback(() => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      if (html === lastValueRef.current) return;
      lastValueRef.current = html;
      setHtmlSource(html);
      onChange(html);
    }
  }, [onChange]);

  const exec = useCallback((cmd: string, val?: string) => {
    focusRestoreExec(cmd, val);
  }, [focusRestoreExec]);

  const switchToHtml = useCallback(() => {
    if (editorRef.current) setHtmlSource(editorRef.current.innerHTML);
    setShowHtml(true);
  }, []);

  const switchToVisual = useCallback(() => {
    setShowHtml(false);
    requestAnimationFrame(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = htmlSource;
        lastValueRef.current = htmlSource;
        onChange(htmlSource);
      }
    });
  }, [htmlSource, onChange]);

  const btnS = (active?: boolean): React.CSSProperties => ({
    background: active ? '#ede9fe' : 'transparent', border: 'none', cursor: 'pointer',
    padding: '3px 7px', borderRadius: 4, fontSize: 13, fontWeight: 600,
    color: active ? '#7c3aed' : '#6b7280', lineHeight: 1,
  });

  const [showSizePicker, setShowSizePicker] = useState(false);
  const sizePickerRef = useRef<HTMLDivElement>(null);

  // Color picker state
  const [colorPickerMode, setColorPickerMode] = useState<'text' | 'bg' | null>(null);
  const [hexInput, setHexInput] = useState('#000000');
  const [rgbR, setRgbR] = useState(0);
  const [rgbG, setRgbG] = useState(0);
  const [rgbB, setRgbB] = useState(0);
  const [alphaInput, setAlphaInput] = useState(100);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  const setFromHex = useCallback((hex: string) => {
    setHexInput(hex);
    const { r, g, b } = hexToRgb(hex);
    setRgbR(r); setRgbG(g); setRgbB(b);
  }, []);

  const setFromRgb = useCallback((r: number, g: number, b: number) => {
    setRgbR(r); setRgbG(g); setRgbB(b);
    setHexInput(rgbToHex(r, g, b));
  }, []);

  useEffect(() => {
    if (!showSizePicker && !colorPickerMode) return;
    const handler = (e: MouseEvent) => {
      if (showSizePicker && sizePickerRef.current && !sizePickerRef.current.contains(e.target as Node)) {
        setShowSizePicker(false);
      }
      if (colorPickerMode && colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setColorPickerMode(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSizePicker, colorPickerMode]);

  const applyFontSize = useCallback((px: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (sel && savedSelectionRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedSelectionRef.current);
    }
    document.execCommand('fontSize', false, '7');
    const fontEls = editor.querySelectorAll('font[size="7"]');
    fontEls.forEach(el => {
      const span = document.createElement('span');
      span.style.fontSize = px + 'px';
      span.innerHTML = el.innerHTML;
      el.parentNode?.replaceChild(span, el);
    });
    syncFromEditor();
    setShowSizePicker(false);
  }, [syncFromEditor]);

  const buildColorFromState = useCallback(() => {
    const { r, g, b } = hexToRgb(hexInput);
    const a = Math.max(1, Math.min(100, alphaInput)) / 100;
    if (a >= 1) return hexInput;
    return `rgba(${r},${g},${b},${a})`;
  }, [hexInput, alphaInput]);

  // Apply color to selection
  const applyColor = useCallback((color: string) => {
    const m = colorPickerMode;
    if (!m) return;
    focusRestoreExec(m === 'text' ? 'foreColor' : 'hiliteColor', color);
  }, [colorPickerMode, focusRestoreExec]);

  const applyPickerColor = useCallback(() => {
    applyColor(buildColorFromState());
    setColorPickerMode(null);
  }, [applyColor, buildColorFromState]);

  // Swatch click — apply immediately
  const handleSwatchClick = useCallback((hex: string) => {
    setFromHex(hex);
    // Apply immediately via focusRestoreExec (don't rely on applyColor which uses stale colorPickerMode)
    const m = colorPickerMode;
    if (!m) return;
    focusRestoreExec(m === 'text' ? 'foreColor' : 'hiliteColor', hex);
  }, [setFromHex, colorPickerMode, focusRestoreExec]);

  const openColorPicker = useCallback((mode: 'text' | 'bg') => {
    saveSelection();
    const defaultHex = mode === 'text' ? '#000000' : '#ffff00';
    setFromHex(defaultHex);
    setAlphaInput(100);
    setColorPickerMode(mode);
    setShowSizePicker(false);
  }, [saveSelection, setFromHex]);

  const preventFocusLoss = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const contentStyle: React.CSSProperties = {
    minHeight: 60,
    padding: '8px 10px',
    outline: 'none',
    fontSize: 13,
    lineHeight: 1.5,
    color: '#1f2937',
    fontFamily: themeFont || 'inherit',
    background: themeBg || 'transparent',
  };

  // Basic hard color presets — bright, obvious colors
  const basicColors = [
    '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00',
    '#ff00ff', '#00ffff', '#ff6600', '#9900ff', '#006600', '#990000',
  ];

  // Extended swatches
  const extendedColors = [
    '#ef4444','#f97316','#eab308','#22c55e','#1a7a1a','#3b82f6',
    '#8b5cf6','#ec4899','#6b7280','#d1d5db','#fef08a','#bbf7d0',
  ];

  const renderColorPicker = () => (
    <div ref={colorPickerRef} style={{
      position: 'absolute', top: '100%', left: 0, zIndex: 9999, marginTop: 4,
      background: '#fff', border: '1px solid #d1d5db', borderRadius: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)', padding: 10, width: 252,
    }}>
      {/* Basic color grid — click applies immediately */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4, fontWeight: 500 }}>Basic colors</div>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {basicColors.map(c => (
            <button key={c} type="button" onMouseDown={preventFocusLoss} onClick={() => handleSwatchClick(c)}
              style={{ width: 20, height: 20, borderRadius: 3, border: hexInput === c ? '2px solid #7c3aed' : '1px solid #ccc', background: c, cursor: 'pointer', padding: 0 }} />
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4, fontWeight: 500 }}>Extended</div>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {extendedColors.map(c => (
            <button key={c} type="button" onMouseDown={preventFocusLoss} onClick={() => handleSwatchClick(c)}
              style={{ width: 20, height: 20, borderRadius: 3, border: hexInput === c ? '2px solid #7c3aed' : '1px solid #ccc', background: c, cursor: 'pointer', padding: 0 }} />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#e5e7eb', margin: '6px 0 8px' }} />

      {/* Color wheel + HEX + RGB all visible at once */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <input type="color" value={hexInput.length === 7 ? hexInput : '#000000'}
          onChange={e => setFromHex(e.target.value)}
          onMouseDown={preventFocusLoss}
          style={{ width: 40, height: 56, border: '1px solid #d1d5db', borderRadius: 6, padding: 2, cursor: 'pointer', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* HEX row */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <label style={{ fontSize: 10, color: '#6b7280', width: 26, flexShrink: 0 }}>HEX</label>
            <input value={hexInput} onChange={e => setFromHex(e.target.value)}
              onMouseDown={e => e.stopPropagation()}
              style={{ flex: 1, fontSize: 11, padding: '2px 4px', border: '1px solid #d1d5db', borderRadius: 4, fontFamily: 'monospace', boxSizing: 'border-box' }} />
          </div>
          {/* RGB row */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <label style={{ fontSize: 10, color: '#6b7280', width: 26, flexShrink: 0 }}>RGB</label>
            {[
              { label: 'R', val: rgbR, set: (v: number) => setFromRgb(v, rgbG, rgbB) },
              { label: 'G', val: rgbG, set: (v: number) => setFromRgb(rgbR, v, rgbB) },
              { label: 'B', val: rgbB, set: (v: number) => setFromRgb(rgbR, rgbG, v) },
            ].map(ch => (
              <input key={ch.label} type="number" min={0} max={255} value={ch.val}
                onChange={e => ch.set(Math.max(0, Math.min(255, Number(e.target.value) || 0)))}
                onMouseDown={e => e.stopPropagation()}
                placeholder={ch.label}
                style={{ flex: 1, fontSize: 11, padding: '2px 2px', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box', textAlign: 'center', width: 0 }} />
            ))}
          </div>
        </div>
        <div style={{ width: 40, flexShrink: 0 }}>
          <label style={{ fontSize: 9, color: '#6b7280', display: 'block', marginBottom: 2, textAlign: 'center' }}>Alpha%</label>
          <input type="number" min={1} max={100} value={alphaInput}
            onChange={e => setAlphaInput(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
            onMouseDown={e => e.stopPropagation()}
            style={{ width: '100%', fontSize: 11, padding: '2px 2px', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box', textAlign: 'center' }} />
        </div>
      </div>

      {/* Preview + Apply (for custom HEX/RGB/alpha) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 24, height: 24, borderRadius: 4, border: '1px solid #d1d5db', background: buildColorFromState() }} />
        <button type="button" onMouseDown={preventFocusLoss} onClick={applyPickerColor}
          style={{ flex: 1, padding: '5px 0', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          Apply
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', position: 'relative' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '4px 6px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', flexWrap: 'wrap', borderRadius: '8px 8px 0 0', position: 'relative', zIndex: 10 }}>
        <button type="button" style={btnS()} onMouseDown={preventFocusLoss} onClick={() => exec('bold')} title="Bold"><strong>B</strong></button>
        <button type="button" style={btnS()} onMouseDown={preventFocusLoss} onClick={() => exec('italic')} title="Italic"><em>I</em></button>
        <button type="button" style={btnS()} onMouseDown={preventFocusLoss} onClick={() => exec('underline')} title="Underline"><u>U</u></button>
        <button type="button" style={btnS()} onMouseDown={preventFocusLoss} onClick={() => exec('strikeThrough')} title="Strikethrough"><s>S</s></button>
        <div style={{ width: 1, height: 16, background: '#d1d5db', margin: '0 4px' }} />
        <div ref={sizePickerRef} style={{ position: 'relative' }}>
          <button type="button" style={{ ...btnS(showSizePicker), display: 'flex', alignItems: 'center', gap: 2 }}
            onMouseDown={preventFocusLoss}
            onClick={() => { saveSelection(); setShowSizePicker(v => !v); setColorPickerMode(null); }}
            title="Font Size"
          >
            <span style={{ fontSize: 13 }}>A</span>
            <svg width="8" height="5" viewBox="0 0 8 5" style={{ opacity: 0.5 }}><path d="M0 0l4 5 4-5z" fill="currentColor"/></svg>
          </button>
          {showSizePicker && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 9999,
              background: '#fff', border: '1px solid #d1d5db', borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)', padding: 4, minWidth: 120,
              marginTop: 4, maxHeight: 280, overflowY: 'auto',
            }}>
              {[10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64].map(px => (
                <button
                  key={px}
                  type="button"
                  onMouseDown={preventFocusLoss}
                  onClick={() => applyFontSize(px)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '5px 10px', border: 'none', background: 'transparent',
                    cursor: 'pointer', borderRadius: 4, gap: 12,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: Math.min(px, 20), lineHeight: 1.3, color: '#111' }}>Aa</span>
                  <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>{px}px</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ width: 1, height: 16, background: '#d1d5db', margin: '0 4px' }} />
        {/* Text color */}
        <div style={{ position: 'relative' }}>
          <button type="button" style={btnS(colorPickerMode === 'text')} onMouseDown={preventFocusLoss}
            onClick={() => { if (colorPickerMode === 'text') { setColorPickerMode(null); } else { openColorPicker('text'); } }} title="Text Color">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>A<span style={{ width: 10, height: 10, borderRadius: 2, border: '1px solid #d1d5db', display: 'inline-block', background: 'linear-gradient(135deg, #ef4444, #3b82f6)' }} /></span>
          </button>
          {colorPickerMode === 'text' && renderColorPicker()}
        </div>
        {/* Background color */}
        <div style={{ position: 'relative' }}>
          <button type="button" style={btnS(colorPickerMode === 'bg')} onMouseDown={preventFocusLoss}
            onClick={() => { if (colorPickerMode === 'bg') { setColorPickerMode(null); } else { openColorPicker('bg'); } }} title="Text Background">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 12 }}>
              <span style={{ background: '#fef08a', padding: '0 3px', borderRadius: 2, lineHeight: 1.2, fontWeight: 700 }}>A</span>
            </span>
          </button>
          {colorPickerMode === 'bg' && renderColorPicker()}
        </div>
        <button type="button" style={btnS()} onMouseDown={preventFocusLoss} onClick={() => exec('removeFormat')} title="Clear Formatting">
          <span style={{ fontSize: 11 }}>T<span style={{ textDecoration: 'line-through', color: '#dc2626' }}>x</span></span>
        </button>
        <div style={{ flex: 1 }} />
        <button type="button" style={{
          ...btnS(showHtml), fontSize: 10, fontFamily: 'monospace', padding: '3px 8px',
          border: '1px solid ' + (showHtml ? '#7c3aed' : '#d1d5db'),
        }} onClick={showHtml ? switchToVisual : switchToHtml}>
          {showHtml ? 'Visual' : '</>'}
        </button>
      </div>

      <div style={{ position: 'relative' }}>
        {showHtml ? (
          <textarea
            value={htmlSource}
            onChange={(e) => { setHtmlSource(e.target.value); lastValueRef.current = e.target.value; onChange(e.target.value); }}
            style={{
              width: '100%', minHeight: 80, padding: '8px 10px', border: 'none', outline: 'none',
              fontFamily: 'monospace', fontSize: 12, color: '#1f2937', resize: 'vertical',
              background: '#f8fafc', boxSizing: 'border-box',
            }}
            spellCheck={false}
          />
        ) : (
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={syncFromEditor}
            onBlur={() => { saveSelection(); syncFromEditor(); }}
            onMouseUp={saveSelection}
            onKeyUp={saveSelection}
            data-placeholder={placeholder || 'Type your text here...'}
            style={contentStyle}
          />
        )}
      </div>
      <style>{`[contenteditable]:empty:before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; }`}</style>
    </div>
  );
}
