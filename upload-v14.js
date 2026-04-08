const https = require('https');
const fs = require('fs');
const path = require('path');

const store = 'eleganto-3011.myshopify.com';
const token = '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';
const themeId = 158546952443;

function upload(key, value) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ asset: { key, value } });
    const req = https.request({
      hostname: store,
      path: '/admin/api/2025-01/themes/' + themeId + '/assets.json',
      method: 'PUT',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log(key + ': ' + res.statusCode);
        if (res.statusCode !== 200) console.log(d.substring(0, 500));
        resolve();
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const dir = path.dirname(__filename);
const js = fs.readFileSync(path.join(dir, 'v14-complete.js'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'v14-css.css'), 'utf8');
const liquid = fs.readFileSync(path.join(dir, 'v14-drawer.liquid'), 'utf8');
const cartItem = fs.readFileSync(path.join(dir, 'v14-cart-item.liquid'), 'utf8');
const cartAjax = fs.readFileSync(path.join(dir, 'v14-cart-ajax.liquid'), 'utf8');

console.log('JS:', js.length, 'CSS:', css.length, 'Liquid:', liquid.length, 'CartItem:', cartItem.length, 'CartAjax:', cartAjax.length);

(async () => {
  await upload('assets/custom-cart-drawer.js', js);
  await upload('assets/custom-cart-drawer.css', css);
  await upload('snippets/cart-drawer.liquid', liquid);
  await upload('snippets/cart-item.liquid', cartItem);
  await upload('templates/cart.ajax.liquid', cartAjax);
  console.log('All 5 uploaded!');
})();
