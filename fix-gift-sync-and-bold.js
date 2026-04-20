const fs = require('fs');

// ═══ FIX 1: Bold {remaining} in v14-complete.js ═══
let v14 = fs.readFileSync('C:/Projects/eliminai-cart-drawer/v14-complete.js', 'utf8');

// Replace both instances of {remaining} replacement to wrap in <strong>
v14 = v14.replace(
  /msgEl\.innerHTML = nextTier\.beforeText\.replace\('\{remaining\}', unit\);/g,
  "msgEl.innerHTML = nextTier.beforeText.replace('{remaining}', '<strong>' + unit + '</strong>');"
);
console.log('1. Bold {remaining} fixed in v14');

fs.writeFileSync('C:/Projects/eliminai-cart-drawer/v14-complete.js', v14);

// ═══ FIX 2: Gift sync — handle multiple variants of same product ═══
let sync = fs.readFileSync('C:/Projects/eliminai-cart-drawer/backend/src/app/api/stores/[id]/gift-discounts/route.ts', 'utf8');

// The problem: all gift entries with the same handle get the same mapping.
// Fix: use a unique key per gift entry (index-based) when building desired state,
// and track which specific variant each duplicate should use.

// Replace the "Build desired state" section to include variantId
const oldDesiredBlock = `    // 3. Build desired state from tiers
    const desired: { handle: string; title: string; originalGid: string; originalPrice: string; tierGoal: number; tierNumber: number }[] = [];
    const notFound: string[] = [];

    let tierNumber = 0;
    for (const tier of tiers) {
      tierNumber++;
      const giftProducts = tier.giftProducts ?? (tier.giftProduct ? [tier.giftProduct] : []);
      for (const gift of giftProducts) {
        if (!gift.handle) continue;
        const lookupHandle = gift.originalHandle || gift.handle;
        const product = await getProductByHandle(store.shopDomain, token, lookupHandle);
        if (!product) {
          console.warn(\`[gift-discounts] Product not found: \${lookupHandle}\`);
          notFound.push(lookupHandle);
          continue;
        }
        desired.push({
          handle: lookupHandle,
          title: product.title,
          originalGid: product.id,
          originalPrice: gift.price || product.price,
          tierGoal: tier.goal,
          tierNumber,
        });
      }
    }`;

const newDesiredBlock = `    // 3. Build desired state from tiers
    const desired: { handle: string; title: string; originalGid: string; originalPrice: string; tierGoal: number; tierNumber: number; giftIndex: number; tierIndex: number; variantTitle?: string }[] = [];
    const notFound: string[] = [];

    // Cache product lookups to avoid repeated API calls for same handle
    const productCache: Record<string, { id: string; title: string; price: string } | null> = {};

    let tierNumber = 0;
    for (let tIdx = 0; tIdx < tiers.length; tIdx++) {
      const tier = tiers[tIdx];
      tierNumber++;
      const giftProducts = tier.giftProducts ?? (tier.giftProduct ? [tier.giftProduct] : []);
      for (let gIdx = 0; gIdx < giftProducts.length; gIdx++) {
        const gift = giftProducts[gIdx];
        if (!gift.handle) continue;
        const lookupHandle = gift.originalHandle || gift.handle;

        if (!(lookupHandle in productCache)) {
          productCache[lookupHandle] = await getProductByHandle(store.shopDomain, token, lookupHandle);
        }
        const product = productCache[lookupHandle];
        if (!product) {
          console.warn(\`[gift-discounts] Product not found: \${lookupHandle}\`);
          notFound.push(lookupHandle);
          continue;
        }
        // Extract variant-specific title (part after em-dash)
        const variantTitle = gift.title?.includes('\\u2014') ? gift.title.split('\\u2014').pop()?.trim() : undefined;
        desired.push({
          handle: lookupHandle,
          title: product.title,
          originalGid: product.id,
          originalPrice: gift.price || product.price,
          tierGoal: tier.goal,
          tierNumber,
          giftIndex: gIdx,
          tierIndex: tIdx,
          variantTitle,
        });
      }
    }`;

if (sync.includes(oldDesiredBlock)) {
  sync = sync.replace(oldDesiredBlock, newDesiredBlock);
  console.log('2. Desired state now tracks giftIndex + variantTitle');
} else {
  console.log('WARNING: Could not find old desired block');
}

// Replace the config update section to use index-based mapping
const oldConfigUpdate = `      for (const c of [cfg, otherCfg]) {
        delete c.giftDiscountCodes;

        if (giftMappings.length > 0) {
          c.giftMappings = giftMappings;
        } else {
          delete c.giftMappings;
        }

        const addons = c.addons ?? {};
        const rewardConfig = addons.freeShippingBar?.config ?? {};
        const cfgTiers = rewardConfig.tiers ?? [];
        for (const tier of cfgTiers) {
          const giftProducts = tier.giftProducts ?? (tier.giftProduct ? [tier.giftProduct] : []);
          for (const gp of giftProducts) {
            const lookupHandle = gp.originalHandle || gp.handle;
            const mapping = giftMappings.find(m => m.originalHandle === lookupHandle);
            if (mapping) {
              gp.originalHandle = lookupHandle;
              gp.originalUrl = mapping.originalUrl;
              gp.handle = mapping.duplicateHandle;
              gp.variantId = parseInt(mapping.duplicateVariantId) || gp.variantId;
            }
          }
        }
      }`;

const newConfigUpdate = `      for (const c of [cfg, otherCfg]) {
        delete c.giftDiscountCodes;

        if (giftMappings.length > 0) {
          c.giftMappings = giftMappings;
        } else {
          delete c.giftMappings;
        }

        const addons = c.addons ?? {};
        const rewardConfig = addons.freeShippingBar?.config ?? {};
        const cfgTiers = rewardConfig.tiers ?? [];
        for (let tI = 0; tI < cfgTiers.length; tI++) {
          const tier = cfgTiers[tI];
          const giftProducts = tier.giftProducts ?? (tier.giftProduct ? [tier.giftProduct] : []);
          for (let gI = 0; gI < giftProducts.length; gI++) {
            const gp = giftProducts[gI];
            const lookupHandle = gp.originalHandle || gp.handle;
            // Match by tierIndex + giftIndex for unique mapping (handles same product in multiple slots)
            const mapping = giftMappings.find(m => m.tierIndex === tI && m.giftIndex === gI)
              || giftMappings.find(m => m.originalHandle === lookupHandle && !m._used);
            if (mapping) {
              (mapping as any)._used = true;
              gp.originalHandle = lookupHandle;
              gp.originalUrl = mapping.originalUrl;
              gp.handle = mapping.duplicateHandle;
              gp.variantId = parseInt(mapping.duplicateVariantId) || gp.variantId;
            }
          }
        }
      }`;

if (sync.includes(oldConfigUpdate)) {
  sync = sync.replace(oldConfigUpdate, newConfigUpdate);
  console.log('3. Config update now uses index-based mapping');
} else {
  console.log('WARNING: Could not find old config update block');
}

// Also update giftMappings to include tierIndex and giftIndex
const oldMappingPush = `      giftMappings.push({
        originalHandle: want.handle,
        originalUrl: \`/products/\${want.handle}\`,
        duplicateHandle: dupResult.duplicateHandle,
        duplicateVariantId: dupResult.duplicateVariantId,
        duplicateGid: dupResult.duplicateGid,
      });`;

const newMappingPush = `      giftMappings.push({
        originalHandle: want.handle,
        originalUrl: \`/products/\${want.handle}\`,
        duplicateHandle: dupResult.duplicateHandle,
        duplicateVariantId: dupResult.duplicateVariantId,
        duplicateGid: dupResult.duplicateGid,
        tierIndex: want.tierIndex,
        giftIndex: want.giftIndex,
      });`;

if (sync.includes(oldMappingPush)) {
  sync = sync.replace(oldMappingPush, newMappingPush);
  console.log('4. giftMappings now include tierIndex + giftIndex');
} else {
  console.log('WARNING: Could not find mapping push');
}

fs.writeFileSync('C:/Projects/eliminai-cart-drawer/backend/src/app/api/stores/[id]/gift-discounts/route.ts', sync);
console.log('\nAll fixes applied!');
