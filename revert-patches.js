const https = require('https');
const fs = require('fs');
const envContent = fs.readFileSync('C:/יוני/אפליקציות/Eleganto AI customer support/app/.env', 'utf8');
const getId = (key) => { const m = envContent.match(new RegExp(key + '=(.+)')); return m ? m[1].trim() : null; };
const cid = getId('SHOPIFY_CLIENT_ID');
const csec = getId('SHOPIFY_CLIENT_SECRET');
const postData = JSON.stringify({ client_id: cid, client_secret: csec, grant_type: 'client_credentials' });

function doRequest(hostname, path, method, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method, headers }, res => {
      let data = ''; res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(data); } });
    });
    if (body) req.write(body);
    req.end();
  });
}

// Read the current (patched) file and reverse all my changes
let code = fs.readFileSync('v14-complete.js', 'utf8');
let reverts = 0;

// 1. Revert CSS: var(--ccd-free-color, #111) back to #16a34a
code = code.replace(
  ".ccd-item__price--free { font-weight: 700 !important; color: var(--ccd-free-color, #111) !important; }",
  ".ccd-item__price--free { font-weight: 700 !important; color: #16a34a !important; }"
);
reverts++;

// 2. Remove FREE_PRICE_COLOR config line
code = code.replace(
  "  var FREE_PRICE_COLOR = _fsb.freePriceColor || CFG.freePriceColor || '#111';\n",
  ""
);
reverts++;

// 3. Remove CSS variable injection from init
code = code.replace(
  "      // Set free price color from config\n      document.documentElement.style.setProperty('--ccd-free-color', FREE_PRICE_COLOR);\n",
  ""
);
reverts++;

// 4. Revert empty cart text color: #fff back to #888
code = code.replace(
  "color: #fff !important; text-align: center !important; flex: 1 !important; display: none !important; align-items: center !important; justify-content: flex-start !important; padding-top: 80px !important;",
  "color: #888 !important; text-align: center !important; flex: 1 !important; display: none !important; align-items: center !important; justify-content: center !important;"
);
reverts++;

// 5. Revert empty cart show padding
code = code.replace(
  "padding: 20px 20px 60px !important",
  "padding: 40px 20px !important"
);
reverts++;

// 6. Revert SVG fill from #fff to #bbb
code = code.replace(
  'fill="#fff" style="margin-bottom:8px"',
  'fill="#bbb" style="margin-bottom:8px"'
);
reverts++;

// Keep FREE_PRICE_LABEL and hasDiscount changes (those are the "Free" label feature, not the color/empty cart)
// Actually let me revert those too for the live theme — EVERYTHING goes back
code = code.replace(
  "  var FREE_PRICE_LABEL = _fsb.freePriceLabel || CFG.freePriceLabel || 'Free';\n",
  ""
);

// Revert hasDiscount back to isGiftHandle
code = code.replace(
  "        var hasDiscount = item.discounts && item.discounts.length > 0;\n        var priceLabel = (linePrice === 0 && hasDiscount) ? FREE_PRICE_LABEL : CCD.fmt(linePrice);\n        var priceClass = (linePrice === 0 && hasDiscount) ? 'ccd-item__price ccd-item__price--free' : 'ccd-item__price';",
  "        var isGiftHandle = GIFT_HANDLES[item.handle] || item.handle === WATCH_CASE_HANDLE;\n        var priceLabel = (linePrice === 0 && isGiftHandle) ? 'Free' : CCD.fmt(linePrice);\n        var priceClass = (linePrice === 0 && isGiftHandle) ? 'ccd-item__price ccd-item__price--free' : 'ccd-item__price';"
);
reverts++;

console.log('Reverted', reverts, 'patches');
console.log('Has FREE_PRICE_COLOR:', code.includes('FREE_PRICE_COLOR'));
console.log('Has FREE_PRICE_LABEL:', code.includes('FREE_PRICE_LABEL'));
console.log('Has old green:', code.includes('#16a34a'));
console.log('Has old #888:', code.includes('color: #888'));
console.log('Has isGiftHandle:', code.includes('isGiftHandle'));

// Save reverted version for live upload
fs.writeFileSync('/tmp/v14-reverted.js', code);
console.log('\nReverted file size:', code.length);

// Upload to LIVE theme
async function upload() {
  const tokenRes = await doRequest('eleganto-3011.myshopify.com', '/admin/oauth/access_token', 'POST',
    { 'Content-Type': 'application/json', 'Content-Length': postData.length }, postData);
  const token = tokenRes.access_token;

  const assetData = JSON.stringify({ asset: { key: 'assets/v14-complete.js', value: code } });
  const res = await doRequest('eleganto-3011.myshopify.com',
    '/admin/api/2025-01/themes/145950245115/assets.json', 'PUT',
    { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token, 'Content-Length': Buffer.byteLength(assetData) },
    assetData);

  if (res.asset) {
    console.log('RESTORED live theme: ' + res.asset.key + ' size=' + res.asset.size);
  } else {
    console.log('Error:', JSON.stringify(res));
  }
}
upload().catch(e => console.error(e));
