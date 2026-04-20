// Test the full cart flow:
// 1. Add 3+ items to cart (to trigger "1+2 FREE" and tier-2 gift)
// 2. Add the Watch Case gift
// 3. Check cart state — verify discounts

const https = require('https');

function shopifyFetch(path, method, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'eleganto-3011.myshopify.com',
      path: path,
      method: method || 'GET',
      headers: { 'Content-Type': 'application/json' },
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Clear cart first
  await shopifyFetch('/cart/clear.js', 'POST', {});
  console.log('Cart cleared');

  // Add 3 watches (to trigger "1+2 FREE" and tier-2 gift)
  // Black variant: 46858498015483
  // Blue variant: 46858498048251
  // White variant: 46858497982715
  const items = [
    { id: 46858498015483, quantity: 1 },  // Black
    { id: 46858498048251, quantity: 1 },  // Blue
    { id: 46858497982715, quantity: 1 },  // White
  ];

  for (const item of items) {
    await shopifyFetch('/cart/add.js', 'POST', { items: [item] });
  }
  console.log('Added 3 watches');

  // Add Watch Case gift (variantId from config: 46941745742075)
  await shopifyFetch('/cart/add.js', 'POST', { items: [{ id: 46941745742075, quantity: 1 }] });
  console.log('Added Watch Case gift');

  // Check cart
  const cart = await shopifyFetch('/cart.json');
  console.log('\n=== CART STATE ===');
  console.log('Items:', cart.items?.length);
  for (const item of cart.items || []) {
    const price = (item.final_line_price / 100).toFixed(2);
    const orig = (item.original_line_price / 100).toFixed(2);
    const discounts = item.discounts?.map(d => `${d.title} (-$${(d.amount/100).toFixed(2)})`).join(', ') || 'none';
    console.log(`  ${item.title} (${item.handle}): $${price} (orig: $${orig}) | discounts: ${discounts}`);
  }
  console.log('Cart total: $' + (cart.total_price / 100).toFixed(2));
  console.log('Total discount: $' + (cart.total_discount / 100).toFixed(2));
}

main().catch(e => console.error(e));
