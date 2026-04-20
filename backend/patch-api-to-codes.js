const fs = require('fs');
const file = 'src/app/api/stores/[id]/gift-discounts/route.ts';
let code = fs.readFileSync(file, 'utf8');

// Replace the entire section 4 (recreate with correct types) to use code discounts

const oldSection = `    // 4. Recreate with correct types
    let allProductGids: string[] | null = null;
    const ensureAllProductGids = async () => {
      if (!allProductGids) {
        allProductGids = await getAllActiveProductGids(store.shopDomain, token);
      }
      return allProductGids;
    };

    const results: { tier: number; handle: string; title: string; gid: string; discountId: string; type: 'automatic' }[] = [];
    const giftCodes: string[] = [];
    const errors: any[] = [];

    if (desired.length > 0) {
      // Create ONE single BXGY discount for ALL gift products.
      // Shopify BXGY discounts consume items — separate discounts per gift
      // block each other at checkout. This is the only working pattern.
      const gids = await ensureAllProductGids();
      const giftProductGids = desired.map(w => w.productGid);
      // CRITICAL: exclude gift products from customerBuys — Shopify BXGY
      // consumes items from "gets" first, so gift items in both lists
      // count as "gets" and leave "buys" unsatisfied = discount won't apply.
      const buyProductGids = gids.filter(g => !giftProductGids.includes(g));

      const createResult = await createSingleGiftDiscount(
        store.shopDomain, token, giftProductGids, buyProductGids,
      );

      if (createResult?.error) {
        errors.push({ error: createResult.error });
      } else if (createResult?.id) {
        for (const want of desired) {
          results.push({
            tier: want.tierGoal, handle: want.handle, title: want.title,
            gid: want.productGid, discountId: createResult.id, type: 'automatic',
          });
        }
      }
    }`;

const newSection = `    // 4. Recreate as CODE discounts (one per gift product).
    // IMPORTANT: Cannot use automatic BXGY because stores already have their own
    // automatic BXGY discounts (e.g. "1+2 FREE") and Shopify can't stack them.
    // Code discounts are applied via /discount/CODE1,CODE2?redirect=/checkout redirect.
    const results: { tier: number; handle: string; title: string; gid: string; discountId: string; type: 'code'; code: string }[] = [];
    const giftCodes: string[] = [];
    const errors: any[] = [];

    for (const want of desired) {
      const codeResult = await createCodeDiscount(
        store.shopDomain, token, want.productGid, want.tierGoal, want.tierNumber, [],
      );

      if (codeResult?.error) {
        errors.push({ handle: want.handle, error: codeResult.error });
      } else if (codeResult?.id) {
        const discountCode = codeResult.code;
        giftCodes.push(discountCode);
        results.push({
          tier: want.tierGoal, handle: want.handle, title: want.title,
          gid: want.productGid, discountId: codeResult.id, type: 'code', code: discountCode,
        });
      }
    }`;

if (!code.includes(oldSection)) {
  console.log('ERROR: Section 4 not found');
  // Show what's there
  const idx = code.indexOf('// 4. Recreate');
  if (idx > 0) console.log('Found at:', idx, code.substring(idx, idx + 200));
  process.exit(1);
}

code = code.replace(oldSection, newSection);
console.log('✓ Replaced section 4: automatic BXGY → code discounts per gift');

fs.writeFileSync(file, code);
console.log('✅ API patched to use code discounts');
console.log('File size:', code.length);
