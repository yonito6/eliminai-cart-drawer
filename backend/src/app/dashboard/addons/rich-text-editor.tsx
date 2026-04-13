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

export default function RichTextEditor({ value, onChange, placeholder, themeColor, themeFont, themeBg }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showHtml, setShowHtml] = useState(false);
  const [htmlSource, setHtmlSource] = useState(value || '');
  const lastValueRef = useRef(value || '');
  // Track whether we've done the initial render
  const initializedRef = useRef(false);

  // Set initial content once, then only update if external value changes
  useEffect(() => {
    if (!editorRef.current || showHtml) return;
    if (!initializedRef.current) {
      editorRef.current.innerHTML = value || '';
      lastValueRef.current = value || '';
      initializedRef.current = true;
      return;
    }
    // Only update if value changed externally (not from our own edits)
    if (value !== lastValueRef.current) {
      // Save and restore selection
      const sel = window.getSelection();
      const hadFocus = document.activeElement === editorRef.current;
      editorRef.current.innerHTML = value || '';
      lastValueRef.current = value || '';
      if (hadFocus && sel) {
        // Move cursor to end after external update
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  }, [value, showHtml]);

  // Sync HTML source view with external value changes
  useEffect(() => {
    if (showHtml && value !== lastValueRef.current) {
      setHtmlSource(value || '');
      lastValueRef.current = value || '';
    }
  }, [value, showHtml]);

  // Save and restore selection around execCommand
  const savedSelectionRef = useRef<Range | null>(null);

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && savedSelectionRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedSelectionRef.current);
    }
  }, []);

  const exec = useCallback((cmd: string, val?: string) => {
    // Restore selection before executing command (in case focus was lost)
    restoreSelection();
    document.execCommand(cmd, false, val);
    syncFromEditor();
  }, [restoreSelection]);

  const syncFromEditor = useCallback(() => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      // Don't fire onChange if content hasn't actually changed
      if (html === lastValueRef.current) return;
      lastValueRef.current = html;
      setHtmlSource(html);
      onChange(html);
    }
  }, [onChange]);

  const switchToHtml = useCallback(() => {
    if (editorRef.current) setHtmlSource(editorRef.current.innerHTML);
    setShowHtml(true);
  }, []);

  const switchToVisual = useCallback(() => {
    setShowHtml(false);
    // Set content after React renders the contentEditable div
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

  // Color picker state (shared for text color and background color)
  const [colorPickerMode, setColorPickerMode] = useState<'text' | 'bg' | null>(null);
  const [hexInput, setHexInput] = useState('#000000');
  const [alphaInput, setAlphaInput] = useState(100);
  const colorPickerRef = useRef<HTMLDivElement>(null);

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
    // Use fontSize 7 as a marker, then replace <font size="7"> with <span style="font-size:Xpx">
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

  // Build rgba/hex string from current picker state
  const buildColorValue = useCallback(() => {
    const hex = hexInput.replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '#000000';
    const a = Math.max(1, Math.min(100, alphaInput)) / 100;
    if (a >= 1) return `#${hex}`;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }, [hexInput, alphaInput]);

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
    setHexInput(mode === 'text' ? '#000000' : '#ffff00');
    setAlphaInput(100);
    setColorPickerMode(mode);
    setShowSizePicker(false);
  }, [saveSelection]);

  // Prevent toolbar buttons from stealing focus — this is critical for execCommand
  const preventFocusLoss = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // Content area styles — apply theme if provided
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

  return (
    <div style={{ border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
      {/* Toolbar — all buttons use onMouseDown + preventDefault to keep focus in editor */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '4px 6px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', flexWrap: 'wrap' }}>
        <button type="button" style={btnS()} onMouseDown={preventFocusLoss} onClick={() => exec('bold')} title="Bold"><strong>B</strong></button>
        <button type="button" style={btnS()} onMouseDown={preventFocusLoss} onClick={() => exec('italic')} title="Italic"><em>I</em></button>
        <button type="button" style={btnS()} onMouseDown={preventFocusLoss} onClick={() => exec('underline')} title="Underline"><u>U</u></button>
        <button type="button" style={btnS()} onMouseDown={preventFocusLoss} onClick={() => exec('strikeThrough')} title="Strikethrough"><s>S</s></button>
        <div style={{ width: 1, height: 16, background: '#d1d5db', margin: '0 4px' }} />
        <div ref={sizePickerRef} style={{ position: 'relative' }}>
          <button type="button" style={{ ...btnS(showSizePicker), display: 'flex', alignItems: 'center', gap: 2 }}
            onMouseDown={preventFocusLoss}
            onClick={() => { saveSelection(); setShowSizePicker(v => !v); }}
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
              marginTop: 4,
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
        <div ref={colorPickerMode === 'text' ? colorPickerRef : undefined} style={{ position: 'relative' }}>
          <button type="button" style={btnS(colorPickerMode === 'text')} onMouseDown={preventFocusLoss}
            onClick={() => colorPickerMode === 'text' ? setColorPickerMode(null) : openColorPicker('text')} title="Text Color">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>A<span style={{ width: 10, height: 10, borderRadius: 2, border: '1px solid #d1d5db', display: 'inline-block', background: 'linear-gradient(135deg, #ef4444, #3b82f6)' }} /></span>
          </button>
          {colorPickerMode === 'text' && (
            <div ref={colorPickerRef} style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: 4,
              background: '#fff', border: '1px solid #d1d5db', borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 10, width: 200,
            }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input type="color" value={hexInput.length === 7 ? hexInput : '#000000'}
                  onChange={e => setHexInput(e.target.value)}
                  onMouseDown={preventFocusLoss}
                  style={{ width: 36, height: 36, border: '1px solid #d1d5db', borderRadius: 6, padding: 2, cursor: 'pointer' }} />
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>HEX</label>
                  <input value={hexInput} onChange={e => setHexInput(e.target.value)}
                    onMouseDown={e => e.stopPropagation()}
                    style={{ width: '100%', fontSize: 12, padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 4, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                </div>
                <div style={{ width: 50 }}>
                  <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>Alpha %</label>
                  <input type="number" min={1} max={100} value={alphaInput}
                    onChange={e => setAlphaInput(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                    onMouseDown={e => e.stopPropagation()}
                    style={{ width: '100%', fontSize: 12, padding: '3px 4px', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                {['#000000','#ffffff','#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#6b7280'].map(c => (
                  <button key={c} type="button" onMouseDown={preventFocusLoss} onClick={() => setHexInput(c)}
                    style={{ width: 18, height: 18, borderRadius: 3, border: hexInput === c ? '2px solid #7c3aed' : '1px solid #d1d5db', background: c, cursor: 'pointer', padding: 0 }} />
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 24, height: 24, borderRadius: 4, border: '1px solid #d1d5db', background: buildColorValue() }} />
                <button type="button" onMouseDown={preventFocusLoss} onClick={applyPickerColor}
                  style={{ flex: 1, padding: '5px 0', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
        {/* Background color picker */}
        <div ref={colorPickerMode === 'bg' ? colorPickerRef : undefined} style={{ position: 'relative' }}>
          <button type="button" style={btnS(colorPickerMode === 'bg')} onMouseDown={preventFocusLoss}
            onClick={() => colorPickerMode === 'bg' ? setColorPickerMode(null) : openColorPicker('bg')} title="Text Background">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 12 }}>
              <span style={{ background: '#fef08a', padding: '0 3px', borderRadius: 2, lineHeight: 1.2, fontWeight: 700 }}>A</span>
            </span>
          </button>
          {colorPickerMode === 'bg' && (
            <div ref={colorPickerRef} style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: 4,
              background: '#fff', border: '1px solid #d1d5db', borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 10, width: 200,
            }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input type="color" value={hexInput.length === 7 ? hexInput : '#ffff00'}
                  onChange={e => setHexInput(e.target.value)}
                  onMouseDown={preventFocusLoss}
                  style={{ width: 36, height: 36, border: '1px solid #d1d5db', borderRadius: 6, padding: 2, cursor: 'pointer' }} />
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>HEX</label>
                  <input value={hexInput} onChange={e => setHexInput(e.target.value)}
                    onMouseDown={e => e.stopPropagation()}
                    style={{ width: '100%', fontSize: 12, padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 4, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                </div>
                <div style={{ width: 50 }}>
                  <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>Alpha %</label>
                  <input type="number" min={1} max={100} value={alphaInput}
                    onChange={e => setAlphaInput(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                    onMouseDown={e => e.stopPropagation()}
                    style={{ width: '100%', fontSize: 12, padding: '3px 4px', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                {['#ffff00','#fef08a','#bbf7d0','#bfdbfe','#e9d5ff','#fecdd3','#fed7aa','#ffffff','#d1d5db','#000000'].map(c => (
                  <button key={c} type="button" onMouseDown={preventFocusLoss} onClick={() => setHexInput(c)}
                    style={{ width: 18, height: 18, borderRadius: 3, border: hexInput === c ? '2px solid #7c3aed' : '1px solid #d1d5db', background: c, cursor: 'pointer', padding: 0 }} />
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 24, height: 24, borderRadius: 4, border: '1px solid #d1d5db', background: buildColorValue() }} />
                <button type="button" onMouseDown={preventFocusLoss} onClick={applyPickerColor}
                  style={{ flex: 1, padding: '5px 0', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Apply
                </button>
              </div>
            </div>
          )}
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
