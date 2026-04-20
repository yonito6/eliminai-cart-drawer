const fs = require('fs');

const path = 'C:/Projects/eliminai-cart-drawer/backend/src/app/dashboard/addons/rewards-tier-editor.tsx';
let code = fs.readFileSync(path, 'utf8');

// Fix 1: Replace forEach variant submit with batch add (single updateTier call)
const oldSubmit = `<button disabled={selectedVariants.size === 0} onClick={() => { if (!variantPickerTierId) return; selectedVariants.forEach((vid) => { const vr = variantPickerProduct.variants?.find((x: any) => x.id === vid); addGiftToTier(variantPickerTierId, variantPickerProduct, vid, vr?.title); }); setVariantPickerProduct(null); setVariantPickerTierId(null); setGiftSearchResults([]); setGiftSearchQuery(""); }}`;

const newSubmit = `<button disabled={selectedVariants.size === 0} onClick={() => {
                if (!variantPickerTierId) return;
                const tier = tiers.find(t => t.id === variantPickerTierId);
                if (!tier) return;
                const norm = normalizeTier(tier);
                const img = variantPickerProduct.imageUrl || variantPickerProduct.image?.src || variantPickerProduct.images?.[0]?.src || '';
                const newGifts = Array.from(selectedVariants).map((vid) => {
                  const vr = variantPickerProduct.variants?.find((x: any) => x.id === vid);
                  const title = vr?.title && vr.title !== 'Default Title' ? variantPickerProduct.title + ' \\u2014 ' + vr.title : variantPickerProduct.title;
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
              }}`;

if (code.includes(oldSubmit)) {
  code = code.replace(oldSubmit, newSubmit);
  console.log('1. Fixed variant batch submit (single updateTier call)');
} else {
  console.log('ERROR: Could not find old variant submit button');
  process.exit(1);
}

fs.writeFileSync(path, code);
console.log('Done!');
