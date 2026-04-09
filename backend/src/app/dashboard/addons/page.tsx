'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Constants ──────────────────────────────────────────────────────────────

const STORE_ID = 'cmnriegez0000jc70ro9nltw2';
const API = '';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AddonDimension {
  key: string;
  label: string;
  type: 'select' | 'text' | 'number' | 'checkboxes' | 'toggle';
  testable: boolean;
  options?: { value: string; label: string }[];
  checkboxOptions?: { value: string; label: string }[];
  default: any;
  min?: number;
  max?: number;
  placeholder?: string;
}

interface AddonDefinition {
  key: string;
  label: string;
  icon: string;
  description: string;
  estimatedImpact: string;
  impactMetric: string;
  dimensions: AddonDimension[];
  defaultConfig: Record<string, any>;
}

interface AddonState {
  enabled: boolean;
  mode: 'off' | 'locked' | 'auto-optimize';
  config: Record<string, any>;
  optimizeState: {
    queuePosition: number;
    step?: number;
    totalSteps?: number;
    status?: string;
  } | null;
  results: any;
}

// ─── ModeToggle Component ───────────────────────────────────────────────────

function ModeToggle({
  mode,
  onModeChange,
  disabled,
}: {
  mode: string;
  onModeChange: (m: string) => void;
  disabled?: boolean;
}) {
  const segments: { key: string; label: string; color: string }[] = [
    { key: 'off', label: 'Off', color: '#6b7280' },
    { key: 'auto-optimize', label: 'Optimize', color: '#22c55e' },
    { key: 'locked', label: 'Lock', color: '#3b82f6' },
  ];

  return (
    <div
      style={{
        display: 'inline-flex',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        overflow: 'hidden',
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
      }}
    >
      {segments.map((seg) => {
        const active = mode === seg.key;
        return (
          <button
            key={seg.key}
            onClick={() => onModeChange(seg.key)}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: active ? seg.color : '#f3f4f6',
              color: active ? '#fff' : '#9ca3af',
              transition: 'all 0.15s',
            }}
          >
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Page Component ────────────────────────────────────────────────────

export default function AddonsPage() {
  const [addons, setAddons] = useState<Record<string, AddonState>>({});
  const [definitions, setDefinitions] = useState<AddonDefinition[]>([]);
  const [optimizeQueue, setOptimizeQueue] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // ── Data fetching ───────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        API + '/api/stores/' + STORE_ID + '/addons',
      );
      if (res.ok) {
        const json = await res.json();
        setAddons(json.addons ?? {});
        setDefinitions(json.definitions ?? []);
        setOptimizeQueue(json.optimizeQueue ?? []);
      }
    } catch (e) {
      console.error('Failed to load addons', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── API helpers ─────────────────────────────────────────────────────────

  async function patchAddon(key: string, data: any) {
    setSaving((s) => ({ ...s, [key]: true }));
    try {
      const res = await fetch(API + '/api/stores/' + STORE_ID + '/addons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addonKey: key, ...data }),
      });
      const json = await res.json();
      setAddons(json.addons ?? {});
      setOptimizeQueue(json.optimizeQueue ?? []);
    } catch (e) {
      console.error('Failed to patch addon', e);
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  }

  async function applyRecommended() {
    setLoading(true);
    try {
      const res = await fetch(
        API + '/api/stores/' + STORE_ID + '/addons/apply-recommended',
        { method: 'POST' },
      );
      if (res.ok) {
        await load();
      }
    } catch (e) {
      console.error('Failed to apply recommended', e);
    } finally {
      setLoading(false);
    }
  }

  function handleModeChange(key: string, newMode: string) {
    if (newMode === 'off') {
      patchAddon(key, { enabled: false, mode: 'off' });
    } else if (newMode === 'auto-optimize') {
      patchAddon(key, { enabled: true, mode: 'auto-optimize' });
    } else if (newMode === 'locked') {
      patchAddon(key, { enabled: true, mode: 'locked' });
    }
  }

  // ── Derived state ───────────────────────────────────────────────────────

  const activeCount = Object.values(addons).filter((a) => a.enabled).length;
  const optimizingCount = Object.values(addons).filter(
    (a) => a.mode === 'auto-optimize',
  ).length;
  const allDisabled = activeCount === 0 && definitions.length > 0;

  // Sort: enabled first (auto-optimize > locked > on), then disabled
  const sortedDefs = [...definitions].sort((a, b) => {
    const aa = addons[a.key];
    const bb = addons[b.key];
    const scoreA = !aa?.enabled
      ? 0
      : aa.mode === 'auto-optimize'
        ? 3
        : aa.mode === 'locked'
          ? 2
          : 1;
    const scoreB = !bb?.enabled
      ? 0
      : bb.mode === 'auto-optimize'
        ? 3
        : bb.mode === 'locked'
          ? 2
          : 1;
    return scoreB - scoreA;
  });

  // ── Render helpers ────────────────────────────────────────────────────

  function renderDimensionControl(
    addonKey: string,
    dim: AddonDimension,
    config: Record<string, any>,
  ) {
    const val = config[dim.key] ?? dim.default;
    const inputStyle: React.CSSProperties = {
      width: '100%',
      padding: '8px 12px',
      background: '#fafafa',
      border: '1px solid #d1d5db',
      borderRadius: 6,
      color: '#111827',
      fontSize: 13,
      boxSizing: 'border-box' as const,
    };

    switch (dim.type) {
      case 'select':
        return (
          <select
            value={val}
            onChange={(e) =>
              patchAddon(addonKey, {
                config: { [dim.key]: e.target.value },
              })
            }
            style={inputStyle}
          >
            {(dim.options ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'text':
        return (
          <input
            type="text"
            value={val ?? ''}
            placeholder={dim.placeholder}
            onChange={(e) =>
              patchAddon(addonKey, {
                config: { [dim.key]: e.target.value },
              })
            }
            style={inputStyle}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={val ?? ''}
            min={dim.min}
            max={dim.max}
            placeholder={dim.placeholder}
            onChange={(e) =>
              patchAddon(addonKey, {
                config: { [dim.key]: Number(e.target.value) },
              })
            }
            style={inputStyle}
          />
        );

      case 'toggle':
        return (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={!!val}
              onChange={(e) =>
                patchAddon(addonKey, {
                  config: { [dim.key]: e.target.checked },
                })
              }
              style={{ width: 16, height: 16 }}
            />
            <span style={{ fontSize: 13, color: '#374151' }}>
              {val ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        );

      case 'checkboxes': {
        const current: string[] = Array.isArray(val) ? val : [];
        const opts = dim.checkboxOptions ?? dim.options ?? [];
        return (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap' as const,
              gap: 8,
            }}
          >
            {opts.map((opt) => {
              const checked = current.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    cursor: 'pointer',
                    fontSize: 12,
                    color: '#374151',
                    padding: '4px 8px',
                    background: checked ? '#f0f9ff' : '#f9fafb',
                    border:
                      '1px solid ' + (checked ? '#93c5fd' : '#e5e7eb'),
                    borderRadius: 6,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...current, opt.value]
                        : current.filter((v) => v !== opt.value);
                      patchAddon(addonKey, {
                        config: { [dim.key]: next },
                      });
                    }}
                    style={{ width: 14, height: 14 }}
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        );
      }

      default:
        return null;
    }
  }

  // ── Loading state ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f9fafb',
        }}
      >
        <div style={{ fontSize: 16, color: '#6b7280' }}>
          Loading addons...
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f9fafb',
        color: '#111827',
        padding: '24px 32px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 28,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                margin: 0,
                color: '#111827',
              }}
            >
              Cart Addons
            </h1>
            <p
              style={{
                color: '#9ca3af',
                margin: '4px 0 0',
                fontSize: 13,
              }}
            >
              Toggle features on/off. Auto-Optimize lets AI test variations.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 500,
                background: activeCount > 0 ? '#dcfce7' : '#f3f4f6',
                color: activeCount > 0 ? '#166534' : '#6b7280',
                borderRadius: 20,
              }}
            >
              {activeCount} active
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 500,
                background: optimizingCount > 0 ? '#f0fdf4' : '#f3f4f6',
                color: optimizingCount > 0 ? '#15803d' : '#6b7280',
                borderRadius: 20,
              }}
            >
              {optimizingCount} optimizing
            </span>
          </div>
        </div>

        {/* ── Recommended Setup Banner ─────────────────────────────── */}
        {allDisabled && (
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 20,
              marginBottom: 20,
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  margin: 0,
                  color: '#111827',
                }}
              >
                Get started fast
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: '#6b7280',
                  margin: '4px 0 0',
                }}
              >
                Enable Trust Badges + Free Shipping Bar + Scarcity Timer with
                Auto-Optimize
              </p>
            </div>
            <button
              onClick={applyRecommended}
              style={{
                padding: '9px 20px',
                background: '#22c55e',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
                whiteSpace: 'nowrap' as const,
              }}
            >
              Apply Recommended
            </button>
          </div>
        )}

        {/* ── Optimization Queue ───────────────────────────────────── */}
        {optimizeQueue.length > 0 && (
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 16,
              marginBottom: 20,
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#6b7280',
                marginBottom: 10,
                textTransform: 'uppercase' as const,
                letterSpacing: 0.5,
              }}
            >
              Optimization Queue
            </div>
            <div
              style={{
                display: 'flex',
                gap: 8,
                overflowX: 'auto' as const,
              }}
            >
              {optimizeQueue.map((key, idx) => {
                const def = definitions.find((d) => d.key === key);
                const label = def?.label ?? key;
                return (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 14px',
                      background: idx === 0 ? '#f0fdf4' : '#f9fafb',
                      border:
                        '1px solid ' +
                        (idx === 0 ? '#bbf7d0' : '#e5e7eb'),
                      borderRadius: 8,
                      whiteSpace: 'nowrap' as const,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{def?.icon ?? ''}</span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: '#374151',
                      }}
                    >
                      {label}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: idx === 0 ? '#16a34a' : '#9ca3af',
                        background: idx === 0 ? '#dcfce7' : '#f3f4f6',
                        padding: '2px 8px',
                        borderRadius: 12,
                      }}
                    >
                      {idx === 0 ? 'Testing now' : 'Queue #' + (idx + 1)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Addon Cards ──────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column' as const,
            gap: 12,
          }}
        >
          {sortedDefs.map((def) => {
            const addon: AddonState = addons[def.key] ?? {
              enabled: false,
              mode: 'off',
              config: { ...def.defaultConfig },
              optimizeState: null,
              results: null,
            };
            const isExpanded = expanded === def.key;
            const isSaving = saving[def.key] ?? false;

            const borderColor =
              addon.mode === 'auto-optimize'
                ? '#22c55e'
                : addon.mode === 'locked'
                  ? '#3b82f6'
                  : '#e5e7eb';
            const borderWidth =
              addon.mode === 'auto-optimize' || addon.mode === 'locked'
                ? 2
                : 1;

            const badgeColor =
              addon.mode === 'auto-optimize'
                ? '#22c55e'
                : addon.mode === 'locked'
                  ? '#3b82f6'
                  : '#9ca3af';
            const badgeLabel =
              addon.mode === 'auto-optimize'
                ? 'Auto-Optimize'
                : addon.mode === 'locked'
                  ? 'Locked'
                  : 'Off';

            return (
              <div
                key={def.key}
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  border: borderWidth + 'px solid ' + borderColor,
                  padding: 16,
                  opacity: addon.enabled ? 1 : 0.6,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  transition: 'all 0.2s',
                }}
              >
                {/* ── Collapsed Row ──────────────────────────────── */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  {/* Icon */}
                  <span style={{ fontSize: 24, flexShrink: 0 }}>
                    {def.icon}
                  </span>

                  {/* Name + badge + impact */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: '#111827',
                        }}
                      >
                        {def.label}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 12,
                          background: badgeColor + '18',
                          color: badgeColor,
                          textTransform: 'uppercase' as const,
                          letterSpacing: 0.3,
                        }}
                      >
                        {badgeLabel}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: '#9ca3af',
                        marginTop: 2,
                      }}
                    >
                      {def.estimatedImpact}
                    </div>
                  </div>

                  {/* Edit link */}
                  <button
                    onClick={() =>
                      setExpanded(isExpanded ? null : def.key)
                    }
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 500,
                      color: '#3b82f6',
                      padding: '4px 8px',
                      flexShrink: 0,
                    }}
                  >
                    {isExpanded ? 'Collapse' : 'Edit'}
                  </button>

                  {/* 3-way toggle */}
                  <ModeToggle
                    mode={addon.mode}
                    onModeChange={(m) => handleModeChange(def.key, m)}
                    disabled={isSaving}
                  />
                </div>

                {/* ── Expanded Section ───────────────────────────── */}
                {isExpanded && (
                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 16,
                      borderTop: '1px solid #f3f4f6',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 24,
                    }}
                  >
                    {/* Left: Preview placeholder */}
                    <div
                      style={{
                        background: '#f9fafb',
                        border: '1px solid #e5e7eb',
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 220,
                        color: '#9ca3af',
                        fontSize: 14,
                        fontWeight: 500,
                      }}
                    >
                      Preview
                    </div>

                    {/* Right: Edit controls */}
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column' as const,
                          gap: 14,
                        }}
                      >
                        {def.dimensions.map((dim) => (
                          <div key={dim.key}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                marginBottom: 4,
                              }}
                            >
                              <label
                                style={{
                                  fontSize: 12,
                                  fontWeight: 500,
                                  color: '#374151',
                                }}
                              >
                                {dim.label}
                              </label>
                              {!dim.testable && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    padding: '1px 6px',
                                    borderRadius: 8,
                                    background: '#fef3c7',
                                    color: '#92400e',
                                    fontWeight: 500,
                                  }}
                                >
                                  Never A/B tested
                                </span>
                              )}
                            </div>
                            {renderDimensionControl(
                              def.key,
                              dim,
                              addon.config,
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Mode buttons at bottom */}
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          marginTop: 20,
                        }}
                      >
                        <button
                          onClick={() =>
                            handleModeChange(def.key, 'auto-optimize')
                          }
                          disabled={isSaving}
                          style={{
                            padding: '8px 18px',
                            background:
                              addon.mode === 'auto-optimize'
                                ? '#16a34a'
                                : '#22c55e',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            cursor: isSaving ? 'default' : 'pointer',
                            fontWeight: 600,
                            fontSize: 13,
                            opacity:
                              addon.mode === 'auto-optimize' ? 0.7 : 1,
                          }}
                        >
                          Auto-Optimize
                        </button>
                        <button
                          onClick={() =>
                            handleModeChange(def.key, 'locked')
                          }
                          disabled={isSaving}
                          style={{
                            padding: '8px 18px',
                            background:
                              addon.mode === 'locked'
                                ? '#2563eb'
                                : '#3b82f6',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            cursor: isSaving ? 'default' : 'pointer',
                            fontWeight: 600,
                            fontSize: 13,
                            opacity: addon.mode === 'locked' ? 0.7 : 1,
                          }}
                        >
                          Lock
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 32,
            padding: 16,
            textAlign: 'center' as const,
            color: '#d1d5db',
            fontSize: 11,
          }}
        >
          Eliminai Cart Optimizer
        </div>
      </div>
    </div>
  );
}
