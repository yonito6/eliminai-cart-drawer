'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface ManualUpsellProduct {
  handle: string;
  variantId: number;
  title: string;
  image?: string;
  price?: string | number; // store as cents-string or number for forward-compat with v14-complete.js
}

interface UpsellManualProductsProps {
  storeId: string;
  value: ManualUpsellProduct[];
  maxProducts: number;
  onChange: (next: ManualUpsellProduct[]) => void;
}

/**
 * Inline product picker for the "Manual Selection" recommendation source.
 * Pattern mirrors the gifts picker in rewards-tier-editor.tsx (search → click to add → drag/remove).
 * Renders nothing for callers that haven't set source='manual' — page.tsx handles the conditional.
 */
export default function UpsellManualProducts({ storeId, value, maxProducts, onChange }: UpsellManualProductsProps) {
  const list = Array.isArray(value) ? value : [];
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!storeId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/stores/${storeId}/products/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.products ?? []);
      }
    } catch {
      // Swallow — keep last results visible so the user sees stale list rather than empty flicker.
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  // Debounced live search.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { search(query); }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  // Browse mode on first focus — show some products immediately.
  const [hasInitialLoad, setHasInitialLoad] = useState(false);

  function addProduct(p: any) {
    if (list.length >= maxProducts) return;
    const v = (p.variants && p.variants[0]) || {};
    const next: ManualUpsellProduct = {
      handle: p.handle,
      variantId: v.id,
      title: p.title,
      image: (p.image && p.image.src) || (p.images && p.images[0] && p.images[0].src) || '',
      price: v.price ?? '',
    };
    // Don't duplicate.
    if (list.some(x => x.variantId === next.variantId)) return;
    onChange([...list, next]);
  }

  function removeAt(i: number) {
    const next = list.slice();
    next.splice(i, 1);
    onChange(next);
  }

  function moveUp(i: number) {
    if (i <= 0) return;
    const next = list.slice();
    const [item] = next.splice(i, 1);
    next.splice(i - 1, 0, item);
    onChange(next);
  }

  function moveDown(i: number) {
    if (i >= list.length - 1) return;
    const next = list.slice();
    const [item] = next.splice(i, 1);
    next.splice(i + 1, 0, item);
    onChange(next);
  }

  const remaining = Math.max(0, maxProducts - list.length);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
        Manual Products
        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#fef3c7', color: '#92400e', fontWeight: 500 }}>
          Never optimized
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b7280', fontWeight: 400 }}>
          {list.length} / {maxProducts}
        </span>
      </div>

      {/* Selected list */}
      {list.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {list.map((p, i) => (
            <div key={p.variantId + ':' + i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 10px', background: '#f9fafb',
              border: '1px solid #e5e7eb', borderRadius: 8,
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 6, background: '#fff', border: '1px solid #e5e7eb', overflow: 'hidden', flexShrink: 0 }}>
                {p.image ? (
                  <img src={p.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : null}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.title}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>${p.price ?? '—'}</div>
              </div>
              <button onClick={() => moveUp(i)} disabled={i === 0} title="Move up" style={iconBtn(i === 0)}>↑</button>
              <button onClick={() => moveDown(i)} disabled={i === list.length - 1} title="Move down" style={iconBtn(i === list.length - 1)}>↓</button>
              <button onClick={() => removeAt(i)} title="Remove" style={{ ...iconBtn(false), color: '#dc2626' }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Search box — hidden once max is reached */}
      {remaining > 0 && (
        <>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => {
              if (!hasInitialLoad) {
                setHasInitialLoad(true);
                search('');
              }
            }}
            placeholder={list.length === 0 ? 'Search products to recommend…' : `Add ${remaining} more…`}
            style={{
              width: '100%', padding: '8px 12px', background: '#fafafa',
              border: '1px solid #d1d5db', borderRadius: 6, color: '#111827',
              fontSize: 13, boxSizing: 'border-box',
            }}
          />

          {/* Results dropdown */}
          {(loading || results.length > 0) && (
            <div style={{
              maxHeight: 280, overflowY: 'auto', border: '1px solid #e5e7eb',
              borderRadius: 8, background: '#fff',
            }}>
              {loading && results.length === 0 && (
                <div style={{ padding: 12, fontSize: 12, color: '#6b7280', textAlign: 'center' }}>Searching…</div>
              )}
              {results.map(p => {
                const alreadyAdded = list.some(x => x.variantId === (p.variants?.[0]?.id));
                const noVariant = !p.variants || p.variants.length === 0;
                const disabled = alreadyAdded || noVariant;
                return (
                  <button
                    key={p.id}
                    onClick={() => !disabled && addProduct(p)}
                    disabled={disabled}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '8px 10px', background: 'transparent', border: 'none',
                      borderBottom: '1px solid #f3f4f6', cursor: disabled ? 'default' : 'pointer',
                      textAlign: 'left' as const,
                      opacity: disabled ? 0.5 : 1,
                    }}
                    onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = '#f9fafb'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 4, background: '#f5f5f5', overflow: 'hidden', flexShrink: 0 }}>
                      {(p.image?.src || p.images?.[0]?.src) ? (
                        <img src={p.image?.src || p.images?.[0]?.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : null}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.title}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>
                        ${p.variants?.[0]?.price ?? '—'}
                        {alreadyAdded && <span style={{ marginLeft: 8, color: '#7c3aed', fontWeight: 600 }}>Already added</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
              {!loading && results.length === 0 && query && (
                <div style={{ padding: 12, fontSize: 12, color: '#6b7280', textAlign: 'center' }}>No products found</div>
              )}
            </div>
          )}
        </>
      )}

      {list.length === 0 && (
        <div style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>
          Add up to {maxProducts} products to recommend. They'll appear in this exact order.
        </div>
      )}
    </div>
  );
}

function iconBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 24, height: 24, padding: 0,
    fontSize: 14, lineHeight: 1,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    color: disabled ? '#cbd5e1' : '#374151',
    cursor: disabled ? 'default' : 'pointer',
    flexShrink: 0,
  };
}
