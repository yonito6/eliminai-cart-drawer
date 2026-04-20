const fs = require('fs');

const editorPath = 'C:/Projects/eliminai-cart-drawer/backend/src/app/dashboard/addons/rewards-tier-editor.tsx';
let code = fs.readFileSync(editorPath, 'utf8');

// ═══ FEATURE 1: "Let Customer Choose" toggle ═══
// Insert before the "Free Price Label" block

const customerChoiceToggle = `
                    {/* Let Customer Choose Gift — shown when tier has 2+ gifts */}
                    {normalizeTier(tier).giftProducts.length >= 2 && (
                      <div style={{ padding: '10px 12px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>Let Customer Choose</span>
                            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>Show a gift picker so the customer selects their preferred gift</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: '#6b7280' }}>{config.giftCustomerChoice === true ? 'On' : 'Off'}</span>
                            <button
                              onClick={() => onConfigChange({ giftCustomerChoice: !config.giftCustomerChoice })}
                              style={{
                                position: 'relative', width: 36, height: 20, borderRadius: 10,
                                border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0,
                                background: config.giftCustomerChoice === true ? '#22c55e' : '#d1d5db',
                                transition: 'background 0.2s',
                              }}
                            >
                              <div style={{
                                position: 'absolute', top: 2, left: config.giftCustomerChoice === true ? 18 : 2,
                                width: 16, height: 16, borderRadius: 8, background: '#fff',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                              }} />
                            </button>
                          </div>
                        </div>
                        {config.giftCustomerChoice === true && (
                          <div style={{ marginTop: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Picker Title</span>
                            <input
                              type="text"
                              value={config.giftPickerTitle || 'Choose your free gift'}
                              onChange={e => onConfigChange({ giftPickerTitle: e.target.value })}
                              placeholder="Choose your free gift"
                              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, color: '#374151', outline: 'none', boxSizing: 'border-box' }}
                            />
                          </div>
                        )}
                      </div>
                    )}

`;

code = code.replace(
  '                    {/* Free Price Label',
  customerChoiceToggle + '                    {/* Free Price Label'
);
console.log('1. "Let Customer Choose" toggle added');


// ═══ FEATURE 2: Variant selector ═══

// a) Add state
code = code.replace(
  '  const [discountsExist, setDiscountsExist] = useState(false);',
  `  const [discountsExist, setDiscountsExist] = useState(false);
  const [variantPickerProduct, setVariantPickerProduct] = useState<any | null>(null);
  const [variantPickerTierId, setVariantPickerTierId] = useState<string | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Set<number>>(new Set());`
);

// b) Add helper function
code = code.replace(
  '  function updateTier(tierId: string, patch: Partial<RewardTier>) {',
  `  function addGiftToTier(tierId: string, product: any, vId: number, vTitle?: string) {
    const tier = tiers.find(t => t.id === tierId);
    if (!tier) return;
    const norm = normalizeTier(tier);
    const v = product.variants?.find((x: any) => x.id === vId) || product.variants?.[0];
    const img = product.imageUrl || product.image?.src || product.images?.[0]?.src || '';
    const title = vTitle && vTitle !== 'Default Title' ? product.title + ' \\u2014 ' + vTitle : product.title;
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

  function updateTier(tierId: string, patch: Partial<RewardTier>) {`
);

// c) Modify Add button to check for variants
const oldAddHandler = `                                        const normalized = normalizeTier(tier);
                                        const tierAlreadyHasGifts = normalized.giftProducts.length > 0;
                                        // First gift ever (no discounts on Shopify yet) → show confirmation modal
                                        // Otherwise (replacing, adding more, or discounts already exist) → silent add
                                        if (tierAlreadyHasGifts || replacingGiftIndex !== null || discountsExist) {
                                          const newGift = { handle: product.handle, variantId: product.variants?.[0]?.id ?? 0, title: product.title, imageUrl: imgSrc, price: product.variants?.[0]?.price || '' };
                                          let updated: any[];
                                          if (replacingGiftIndex !== null) {
                                            updated = [...normalized.giftProducts];
                                            updated[replacingGiftIndex] = newGift;
                                            setReplacingGiftIndex(null);
                                          } else {
                                            updated = [...normalized.giftProducts, newGift];
                                          }
                                          updateTier(tier.id, { giftProducts: updated, giftProduct: updated[0] });
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
                                        }`;

const newAddHandler = `                                        const normalized = normalizeTier(tier);
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
                                        }`;

if (code.includes(oldAddHandler)) {
  code = code.replace(oldAddHandler, newAddHandler);
  console.log('2. Add button now checks for variants');
} else {
  console.log('WARNING: Could not find Add button handler');
}

// d) Add variant picker modal before the empty-tiers message
const variantModal = `
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
                      {v.price && <div style={{ fontSize: 11, color: '#6b7280' }}>${v.price}</div>}
                    </div>
                  </label>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => { setVariantPickerProduct(null); setVariantPickerTierId(null); }} style={{ padding: '8px 20px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500, color: '#374151' }}>Cancel</button>
              <button disabled={selectedVariants.size === 0} onClick={() => { if (!variantPickerTierId) return; selectedVariants.forEach((vid) => { const vr = variantPickerProduct.variants?.find((x: any) => x.id === vid); addGiftToTier(variantPickerTierId, variantPickerProduct, vid, vr?.title); }); setVariantPickerProduct(null); setVariantPickerTierId(null); setGiftSearchResults([]); setGiftSearchQuery(''); }} style={{ padding: '8px 20px', background: selectedVariants.size === 0 ? '#d1d5db' : '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: selectedVariants.size === 0 ? 'not-allowed' : 'pointer' }}>
                {'Add ' + (selectedVariants.size > 0 ? selectedVariants.size + ' Variant' + (selectedVariants.size > 1 ? 's' : '') : 'Selected')}
              </button>
            </div>
          </div>
        </div>
      )}
`;

code = code.replace(
  '        {tiers.length === 0 && (',
  variantModal + '\n        {tiers.length === 0 && ('
);
console.log('3. Variant picker modal added');

fs.writeFileSync(editorPath, code);
console.log('\nAll changes written. Verifying...');

const final = fs.readFileSync(editorPath, 'utf8');
console.log('  giftCustomerChoice toggle:', final.includes('giftCustomerChoice'));
console.log('  variantPickerProduct state:', final.includes('variantPickerProduct'));
console.log('  addGiftToTier helper:', final.includes('function addGiftToTier'));
console.log('  Variant Picker Modal:', final.includes('Variant Picker Modal'));
console.log('  Select All button:', final.includes('Select All'));
console.log('  Let Customer Choose:', final.includes('Let Customer Choose'));
