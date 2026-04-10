'use client';

import { useState, useEffect, useCallback } from 'react';
import AddonPreview from './addon-preview';
import { useStore } from '@/lib/hooks/use-store';

// ─── Constants ──────────────────────────────────────────────────────────────

// STORE_ID is now resolved dynamically via useStore() hook
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

function CapsuleToggle({
  on,
  onChange,
  disabled,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!on)}
      style={{
        position: 'relative',
        width: 44,
        height: 24,
        borderRadius: 12,
        border: 'none',
        background: on ? '#22c55e' : '#d1d5db',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
        padding: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 22 : 2,
          width: 20,
          height: 20,
          borderRadius: 10,
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'left 0.2s',
        }}
      />
    </button>
  );
}

// ─── Main Page Component ────────────────────────────────────────────────────

export default function AddonsPage() {
  const { storeId: STORE_ID, loading: storeLoading, error: storeError } = useStore();


  const [addons, setAddons] = useState<Record<string, AddonState>>({});
  const [definitions, setDefinitions] = useState<AddonDefinition[]>([]);
  const [optimizeQueue, setOptimizeQueue] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // ── Autopilot state ──────────────────────────────────────────────────────
  const [autopilot, setAutopilot] = useState<{
    enabled: boolean;
    queue: string[];
    completedCount: number;
    totalLift: number;
    currentTestSlot?: string;
  } | null>(null);
  const [autopilotLoading, setAutopilotLoading] = useState(false);

  // ── Post-winner modal state ──────────────────────────────────────────────
  const [winnerModal, setWinnerModal] = useState<{
    experimentId: string;
    experimentName: string;
    slot: string;
    liftPercent: number;
    winnerLabel: string;
  } | null>(null);
  const [winnerActionLoading, setWinnerActionLoading] = useState(false);

  // ── Edit-triggers-test modal state ───────────────────────────────────────
  const [editTestModal, setEditTestModal] = useState<{
    type: 'suggest-test' | 'hard-block';
    addonKey: string;
    addonLabel: string;
    runningTestName?: string;
    pendingData?: any;
  } | null>(null);

  // ── Time estimate state (per experiment) ────────────────────────────────
  const [timeEstimates, setTimeEstimates] = useState<Record<string, {
    estimatedDaysRemaining: number;
    dailyEventRate: number;
    requiredSamples: number;
    currentSamples: number;
  }>>({});

  // ── Experiment data for timeline notes ──────────────────────────────────
  const [experiments, setExperiments] = useState<any[]>([]);
  const [logEventInput, setLogEventInput] = useState<Record<string, string>>({});
  const [showLogEvent, setShowLogEvent] = useState<Record<string, boolean>>({});

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

  // ── Fetch autopilot state ───────────────────────────────────────────────
  const loadAutopilot = useCallback(async () => {
    if (!STORE_ID) return;
    try {
      const res = await fetch(API + '/api/stores/' + STORE_ID + '/autopilot');
      if (res.ok) {
        const json = await res.json();
        setAutopilot(json.autopilot);
      }
    } catch (e) { console.error('Failed to load autopilot', e); }
  }, [STORE_ID]);

  // ── Fetch experiments for time estimates + timeline ──────────────────────
  const loadExperiments = useCallback(async () => {
    if (!STORE_ID) return;
    try {
      const res = await fetch(API + '/api/stores/' + STORE_ID + '/addons/experiments');
      if (res.ok) {
        const json = await res.json();
        const exps = json.experiments || [];
        setExperiments(exps);
        const estimates: Record<string, any> = {};
        for (const exp of exps) {
          if (exp.estimatedDaysRemaining != null) {
            estimates[exp.id] = {
              estimatedDaysRemaining: exp.estimatedDaysRemaining,
              dailyEventRate: exp.dailyEventRate || 0,
              requiredSamples: exp.requiredSamples || 0,
              currentSamples: exp.currentSamples || 0,
            };
          }
        }
        setTimeEstimates(estimates);
      }
    } catch (e) { console.error('Failed to load experiments', e); }
  }, [STORE_ID]);

  useEffect(() => {
    load();
    loadAutopilot();
    loadExperiments();
  }, [load, loadAutopilot, loadExperiments]);

  // ── Early returns (MUST be after all hooks) ────────────────────────────
  if (storeLoading) return <div style={{padding: 40, textAlign: 'center'}}>Loading store...</div>;
  if (storeError || !STORE_ID) return <div style={{padding: 40, textAlign: 'center', color: '#ef4444'}}>Store not found. Please install the app from Shopify.</div>;

  // ── Autopilot toggle ────────────────────────────────────────────────────

  async function toggleAutopilot(enabled: boolean) {
    if (!STORE_ID) return;
    setAutopilotLoading(true);
    try {
      const res = await fetch(API + '/api/stores/' + STORE_ID + '/autopilot', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        const json = await res.json();
        setAutopilot(json.autopilot);
      }
    } catch (e) { console.error('Failed to toggle autopilot', e); }
    finally { setAutopilotLoading(false); }
  }

  // ── Post-winner actions ────────────────────────────────────────────────

  async function applyWinner(experimentId: string) {
    if (!STORE_ID) return;
    setWinnerActionLoading(true);
    try {
      await fetch(API + '/api/stores/' + STORE_ID + '/addons/test/apply-winner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experimentId }),
      });
      setWinnerModal(null);
      load();
      loadExperiments();
    } catch (e) { console.error('Failed to apply winner', e); }
    finally { setWinnerActionLoading(false); }
  }

  // ── Log user event to experiment timeline ──────────────────────────────

  async function logUserEvent(experimentId: string) {
    if (!STORE_ID) return;
    const note = logEventInput[experimentId]?.trim();
    if (!note) return;
    try {
      await fetch(API + '/api/stores/' + STORE_ID + '/experiments/' + experimentId + '/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      setLogEventInput(prev => ({ ...prev, [experimentId]: '' }));
      setShowLogEvent(prev => ({ ...prev, [experimentId]: false }));
      loadExperiments();
    } catch (e) { console.error('Failed to log event', e); }
  }

  // ── Edit-triggers-test: intercept save ─────────────────────────────────

  async function patchAddonWithSafety(key: string, data: any) {
    if (!STORE_ID) return;
    // First try a dry-run to check risk
    const res = await fetch(API + '/api/stores/' + STORE_ID + '/addons', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addonKey: key, ...data }),
    });
    if (res.status === 409) {
      // Hard block — active test on same slot
      const json = await res.json();
      const def = definitions.find(d => d.key === key);
      setEditTestModal({
        type: 'hard-block',
        addonKey: key,
        addonLabel: def?.label || key,
        runningTestName: json.runningTest,
        pendingData: data,
      });
      return;
    }
    const json = await res.json();
    if (json.changeRisk === 'medium') {
      // Soft warning — show but proceed
      console.log('Medium risk change applied:', json);
    }
    setAddons(json.addons ?? {});
    setOptimizeQueue(json.optimizeQueue ?? []);
    loadExperiments();
  }

  async function forceAddonSave(key: string, data: any, options?: { pauseTest?: boolean; resetTest?: boolean }) {
    if (!STORE_ID) return;
    setSaving(s => ({ ...s, [key]: true }));
    try {
      const res = await fetch(API + '/api/stores/' + STORE_ID + '/addons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addonKey: key, ...data, force: true,
          pauseTest: options?.pauseTest,
          resetTest: options?.resetTest,
        }),
      });
      const json = await res.json();
      setAddons(json.addons ?? {});
      setOptimizeQueue(json.optimizeQueue ?? []);
      setEditTestModal(null);
      loadExperiments();
    } catch (e) { console.error('Failed to force save', e); }
    finally { setSaving(s => ({ ...s, [key]: false })); }
  }

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

        {/* ── Autopilot Banner ───────────────────────────────────── */}
        <div
          style={{
            background: autopilot?.enabled ? 'linear-gradient(135deg, #f0fdf4, #ecfdf5)' : '#fff',
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
            border: '1px solid ' + (autopilot?.enabled ? '#86efac' : '#e5e7eb'),
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>{autopilot?.enabled ? '🤖' : '🔄'}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                  Autopilot Mode
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {autopilot?.enabled
                    ? `Testing automatically. ${autopilot.completedCount || 0} done, +${((autopilot.totalLift || 0)).toFixed(1)}% cumulative lift`
                    : 'Let AI run tests automatically, one after another'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {autopilot?.enabled && autopilot.queue && autopilot.queue.length > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 500, color: '#6b7280',
                  background: '#f3f4f6', padding: '3px 10px', borderRadius: 12,
                }}>
                  {autopilot.queue.length} tests queued
                </span>
              )}
              <CapsuleToggle
                on={!!autopilot?.enabled}
                onChange={(on) => toggleAutopilot(on)}
                disabled={autopilotLoading}
              />
            </div>
          </div>
          {autopilot?.enabled && autopilot.queue && autopilot.queue.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
                Up Next
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                {autopilot.queue.slice(0, 5).map((item: string, idx: number) => (
                  <span key={item} style={{
                    fontSize: 11, padding: '3px 10px', borderRadius: 8,
                    background: idx === 0 ? '#dcfce7' : '#f9fafb',
                    border: '1px solid ' + (idx === 0 ? '#86efac' : '#e5e7eb'),
                    color: idx === 0 ? '#166534' : '#6b7280',
                    fontWeight: idx === 0 ? 600 : 400,
                  }}>
                    {idx === 0 ? '▶ ' : ''}{item.replace(':', ' → ')}
                  </span>
                ))}
                {autopilot.queue.length > 5 && (
                  <span style={{ fontSize: 11, color: '#9ca3af', padding: '3px 6px' }}>
                    +{autopilot.queue.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

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
                  opacity: 1,
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
                  <CapsuleToggle
                    on={addon.enabled}
                    onChange={(on) => handleModeChange(def.key, on ? 'locked' : 'off')}
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
                    {/* Left: Cart Preview */}
                    <AddonPreview
                      addonKey={def.key}
                      addonConfig={addon.config ?? {}}
                      mode="focused"
                    />

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
