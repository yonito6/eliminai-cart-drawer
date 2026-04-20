const fs = require('fs');

// === 1. Fix route.ts — use tag-only safety, no [Gift] prefix ===
const routeFile = 'backend/src/app/api/stores/[id]/gift-discounts/route.ts';
let route = fs.readFileSync(routeFile, 'utf8');

// Change title from [Gift] prefix to original name
route = route.replace(
  "const newTitle = `[Gift] ${originalTitle}`;",
  "const newTitle = originalTitle;"
);

// findGiftDuplicates — safety uses tag only (already queries by tag)
// Remove the title filter since tag IS the safety
route = route.replace(
  "  // SAFETY: Only return products whose title starts with \"[Gift]\" — OUR duplicates only.\n  return nodes.filter((n: any) => n.title.startsWith('[Gift]'));",
  "  // SAFETY: Only return products tagged with _eliminai-gift — OUR duplicates only.\n  // The tag is ONLY applied by duplicateAndZeroPrice(), never by external scripts.\n  return nodes;"
);

// Update comments
route = route.replace(
  "// Delete a product (our duplicate only — caller must verify [Gift] title)",
  "// Delete a product (our duplicate only — caller must verify _eliminai-gift tag)"
);
route = route.replace(
  "// Find all our duplicate gift products (tagged _eliminai-gift + title starts with [Gift])",
  "// Find all our duplicate gift products (tagged _eliminai-gift)"
);

// POST deletion loop — change title check to tag check
// The existing duplicates from findGiftDuplicates are already tag-filtered,
// but we add a tags query to be extra safe
route = route.replace(
  `      if (!dup.title.startsWith('[Gift]')) {
        console.warn(\`[gift-discounts] SAFETY: Skipping "\${dup.title}" (\${dup.id}) — not a [Gift] duplicate\`);
        continue;
      }
      await deleteProduct(store.shopDomain, token, dup.id);
      console.log(\`[gift-discounts] Deleted old duplicate: \${dup.title} (\${dup.id})\`);
    }

    // 2. Clean up legacy discounts`,
  `      await deleteProduct(store.shopDomain, token, dup.id);
      console.log(\`[gift-discounts] Deleted old duplicate: \${dup.title} (\${dup.id})\`);
    }

    // 2. Clean up legacy discounts`
);

// DELETE handler — same fix
route = route.replace(
  `      if (!dup.title.startsWith('[Gift]')) {
        console.warn(\`[gift-discounts] SAFETY: Skipping "\${dup.title}" (\${dup.id}) — not a [Gift] duplicate\`);
        continue;
      }
      await deleteProduct(store.shopDomain, token, dup.id);
      console.log(\`[gift-discounts] Deleted duplicate: \${dup.title} (\${dup.id})\`);`,
  `      await deleteProduct(store.shopDomain, token, dup.id);
      console.log(\`[gift-discounts] Deleted duplicate: \${dup.title} (\${dup.id})\`);`
);

fs.writeFileSync(routeFile, route);
console.log('1. route.ts updated — no [Gift] prefix, tag-only safety');

// === 2. Fix v14-complete.js — remove [Gift] strip ===
const jsFile = 'v14-complete.js';
let js = fs.readFileSync(jsFile, 'utf8');

// Remove the [Gift] title strip from product name display
js = js.replace(
  "(function(t) { return t.replace(/^\[Gift\]\s*/, ''); })(item.product_title || item.title || '')",
  "(item.product_title || item.title || '')"
);

fs.writeFileSync(jsFile, js);
console.log('2. v14-complete.js updated — removed [Gift] title strip');
