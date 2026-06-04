// backend/src/lib/test-variants.ts
export interface AddonDimension {
  key: string;
  label: string;
  testable: boolean;
  type: 'select' | 'toggle' | 'text' | 'wallets' | string;
  default?: any;
  options?: { value: any; label: string }[];
}
export interface AddonDefinition {
  key: string;
  label: string;
  // NOTE: the real ADDON_DEFINITIONS shape has NO top-level `category`/`testable`.
  // buildVariantsForSlot only reads key/label/dimensions, so these are optional.
  category?: string;
  testable?: boolean;
  dimensions: AddonDimension[];
}
export interface BuildVariantsOpts {
  completedNames: Set<string>;
  currentConfig: Record<string, any>;
  dimensionKey?: string;
}
export interface BuiltVariants {
  testName: string;
  dimensionKey: string;
  variants: { id: string; label: string; features: Record<string, any> }[];
  trafficSplit: Record<string, number>;
}

export function buildVariantsForSlot(
  definition: AddonDefinition,
  opts: BuildVariantsOpts,
): BuiltVariants | { error: string } {
  const { completedNames, currentConfig: cfg, dimensionKey } = opts;

  const enabledTestName = `${definition.label} — Enabled vs Disabled`;
  const hasTestedEnabled = completedNames.has(enabledTestName);

  let testName: string;
  let testDimensionKey: string;
  let variants: { id: string; label: string; features: Record<string, any> }[];

  if (!hasTestedEnabled && !dimensionKey) {
    testName = enabledTestName;
    testDimensionKey = '_enabled';
    variants = [
      { id: 'with_addon', label: `With ${definition.label}`, features: { _enabled: true } },
      { id: 'without_addon', label: `Without ${definition.label}`, features: { _enabled: false } },
    ];
  } else {
    const testableDims = definition.dimensions.filter(d => d.testable);
    if (!testableDims.length) return { error: 'No testable dimensions' };

    let dim;
    if (dimensionKey) {
      dim = testableDims.find(d => d.key === dimensionKey);
    } else {
      dim = testableDims.find(d => !completedNames.has(`${definition.label} — ${d.label}`)) || testableDims[0];
    }
    if (!dim) return { error: 'Dimension not found or not testable' };

    testName = `${definition.label} — ${dim.label}`;
    testDimensionKey = dim.key;
    const currentVal = cfg[dim.key] ?? dim.default;

    if (dim.type === 'select' && dim.options) {
      const currentOpt = dim.options.find(o => o.value === currentVal) || dim.options[0];
      const altOpt = dim.options.find(o => o.value !== currentVal) || dim.options[1];
      variants = [
        { id: `${dim.key}_${currentOpt.value}`, label: currentOpt.label + ' (current)', features: { [dim.key]: currentOpt.value } },
        { id: `${dim.key}_${altOpt.value}`, label: altOpt.label, features: { [dim.key]: altOpt.value } },
      ];
    } else if (dim.type === 'toggle') {
      variants = [
        { id: `${dim.key}_${currentVal ? 'on' : 'off'}`, label: `${dim.label}: ${currentVal ? 'On' : 'Off'} (current)`, features: { [dim.key]: !!currentVal } },
        { id: `${dim.key}_${currentVal ? 'off' : 'on'}`, label: `${dim.label}: ${currentVal ? 'Off' : 'On'}`, features: { [dim.key]: !currentVal } },
      ];
    } else if (dim.type === 'text') {
      const cur = currentVal || '';
      const alt = cur === 'Guaranteed Safe Checkout' ? 'Secure Payment' : 'Guaranteed Safe Checkout';
      variants = [
        { id: `${dim.key}_current`, label: cur ? `"${cur}" (current)` : '(none) (current)', features: { [dim.key]: cur } },
        { id: `${dim.key}_alt`, label: alt, features: { [dim.key]: alt } },
      ];
    } else if (dim.type === 'wallets') {
      const curHidden: string[] = Array.isArray(currentVal) ? currentVal : [];
      const paypalShown = curHidden.indexOf('paypal') === -1;
      const showVariant = { id: 'paypal_show', label: 'Show PayPal' + (paypalShown ? ' (current)' : ''), features: { [dim.key]: curHidden.filter(w => w !== 'paypal') } };
      const hideVariant = { id: 'paypal_hide', label: 'Hide PayPal' + (!paypalShown ? ' (current)' : ''), features: { [dim.key]: Array.from(new Set([...curHidden, 'paypal'])) } };
      variants = paypalShown ? [showVariant, hideVariant] : [hideVariant, showVariant];
    } else {
      return { error: 'Cannot auto-generate variants for this type' };
    }
  }

  const trafficSplit: Record<string, number> = {};
  variants.forEach(v => { trafficSplit[v.id] = 0.5; });

  return { testName, dimensionKey: testDimensionKey, variants, trafficSplit };
}
