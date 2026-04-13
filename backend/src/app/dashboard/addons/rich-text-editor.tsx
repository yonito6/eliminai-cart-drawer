'use client';

import React, { useState, useRef, useEffect } from 'react';

export default function RichTextEditor({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showHtml, setShowHtml] = useState(false);
  const [htmlSource, setHtmlSource] = useState(value || '');
  const lastValueRef = useRef(value || '');

  useEffect(() => {
    if (editorRef.current && !showHtml && value !== lastValueRef.current) {
      editorRef.current.innerHTML = value || '';
      lastValueRef.current = value || '';
    }
    if (showHtml && value !== lastValueRef.current) {
      setHtmlSource(value || '');
      lastValueRef.current = value || '';
    }
  }, [value, showHtml]);

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    syncFromEditor();
  };

  const syncFromEditor = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      lastValueRef.current = html;
      setHtmlSource(html);
      onChange(html);
    }
  };

  const switchToHtml = () => {
    if (editorRef.current) setHtmlSource(editorRef.current.innerHTML);
    setShowHtml(true);
  };

  const switchToVisual = () => {
    if (editorRef.current) editorRef.current.innerHTML = htmlSource;
    lastValueRef.current = htmlSource;
    onChange(htmlSource);
    setShowHtml(false);
  };

  const btnS = (active?: boolean): React.CSSProperties => ({
    background: active ? '#ede9fe' : 'transparent', border: 'none', cursor: 'pointer',
    padding: '3px 7px', borderRadius: 4, fontSize: 13, fontWeight: 600,
    color: active ? '#7c3aed' : '#6b7280', lineHeight: 1,
  });

  const colorRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{ border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '4px 6px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', flexWrap: 'wrap' }}>
        <button type="button" style={btnS()} onClick={() => exec('bold')} title="Bold"><strong>B</strong></button>
        <button type="button" style={btnS()} onClick={() => exec('italic')} title="Italic"><em>I</em></button>
        <button type="button" style={btnS()} onClick={() => exec('underline')} title="Underline"><u>U</u></button>
        <div style={{ width: 1, height: 16, background: '#d1d5db', margin: '0 4px' }} />
        <button type="button" style={btnS()} onClick={() => exec('fontSize', '2')} title="Small text">A<span style={{ fontSize: 9 }}>-</span></button>
        <button type="button" style={btnS()} onClick={() => exec('fontSize', '5')} title="Large text">A<span style={{ fontSize: 15 }}>+</span></button>
        <div style={{ width: 1, height: 16, background: '#d1d5db', margin: '0 4px' }} />
        <button type="button" style={btnS()} onClick={() => colorRef.current?.click()} title="Text Color">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>A<span style={{ width: 10, height: 10, borderRadius: 2, border: '1px solid #d1d5db', display: 'inline-block', background: 'linear-gradient(135deg, #ef4444, #3b82f6)' }} /></span>
        </button>
        <input ref={colorRef} type="color" style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}
          onChange={(e) => exec('foreColor', e.target.value)} />
        <button type="button" style={btnS()} onClick={() => exec('removeFormat')} title="Clear Formatting">
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
          onBlur={syncFromEditor}
          data-placeholder={placeholder || 'Type your text here...'}
          style={{ minHeight: 60, padding: '8px 10px', outline: 'none', fontSize: 13, color: '#1f2937', lineHeight: 1.5 }}
          dangerouslySetInnerHTML={{ __html: value || '' }}
        />
      )}
      <style>{`[contenteditable]:empty:before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; }`}</style>
    </div>
  );
}
