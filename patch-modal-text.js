const fs = require('fs');
const file = 'backend/src/app/dashboard/addons/rewards-tier-editor.tsx';
let code = fs.readFileSync(file, 'utf8');
let changes = 0;

// Fix 1: Replace "How it works" line
const old1 = "How it works:</strong> Product is duplicated with price set to";
if (code.includes(old1)) {
  // Replace the whole line content
  code = code.replace(
    /How it works:<\/strong>[^<]+/,
    "Automatic:</strong> Added to cart when customer qualifies"
  );
  changes++;
}

// Fix 2: Replace "Storefront" line  
if (code.includes("Storefront:</strong>")) {
  code = code.replace(
    /Storefront:<\/strong>[^<]+/,
    "Hidden:</strong> Customers cannot find or add it themselves"
  );
  changes++;
}

// Fix 3: Replace "Cart link" line
if (code.includes("Cart link:</strong>")) {
  code = code.replace(
    /Cart link:<\/strong>[^<]+/,
    "Product link:</strong> Goes to the original product page"
  );
  changes++;
}

fs.writeFileSync(file, code);
console.log(changes + ' modal text updates applied');
