const fs = require('fs');
const file = 'backend/src/app/api/stores/[id]/gift-discounts/route.ts';
let code = fs.readFileSync(file, 'utf8');
let changes = 0;

// 1. Fix findGiftDuplicates — add [Gift] title filter on the return line
const old1 = '  return (result?.data?.products?.nodes ?? []);\n}';
const new1 = '  const nodes = result?.data?.products?.nodes ?? [];\n' +
  '  // SAFETY: Only return products whose title starts with "[Gift]" — these are OUR duplicates.\n' +
  '  // This prevents accidentally deleting original products that might have been tagged.\n' +
  '  return nodes.filter((n) => n.title.startsWith(\'[Gift]\'));\n}';

// Find it within findGiftDuplicates specifically
const fnIdx = code.indexOf('async function findGiftDuplicates');
const nextFn = code.indexOf('\n// ---', fnIdx + 1);
const fnBody = code.substring(fnIdx, nextFn);
if (fnBody.includes(old1)) {
  code = code.substring(0, fnIdx) + fnBody.replace(old1, new1) + code.substring(nextFn);
  changes++;
  console.log('1. PATCHED findGiftDuplicates');
} else {
  console.log('1. SKIP - pattern:', JSON.stringify(old1.substring(0, 40)));
}

// 2. POST handler — add safety guard before deleteProduct
const old2 = '    for (const dup of existingDuplicates) {\n' +
  '      await deleteProduct(store.shopDomain, token, dup.id);\n' +
  '      console.log(`[gift-discounts] Deleted old duplicate: ${dup.title} (${dup.id})`);';
const new2 = '    for (const dup of existingDuplicates) {\n' +
  '      if (!dup.title.startsWith(\'[Gift]\')) {\n' +
  '        console.warn(`[gift-discounts] SAFETY: Skipping "${dup.title}" (${dup.id}) — not a [Gift] duplicate`);\n' +
  '        continue;\n' +
  '      }\n' +
  '      await deleteProduct(store.shopDomain, token, dup.id);\n' +
  '      console.log(`[gift-discounts] Deleted old duplicate: ${dup.title} (${dup.id})`);';

if (code.includes(old2)) {
  code = code.replace(old2, new2);
  changes++;
  console.log('2. PATCHED POST deletion loop');
} else {
  console.log('2. SKIP POST deletion loop');
}

// 3. DELETE handler — add safety guard
const old3 = '    for (const dup of duplicates) {\n' +
  '      await deleteProduct(store.shopDomain, token, dup.id);\n' +
  '      console.log(`[gift-discounts] Deleted duplicate: ${dup.title} (${dup.id})`);';
const new3 = '    for (const dup of duplicates) {\n' +
  '      if (!dup.title.startsWith(\'[Gift]\')) {\n' +
  '        console.warn(`[gift-discounts] SAFETY: Skipping "${dup.title}" (${dup.id}) — not a [Gift] duplicate`);\n' +
  '        continue;\n' +
  '      }\n' +
  '      await deleteProduct(store.shopDomain, token, dup.id);\n' +
  '      console.log(`[gift-discounts] Deleted duplicate: ${dup.title} (${dup.id})`);';

if (code.includes(old3)) {
  code = code.replace(old3, new3);
  changes++;
  console.log('3. PATCHED DELETE handler deletion loop');
} else {
  console.log('3. SKIP DELETE handler deletion loop');
}

fs.writeFileSync(file, code);
console.log('\n' + changes + ' patches applied.');
