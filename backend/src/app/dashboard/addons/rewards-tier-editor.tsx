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
  // Track which tier+field is being explicitly previewed via "Preview in cart" button
  const [previewingKey, setPreviewingKey] = useState<string | null>(null);

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

  // Toggle explicit preview for a specific tier+field (e.g. gift products)
  const togglePreview = useCallback((tierId: string, field: StagingHint['field']) => {
    const key = `${tierId}:${field}`;
    if (previewingKey === key) {
      // Hide preview — go back to whatever the current editing context is
      setPreviewingKey(null);
      emitStaging(editingTierId, 'label');
    } else {
      setPreviewingKey(key);
      emitStaging(tierId, field);
    }
  }, [previewingKey, emitStaging, editingTierId]);

  const [iconPickerTierId, setIconPickerTierId] = useState<string | null>(null);
  const [giftSearchQuery, setGiftSearchQuery] = useState('');
  const [giftSearchResults, setGiftSearchResults] = useState<any[]>([]);
  const [giftSearchLoading, setGiftSearchLoading] = useState(false);
  // "replace mode" — when set, the next product picked replaces this gift index instead of appending
  const [replacingGiftIndex, setReplacingGiftIndex] = useState<number | null>(null);

  function updateTiers(newTiers: RewardTier[]) {
    onConfigChange({ tiers: newTiers });
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
        if (gift.handle && !gift.imageUrl) {
          fetch(`/api/stores/${storeId}/products/search?q=${encodeURIComponent(gift.title || gift.handle)}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (!data?.products?.length) return;
              const match = data.products.find((p: any) => p.handle === gift.handle) || data.products[0];
              const imgUrl = match?.image?.src || match?.images?.[0]?.src;
              if (imgUrl) {
                const updated = [...tier.giftProducts];
                updated[gi] = { ...updated[gi], imageUrl: imgUrl };
                updateTier(tier.id, { giftProducts: updated, giftProduct: updated[0] });
              }
            })
            .catch(() => {});
        }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  async function searchGiftProducts(query: string) {
    if (!query.trim() || !storeId) return;
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
  }

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
                    setPreviewingKey(null);
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
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {Object.entries(REWARD_ICONS).map(([key, def]) => (
                          <button
                            key={key}
                            onClick={() => { updateTier(tier.id, { icon: key }); setIconPickerTierId(null); }}
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 8,
                              border: '2px solid ' + (tier.icon === key ? '#7c3aed' : '#e5e7eb'),
                              background: tier.icon === key ? '#f5f3ff' : '#fff',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s',
                            }}
                            title={def.label}
                            dangerouslySetInnerHTML={{
                              __html: def.svg.replace('currentColor', tier.icon === key ? '#7c3aed' : '#9ca3af'),
                            }}
                          />
                        ))}
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={labelStyle}>Gift Products (auto-added to cart when tier is reached)</span>
                        {normalizeTier(tier).giftProducts.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); togglePreview(tier.id, 'gift'); }}
                            style={{
                              padding: '3px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                              border: '1px solid', borderRadius: 6, lineHeight: '18px',
                              ...(previewingKey === `${tier.id}:gift`
                                ? { background: '#7c3aed', color: '#fff', borderColor: '#7c3aed' }
                                : { background: '#fff', color: '#6b7280', borderColor: '#d1d5db' }),
                            }}
                          >
                            {previewingKey === `${tier.id}:gift` ? 'Hide preview' : 'Preview in cart'}
                          </button>
                        )}
                      </div>

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
                            onKeyDown={e => { if (e.key === 'Enter') searchGiftProducts(giftSearchQuery); }}
                            placeholder={replacingGiftIndex !== null ? 'Search for replacement product...' : 'Search Shopify products to add as gift...'}
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
                              return (
                                <div
                                  key={product.id}
                                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}
                                >
                                  {imgSrc ? (
                                    <img src={imgSrc} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0, border: '1px solid #e5e7eb' }} />
                                  ) : (
                                    <div style={{ width: 40, height: 40, borderRadius: 6, background: '#f3f4f6', flexShrink: 0 }} />
                                  )}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.title}</div>
                                    {product.variants?.[0]?.price && <div style={{ fontSize: 11, color: '#6b7280' }}>${product.variants[0].price}</div>}
                                  </div>
                                  {alreadyAdded ? (
                                    <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Added</span>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        const newGift = { handle: product.handle, variantId: product.variants?.[0]?.id ?? 0, title: product.title, imageUrl: imgSrc };
                                        let updated: any[];
                                        if (replacingGiftIndex !== null) {
                                          updated = [...normalizeTier(tier).giftProducts];
                                          updated[replacingGiftIndex] = newGift;
                                          setReplacingGiftIndex(null);
                                        } else {
                                          updated = [...normalizeTier(tier).giftProducts, newGift];
                                        }
                                        updateTier(tier.id, { giftProducts: updated, giftProduct: updated[0] });
                                        setGiftSearchResults([]);
                                        setGiftSearchQuery('');
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
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {tiers.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13, background: '#f9fafb', borderRadius: 8, border: '1px dashed #d1d5db' }}>
            No reward tiers yet. Click "+ Add Tier" to create your first milestone.
          </div>
        )}
      </div>
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
  successColor?: string;
  messageColor?: string;
  themeFont?: string;
  /** Called when the editing context changes — tells the preview what scenario to stage */
  onStagingChange?: (hint: StagingHint | null) => void;
}

export function RewardsTierEditorWithSave({ savedConfig, onSave, onPreviewChange, storeId, successColor, messageColor, themeFont, onStagingChange }: WithSaveProps) {
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
      setDiscountStatus('Syncing gift discounts...');
      try {
        const res = await fetch(`/api/stores/${storeId}/gift-discounts`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          const count = data.discounts?.filter((d: any) => !d.error).length ?? 0;
          setDiscountStatus(`${count} gift discount${count !== 1 ? 's' : ''} synced`);
        } else {
          setDiscountStatus('Discount sync failed: ' + (data.error || 'unknown'));
        }
      } catch (e) {
        setDiscountStatus('Discount sync failed');
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
