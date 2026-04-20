'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  price?: number;
  tiers?: PricingTier[];
  defaultOn?: boolean;
  iconColor?: string;
}

export interface ProtectionEditorProps {
  storeId: string;
  config: ProtectionConfig;
  /** Called on every field change — for instant preview (no persistence) */
  onPreviewChange: (patch: Record<string, any>) => void;
  /** Called when user clicks Save — persists to DB */
  onSave: (fullConfig: Record<string, any>) => void;
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
  onPreviewChange,
  onSave,
}: ProtectionEditorProps) {
  // Local state — initialize from config (price field = dollars)
  const initPrice = config.price ?? config.singlePrice ?? 4.99;
  const [iconId, setIconId] = useState(config.iconId ?? 'shield-filled');
  const [customIconUrl, setCustomIconUrl] = useState(config.customIconUrl ?? '');
  const [iconColor, setIconColor] = useState(config.iconColor ?? '#555555');
  const [productName, setProductName] = useState(config.productName ?? 'Shipping Protection');
  const [description, setDescription] = useState(
    config.description ?? 'Covers lost, stolen, or damaged packages',
  );
  const [pricingMode, setPricingMode] = useState<'single' | 'tiered'>(
    config.pricingMode ?? 'single',
  );
  const [singlePrice, setSinglePrice] = useState(initPrice);
  const [tiers, setTiers] = useState<PricingTier[]>(config.tiers ?? defaultTiers());
  const [defaultOn, setDefaultOn] = useState(config.defaultOn ?? true);

  // Shopify product state
  const [productExists, setProductExists] = useState(false);
  const [productTitle, setProductTitle] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusWarning, setStatusWarning] = useState<string | null>(null);

  // Modal + save state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Dirty tracking
  const savedConfigRef = useRef<string>(JSON.stringify(config));
  const [isDirty, setIsDirty] = useState(false);

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
      })
      .catch(() => setStatusWarning('Failed to check product status'))
      .finally(() => setStatusLoading(false));
  }, [storeId]);

  // ── Build payload from current state (with optional overrides) ──
  function buildPayload(overrides: Record<string, any> = {}) {
    const curIconId = overrides.iconId ?? iconId;
    const curCustomIconUrl = overrides.customIconUrl ?? customIconUrl;
    const curProductName = overrides.productName ?? productName;
    const curDescription = overrides.description ?? description;
    const curPricingMode = overrides.pricingMode ?? pricingMode;
    const curSinglePrice = overrides.singlePrice ?? singlePrice;
    const curTiers = overrides.tiers ?? tiers;
    const curDefaultOn = overrides.defaultOn ?? defaultOn;
    const curIconColor = overrides.iconColor ?? iconColor;

    const sorted = [...curTiers].sort(
      (a, b) => (a.maxCartValue ?? Infinity) - (b.maxCartValue ?? Infinity),
    );
    const displayPrice = curPricingMode === 'single' ? curSinglePrice : (sorted[0]?.price ?? curSinglePrice);
    return {
      iconId: curIconId,
      customIconUrl: curCustomIconUrl || undefined,
      iconColor: curIconColor,
      productName: curProductName,
      description: curDescription,
      pricingMode: curPricingMode,
      singlePrice: curPricingMode === 'single' ? curSinglePrice : undefined,
      tiers: curPricingMode === 'tiered' ? sorted : undefined,
      defaultOn: curDefaultOn,
      price: displayPrice,
    };
  }

  // ── Push preview change (called from every event handler) ──
  function pushPreview(overrides: Record<string, any> = {}) {
    const payload = buildPayload(overrides);
    onPreviewChange(payload);
    setIsDirty(JSON.stringify(payload) !== savedConfigRef.current);
  }

  // ── Send initial config to parent once on mount ──
  const didMount = useRef(false);
  useEffect(() => {
    if (didMount.current) return;
    didMount.current = true;
    onPreviewChange(buildPayload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // ── Debounced preview for text inputs (prevents cursor jumping) ──
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function pushPreviewDebounced(overrides: Record<string, any>) {
    setIsDirty(true); // mark dirty immediately
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      pushPreview(overrides);
    }, 200);
  }

  // ── Create Shopify product ──
  const handleCreate = async () => {
    setCreating(true);
    try {
      const payload = buildPayload();
      const res = await fetch(`/api/stores/${storeId}/protection/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setProductExists(true);
      setProductTitle(data.title ?? productName);
      setStatusWarning(null);
      setShowCreateModal(false);
      // Now save the config to DB
      onSave(payload);
      savedConfigRef.current = JSON.stringify(payload);
      setIsDirty(false);
    } catch (err: any) {
      alert(`Failed to create product: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  // ── Save handler (called from Save button) ──
  const handleSave = async () => {
    const payload = buildPayload();
    if (!productExists && !statusLoading) {
      // No Shopify product yet — show confirmation modal first
      setShowCreateModal(true);
      return;
    }
    // Product exists — silently update Shopify product + save config
    setSaving(true);
    try {
      // Update the Shopify product
      const res = await fetch(`/api/stores/${storeId}/protection/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error('Protection update failed:', text);
      }
    } catch (err) {
      console.error('Failed to sync protection product:', err);
    }
    // Save config to DB regardless
    onSave(payload);
    savedConfigRef.current = JSON.stringify(payload);
    setIsDirty(false);
    setSaving(false);
  };

  // ── Discard changes ──
  const handleDiscard = () => {
    const saved = JSON.parse(savedConfigRef.current) as ProtectionConfig;
    setIconId(saved.iconId ?? 'shield-filled');
    setCustomIconUrl(saved.customIconUrl ?? '');
    setProductName(saved.productName ?? 'Shipping Protection');
    setDescription(saved.description ?? 'Covers lost, stolen, or damaged packages');
    setPricingMode(saved.pricingMode ?? 'single');
    setSinglePrice(saved.price ?? saved.singlePrice ?? 4.99);
    setTiers(saved.tiers ?? defaultTiers());
    setDefaultOn(saved.defaultOn ?? true);
    setIsDirty(false);
    onPreviewChange(saved);
  };

  // ── Tier helpers ──
  const addTier = () => {
    if (tiers.length >= MAX_TIERS) return;
    const sorted = [...tiers].sort(
      (a, b) => (a.maxCartValue ?? Infinity) - (b.maxCartValue ?? Infinity),
    );
    const lastTier = sorted[sorted.length - 1];
    const prevMax = sorted.length >= 2 ? (sorted[sorted.length - 2].maxCartValue ?? 0) : 0;
    const newMax = prevMax + 100;
    const newTier: PricingTier = { price: lastTier.price, maxCartValue: newMax };
    sorted.splice(sorted.length - 1, 0, newTier);
    setTiers(sorted);
    pushPreview({ tiers: sorted });
  };

  const removeTier = (idx: number) => {
    const sorted = [...tiers].sort(
      (a, b) => (a.maxCartValue ?? Infinity) - (b.maxCartValue ?? Infinity),
    );
    if (sorted[idx].maxCartValue === null) return;
    sorted.splice(idx, 1);
    setTiers(sorted);
    pushPreview({ tiers: sorted });
  };

  const updateTier = (idx: number, field: 'price' | 'maxCartValue', value: number) => {
    const sorted = [...tiers].sort(
      (a, b) => (a.maxCartValue ?? Infinity) - (b.maxCartValue ?? Infinity),
    );
    if (field === 'price') sorted[idx].price = value;
    else sorted[idx].maxCartValue = value;
    const updated = [...sorted];
    setTiers(updated);
    pushPreview({ tiers: updated });
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
              onClick={() => {
                setIconId(icon.id);
                setCustomIconUrl('');
                pushPreview({ iconId: icon.id, customIconUrl: '' });
              }}
              title={icon.label}
              style={{
                width: 52,
                height: 52,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                border: `2px solid ${iconId === icon.id && !customIconUrl ? iconColor : '#e5e7eb'}`,
                background: iconId === icon.id && !customIconUrl ? `${iconColor}15` : '#fff',
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
                  color: iconId === icon.id && !customIconUrl ? iconColor : GRAY_SEC,
                  transition,
                }}
              />
            </button>
          ))}

          {/* Custom upload card */}
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
                const url = URL.createObjectURL(file);
                setCustomIconUrl(url);
                setIconId('custom');
                pushPreview({ customIconUrl: url, iconId: 'custom' });
              }}
            />
          </label>
        </div>

        {/* ── Icon Color ── */}
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 6 }}>
            Icon Color
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="color"
              value={iconColor}
              onChange={(e) => {
                setIconColor(e.target.value);
                pushPreview({ iconColor: e.target.value });
              }}
              style={{
                width: 40,
                height: 40,
                border: '2px solid #e5e7eb',
                borderRadius: 10,
                cursor: 'pointer',
                padding: 2,
                background: '#fff',
              }}
            />
            <input
              type="text"
              value={iconColor}
              onChange={(e) => {
                const v = e.target.value;
                setIconColor(v);
                // Only push preview if it looks like a valid color
                if (/^#[0-9a-fA-F]{6}$/.test(v) || /^rgb/.test(v)) {
                  pushPreviewDebounced({ iconColor: v });
                }
              }}
              onBlur={() => pushPreview({ iconColor })}
              placeholder="#555555"
              style={{
                width: 120,
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                fontSize: 13,
                color: '#374151',
                fontFamily: 'monospace',
                outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#8b5cf6')}
            />
            {/* Quick preset colors */}
            {['#555555', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#000000'].map((c) => (
              <button
                key={c}
                onClick={() => {
                  setIconColor(c);
                  pushPreview({ iconColor: c });
                }}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: c,
                  border: iconColor === c ? '2px solid #374151' : '2px solid #e5e7eb',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'border-color 0.15s, transform 0.15s',
                  transform: iconColor === c ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            ))}
          </div>
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
          onChange={(e) => {
            setProductName(e.target.value);
            setIsDirty(true);
          }}
          onBlur={() => pushPreview({ productName })}
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
          onChange={(e) => {
            setDescription(e.target.value);
            setIsDirty(true);
          }}
          onBlur={() => pushPreview({ description })}
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
                pushPreview({ pricingMode: mode });
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
              onChange={(e) => {
                const val = Math.max(0, parseFloat(e.target.value) || 0);
                setSinglePrice(val);
                pushPreview({ singlePrice: val });
              }}
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
        onClick={() => {
          const newVal = !defaultOn;
          setDefaultOn(newVal);
          pushPreview({ defaultOn: newVal });
        }}
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
              Not on Shopify yet — will be created on first save
            </span>
          </>
        )}
      </div>

      {/* ── Save / Discard Buttons (always visible) ── */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSave}
          disabled={saving || (!isDirty && productExists)}
          style={{
            padding: '8px 20px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 8,
            border: 'none',
            background: saving ? '#a78bfa' : (!isDirty && productExists) ? '#d1d5db' : PURPLE,
            color: '#fff',
            cursor: (saving || (!isDirty && productExists)) ? 'default' : 'pointer',
            transition,
            boxShadow: (!isDirty && productExists) ? 'none' : `0 2px 8px ${PURPLE}40`,
            opacity: saving ? 0.7 : 1,
          }}
          onMouseEnter={(e) => !saving && (e.currentTarget.style.transform = 'scale(1.02)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          {saving ? 'Saving...' : !productExists ? 'Save & Create Product' : 'Save'}
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

      {/* ── Confirmation Modal (create Shopify product) ── */}
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
              To add shipping protection to the cart, we need to create a hidden product on your Shopify store:
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
                {creating ? 'Creating...' : 'Create & Save'}
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
