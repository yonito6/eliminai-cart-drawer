'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { REWARD_ICONS } from '@/lib/addon-definitions';
import type { RewardTier } from '@/lib/addon-definitions';
import RichTextEditor, { applyDefaultColor } from './rich-text-editor';
import type { StagingHint } from './addon-preview';

interface RewardsTierEditorProps {
  config: Record<string, any>;
  onConfigChange: (patch: Record<string, any>) => void;
  storeId: string;
  /** Default text color for "all rewards unlocked" + "after" text (CSS default, overridden by editor formatting) */
  successColor?: string;
  /** Default text color for "before" tier text (CSS default, overridden by editor formatting) */
  messageColor?: string;
  themeFont?: string;
  /** Called when the editing context changes — tells the preview what scenario to stage */
  onStagingChange?: (hint: StagingHint | null) => void;
}

export default function RewardsTierEditor({ config, onConfigChange, storeId, successColor, messageColor, themeFont, onStagingChange }: RewardsTierEditorProps) {
  const tiers: RewardTier[] = config.tiers ?? [];
  const thresholdMode: 'items' | 'dollars' = config.thresholdMode ?? 'items';
  const highestTierOnly: boolean = config.highestTierOnly ?? false;
  const allRewardsUnlockedText: string = config.allRewardsUnlockedText ?? '';

  const [editingTierId, setEditingTierId] = useState<string | null>(null);

  // Emit staging hint whenever the editing context changes
  const emitStaging = useCallback((tierId: string | null, field?: StagingHint['field']) => {
    if (!onStagingChange) return;
    if (!tierId) {
      onStagingChange(null);
      return;
    }
    const sortedTiers = [...tiers].sort((a, b) => a.goal - b.goal);
    const tierIndex = sortedTiers.findIndex(t => t.id === tierId);
    if (tierIndex < 0) { onStagingChange(null); return; }
    onStagingChange({ context: 'tier', tierIndex, field: field || 'label' });
  }, [onStagingChange, tiers]);

  const [iconPickerTierId, setIconPickerTierId] = useState<string | null>(null);
  const [giftSearchQuery, setGiftSearchQuery] = useState('');
  const [giftSearchResults, setGiftSearchResults] = useState<any[]>([]);
  const [giftSearchLoading, setGiftSearchLoading] = useState(false);
  // "replace mode" — when set, the next product picked replaces this gift index instead of appending
  const [replacingGiftIndex, setReplacingGiftIndex] = useState<number | null>(null);
  // Confirmation dialog for auto-creating Shopify discount
  const [pendingGift, setPendingGift] = useState<{ product: any; tierGoal: number; tierId: string; isReplace: boolean; replaceIndex: number | null } | null>(null);
  const [discountSyncing, setDiscountSyncing] = useState(false);
  // Track whether gift discounts already exist on Shopify — skip confirmation modal if they do
  const [discountsExist, setDiscountsExist] = useState(false);
  const [variantPickerProduct, setVariantPickerProduct] = useState<any | null>(null);
  const [variantPickerTierId, setVariantPickerTierId] = useState<string | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (!storeId) return;
    fetch(`/api/stores/${storeId}/gift-discounts`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.exists) setDiscountsExist(true); })
      .catch(() => {});
  }, [storeId]);

  function updateTiers(newTiers: RewardTier[]) {
    onConfigChange({ tiers: newTiers });
  }

  function addGiftToTier(tierId: string, product: any, vId: number, vTitle?: string) {
    const tier = tiers.find(t => t.id === tierId);
    if (!tier) return;
    const norm = normalizeTier(tier);
    const v = product.variants?.find((x: any) => x.id === vId) || product.variants?.[0];
    const img = product.imageUrl || product.image?.src || product.images?.[0]?.src || '';
    const title = vTitle && vTitle !== 'Default Title' ? product.title + ' \u2014 ' + vTitle : product.title;
    const newGift = { handle: product.handle, variantId: vId, title, imageUrl: img, price: v?.price || '' };
    let updated: any[];
    if (replacingGiftIndex !== null) {
      updated = [...norm.giftProducts];
      updated[replacingGiftIndex] = newGift;
      setReplacingGiftIndex(null);
    } else {
      updated = [...norm.giftProducts, newGift];
    }
    updateTier(tierId, { giftProducts: updated, giftProduct: updated[0] });
  }

  function updateTier(tierId: string, patch: Partial<RewardTier>) {
    updateTiers(tiers.map(t => t.id === tierId ? { ...t, ...patch } : t));
  }

  // Normalize legacy tiers: migrate giftProduct → giftProducts
  function normalizeTier(t: any): RewardTier {
    if (t.giftProduct && (!t.giftProducts || t.giftProducts.length === 0)) {
      return { ...t, giftProducts: [t.giftProduct], giftProduct: undefined };
    }
    if (!t.giftProducts) return { ...t, giftProducts: [] };
    return t;
  }

  function addTier() {
    const newId = 'tier-' + Date.now();
    const newGoal = tiers.length > 0 ? Math.max(...tiers.map(t => t.goal)) + 1 : 1;
    const newTier: RewardTier = {
      id: newId,
      label: '',
      goal: newGoal,
      icon: 'star',
      beforeText: 'Add {remaining} more to unlock',
      afterText: 'Reward unlocked!',
      giftProducts: [],
    };
    updateTiers([...tiers, newTier]);
    setEditingTierId(newId);
  }

  function removeTier(tierId: string) {
    updateTiers(tiers.filter(t => t.id !== tierId));
    if (editingTierId === tierId) setEditingTierId(null);
  }

  function moveTier(tierId: string, direction: 'up' | 'down') {
    const idx = tiers.findIndex(t => t.id === tierId);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= tiers.length) return;
    const newTiers = [...tiers];
    [newTiers[idx], newTiers[newIdx]] = [newTiers[newIdx], newTiers[idx]];
    updateTiers(newTiers);
  }

  // Auto-fetch missing images for legacy gifts stored with imageUrl: null
  useEffect(() => {
    tiers.forEach(rawTier => {
      const tier = normalizeTier(rawTier);
      tier.giftProducts.forEach((gift, gi) => {
        if (gift.handle && (!gift.imageUrl || !gift.price)) {
          fetch(`/api/stores/${storeId}/products/search?q=${encodeURIComponent(gift.title || gift.handle)}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (!data?.products?.length) return;
              const match = data.products.find((p: any) => p.handle === gift.handle) || data.products[0];
              const imgUrl = match?.image?.src || match?.images?.[0]?.src;
              const price = match?.variants?.[0]?.price;
              const patch: Partial<typeof gift> = {};
              if (imgUrl && !gift.imageUrl) patch.imageUrl = imgUrl;
              if (price && !gift.price) patch.price = price;
              if (Object.keys(patch).length > 0) {
                const updated = [...tier.giftProducts];
                updated[gi] = { ...updated[gi], ...patch };
                updateTier(tier.id, { giftProducts: updated, giftProduct: updated[0] });
              }
            })
            .catch(() => {});
        }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const searchGiftProducts = useCallback(async (query: string) => {
    if (!storeId) return;
    setGiftSearchLoading(true);
    try {
      const res = await fetch(`/api/stores/${storeId}/products/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setGiftSearchResults(data.products ?? []);
      }
    } catch (e) {
      console.error('Product search failed', e);
    } finally {
      setGiftSearchLoading(false);
    }
  }, [storeId]);

  // Debounced live search — triggers 300ms after user stops typing
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // Only auto-search when there's a query (browse mode is triggered by button click)
    if (!giftSearchQuery.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchGiftProducts(giftSearchQuery);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [giftSearchQuery, searchGiftProducts]);

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
    fontSize: 11,
    fontWeight: 500,
    color: '#6b7280',
    marginBottom: 3,
    display: 'block',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Threshold Mode */}
      <div>
        <span style={labelStyle}>Threshold Mode</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['items', 'dollars'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => onConfigChange({ thresholdMode: mode })}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '2px solid ' + (thresholdMode === mode ? '#7c3aed' : '#e5e7eb'),
                borderRadius: 8,
                background: thresholdMode === mode ? '#f5f3ff' : '#fff',
                color: thresholdMode === mode ? '#7c3aed' : '#374151',
                fontWeight: thresholdMode === mode ? 600 : 400,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {mode === 'items' ? 'Item Count' : 'Dollar Amount ($)'}
            </button>
          ))}
        </div>
      </div>

      {/* Highest Tier Only Toggle */}
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
        <input
          type="checkbox"
          checked={highestTierOnly}
          onChange={e => onConfigChange({ highestTierOnly: e.target.checked })}
          style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0 }}
        />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
            Apply highest tier only
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
            Customers receive only the highest eligible reward. Lower tiers will not be combined.
          </div>
        </div>
      </label>

      {/* All Rewards Unlocked Text */}
      <div onFocus={() => { onStagingChange?.({ context: 'allUnlocked' }); }}>
        <span style={labelStyle}>Text when all rewards unlocked</span>
        <RichTextEditor
          value={allRewardsUnlockedText}
          onChange={v => onConfigChange({ allRewardsUnlockedText: v })}
          placeholder="e.g. You've unlocked all rewards!"
          themeColor={successColor || '#1a7a1a'}
          themeFont={themeFont}
        />
      </div>

      {/* Milestone Animation */}
      <div style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: (config.milestoneAnimation !== false) ? 8 : 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>Milestone Animation</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#6b7280' }}>{config.milestoneAnimation !== false ? 'On' : 'Off'}</span>
            <button
              onClick={() => {
                const next = !(config.milestoneAnimation !== false);
                onConfigChange({ milestoneAnimation: next, milestoneAnimationType: next ? (config.milestoneAnimationType || 'pulse') : 'none' });
              }}
              style={{
                position: 'relative', width: 36, height: 20, borderRadius: 10,
                border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0,
                background: (config.milestoneAnimation !== false) ? '#22c55e' : '#d1d5db',
                transition: 'background 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: 2, left: (config.milestoneAnimation !== false) ? 18 : 2,
                width: 16, height: 16, borderRadius: 8, background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
              }} />
            </button>
          </div>
        </div>
        {config.milestoneAnimation !== false && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {([
              { key: 'pulse', label: 'Pulse', desc: 'Gentle scale up/down' },
              { key: 'bounce', label: 'Bounce', desc: 'Playful bounce effect' },
              { key: 'heartbeat', label: 'Heartbeat', desc: 'Double-tap heartbeat rhythm' },
              { key: 'shake', label: 'Shake', desc: 'Quick attention shake' },
            ] as const).map(anim => (
              <button
                key={anim.key}
                type="button"
                onClick={() => onConfigChange({ milestoneAnimationType: anim.key })}
                title={anim.desc}
                style={{
                  padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  borderRadius: 6, border: '1px solid',
                  background: (config.milestoneAnimationType ?? 'pulse') === anim.key ? '#7c3aed' : '#fff',
                  color: (config.milestoneAnimationType ?? 'pulse') === anim.key ? '#fff' : '#374151',
                  borderColor: (config.milestoneAnimationType ?? 'pulse') === anim.key ? '#7c3aed' : '#d1d5db',
                }}
              >
                {anim.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tiers List */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
            Reward Tiers ({tiers.length})
          </span>
          <button
            onClick={addTier}
            style={{
              padding: '6px 14px',
              background: '#7c3aed',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Add Tier
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tiers.map((tier, idx) => {
            const isEditing = editingTierId === tier.id;
            const iconDef = REWARD_ICONS[tier.icon] ?? REWARD_ICONS.star;

            return (
              <div
                key={tier.id}
                style={{
                  border: '1px solid ' + (isEditing ? '#c4b5fd' : '#e5e7eb'),
                  borderRadius: 10,
                  background: isEditing ? '#faf5ff' : '#fff',
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                }}
              >
                {/* Tier Header Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    const nextId = isEditing ? null : tier.id;
                    setEditingTierId(nextId);
                    emitStaging(nextId, 'label');
                  }}
                >
                  {/* Icon — always show the user-chosen tier icon */}
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: '#f3f4f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                    dangerouslySetInnerHTML={{ __html: iconDef.svg.replace('currentColor', '#6b7280') }}
                  />

                  {/* Label + Goal */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                      {tier.label || `Tier ${idx + 1}`}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>
                      {thresholdMode === 'items' ? `${tier.goal} item${tier.goal !== 1 ? 's' : ''}` : `$${tier.goal}`}
                      {normalizeTier(tier).giftProducts.length > 0 ? ` + ${normalizeTier(tier).giftProducts.length} gift${normalizeTier(tier).giftProducts.length > 1 ? 's' : ''}` : ''}
                    </div>
                  </div>

                  {/* Move + Remove (only show when expanded) */}
                  {isEditing && (
                    <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => moveTier(tier.id, 'up')}
                        disabled={idx === 0}
                        style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 0.6, fontSize: 12, padding: '2px 4px', color: '#6b7280' }}
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveTier(tier.id, 'down')}
                        disabled={idx === tiers.length - 1}
                        style={{ background: 'none', border: 'none', cursor: idx === tiers.length - 1 ? 'default' : 'pointer', opacity: idx === tiers.length - 1 ? 0.3 : 0.6, fontSize: 12, padding: '2px 4px', color: '#6b7280' }}
                      >
                        ▼
                      </button>
                      <button
                        onClick={() => removeTier(tier.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16, padding: '2px 4px', fontWeight: 700 }}
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {/* Expand/collapse chevron */}
                  <svg
                    width="16" height="16" viewBox="0 0 16 16" fill="none"
                    style={{ flexShrink: 0, color: '#9ca3af', transform: isEditing ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }}
                  >
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                {/* Expanded Edit Form */}
                {isEditing && (
                  <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid #e9d5ff' }}>
                    {/* Label */}
                    <div style={{ marginTop: 12 }}>
                      <span style={labelStyle}>Label</span>
                      <input
                        type="text"
                        value={tier.label}
                        onChange={e => updateTier(tier.id, { label: e.target.value })}
                        placeholder="e.g. Free Shipping, 2+1 FREE"
                        style={inputStyle}
                      />
                    </div>

                    {/* Goal */}
                    <div>
                      <span style={labelStyle}>
                        {thresholdMode === 'items' ? 'Items Needed' : 'Dollar Threshold ($)'}
                      </span>
                      <input
                        type="number"
                        value={tier.goal}
                        min={1}
                        onChange={e => updateTier(tier.id, { goal: Number(e.target.value) || 1 })}
                        style={{ ...inputStyle, width: 120 }}
                      />
                    </div>

                    {/* Icon Picker */}
                    <div>
                      <span style={labelStyle}>Icon</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        {Object.entries(REWARD_ICONS).map(([key, def]) => (
                          <button
                            key={key}
                            onClick={() => { updateTier(tier.id, { icon: key, customIconUrl: undefined }); setIconPickerTierId(null); }}
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 8,
                              border: '2px solid ' + (tier.icon === key && !tier.customIconUrl ? '#7c3aed' : '#e5e7eb'),
                              background: tier.icon === key && !tier.customIconUrl ? '#f5f3ff' : '#fff',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s',
                            }}
                            title={def.label}
                            dangerouslySetInnerHTML={{
                              __html: def.svg.replace('currentColor', tier.icon === key && !tier.customIconUrl ? '#7c3aed' : '#9ca3af'),
                            }}
                          />
                        ))}
                        {/* Custom icon upload */}
                        {tier.customIconUrl && (
                          <div style={{
                            width: 40, height: 40, borderRadius: 8, border: '2px solid #7c3aed',
                            background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                          }}>
                            <img src={tier.customIconUrl} alt="Custom" style={{ width: 22, height: 22, objectFit: 'contain' }} />
                            <button
                              onClick={() => updateTier(tier.id, { customIconUrl: undefined, icon: 'star' })}
                              style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%', background: '#ef4444', color: '#fff', border: 'none', fontSize: 10, cursor: 'pointer', lineHeight: '16px', padding: 0 }}
                            >×</button>
                          </div>
                        )}
                        <label
                          title="Upload custom icon (SVG or PNG, max 10KB)"
                          style={{
                            width: 40, height: 40, borderRadius: 8, border: '2px dashed #d1d5db',
                            background: '#fafafa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 18, color: '#9ca3af', transition: 'all 0.15s',
                          }}
                        >
                          +
                          <input
                            type="file"
                            accept=".svg,.png,image/svg+xml,image/png"
                            style={{ display: 'none' }}
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 10240) { alert('Icon must be under 10KB'); return; }
                              const reader = new FileReader();
                              reader.onload = () => {
                                updateTier(tier.id, { customIconUrl: reader.result as string, icon: 'custom' });
                              };
                              reader.readAsDataURL(file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Before Text */}
                    <div onFocus={() => { emitStaging(tier.id, 'before'); }}>
                      <span style={labelStyle}>Text before achieving <span style={{ color: '#9ca3af' }}>({'{remaining}'} = items left)</span></span>
                      <RichTextEditor
                        value={tier.beforeText}
                        onChange={v => updateTier(tier.id, { beforeText: v })}
                        placeholder="Add {remaining} more to unlock"
                        themeColor={messageColor || '#333333'}
                        themeFont={themeFont}
                      />
                    </div>

                    {/* After Text */}
                    <div onFocus={() => { emitStaging(tier.id, 'after'); }}>
                      <span style={labelStyle}>Text after achieving</span>
                      <RichTextEditor
                        value={tier.afterText}
                        onChange={v => updateTier(tier.id, { afterText: v })}
                        placeholder="Free shipping unlocked!"
                        themeColor={successColor || '#1a7a1a'}
                        themeFont={themeFont}
                      />
                    </div>

                    {/* Gift Products — multi-product picker with real Shopify images */}
                    <div onFocus={() => { emitStaging(tier.id, 'gift'); }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <span style={labelStyle}>Gift Products</span>
                          <div style={{ fontSize: 10, color: '#6b7280', marginTop: -2, marginBottom: 4 }}>Add gifts that unlock when this tier is reached</div>
                        </div>
                      </div>

                      {/* Gift Mode — Auto-add vs Customer Choice */}
                      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                        <button
                          onClick={() => onConfigChange({ giftCustomerChoice: false })}
                          style={{
                            flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                            border: config.giftCustomerChoice !== true ? '2px solid #7c3aed' : '1px solid #e5e7eb',
                            background: config.giftCustomerChoice !== true ? '#f5f3ff' : '#fff',
                            textAlign: 'left', transition: 'all 0.15s',
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 600, color: config.giftCustomerChoice !== true ? '#7c3aed' : '#374151' }}>Auto-add</div>
                          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>Gift is added to cart automatically</div>
                        </button>
                        <button
                          onClick={() => onConfigChange({ giftCustomerChoice: true })}
                          style={{
                            flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                            border: config.giftCustomerChoice === true ? '2px solid #7c3aed' : '1px solid #e5e7eb',
                            background: config.giftCustomerChoice === true ? '#f5f3ff' : '#fff',
                            textAlign: 'left', transition: 'all 0.15s',
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 600, color: config.giftCustomerChoice === true ? '#7c3aed' : '#374151' }}>Customer chooses</div>
                          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>Customer picks their preferred gift</div>
                        </button>
                      </div>

                      {/* Picker Title + validation — shown in Customer Choice mode */}
                      {config.giftCustomerChoice === true && (() => {
                        const gifts = normalizeTier(tier).giftProducts;
                        const choiceCount = gifts.length;
                        const needsMore = choiceCount < 2;
                        return (
                          <>
                            {needsMore && (
                              <div style={{ marginBottom: 10, padding: '10px 12px', background: '#fef3c7', borderRadius: 8, border: '1px solid #fcd34d', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 16 }}>&#9888;</span>
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e' }}>
                                    {choiceCount === 0 ? 'Add at least 2 gift options' : 'Add at least 1 more gift option'}
                                  </div>
                                  <div style={{ fontSize: 10, color: '#a16207', marginTop: 1 }}>
                                    Customers need at least 2 options to choose from
                                  </div>
                                </div>
                              </div>
                            )}
                            <div style={{ marginBottom: 10, padding: '8px 12px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
                              <span style={{ fontSize: 11, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Picker Title <span style={{ fontWeight: 400, color: '#9ca3af' }}>(shown to customer)</span></span>
                              <input
                                type="text"
                                value={config.giftPickerTitle || 'Choose your free gift'}
                                onChange={e => onConfigChange({ giftPickerTitle: e.target.value })}
                                placeholder="Choose your free gift"
                                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, color: '#374151', outline: 'none', boxSizing: 'border-box' }}
                              />
                            </div>
                                                      {/* Change button settings */}
                            <div style={{ marginBottom: 10, padding: '8px 12px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
                              <span style={{ fontSize: 11, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Change Button Text</span>
                              <input
                                type="text"
                                value={config.giftChangeText || 'Change'}
                                onChange={e => onConfigChange({ giftChangeText: e.target.value })}
                                placeholder="Change"
                                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, color: '#374151', outline: 'none', boxSizing: 'border-box' }}
                              />
                            </div>
                            <div style={{ marginBottom: 10, padding: '8px 12px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
                              <span style={{ fontSize: 11, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Change Button Color</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input
                                  type="color"
                                  value={config.giftChangeColor || '#111111'}
                                  onChange={e => onConfigChange({ giftChangeColor: e.target.value })}
                                  style={{ width: 36, height: 30, border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', padding: 2 }}
                                />
                                <span style={{ fontSize: 11, color: '#6b7280' }}>{config.giftChangeColor || '#111111'}</span>
                              </div>
                            </div>
                          </>
                        );
                      })()}

                      {/* Selected gifts list */}
                      {normalizeTier(tier).giftProducts.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                          {normalizeTier(tier).giftProducts.map((gift, gi) => (
                            <div key={gift.handle + '-' + gi} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                              {gift.imageUrl ? (
                                <img src={gift.imageUrl} alt={gift.title} style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', border: '1px solid #d1fae5', flexShrink: 0 }} />
                              ) : (
                                <div style={{ width: 44, height: 44, borderRadius: 6, background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <span dangerouslySetInnerHTML={{ __html: REWARD_ICONS.gift.svg.replace('currentColor', '#16a34a') }} style={{ width: 22, height: 22, display: 'flex' }} />
                                </div>
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gift.title}</div>
                                {gift.price && <div style={{ fontSize: 11, color: '#6b7280' }}><span style={{ textDecoration: 'line-through' }}>${gift.price}</span> → <span style={{ color: '#16a34a', fontWeight: 600 }}>Free</span></div>}
                              </div>
                              <button
                                onClick={() => {
                                  setReplacingGiftIndex(gi);
                                  setGiftSearchQuery('');
                                  setGiftSearchResults([]);
                                }}
                                style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', color: '#6b7280', fontSize: 11, padding: '4px 10px', fontWeight: 500 }}
                                title="Change this gift product"
                              >
                                Change
                              </button>
                              <button
                                onClick={() => {
                                  const updated = normalizeTier(tier).giftProducts.filter((_, i) => i !== gi);
                                  updateTier(tier.id, { giftProducts: updated, giftProduct: updated[0] ?? null });
                                  if (replacingGiftIndex === gi) setReplacingGiftIndex(null);
                                }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16, padding: '2px 6px', fontWeight: 700, lineHeight: 1 }}
                                title="Remove gift"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Replace mode banner */}
                      {replacingGiftIndex !== null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 12, color: '#1d4ed8', flex: 1 }}>
                            Search for a replacement product. Pick one below to swap it in.
                          </span>
                          <button
                            onClick={() => { setReplacingGiftIndex(null); setGiftSearchResults([]); setGiftSearchQuery(''); }}
                            style={{ background: 'none', border: '1px solid #93c5fd', borderRadius: 6, color: '#1d4ed8', fontSize: 11, padding: '3px 10px', cursor: 'pointer', fontWeight: 500 }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {/* Search to add/replace gifts */}
                      <div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            type="text"
                            value={giftSearchQuery}
                            onChange={e => setGiftSearchQuery(e.target.value)}
                            onFocus={() => { if (!giftSearchQuery.trim() && giftSearchResults.length === 0) searchGiftProducts(''); }}
                            onKeyDown={e => { if (e.key === 'Enter') searchGiftProducts(giftSearchQuery); }}
                            placeholder={replacingGiftIndex !== null ? 'Search for replacement product...' : 'Search or browse Shopify products to add as gift...'}
                            style={{ ...inputStyle, flex: 1 }}
                          />
                          <button
                            onClick={() => searchGiftProducts(giftSearchQuery)}
                            disabled={giftSearchLoading}
                            style={{ padding: '8px 14px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                          >
                            {giftSearchLoading ? '...' : 'Search'}
                          </button>
                        </div>

                        {giftSearchResults.length > 0 && (
                          <div style={{ marginTop: 6, maxHeight: 220, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                            {giftSearchResults.map((product: any) => {
                              const imgSrc = product.image?.src || product.images?.[0]?.src || '';
                              const alreadyAdded = normalizeTier(tier).giftProducts.some(g => g.handle === product.handle);
                              const firstVariant = product.variants?.[0];
                              const isHidden = product.publishedOnCurrentPublication === false;
                              const isOutOfStock = isHidden || (firstVariant?.inventoryPolicy === 'DENY' && (firstVariant?.inventoryQuantity ?? 0) <= 0);
                              return (
                                <div
                                  key={product.id}
                                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderBottom: '1px solid #f3f4f6', opacity: isOutOfStock ? 0.55 : 1 }}
                                >
                                  {imgSrc ? (
                                    <img src={imgSrc} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0, border: '1px solid #e5e7eb' }} />
                                  ) : (
                                    <div style={{ width: 40, height: 40, borderRadius: 6, background: '#f3f4f6', flexShrink: 0 }} />
                                  )}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.title}</div>
                                    {firstVariant?.price && <div style={{ fontSize: 11, color: '#6b7280' }}>${firstVariant.price}</div>}
                                    {isOutOfStock && <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 600, marginTop: 1 }}>{isHidden ? 'Not published to Online Store — publish it first' : 'Out of stock — restock before adding as gift'}</div>}
                                  </div>
                                  {alreadyAdded ? (
                                    <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Added</span>
                                  ) : isOutOfStock ? (
                                    <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, flexShrink: 0 }}>Unavailable</span>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        const normalized = normalizeTier(tier);
                                        const tierAlreadyHasGifts = normalized.giftProducts.length > 0;
                                        const hasMultipleVariants = (product.variants?.length ?? 0) > 1;

                                        // Multi-variant → open variant picker
                                        if (hasMultipleVariants) {
                                          setVariantPickerProduct({ ...product, imageUrl: imgSrc });
                                          setVariantPickerTierId(tier.id);
                                          setSelectedVariants(new Set());
                                          return;
                                        }

                                        if (tierAlreadyHasGifts || replacingGiftIndex !== null || discountsExist) {
                                          addGiftToTier(tier.id, { ...product, imageUrl: imgSrc }, product.variants?.[0]?.id ?? 0);
                                          setGiftSearchResults([]);
                                          setGiftSearchQuery('');
                                        } else {
                                          setPendingGift({
                                            product: { ...product, imageUrl: imgSrc },
                                            tierGoal: tier.goal,
                                            tierId: tier.id,
                                            isReplace: false,
                                            replaceIndex: null,
                                          });
                                        }
                                      }}
                                      style={{ padding: '5px 14px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
                                    >
                                      {replacingGiftIndex !== null ? 'Use This' : 'Add'}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {replacingGiftIndex === null && (
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                            {normalizeTier(tier).giftProducts.length === 0 ? 'Optional — search and add products that will be gifted when this tier is reached' : 'Search to add more gift products'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Gift Badge Settings — shown when tier has gifts */}
                    {normalizeTier(tier).giftProducts.length > 0 && (
                      <div onClick={() => { emitStaging(tier.id, 'gift'); }} style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: (config.giftBadgeEnabled !== false) ? 8 : 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>Gift Badge</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: '#6b7280' }}>{config.giftBadgeEnabled !== false ? 'On' : 'Off'}</span>
                            <button
                              onClick={() => onConfigChange({ giftBadgeEnabled: !(config.giftBadgeEnabled !== false) })}
                              style={{
                                position: 'relative', width: 36, height: 20, borderRadius: 10,
                                border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0,
                                background: (config.giftBadgeEnabled !== false) ? '#22c55e' : '#d1d5db',
                                transition: 'background 0.2s',
                              }}
                            >
                              <div style={{
                                position: 'absolute', top: 2, left: (config.giftBadgeEnabled !== false) ? 18 : 2,
                                width: 16, height: 16, borderRadius: 8, background: '#fff',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                              }} />
                            </button>
                          </div>
                        </div>
                        {config.giftBadgeEnabled !== false && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div>
                              <span style={labelStyle}>Badge Icon</span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                                {Object.entries(REWARD_ICONS).map(([key, icon]) => (
                                  <button
                                    key={key}
                                    type="button"
                                    onClick={() => onConfigChange({ giftBadgeIcon: key, giftBadgeCustomIconUrl: undefined })}
                                    title={icon.label}
                                    style={{
                                      width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      borderRadius: 5, cursor: 'pointer', border: '1px solid',
                                      background: (config.giftBadgeIcon ?? 'gift') === key && !config.giftBadgeCustomIconUrl ? '#7c3aed' : '#fff',
                                      borderColor: (config.giftBadgeIcon ?? 'gift') === key && !config.giftBadgeCustomIconUrl ? '#7c3aed' : '#d1d5db',
                                    }}
                                  >
                                    <span
                                      dangerouslySetInnerHTML={{ __html: icon.svg.replace('currentColor', (config.giftBadgeIcon ?? 'gift') === key && !config.giftBadgeCustomIconUrl ? '#fff' : '#6b7280') }}
                                      style={{ width: 16, height: 16, display: 'flex' }}
                                    />
                                  </button>
                                ))}
                                {config.giftBadgeCustomIconUrl && (
                                  <div style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid #7c3aed', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                    <img src={config.giftBadgeCustomIconUrl} alt="Custom" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                                    <button
                                      onClick={() => onConfigChange({ giftBadgeCustomIconUrl: undefined, giftBadgeIcon: 'gift' })}
                                      style={{ position: 'absolute', top: -5, right: -5, width: 14, height: 14, borderRadius: '50%', background: '#ef4444', color: '#fff', border: 'none', fontSize: 8, cursor: 'pointer', lineHeight: '14px', padding: 0 }}
                                    >×</button>
                                  </div>
                                )}
                                <label
                                  title="Upload custom icon (SVG or PNG, max 10KB)"
                                  style={{ width: 28, height: 28, borderRadius: 5, border: '1px dashed #d1d5db', background: '#fafafa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#9ca3af' }}
                                >
                                  +
                                  <input
                                    type="file"
                                    accept=".svg,.png,image/svg+xml,image/png"
                                    style={{ display: 'none' }}
                                    onChange={e => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      if (file.size > 10240) { alert('Icon must be under 10KB'); return; }
                                      const reader = new FileReader();
                                      reader.onload = () => { onConfigChange({ giftBadgeCustomIconUrl: reader.result as string, giftBadgeIcon: 'custom' }); };
                                      reader.readAsDataURL(file);
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 10 }}>
                              <div style={{ flex: 1 }}>
                                <span style={labelStyle}>Text Color</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <input
                                    type="color"
                                    value={config.giftBadgeTextColor ?? '#1a7a1a'}
                                    onChange={e => onConfigChange({ giftBadgeTextColor: e.target.value })}
                                    style={{ width: 28, height: 28, border: '1px solid #d1d5db', borderRadius: 4, padding: 0, cursor: 'pointer', flexShrink: 0 }}
                                  />
                                  <input
                                    type="text"
                                    value={config.giftBadgeTextColor ?? '#1a7a1a'}
                                    onChange={e => onConfigChange({ giftBadgeTextColor: e.target.value })}
                                    placeholder="#1a7a1a"
                                    style={{ ...inputStyle, flex: 1, fontSize: 11, fontFamily: 'monospace', padding: '6px 8px' }}
                                  />
                                </div>
                              </div>
                              <div style={{ flex: 1 }}>
                                <span style={labelStyle}>Background</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <input
                                    type="color"
                                    value={config.giftBadgeBgColor ?? '#edf7ed'}
                                    onChange={e => onConfigChange({ giftBadgeBgColor: e.target.value })}
                                    style={{ width: 28, height: 28, border: '1px solid #d1d5db', borderRadius: 4, padding: 0, cursor: 'pointer', flexShrink: 0 }}
                                  />
                                  <input
                                    type="text"
                                    value={config.giftBadgeBgColor ?? '#edf7ed'}
                                    onChange={e => onConfigChange({ giftBadgeBgColor: e.target.value })}
                                    placeholder="#edf7ed"
                                    style={{ ...inputStyle, flex: 1, fontSize: 11, fontFamily: 'monospace', padding: '6px 8px' }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Show Compare Price — shown when tier has gifts */}
                    {normalizeTier(tier).giftProducts.length > 0 && (
                      <div style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>Show Compare Price</span>
                            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>Show crossed-out original price next to "Free"</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: '#6b7280' }}>{config.giftShowComparePrice !== false ? 'On' : 'Off'}</span>
                            <button
                              onClick={() => onConfigChange({ giftShowComparePrice: !(config.giftShowComparePrice !== false) })}
                              style={{
                                position: 'relative', width: 36, height: 20, borderRadius: 10,
                                border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0,
                                background: (config.giftShowComparePrice !== false) ? '#22c55e' : '#d1d5db',
                                transition: 'background 0.2s',
                              }}
                            >
                              <div style={{
                                position: 'absolute', top: 2, left: (config.giftShowComparePrice !== false) ? 18 : 2,
                                width: 16, height: 16, borderRadius: 8, background: '#fff',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                              }} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Show Discount Label — shown when tier has gifts */}
                    {normalizeTier(tier).giftProducts.length > 0 && (
                      <div style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>Show Discount Label</span>
                            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>Show the discount name in the cart summary</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: '#6b7280' }}>{config.giftHideDiscountLabel !== false ? 'Off' : 'On'}</span>
                            <button
                              onClick={() => onConfigChange({ giftHideDiscountLabel: config.giftHideDiscountLabel === false ? true : false })}
                              style={{
                                position: 'relative', width: 36, height: 20, borderRadius: 10,
                                border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0,
                                background: config.giftHideDiscountLabel === false ? '#22c55e' : '#d1d5db',
                                transition: 'background 0.2s',
                              }}
                            >
                              <div style={{
                                position: 'absolute', top: 2, left: config.giftHideDiscountLabel === false ? 18 : 2,
                                width: 16, height: 16, borderRadius: 8, background: '#fff',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                              }} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}


                    {/* Free Price Label — shown when tier has gifts */}
                    {normalizeTier(tier).giftProducts.length > 0 && (
                      <div style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                        <span style={labelStyle}>Free Price Label</span>
                        <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>Text shown instead of $0.00 for discounted items</div>
                        <input
                          type="text"
                          value={config.freePriceLabel ?? 'Free'}
                          onChange={e => onConfigChange({ freePriceLabel: e.target.value })}
                          placeholder="Free"
                          style={{ ...inputStyle }}
                        />
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                          <span style={{ fontSize: 11, color: "#6b7280" }}>Color</span>
                          <input
                            type="color"
                            value={config.freePriceColor ?? "#111111"}
                            onChange={e => onConfigChange({ freePriceColor: e.target.value })}
                            style={{ width: 28, height: 28, border: "1px solid #d1d5db", borderRadius: 4, padding: 0, cursor: "pointer" }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      {/* Variant Picker Modal */}
      {variantPickerProduct && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              {variantPickerProduct.imageUrl && (
                <img src={variantPickerProduct.imageUrl} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', border: '1px solid #e5e7eb' }} />
              )}
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{variantPickerProduct.title}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Select which variant(s) to offer as gift</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button onClick={() => setSelectedVariants(new Set(variantPickerProduct.variants.map((v: any) => v.id)))} style={{ fontSize: 11, color: '#7c3aed', background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontWeight: 500 }}>Select All</button>
              <button onClick={() => setSelectedVariants(new Set())} style={{ fontSize: 11, color: '#6b7280', background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontWeight: 500 }}>Clear</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {variantPickerProduct.variants?.map((v: any) => {
                const isSel = selectedVariants.has(v.id);
                return (
                  <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, border: isSel ? '2px solid #7c3aed' : '1px solid #e5e7eb', background: isSel ? '#f5f3ff' : '#fff', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <input type="checkbox" checked={isSel} onChange={() => { const n = new Set(selectedVariants); if (isSel) n.delete(v.id); else n.add(v.id); setSelectedVariants(n); }} style={{ accentColor: '#7c3aed', width: 16, height: 16 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{v.title || 'Default'}</div>
                      {v.price && <div style={{ fontSize: 11, color: "#6b7280" }}>{"$"}{v.price}</div>}
                    </div>
                  </label>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button onClick={() => { setVariantPickerProduct(null); setVariantPickerTierId(null); }} style={{ padding: "8px 20px", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 500, color: "#374151" }}>Cancel</button>
              <button disabled={selectedVariants.size === 0} onClick={() => {
                if (!variantPickerTierId) return;
                const tier = tiers.find(t => t.id === variantPickerTierId);
                if (!tier) return;
                const norm = normalizeTier(tier);
                const img = variantPickerProduct.imageUrl || variantPickerProduct.image?.src || variantPickerProduct.images?.[0]?.src || '';
                const newGifts = Array.from(selectedVariants).map((vid) => {
                  const vr = variantPickerProduct.variants?.find((x: any) => x.id === vid);
                  const title = vr?.title && vr.title !== 'Default Title' ? variantPickerProduct.title + ' \u2014 ' + vr.title : variantPickerProduct.title;
                  return { handle: variantPickerProduct.handle, variantId: vid, title, imageUrl: img, price: vr?.price || '' };
                });
                let updated: any[];
                if (replacingGiftIndex !== null) {
                  updated = [...norm.giftProducts];
                  updated.splice(replacingGiftIndex, 1, ...newGifts);
                  setReplacingGiftIndex(null);
                } else {
                  updated = [...norm.giftProducts, ...newGifts];
                }
                updateTier(variantPickerTierId, { giftProducts: updated, giftProduct: updated[0] });
                setVariantPickerProduct(null); setVariantPickerTierId(null); setGiftSearchResults([]); setGiftSearchQuery('');
              }} style={{ padding: "8px 20px", background: selectedVariants.size === 0 ? "#d1d5db" : "#7c3aed", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: selectedVariants.size === 0 ? "not-allowed" : "pointer" }}>
                {"Add " + (selectedVariants.size > 0 ? selectedVariants.size + " Variant" + (selectedVariants.size > 1 ? "s" : "") : "Selected")}
              </button>
            </div>
          </div>
        </div>
      )}
        
{tiers.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13, background: '#f9fafb', borderRadius: 8, border: '1px dashed #d1d5db' }}>
            No reward tiers yet. Click "+ Add Tier" to create your first milestone.
          </div>
        )}
      </div>

      {/* ── Gift Discount Confirmation Modal ── */}
      {pendingGift && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => { if (!discountSyncing) setPendingGift(null); }}>
          <div style={{ background: '#1f2937', borderRadius: 12, padding: 24, maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f9fafb', marginBottom: 12 }}>
              Add Gift Product
            </div>
            <div style={{ fontSize: 13, color: '#d1d5db', lineHeight: 1.6, marginBottom: 16 }}>
              {"We'll set up this product as a "}
              <strong style={{ color: '#34d399' }}>free gift</strong>
              {" in the cart:"}
            </div>
            <div style={{ background: '#111827', borderRadius: 8, padding: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              {pendingGift.product.imageUrl ? (
                <img src={pendingGift.product.imageUrl} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', border: '1px solid #374151' }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 8, background: '#374151' }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f9fafb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pendingGift.product.title}
                </div>
                {pendingGift.product.variants?.[0]?.price && (
                  <div style={{ fontSize: 12, color: '#6b7280', textDecoration: 'line-through' }}>${pendingGift.product.variants[0].price}</div>
                )}
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#34d399' }}>FREE</span>
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16, lineHeight: 1.5 }}>
              <div style={{ marginBottom: 4 }}><strong style={{ color: '#d1d5db' }}>Automatic:</strong> Added to cart when customer qualifies</div>
              <div style={{ marginBottom: 4 }}><strong style={{ color: '#d1d5db' }}>Hidden:</strong> Customers cannot find or add it themselves</div>
              <div><strong style={{ color: '#d1d5db' }}>Product link:</strong> Goes to the original product page</div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setPendingGift(null)}
                disabled={discountSyncing}
                style={{ padding: '8px 16px', background: 'transparent', color: '#9ca3af', border: '1px solid #374151', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const pg = pendingGift;
                  const newGift = { handle: pg.product.handle, variantId: pg.product.variants?.[0]?.id ?? 0, title: pg.product.title, imageUrl: pg.product.imageUrl, price: pg.product.variants?.[0]?.price || '' };
                  const tierObj = tiers.find(t => t.id === pg.tierId);
                  if (!tierObj) return;
                  const normalized = normalizeTier(tierObj);
                  let updated: any[];
                  if (pg.isReplace && pg.replaceIndex !== null) {
                    updated = [...normalized.giftProducts];
                    updated[pg.replaceIndex] = newGift;
                    setReplacingGiftIndex(null);
                  } else {
                    updated = [...normalized.giftProducts, newGift];
                  }
                  updateTier(pg.tierId, { giftProducts: updated, giftProduct: updated[0] });
                  setPendingGift(null);
                  setDiscountsExist(true); // User acknowledged — skip modal for subsequent gifts
                  setGiftSearchResults([]);
                  setGiftSearchQuery('');
                }}
                style={{ padding: '8px 20px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Confirm & Add Gift
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Save/Discard wrapper ─────────────────────────────────────────────
   Holds a local draft. Preview updates instantly, DB saves on "Save". */

interface WithSaveProps {
  savedConfig: Record<string, any>;
  onSave: (fullConfig: Record<string, any>) => void;
  onPreviewChange: (draftConfig: Record<string, any>) => void;
  storeId: string;
  configTarget?: 'demo' | 'live';
  successColor?: string;
  messageColor?: string;
  themeFont?: string;
  /** Called when the editing context changes — tells the preview what scenario to stage */
  onStagingChange?: (hint: StagingHint | null) => void;
}

export function RewardsTierEditorWithSave({ savedConfig, onSave, onPreviewChange, storeId, configTarget, successColor, messageColor, themeFont, onStagingChange }: WithSaveProps) {
  // Migrate plain text → colorized HTML on initial load (both draft AND saved baseline)
  const migrateColors = useCallback((config: Record<string, any>) => {
    const sColor = successColor || '#1a7a1a';
    const mColor = messageColor || '#333333';
    const migrated = { ...config };
    if (migrated.allRewardsUnlockedText) {
      migrated.allRewardsUnlockedText = applyDefaultColor(migrated.allRewardsUnlockedText, sColor);
    }
    if (migrated.tiers) {
      migrated.tiers = migrated.tiers.map((t: any) => ({
        ...t,
        beforeText: t.beforeText ? applyDefaultColor(t.beforeText, mColor) : t.beforeText,
        afterText: t.afterText ? applyDefaultColor(t.afterText, sColor) : t.afterText,
      }));
    }
    return migrated;
  }, [successColor, messageColor]);

  const [draft, setDraft] = useState<Record<string, any>>(() => migrateColors({ ...savedConfig }));
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const savedRef = useRef(migrateColors(savedConfig));
  // Snapshot of what was ACTUALLY saved (persisted to DB) — not polluted by preview updates
  const savedJsonRef = useRef(JSON.stringify(migrateColors(savedConfig)));
  // Track whether we are the source of preview updates (to ignore our own prop changes)
  const isPreviewingRef = useRef(false);

  useEffect(() => {
    // Only update saved snapshot from external saves (not from our own preview updates)
    if (isPreviewingRef.current) return;
    const migrated = migrateColors(savedConfig);
    const newJson = JSON.stringify(migrated);
    if (newJson !== savedJsonRef.current) {
      savedRef.current = migrated;
      savedJsonRef.current = newJson;
      if (!hasChanges) setDraft({ ...migrated });
    }
  }, [savedConfig, hasChanges, migrateColors]);

  const handleConfigChange = useCallback((patch: Record<string, any>) => {
    setDraft(prev => {
      const next = { ...prev, ...patch };
      isPreviewingRef.current = true;
      onPreviewChange(next);
      // Reset after React processes the preview update
      setTimeout(() => { isPreviewingRef.current = false; }, 0);
      // Compare draft to saved snapshot for undo detection
      setHasChanges(JSON.stringify(next) !== savedJsonRef.current);
      return next;
    });
  }, [onPreviewChange]);

  const [discountStatus, setDiscountStatus] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    onSave(draft);
    savedRef.current = draft;
    savedJsonRef.current = JSON.stringify(draft);
    setHasChanges(false);

    // Sync gift discounts with Shopify after saving config
    const hasGifts = (draft.tiers ?? []).some((t: any) => {
      const gifts = t.giftProducts ?? (t.giftProduct ? [t.giftProduct] : []);
      return gifts.length > 0;
    });

    if (hasGifts && storeId) {
      setDiscountStatus('Setting up gift products...');
      try {
        const res = await fetch(`/api/stores/${storeId}/gift-discounts${configTarget ? '?target=' + configTarget : ''}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tiers: draft.tiers ?? [] }),
        });
        const data = await res.json();
        if (data.success) {
          const count = data.created ?? data.duplicates?.length ?? 0;
          setDiscountStatus(`${count} gift product${count !== 1 ? 's' : ''} synced`);
        } else {
          setDiscountStatus('Gift setup failed: ' + (data.error || 'unknown'));
        }
      } catch (e) {
        setDiscountStatus('Gift setup failed');
      }
      setTimeout(() => setDiscountStatus(null), 3000);
    }

    setTimeout(() => setSaving(false), 400);
  }

  function handleDiscard() {
    const saved = { ...savedRef.current };
    setDraft(saved);
    isPreviewingRef.current = true;
    onPreviewChange(saved);
    setTimeout(() => { isPreviewingRef.current = false; }, 0);
    onStagingChange?.(null);
    setHasChanges(false);
  }

  // When staging hint changes, push current draft (with migrated colors) to
  // the preview so the parent's addon config matches the editor immediately.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const handleStagingChange = useCallback((hint: StagingHint | null) => {
    isPreviewingRef.current = true;
    onPreviewChange(draftRef.current);
    setTimeout(() => { isPreviewingRef.current = false; }, 0);
    onStagingChange?.(hint);
  }, [onPreviewChange, onStagingChange]);

  return (
    <div>
      <RewardsTierEditor config={draft} onConfigChange={handleConfigChange} storeId={storeId} successColor={successColor} messageColor={messageColor} themeFont={themeFont} onStagingChange={handleStagingChange} />
      {hasChanges && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, padding: '12px 14px', background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 10, alignItems: 'center' }}>
          <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#92400e' }}>Unsaved changes</div>
          <button onClick={handleDiscard} style={{ padding: '8px 18px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', color: '#374151' }}>
            Discard
          </button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 22px', background: '#7c3aed', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
      {discountStatus && (
        <div style={{ marginTop: 8, padding: '8px 14px', background: discountStatus.includes('failed') ? '#fef2f2' : '#f0fdf4', border: '1px solid ' + (discountStatus.includes('failed') ? '#fecaca' : '#bbf7d0'), borderRadius: 8, fontSize: 12, color: discountStatus.includes('failed') ? '#dc2626' : '#16a34a', fontWeight: 500 }}>
          {discountStatus}
        </div>
      )}
    </div>
  );
}
