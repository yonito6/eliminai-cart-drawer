const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

async function main() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eliminai-test.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  
  var themeId = 185993036089; // main theme (test-data)
  var domain = store.shopDomain;
  var token = store.accessToken;
  
  async function putAsset(key, value) {
    var res = await fetch('https://' + domain + '/admin/api/2025-01/themes/' + themeId + '/assets.json', {
      method: 'PUT',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset: { key: key, value: value } })
    });
    var data = await res.json();
    if (data.asset) {
      console.log('OK: ' + key);
    } else {
      console.log('ERROR ' + key + ':', JSON.stringify(data.errors || data));
    }
    return data;
  }
  
  async function getAsset(key) {
    var res = await fetch('https://' + domain + '/admin/api/2025-01/themes/' + themeId + '/assets.json?asset[key]=' + encodeURIComponent(key), {
      headers: { 'X-Shopify-Access-Token': token }
    });
    return (await res.json()).asset;
  }
  
  // Step 1: Upload eliminai-cart-embed snippet
  var embedSnippet = '{% comment %}\n  Eliminai Cart Drawer \u2014 Embed Snippet\n{% endcomment %}\n\n<script>\n(function() {\n  if (window.__eliminai_cart_loaded) return;\n  window.__eliminai_cart_loaded = true;\n\n  window.__ccd_early_open = false;\n  function handleCartClick(e) {\n    if (e.target.closest && e.target.closest("#CCD-Drawer")) return;\n    var link = e.target.closest ? e.target.closest(\'a[href*="/cart"]\') : null;\n    if (link) {\n      var href = link.getAttribute("href") || "";\n      if (href.indexOf("/checkout") !== -1 || href.indexOf("/cart/clear") !== -1) return;\n      if (href === "/cart" || href.indexOf("/cart?") === 0 || href === "/cart/") {\n        e.preventDefault();\n        e.stopPropagation();\n        e.stopImmediatePropagation();\n        if (window.CCD && window.CCD.openDrawer) { window.CCD.openDrawer(); }\n        else { window.__ccd_early_open = true; }\n        return;\n      }\n    }\n    var btn = e.target.closest ? e.target.closest(\'[data-cart-toggle], .js-drawer-open-cart, .js-cart-toggle, .site-header__cart, .header__icon--cart, [data-action="toggle-cart"], cart-toggle, .cart-icon-bubble, .cart-count-bubble, #cart-icon-bubble, [aria-controls="CartDrawer"]\') : null;\n    if (btn) {\n      e.preventDefault();\n      e.stopPropagation();\n      e.stopImmediatePropagation();\n      if (window.CCD && window.CCD.openDrawer) { window.CCD.openDrawer(); }\n      else { window.__ccd_early_open = true; }\n    }\n  }\n  document.addEventListener("click", handleCartClick, true);\n  document.addEventListener("mousedown", handleCartClick, true);\n  document.addEventListener("touchstart", handleCartClick, true);\n\n  var script = document.createElement("script");\n  script.src = "{{ \'v14-complete.js\' | asset_url }}";\n  script.async = true;\n  document.body.appendChild(script);\n})();\n</script>';
  
  console.log('Step 1: Upload eliminai-cart-embed snippet');
  await putAsset('snippets/eliminai-cart-embed.liquid', embedSnippet);
  
  // Step 2: Upload latest v14-complete.js  
  console.log('\nStep 2: Upload v14-complete.js');
  var jsCode = fs.readFileSync('v14-complete.js', 'utf8');
  await putAsset('assets/v14-complete.js', jsCode);
  
  // Step 3: Modify theme.liquid — add ccd-theme-hide style + render snippet
  console.log('\nStep 3: Modify theme.liquid');
  var themeAsset = await getAsset('layout/theme.liquid');
  if (!themeAsset) {
    console.log('ERROR: Cannot read theme.liquid');
    await p.$disconnect();
    return;
  }
  
  var themeContent = themeAsset.value;
  var modified = false;
  
  // Add ccd-theme-hide style after <head> if not present
  if (!themeContent.includes('ccd-theme-hide')) {
    var headIdx = themeContent.indexOf('<head');
    var headCloseIdx = themeContent.indexOf('>', headIdx);
    var insertPoint = headCloseIdx + 1;
    var hideStyle = '\n<style id="ccd-theme-hide">\n#CartDrawer, cart-drawer, .cart-drawer, [data-drawer=cart-drawer], .js-cart-drawer,\n.drawer--cart, [data-section-type="cart-drawer"], .cart-drawer-wrapper { display: none !important; visibility: hidden !important; pointer-events: none !important; }\n</style>\n';
    themeContent = themeContent.substring(0, insertPoint) + hideStyle + themeContent.substring(insertPoint);
    modified = true;
    console.log('  Added ccd-theme-hide style');
  } else {
    console.log('  ccd-theme-hide already present');
  }
  
  // Add render snippet before </body> if not present
  if (!themeContent.includes('eliminai-cart-embed')) {
    var bodyCloseIdx = themeContent.lastIndexOf('</body>');
    if (bodyCloseIdx !== -1) {
      var renderTag = "{% render 'eliminai-cart-embed' %}\n";
      themeContent = themeContent.substring(0, bodyCloseIdx) + renderTag + themeContent.substring(bodyCloseIdx);
      modified = true;
      console.log('  Added eliminai-cart-embed render tag');
    }
  } else {
    console.log('  eliminai-cart-embed render already present');
  }
  
  // Add v14-drawer render before </body> if not present
  if (!themeContent.includes('v14-drawer')) {
    var bodyCloseIdx2 = themeContent.lastIndexOf('</body>');
    if (bodyCloseIdx2 !== -1) {
      var renderTag2 = "{% render 'v14-drawer' %}\n";
      themeContent = themeContent.substring(0, bodyCloseIdx2) + renderTag2 + themeContent.substring(bodyCloseIdx2);
      modified = true;
      console.log('  Added v14-drawer render tag');
    }
  } else {
    console.log('  v14-drawer render already present');
  }
  
  if (modified) {
    await putAsset('layout/theme.liquid', themeContent);
  } else {
    console.log('  No changes needed');
  }
  
  console.log('\nDone! Test store should now load the cart drawer.');
  await p.$disconnect();
}
main().catch(function(e) { console.error(e); p.$disconnect(); });
