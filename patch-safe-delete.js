const fs = require('fs');
const file = 'backend/src/app/api/stores/[id]/gift-discounts/route.ts';
let code = fs.readFileSync(file, 'utf8');

// 1. Fix findGiftDuplicates — add [Gift] title filter
const oldReturn = "  return (result?.data?.products?.nodes ?? []);\n}";
const fnStart = code.indexOf('async function findGiftDuplicates');
const fnReturnIdx = code.indexOf(oldReturn, fnStart);

if (fnReturnIdx > fnStart && fnStart >= 0) {
  const newReturn = "  const nodes = result?.data?.products?.nodes ?? [];\n" +
    "  // SAFETY: Only return products whose title starts with \"[Gift]\" — these are OUR duplicates.\n" +
    "  // This prevents accidentally deleting original products that might have been tagged incorrectly.\n" +
    "  return nodes.filter((n: any) => n.title.startsWith('[Gift]'));\n}";
  code = code.substring(0, fnReturnIdx) + newReturn + code.substring(fnReturnIdx + oldReturn.length);
  console.log('1. PATCHED findGiftDuplicates with [Gift] title safety filter');
} else {
  console.log('1. SKIP findGiftDuplicates:', fnStart, fnReturnIdx);
}

// 2. Add safety check in POST deletion loop
const oldPostLoop = 'for (const dup of existingDuplicates) {\n      await deleteProduct(store.shopDomain, token, dup.id);\n      console.log(`[gift-discounts] Deleted old duplicate: ${dup.title} (${dup.id})`);\n    }';
const newPostLoop = 'for (const dup of existingDuplicates) {\n' +
  '      // SAFETY: Double-check title starts with [Gift] before deleting — NEVER delete original products\n' +
  '      if (!dup.title.startsWith(\'[Gift]\')) {\n' +
  '        console.warn(`[gift-discounts] SKIPPING deletion of "${dup.title}" (${dup.id}) — not a [Gift] duplicate`);\n' +
  '        continue;\n' +
  '      }\n' +
  '      await deleteProduct(store.shopDomain, token, dup.id);\n' +
  '      console.log(`[gift-discounts] Deleted old duplicate: ${dup.title} (${dup.id})`);\n    }';

if (code.includes(oldPostLoop)) {
  code = code.replace(oldPostLoop, newPostLoop);
  console.log('2. PATCHED POST deletion loop with title safety check');
} else {
  console.log('2. SKIP POST deletion loop');
}

// 3. Protect DELETE handler's deletion loop
const oldDelLoop = 'for (const dup of duplicates) {\n      await deleteProduct(store.shopDomain, token, dup.id);\n      console.log(`[gift-discounts] Deleted duplicate: ${dup.title} (${dup.id})`);\n    }';
const newDelLoop = 'for (const dup of duplicates) {\n' +
  '      // SAFETY: Only delete products whose title starts with [Gift] — NEVER delete originals\n' +
  '      if (!dup.title.startsWith(\'[Gift]\')) {\n' +
  '        console.warn(`[gift-discounts] SKIPPING deletion of "${dup.title}" (${dup.id}) — not a [Gift] duplicate`);\n' +
  '        continue;\n' +
  '      }\n' +
  '      await deleteProduct(store.shopDomain, token, dup.id);\n' +
  '      console.log(`[gift-discounts] Deleted duplicate: ${dup.title} (${dup.id})`);\n    }';

if (code.includes(oldDelLoop)) {
  code = code.replace(oldDelLoop, newDelLoop);
  console.log('3. PATCHED DELETE handler deletion loop with title safety check');
} else {
  console.log('3. SKIP DELETE handler deletion loop');
}

fs.writeFileSync(file, code);
console.log('\nDone. File size:', code.length);
