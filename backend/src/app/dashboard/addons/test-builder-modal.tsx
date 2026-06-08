'use client';
import React, { useMemo, useState } from 'react';
import AddonPreview from './addon-preview';

// ── Types mirroring the server ADDON_DEFINITIONS dimension shape ──────────────
interface Dimension {
  key: string;
  label: string;
  testable?: boolean;
  type: 'select' | 'toggle' | 'text' | 'wallets' | string;
  default?: any;
  options?: { value: any; label: string }[];
}
interface Definition {
  key: string;
  label: string;
  dimensions?: Dimension[];
}
interface Variant {
  id: string;
  label: string;
  features: Record<string, any>;
}
export interface LaunchPayload {
  addonKey: string;
  dimensionKey: string;
  name: string;
  variants: Variant[];
  trafficSplit: Record<string, number>;
}

interface Props {
  def: Definition;
  config: Record<string, any>;
  enabled: boolean;
  themeSettings: Record<string, any> | null;
  storeId: string | null;
  launching?: boolean;
  onClose: () => void;
  onLaunch: (payload: LaunchPayload) => void;
}

// A "test choice" is either the meta with/without toggle or a real dimension.
type TestChoice = { kind: 'enabled' } | { kind: 'dimension'; dim: Dimension };

const PURPLE = '#7c3aed';

function altSelectValue(dim: Dimension, current: any) {
  const opts = dim.options || [];
  const other = opts.find(o => o.value !== current);
  return other ? other.value : (opts[1]?.value ?? opts[0]?.value);
}

function valueLabel(dim: Dimension, value: any): string {
  if (dim.type === 'select') {
    return dim.options?.find(o => o.value === value)?.label ?? String(value);
  }
  if (dim.type === 'toggle') return value ? 'On' : 'Off';
  if (dim.type === 'wallets') {
    const hidden: string[] = Array.isArray(value) ? value : [];
    return hidden.includes('paypal') ? 'PayPal hidden' : 'PayPal shown';
  }
  return value === '' || value == null ? '(none)' : String(value);
}

// Build a default A/B pair for a given test choice from the current store config.
function defaultVariants(choice: TestChoice, config: Record<string, any>, label: string): { a: Variant; b: Variant; dimensionKey: string } {
  if (choice.kind === 'enabled') {
    return {
      dimensionKey: '_enabled',
      a: { id: 'with_addon', label: `With ${label}`, features: { _enabled: true } },
      b: { id: 'without_addon', label: `Without ${label}`, features: { _enabled: false } },
    };
  }
  const dim = choice.dim;
  const current = config[dim.key] ?? dim.default;
  let valA: any = current;
  let valB: any;
  if (dim.type === 'select') valB = altSelectValue(dim, current);
  else if (dim.type === 'toggle') { valA = !!current; valB = !current; }
  else if (dim.type === 'text') { valA = current || ''; valB = valA === 'Guaranteed Safe Checkout' ? 'Secure Payment' : 'Guaranteed Safe Checkout'; }
  else if (dim.type === 'wallets') {
    const hidden: string[] = Array.isArray(current) ? current : [];
    valA = hidden.filter(w => w !== 'paypal');           // PayPal shown
    valB = Array.from(new Set([...hidden, 'paypal']));   // PayPal hidden
  } else { valA = current; valB = current; }
  return {
    dimensionKey: dim.key,
    a: { id: `${dim.key}_a`, label: `${valueLabel(dim, valA)} (current)`, features: { [dim.key]: valA } },
    b: { id: `${dim.key}_b`, label: valueLabel(dim, valB), features: { [dim.key]: valB } },
  };
}

export default function TestBuilderModal({ def, config, enabled, themeSettings, storeId, launching, onClose, onLaunch }: Props) {
  const accent = (themeSettings?.ccd_color_primary as string) || PURPLE;
  const testableDims = (def.dimensions || []).filter(d => d.testable);

  // Step flow mirrors the merchant's mental model: pick → set A → set B → launch.
  const [step, setStep] = useState<'choose' | 'a' | 'b' | 'review'>('choose');
  const [choiceKey, setChoiceKey] = useState<string>('_enabled');

  const choice: TestChoice = useMemo(() => {
    if (choiceKey === '_enabled') return { kind: 'enabled' };
    const dim = testableDims.find(d => d.key === choiceKey)!;
    return { kind: 'dimension', dim };
  }, [choiceKey, testableDims]);

  const seed = useMemo(() => defaultVariants(choice, config, def.label), [choice, config, def.label]);
  const [variantA, setVariantA] = useState<Variant>(seed.a);
  const [variantB, setVariantB] = useState<Variant>(seed.b);
  const [testName, setTestName] = useState<string>(
    choice.kind === 'enabled' ? `${def.label} — Enabled vs Disabled` : `${def.label} — ${(choice as any).dim.label}`,
  );

  // When the test choice changes, reseed A/B and the name.
  function applyChoice(key: string) {
    setChoiceKey(key);
    const nextChoice: TestChoice = key === '_enabled'
      ? { kind: 'enabled' }
      : { kind: 'dimension', dim: testableDims.find(d => d.key === key)! };
    const next = defaultVariants(nextChoice, config, def.label);
    setVariantA(next.a);
    setVariantB(next.b);
    setTestName(nextChoice.kind === 'enabled'
      ? `${def.label} — Enabled vs Disabled`
      : `${def.label} — ${nextChoice.dim.label}`);
  }

  // Merge a variant's features onto the live config so the preview renders the real thing.
  function previewConfigFor(v: Variant): { config: Record<string, any>; exclude?: string } {
    if (choice.kind === 'enabled') {
      const off = v.features._enabled === false;
      return { config, exclude: off ? def.key : undefined };
    }
    return { config: { ...config, ...v.features } };
  }

  function setVariantValue(which: 'a' | 'b', rawValue: any) {
    const dim = (choice as any).dim as Dimension | undefined;
    const setV = which === 'a' ? setVariantA : setVariantB;
    const v = which === 'a' ? variantA : variantB;
    if (choice.kind === 'enabled') return; // enabled is fixed on/off
    setV({ ...v, features: { [dim!.key]: rawValue }, label: v.label });
  }

  function launch() {
    onLaunch({
      addonKey: def.key,
      dimensionKey: seed.dimensionKey,
      name: testName.trim() || `${def.label} — A/B test`,
      variants: [variantA, variantB],
      trafficSplit: { [variantA.id]: 0.5, [variantB.id]: 0.5 },
    });
  }

  // ── small themed UI helpers ──
  const btn = (primary: boolean): React.CSSProperties => ({
    padding: '10px 18px', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer',
    border: primary ? 'none' : '1px solid #d1d5db',
    background: primary ? accent : '#fff', color: primary ? '#fff' : '#374151',
  });
  const stepDot = (s: string, label: string, n: number) => {
    const order = ['choose', 'a', 'b', 'review'];
    const active = step === s;
    const done = order.indexOf(step) > order.indexOf(s);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center',
          fontSize: 12, fontWeight: 700,
          background: active ? accent : done ? '#16a34a' : '#e5e7eb',
          color: active || done ? '#fff' : '#9ca3af',
        }}>{done ? '✓' : n}</div>
        <span style={{ fontSize: 13, fontWeight: 600, color: active ? '#111827' : '#9ca3af' }}>{label}</span>
      </div>
    );
  };

  const renderValueEditor = (which: 'a' | 'b') => {
    if (choice.kind === 'enabled') {
      const isA = which === 'a';
      return (
        <div style={{ fontSize: 14, color: '#374151', padding: '10px 12px', background: '#f9fafb', borderRadius: 8 }}>
          {isA ? `Shows the cart WITH "${def.label}" enabled.` : `Shows the cart WITHOUT "${def.label}".`}
        </div>
      );
    }
    const dim = choice.dim;
    const v = which === 'a' ? variantA : variantB;
    const val = v.features[dim.key];
    if (dim.type === 'select') {
      return (
        <select value={String(val)} onChange={e => {
          const opt = dim.options!.find(o => String(o.value) === e.target.value);
          setVariantValue(which, opt ? opt.value : e.target.value);
        }} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}>
          {dim.options!.map(o => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
        </select>
      );
    }
    if (dim.type === 'toggle') {
      return (
        <button onClick={() => setVariantValue(which, !val)} style={{ ...btn(false), width: '100%' }}>
          {val ? 'On' : 'Off'} — click to flip
        </button>
      );
    }
    if (dim.type === 'wallets') {
      const hidden: string[] = Array.isArray(val) ? val : [];
      const shown = !hidden.includes('paypal');
      return (
        <button onClick={() => setVariantValue(which, shown ? Array.from(new Set([...hidden, 'paypal'])) : hidden.filter(w => w !== 'paypal'))}
          style={{ ...btn(false), width: '100%' }}>
          PayPal {shown ? 'shown' : 'hidden'} — click to flip
        </button>
      );
    }
    return (
      <input value={String(val ?? '')} onChange={e => setVariantValue(which, e.target.value)}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }} />
    );
  };

  const renderVariantPreview = (v: Variant) => {
    const pc = previewConfigFor(v);
    return (
      <AddonPreview addonKey={def.key} addonConfig={pc.config} mode="full"
        themeSettings={themeSettings || undefined} storeId={storeId} excludeAddonKey={pc.exclude} />
    );
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.55)', zIndex: 1000,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 860, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>Test conversion · {def.label}</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Hand-pick Variant A and Variant B, then launch a 50/50 A/B test.</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#9ca3af' }}>×</button>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', gap: 20, padding: '14px 24px', borderBottom: '1px solid #f3f4f6', flexWrap: 'wrap' }}>
          {stepDot('choose', 'What to test', 1)}
          {stepDot('a', 'Variant A', 2)}
          {stepDot('b', 'Variant B', 3)}
          {stepDot('review', 'Review & launch', 4)}
        </div>

        <div style={{ padding: 24 }}>
          {/* STEP 1: choose */}
          {step === 'choose' && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 12 }}>Pick what you want to test</div>
              <label style={{
                display: 'flex', gap: 10, padding: 14, border: `2px solid ${choiceKey === '_enabled' ? accent : '#e5e7eb'}`,
                borderRadius: 10, cursor: 'pointer', marginBottom: 10,
              }}>
                <input type="radio" checked={choiceKey === '_enabled'} onChange={() => applyChoice('_enabled')} />
                <div>
                  <div style={{ fontWeight: 700, color: '#111827' }}>
                    With vs Without {enabled ? '' : '(recommended first test)'}
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>Does showing "{def.label}" at all lift conversion? The cleanest first question.</div>
                </div>
              </label>
              {testableDims.map(dim => (
                <label key={dim.key} style={{
                  display: 'flex', gap: 10, padding: 14, border: `2px solid ${choiceKey === dim.key ? accent : '#e5e7eb'}`,
                  borderRadius: 10, cursor: 'pointer', marginBottom: 10,
                }}>
                  <input type="radio" checked={choiceKey === dim.key} onChange={() => applyChoice(dim.key)} />
                  <div>
                    <div style={{ fontWeight: 700, color: '#111827' }}>{dim.label}</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>Test different values of "{dim.label}".</div>
                  </div>
                </label>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button style={btn(true)} onClick={() => setStep('a')}>Next: set up Variant A →</button>
              </div>
            </div>
          )}

          {/* STEP 2/3: variant A / B */}
          {(step === 'a' || step === 'b') && (() => {
            const which = step === 'a' ? 'a' : 'b';
            const v = which === 'a' ? variantA : variantB;
            const setLabel = (lbl: string) => (which === 'a' ? setVariantA : setVariantB)({ ...v, label: lbl });
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
                    {which === 'a' ? 'Variant A (control)' : 'Variant B (challenger)'}
                  </div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Label shown in results</label>
                  <input value={v.label} onChange={e => setLabel(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, margin: '6px 0 14px' }} />
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Value</label>
                  <div style={{ marginTop: 6 }}>{renderValueEditor(which)}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
                    <button style={btn(false)} onClick={() => setStep(which === 'a' ? 'choose' : 'a')}>← Back</button>
                    <button style={btn(true)} onClick={() => setStep(which === 'a' ? 'b' : 'review')}>
                      {which === 'a' ? 'Save A → set up B →' : 'Review →'}
                    </button>
                  </div>
                </div>
                <div style={{ alignSelf: 'start', position: 'sticky', top: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 6 }}>Live preview (your colors)</div>
                  {renderVariantPreview(v)}
                </div>
              </div>
            );
          })()}

          {/* STEP 4: review */}
          {step === 'review' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Test name</label>
              <input value={testName} onChange={e => setTestName(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, margin: '6px 0 18px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {[variantA, variantB].map((v, i) => (
                  <div key={v.id}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 6 }}>
                      {i === 0 ? 'A · ' : 'B · '}{v.label} <span style={{ color: '#9ca3af', fontWeight: 500 }}>(50%)</span>
                    </div>
                    {renderVariantPreview(v)}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
                <button style={btn(false)} onClick={() => setStep('b')}>← Back</button>
                <button style={{ ...btn(true), opacity: launching ? 0.6 : 1 }} disabled={launching} onClick={launch}>
                  {launching ? 'Launching…' : 'Launch A/B test'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
