const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eliminai-test.myshopify.com' },
    select: { shopDomain: true, accessToken: true }
  });
  if (!store || !store.accessToken) { console.log('No token'); return; }

  const res = await fetch('https://eliminai-test.myshopify.com/admin/api/2025-01/products/10181490475321.json', {
    headers: { 'X-Shopify-Access-Token': store.accessToken }
  });
  if (!res.ok) { console.log('Admin API error:', res.status, await res.text()); return; }
  const data = await res.json();
  console.log('Title:', data.product.title);
  console.log('Status:', data.product.status);
  console.log('Variants:');
  data.product.variants.forEach(v => console.log('  ', v.id, '$'+v.price, 'inventory:', v.inventory_quantity));

  // Also check if variant can be added to cart
  const cartRes = await fetch('https://eliminai-test.myshopify.com/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ id: 52419785851193, quantity: 1 }] })
  });
  console.log('\nCart add test:', cartRes.status);
  const cartData = await cartRes.text();
  console.log('Response:', cartData.substring(0, 200));
}
check().finally(() => p.$disconnect());
