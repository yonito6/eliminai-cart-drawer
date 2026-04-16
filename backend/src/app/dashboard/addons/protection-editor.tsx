'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PROTECTION_ICONS } from '@/lib/protection-icons';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PricingTier {
  price: number;
  maxCartValue: number | null; // null = last tier (no upper limit)
}

interface ProtectionConfig {
  iconId?: string;
  customIconUrl?: string;
  productName?: string;
  description?: string;
  pricingMode?: 'single' | 'tiered';
  singlePrice?: number;
  tiers?: PricingTier[];
  defaultOn?: boolean;
}

export interface ProtectionEditorProps {
  storeId: string;
  config: ProtectionConfig;
  onConfigChange: (patch: Record<string, any>) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const transition = 'all 0.25s cubic-bezier(0.4,0,0.2,1)';
const PURPLE = '#7c3aed';
const GRAY_TEXT = '#374151';
const GRAY_SEC = '#9ca3af';
const MODAL_BG = '#1f2937';
const MAX_TIERS = 10;

function defaultTiers(): PricingTier[] {
  return [
    { price: 1.99, maxCartValue: 100 },
    { price: 2.99, maxCartValue: 200 },
    { price: 3.99, maxCartValue: null },
  ];
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ProtectionEditor({
  storeId,
  config,
  onConfigChange,
}: ProtectionEditorProps) {
  // Local state
  const [iconId, setIconId] = useState(config.iconId ?? 'shield-check');
  const [customIconUrl, setCustomIconUrl] = useState(config.customIconUrl ?? '');
  const [productName, setProductName] = useState(config.productName ?? 'Shipping Protection');
  const [description, setDescription] = useState(
    config.description ?? 'Covers lost, stolen, or damaged packages',
  );
  const [pricingMode, setPricingMode] = useState<'single' | 'tiered'>(
    config.pricingMode ?? 'single',
  );
  const [singlePrice, setSinglePrice] = useState(config.singlePrice ?? 2.99);
  const [tiers, setTiers] = useState<PricingTier[]>(config.tiers ?? defaultTiers());
  const [defaultOn, setDefaultOn] = useState(config.defaultOn ?? true);

  // Shopify product state
  const [productExists, setProductExists] = useState(false);
  const [productTitle, setProductTitle] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusWarning, setStatusWarning] = useState<string | null>(null);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Track whether config has changed from what's on Shopify
  const initialConfigRef = useRef<string | null>(null);
  const [configDirty, setConfigDirty] = useState(false);

  // ── Fetch product status on mount ──
  useEffect(() => {
    if (!storeId) return;
    setStatusLoading(true);
    fetch(`/api/stores/${storeId}/protection/status`)
      .then((r) => r.json())
      .then((data) => {
        setProductExists(!!data.exists);
        setProductTitle(data.title ?? null);
        setStatusWarning(data.warning ?? null);
        if (data.exists) {
          initialConfigRef.current = JSON.stringify(buildPayload());
        }
      })
      .catch(() => setStatusWarning('Failed to check product status'))
      .finally(() => setStatusLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  // ── Build payload ──
  const buildPayload = useCallback(() => {
    const sorted = [...tiers].sort(
      (a, b) => (a.maxCartValue ?? Infinity) - (b.maxCartValue ?? Infinity),
    );
    return {
      iconId,
      customIconUrl: customIconUrl || undefined,
      productName,
      description,
      pricingMode,
      singlePrice: pricingMode === 'single' ? singlePrice : undefined,
      tiers: pricingMode === 'tiered' ? sorted : undefined,
      defaultOn,
    };
  }, [iconId, customIconUrl, productName, description, pricingMode, singlePrice, tiers, defaultOn]);

  // ── Push changes to parent on every edit ──
  useEffect(() => {
    const payload = buildPayload();
    onConfigChange(payload);

    // Check if dirty
    if (initialConfigRef.current !== null) {
      setConfigDirty(JSON.stringify(payload) !== initialConfigRef.current);
    }
  }, [buildPayload, onConfigChange]);

  // ── Create product ──
  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch(`/api/stores/${storeId}/protection/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setProductExists(true);
      setProductTitle(data.title ?? productName);
      setStatusWarning(null);
      initialConfigRef.current = JSON.stringify(buildPayload());
      setConfigDirty(false);
      setShowCreateModal(false);
    } catch (err: any) {
      alert(`Failed to create product: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  // ── Sync / Update ──
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/stores/${storeId}/protection/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) throw new Error(await res.text());
      initialConfigRef.current = JSON.stringify(buildPayload());
      setConfigDirty(false);
    } catch (err: any) {
      alert(`Failed to sync: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // ── Tier helpers ──
  const addTier = () => {
    if (tiers.length >= MAX_TIERS) return;
    const sorted = [...tiers].sort(
      (a, b) => (a.maxCartValue ?? Infinity) - (b.maxCartValue ?? Infinity),
    );
    // Insert before the last tier
    const lastTier = sorted[sorted.length - 1];
    const prevMax = sorted.length >= 2 ? (sorted[sorted.length - 2].maxCartValue ?? 0) : 0;
    const newMax = prevMax + 100;
    const newTier: PricingTier = { price: lastTier.price, maxCartValue: newMax };
    sorted.splice(sorted.length - 1, 0, newTier);
    setTiers(sorted);
  };

  const removeTier = (idx: number) => {
    const sorted = [...tiers].sort(
      (a, b) => (a.maxCartValue ?? Infinity) - (b.maxCartValue ?? Infinity),
    );
    // Can't remove the last tier (unlimited ceiling)
    if (sorted[idx].maxCartValue === null) return;
    sorted.splice(idx, 1);
    setTiers(sorted);
  };

  const updateTier = (idx: number, field: 'price' | 'maxCartValue', value: number) => {
    const sorted = [...tiers].sort(
      (a, b) => (a.maxCartValue ?? Infinity) - (b.maxCartValue ?? Infinity),
    );
    if (field === 'price') sorted[idx].price = value;
    else sorted[idx].maxCartValue = value;
    setTiers([...sorted]);
  };

  const sortedTiers = [...tiers].sort(
    (a, b) => (a.maxCartValue ?? Infinity) - (b.maxCartValue ?? Infinity),
  );

  // ── Price summary for modal ──
  const priceSummary = () => {
    if (pricingMode === 'single') return `$${singlePrice.toFixed(2)} flat rate`;
    return sortedTiers
      .map((t, i) => {
        if (t.maxCartValue === null) {
          const prev = i > 0 ? sortedTiers[i - 1].maxCartValue : 0;
          return `$${t.price.toFixed(2)} (carts above $${prev})`;
        }
        return `$${t.price.toFixed(2)} (carts up to $${t.maxCartValue})`;
      })
      .join(', ');
  };

  // ────────────────────────── Render ──────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Icon Selector ── */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, color: GRAY_TEXT, display: 'block', marginBottom: 6 }}>
          Icon
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PROTECTION_ICONS.map((icon) => (
            <button
              key={icon.id}
              onClick={() => { setIconId(icon.id); setCustomIconUrl(''); }}
              title={icon.label}
              style={{
                width: 52,
                height: 52,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                border: `2px solid ${iconId === icon.id && !customIconUrl ? PURPLE : '#e5e7eb'}`,
                background: iconId === icon.id && !customIconUrl ? `${PURPLE}10` : '#fff',
                cursor: 'pointer',
                padding: 8,
                transition,
              }}
            >
              <div
                dangerouslySetInnerHTML={{ __html: icon.svg }}
                style={{
                  width: 28,
                  height: 28,
                  color: iconId === icon.id && !customIconUrl ? PURPLE : GRAY_SEC,
                  transition,
                }}
              />
            </button>
          ))}

          {/* Custom upload card (placeholder) */}
          <label
            title="Upload custom icon"
            style={{
              width: 52,
              height: 52,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
              border: `2px dashed ${customIconUrl ? PURPLE : '#d1d5db'}`,
              background: customIconUrl ? `${PURPLE}10` : '#fafafa',
              cursor: 'pointer',
              transition,
              fontSize: 18,
              color: customIconUrl ? PURPLE : GRAY_SEC,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {customIconUrl ? (
              <img
                src={customIconUrl}
                alt="Custom icon"
                style={{ width: 28, height: 28, objectFit: 'contain' }}
              />
            ) : (
              <span>+</span>
            )}
            <input
              type="file"
              accept="image/svg+xml,image/png,image/jpeg"
              style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer', top: 0, left: 0 }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                // Use local preview for now (upload route can be added later)
                const url = URL.createObjectURL(file);
                setCustomIconUrl(url);
                setIconId('custom');
              }}
            />
          </label>
        </div>
      </div>

      {/* ── Product Name ── */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, color: GRAY_TEXT, display: 'block', marginBottom: 4 }}>
          Product Name
        </label>
        <input
          type="text"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          placeholder="Shipping Protection"
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            fontSize: 13,
            color: GRAY_TEXT,
            outline: 'none',
            transition,
            boxSizing: 'border-box',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = PURPLE)}
          onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
        />
      </div>

      {/* ── Description ── */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, color: GRAY_TEXT, display: 'block', marginBottom: 4 }}>
          Description
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Covers lost, stolen, or damaged packages"
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            fontSize: 13,
            color: GRAY_TEXT,
            outline: 'none',
            transition,
            boxSizing: 'border-box',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = PURPLE)}
          onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
        />
      </div>

      {/* ── Pricing Mode Toggle ── */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, color: GRAY_TEXT, display: 'block', marginBottom: 6 }}>
          Pricing
        </label>
        <div style={{ display: 'inline-flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
          {(['single', 'tiered'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setPricingMode(mode);
                if (mode === 'tiered' && tiers.length === 0) setTiers(defaultTiers());
              }}
              style={{
                padding: '6px 16px',
                fontSize: 12,
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                background: pricingMode === mode ? PURPLE : '#fff',
                color: pricingMode === mode ? '#fff' : GRAY_TEXT,
                transition,
              }}
            >
              {mode === 'single' ? 'Single Price' : 'Tiered'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Single Price Input ── */}
      {pricingMode === 'single' && (
        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: GRAY_TEXT, display: 'block', marginBottom: 4 }}>
            Price
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 13, color: GRAY_SEC }}>$</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={singlePrice}
              onChange={(e) => setSinglePrice(Math.max(0, parseFloat(e.target.value) || 0))}
              style={{
                width: 90,
                padding: '6px 8px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                fontSize: 13,
                color: GRAY_TEXT,
                outline: 'none',
                transition,
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = PURPLE)}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
            />
          </div>
        </div>
      )}

      {/* ── Tiered Pricing Editor ── */}
      {pricingMode === 'tiered' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sortedTiers.map((tier, idx) => {
            const isLast = tier.maxCartValue === null;
            const prevMax = idx > 0 ? sortedTiers[idx - 1].maxCartValue ?? 0 : 0;
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: '#fafafa',
                  border: '1px solid #f3f4f6',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 80 }}>
                  <span style={{ fontSize: 12, color: GRAY_SEC }}>$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={tier.price}
                    onChange={(e) =>
                      updateTier(idx, 'price', Math.max(0, parseFloat(e.target.value) || 0))
                    }
                    style={{
                      width: 60,
                      padding: '4px 6px',
                      borderRadius: 6,
                      border: '1px solid #e5e7eb',
                      fontSize: 12,
                      color: GRAY_TEXT,
                      outline: 'none',
                    }}
                  />
                </div>

                <span style={{ fontSize: 11, color: GRAY_SEC, flex: 1 }}>
                  {isLast ? (
                    <>for carts above ${prevMax}</>
                  ) : (
                    <>
                      for carts up to $
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={tier.maxCartValue ?? 0}
                        onChange={(e) =>
                          updateTier(idx, 'maxCartValue', Math.max(1, parseInt(e.target.value) || 1))
                        }
                        style={{
                          width: 55,
                          padding: '2px 4px',
                          borderRadius: 4,
                          border: '1px solid #e5e7eb',
                          fontSize: 11,
                          color: GRAY_TEXT,
                          outline: 'none',
                          marginLeft: 2,
                        }}
                      />
                    </>
                  )}
                </span>

                {!isLast && (
                  <button
                    onClick={() => removeTier(idx)}
                    title="Remove tier"
                    style={{
                      width: 22,
                      height: 22,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 6,
                      border: 'none',
                      background: 'transparent',
                      color: GRAY_SEC,
                      cursor: 'pointer',
                      fontSize: 14,
                      transition,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = GRAY_SEC)}
                  >
                    &times;
                  </button>
                )}
              </div>
            );
          })}

          {tiers.length < MAX_TIERS && (
            <button
              onClick={addTier}
              style={{
                alignSelf: 'flex-start',
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: 500,
                borderRadius: 6,
                border: `1px dashed ${GRAY_SEC}`,
                background: 'transparent',
                color: GRAY_SEC,
                cursor: 'pointer',
                transition,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = PURPLE;
                e.currentTarget.style.color = PURPLE;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = GRAY_SEC;
                e.currentTarget.style.color = GRAY_SEC;
              }}
            >
              + Add Tier
            </button>
          )}
        </div>
      )}

      {/* ── Default On Toggle ── */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500,
          color: GRAY_TEXT,
        }}
        onClick={() => setDefaultOn(!defaultOn)}
      >
        <div
          style={{
            width: 36,
            height: 20,
            borderRadius: 10,
            background: defaultOn ? PURPLE : '#d1d5db',
            position: 'relative',
            transition,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 2,
              left: defaultOn ? 18 : 2,
              width: 16,
              height: 16,
              borderRadius: 8,
              background: '#fff',
              transition,
              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            }}
          />
        </div>
        Pre-checked by default
      </label>

      {/* ── Status ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {statusLoading ? (
          <span style={{ fontSize: 11, color: GRAY_SEC }}>Checking Shopify...</span>
        ) : productExists ? (
          <>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: '#10b981',
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: 11, color: '#10b981', fontWeight: 500 }}>
              Active on Shopify{productTitle ? ` — "${productTitle}"` : ''}
            </span>
          </>
        ) : (
          <>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: GRAY_SEC,
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: 11, color: GRAY_SEC }}>
              Not on Shopify yet{statusWarning ? ` (${statusWarning})` : ''}
            </span>
          </>
        )}
      </div>

      {/* ── Action Buttons ── */}
      <div style={{ display: 'flex', gap: 8 }}>
        {!productExists && !statusLoading && (
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '8px 18px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 8,
              border: 'none',
              background: PURPLE,
              color: '#fff',
              cursor: 'pointer',
              transition,
              boxShadow: `0 2px 8px ${PURPLE}40`,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            Create Protection Product
          </button>
        )}

        {productExists && configDirty && (
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              padding: '8px 18px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 8,
              border: 'none',
              background: syncing ? '#a78bfa' : PURPLE,
              color: '#fff',
              cursor: syncing ? 'default' : 'pointer',
              transition,
              opacity: syncing ? 0.7 : 1,
            }}
          >
            {syncing ? 'Syncing...' : 'Sync to Shopify'}
          </button>
        )}
      </div>

      {/* ── Confirmation Modal ── */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)',
            background: 'rgba(0,0,0,0.5)',
          }}
          onClick={() => !creating && setShowCreateModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: MODAL_BG,
              borderRadius: 14,
              padding: '24px 28px',
              maxWidth: 420,
              width: '90%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
              animation: 'modalIn 0.2s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600, color: '#f9fafb' }}>
              Create Shipping Protection Product
            </h3>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 14px', lineHeight: 1.5 }}>
              This will create a hidden product on your Shopify store:
            </p>
            <ul style={{ margin: '0 0 18px', paddingLeft: 18, fontSize: 12, color: '#d1d5db', lineHeight: 1.8 }}>
              <li>
                Name: <strong style={{ color: '#f9fafb' }}>{productName}</strong>
              </li>
              <li>
                Pricing: <strong style={{ color: '#f9fafb' }}>{priceSummary()}</strong>
              </li>
              <li>Hidden from storefront (only shown in cart drawer)</li>
              <li>Can be removed anytime from Shopify admin</li>
            </ul>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
                style={{
                  padding: '7px 16px',
                  fontSize: 12,
                  fontWeight: 500,
                  borderRadius: 8,
                  border: '1px solid #4b5563',
                  background: 'transparent',
                  color: '#d1d5db',
                  cursor: creating ? 'default' : 'pointer',
                  transition,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                style={{
                  padding: '7px 16px',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: 'none',
                  background: creating ? '#a78bfa' : PURPLE,
                  color: '#fff',
                  cursor: creating ? 'default' : 'pointer',
                  transition,
                  boxShadow: `0 2px 8px ${PURPLE}60`,
                  opacity: creating ? 0.7 : 1,
                }}
              >
                {creating ? 'Creating...' : 'Create Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal animation keyframes */}
      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
      `}</style>
    </div>
  );
}
