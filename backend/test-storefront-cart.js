// Simulate what a real browser does: add items to cart via AJAX, then read cart.js
const https = require('https');
const domain = 'eleganto-3011.myshopify.com';

function request(path, method, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: domain,
      path,
      method: method || 'GET',
      headers: { 'Content-Type': 'application/json' }
    };
    const req = https.request(opts, res => {
      const cookies = res.headers['set-cookie'] || [];
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ json: JSON.parse(data), cookies, status: res.statusCode }); }
        catch { resolve({ text: data, cookies, status: res.statusCode }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function requestWithCookies(path, method, body, cookieStr) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: domain,
      path,
      method: method || 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': cookieStr
      }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ json: JSON.parse(data), status: res.statusCode }); }
        catch { resolve({ text: data, status: res.statusCode }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  // 1. Clear cart first
  const clearRes = await request('/cart/clear.js', 'POST', {});
  console.log('Clear cart:', clearRes.status);
  const cookies = clearRes.cookies.map(c => c.split(';')[0]).join('; ');
  console.log('Session cookies:', cookies.substring(0, 100));

  // 2. Add 3 watches (Eleganto Luxe)
  const addWatches = await requestWithCookies('/cart/add.js', 'POST', 
    { items: [{ id: 45167742681339, quantity: 3 }] }, cookies);
  console.log('\nAdd 3 watches:', addWatches.status);

  // 3. Add 1 Eleganto Case
  const addCase = await requestWithCookies('/cart/add.js', 'POST',
    { items: [{ id: 46941745742075, quantity: 1 }] }, cookies);
  console.log('Add case:', addCase.status);

  // 4. Read cart.js — this shows final_line_price with discounts applied
  const cart = await requestWithCookies('/cart.js', 'GET', null, cookies);
  if (cart.json) {
    console.log('\n=== CART STATE ===');
    console.log('Total price:', cart.json.total_price, '(cents) = $' + (cart.json.total_price / 100));
    console.log('Total discount:', cart.json.total_discount, '(cents) = $' + (cart.json.total_discount / 100));
    console.log('Item count:', cart.json.item_count);
    cart.json.items.forEach(item => {
      console.log(`\n  ${item.title} (${item.handle})`);
      console.log(`    variant: ${item.variant_id}`);
      console.log(`    qty: ${item.quantity}`);
      console.log(`    price: ${item.price} (cents) = $${(item.price/100)}`);
      console.log(`    line_price: ${item.line_price} (cents) = $${(item.line_price/100)}`);
      console.log(`    final_line_price: ${item.final_line_price} (cents) = $${(item.final_line_price/100)}`);
      console.log(`    original_line_price: ${item.original_line_price} (cents) = $${(item.original_line_price/100)}`);
      console.log(`    total_discount: ${item.total_discount} (cents) = $${(item.total_discount/100)}`);
      console.log(`    discounts:`, JSON.stringify(item.discounts));
    });
  } else {
    console.log('Cart error:', cart.text?.substring(0, 500));
  }

  // 5. Clear cart
  await requestWithCookies('/cart/clear.js', 'POST', {}, cookies);
  console.log('\nCart cleared.');
}
test().catch(console.error);
