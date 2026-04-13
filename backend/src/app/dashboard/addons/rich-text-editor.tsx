'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Theme color to apply as default text color in the editor (e.g. from store's live theme) */
  themeColor?: string;
  /** Theme font to apply in the editor (e.g. from store's live theme) */
  themeFont?: string;
  /** Theme background to show in the editor content area */
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

/** Convert hex string to {r,g,b} */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return { r: 0, g: 0, b: 0 };
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

/** Convert {r,g,b} to hex string */
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
    if (sel && sel.rangeCount > 0) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    // Must focus editor first — execCommand only works on the focused element
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (sel && savedSelectionRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedSelectionRef.current);
    }
  }, []);

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
    restoreSelection();
    document.execCommand(cmd, false, val);
    syncFromEditor();
  }, [restoreSelection, syncFromEditor]);

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
  const [colorMode, setColorMode] = useState<'hex' | 'rgb'>('hex');
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

  // Close dropdowns on outside click
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
    restoreSelection();
    document.execCommand('fontSize', false, '7');
    if (editorRef.current) {
      const fontEls = editorRef.current.querySelectorAll('font[size="7"]');
      fontEls.forEach(el => {
        const span = document.createElement('span');
        span.style.fontSize = px + 'px';
        span.innerHTML = el.innerHTML;
        el.parentNode?.replaceChild(span, el);
      });
    }
    syncFromEditor();
    setShowSizePicker(false);
  }, [restoreSelection, syncFromEditor]);

  const buildColorValue = useCallback(() => {
    const r = colorMode === 'rgb' ? rgbR : hexToRgb(hexInput).r;
    const g = colorMode === 'rgb' ? rgbG : hexToRgb(hexInput).g;
    const b = colorMode === 'rgb' ? rgbB : hexToRgb(hexInput).b;
    const a = Math.max(1, Math.min(100, alphaInput)) / 100;
    if (a >= 1) return rgbToHex(r, g, b);
    return `rgba(${r},${g},${b},${a})`;
  }, [hexInput, rgbR, rgbG, rgbB, alphaInput, colorMode]);

  const applyPickerColor = useCallback(() => {
    const color = buildColorValue();
    restoreSelection();
    if (colorPickerMode === 'text') {
      document.execCommand('foreColor', false, color);
    } else if (colorPickerMode === 'bg') {
      document.execCommand('hiliteColor', false, color);
    }
    syncFromEditor();
    setColorPickerMode(null);
  }, [buildColorValue, restoreSelection, syncFromEditor, colorPickerMode]);

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

  // Shared color swatches
  const colorSwatches = ['#000000','#ffffff','#ef4444','#f97316','#eab308','#22c55e','#1a7a1a','#3b82f6','#8b5cf6','#ec4899','#6b7280','#d1d5db'];

  const renderColorPicker = () => (
    <div ref={colorPickerRef} style={{
      position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: 4,
      background: '#fff', border: '1px solid #d1d5db', borderRadius: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 10, width: 220,
    }}>
      {/* Mode tabs: HEX / RGB */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 8, borderRadius: 6, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {(['hex', 'rgb'] as const).map(m => (
          <button key={m} type="button" onMouseDown={preventFocusLoss}
            onClick={() => setColorMode(m)}
            style={{
              flex: 1, padding: '4px 0', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: colorMode === m ? '#7c3aed' : '#f9fafb',
              color: colorMode === m ? '#fff' : '#6b7280',
            }}>
            {m.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <input type="color" value={hexInput.length === 7 ? hexInput : '#000000'}
          onChange={e => setFromHex(e.target.value)}
          onMouseDown={preventFocusLoss}
          style={{ width: 36, height: 36, border: '1px solid #d1d5db', borderRadius: 6, padding: 2, cursor: 'pointer', flexShrink: 0 }} />
        {colorMode === 'hex' ? (
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>HEX</label>
            <input value={hexInput} onChange={e => setFromHex(e.target.value)}
              onMouseDown={e => e.stopPropagation()}
              style={{ width: '100%', fontSize: 12, padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 4, fontFamily: 'monospace', boxSizing: 'border-box' }} />
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', gap: 4 }}>
            {[
              { label: 'R', val: rgbR, set: (v: number) => setFromRgb(v, rgbG, rgbB) },
              { label: 'G', val: rgbG, set: (v: number) => setFromRgb(rgbR, v, rgbB) },
              { label: 'B', val: rgbB, set: (v: number) => setFromRgb(rgbR, rgbG, v) },
            ].map(ch => (
              <div key={ch.label} style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>{ch.label}</label>
                <input type="number" min={0} max={255} value={ch.val}
                  onChange={e => ch.set(Math.max(0, Math.min(255, Number(e.target.value) || 0)))}
                  onMouseDown={e => e.stopPropagation()}
                  style={{ width: '100%', fontSize: 11, padding: '3px 3px', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box', textAlign: 'center' }} />
              </div>
            ))}
          </div>
        )}
        <div style={{ width: 46 }}>
          <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>Alpha%</label>
          <input type="number" min={1} max={100} value={alphaInput}
            onChange={e => setAlphaInput(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
            onMouseDown={e => e.stopPropagation()}
            style={{ width: '100%', fontSize: 11, padding: '3px 3px', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box', textAlign: 'center' }} />
        </div>
      </div>

      {/* Quick swatches */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        {colorSwatches.map(c => (
          <button key={c} type="button" onMouseDown={preventFocusLoss} onClick={() => setFromHex(c)}
            style={{ width: 18, height: 18, borderRadius: 3, border: hexInput === c ? '2px solid #7c3aed' : '1px solid #d1d5db', background: c, cursor: 'pointer', padding: 0 }} />
        ))}
      </div>

      {/* Preview + Apply */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 24, height: 24, borderRadius: 4, border: '1px solid #d1d5db', background: buildColorValue() }} />
        <button type="button" onMouseDown={preventFocusLoss} onClick={applyPickerColor}
          style={{ flex: 1, padding: '5px 0', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          Apply
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '4px 6px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', flexWrap: 'wrap' }}>
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
              position: 'absolute', top: '100%', left: 0, zIndex: 50,
              background: '#fff', border: '1px solid #d1d5db', borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 4, minWidth: 120,
              marginTop: 4, maxHeight: 260, overflowY: 'auto',
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
        {/* Text color picker */}
        <div style={{ position: 'relative' }}>
          <button type="button" style={btnS(colorPickerMode === 'text')} onMouseDown={preventFocusLoss}
            onClick={() => { if (colorPickerMode === 'text') { setColorPickerMode(null); } else { openColorPicker('text'); } }} title="Text Color">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>A<span style={{ width: 10, height: 10, borderRadius: 2, border: '1px solid #d1d5db', display: 'inline-block', background: 'linear-gradient(135deg, #ef4444, #3b82f6)' }} /></span>
          </button>
          {colorPickerMode === 'text' && renderColorPicker()}
        </div>
        {/* Background color picker */}
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
      <style>{`[contenteditable]:empty:before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; }`}</style>
    </div>
  );
}
