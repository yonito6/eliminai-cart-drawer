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
function hasInlineColor(html: string): boolean {
  return /color\s*[:=]/i.test(html);
}

export default function RichTextEditor({ value, onChange, placeholder, themeColor, themeFont, themeBg }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showHtml, setShowHtml] = useState(false);
  const [htmlSource, setHtmlSource] = useState(value || '');
  const lastValueRef = useRef(value || '');
  // Track whether we've done the initial render
  const initializedRef = useRef(false);

  // Auto-apply themeColor to plain text that has no inline color yet (one-time migration)
  const colorAppliedRef = useRef(false);

  // Set initial content once, then only update if external value changes
  useEffect(() => {
    if (!editorRef.current || showHtml) return;
    if (!initializedRef.current) {
      let html = value || '';
      // If themeColor set and content has no inline color, wrap it once and save
      if (themeColor && html && !colorAppliedRef.current && !hasInlineColor(html)) {
        html = `<span style="color: ${themeColor}">${html}</span>`;
        colorAppliedRef.current = true;
        editorRef.current.innerHTML = html;
        lastValueRef.current = html;
        setHtmlSource(html);
        onChange(html);
      } else {
        editorRef.current.innerHTML = html;
        lastValueRef.current = html;
      }
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

  const colorRef = useRef<HTMLInputElement>(null);
  const [showSizePicker, setShowSizePicker] = useState(false);
  const sizePickerRef = useRef<HTMLDivElement>(null);

  // Close size picker on outside click
  useEffect(() => {
    if (!showSizePicker) return;
    const handler = (e: MouseEvent) => {
      if (sizePickerRef.current && !sizePickerRef.current.contains(e.target as Node)) {
        setShowSizePicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSizePicker]);

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
              {[10, 12, 14, 16, 18, 20, 24, 28, 32].map(px => (
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
        <button type="button" style={btnS()} onMouseDown={(e) => { e.preventDefault(); colorRef.current?.click(); }} title="Text Color">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>A<span style={{ width: 10, height: 10, borderRadius: 2, border: '1px solid #d1d5db', display: 'inline-block', background: 'linear-gradient(135deg, #ef4444, #3b82f6)' }} /></span>
        </button>
        <input ref={colorRef} type="color" style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}
          onChange={(e) => exec('foreColor', e.target.value)} />
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
