const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  const token = store.accessToken;
  const domain = store.shopDomain;

  // Check protection product via REST
  const res = await fetch(`https://${domain}/admin/api/2025-01/products.json?handle=shipping-protection-1`, {
    headers: { 'X-Shopify-Access-Token': token }
  });
  const data = await res.json();
  const product = data.products[0];

  if (!product) {
    console.log('PROTECTION PRODUCT NOT FOUND!');
    await p.$disconnect();
    return;
  }

  console.log('=== Protection Product ===');
  console.log('ID:', product.id);
  console.log('Title:', product.title);
  console.log('Status:', product.status);
  console.log('Published:', product.published_at);
  console.log('Tags:', product.tags);

  product.variants.forEach(v => {
    console.log('\nVariant:', v.id);
    console.log('  Price:', v.price);
    console.log('  Inventory:', v.inventory_quantity);
    console.log('  Inventory policy:', v.inventory_policy);
    console.log('  Available:', v.inventory_quantity > 0 || v.inventory_policy === 'continue');
  });

  // Also test adding it directly to verify it works
  console.log('\n=== Test Add Protection ===');
  // Clear cart first
  await fetch(`https://${domain}/cart/clear.js`, { method: 'POST' });

  const addRes = await fetch(`https://${domain}/cart/add.js`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ id: 47779174023419, quantity: 1 }] })
  });
  const addData = await addRes.json();
  console.log('Add result:', addData.items ? addData.items.length + ' items' : 'FAILED: ' + JSON.stringify(addData));

  if (addData.items && addData.items[0]) {
    console.log('  Handle:', addData.items[0].handle);
    console.log('  Price:', addData.items[0].price);
    console.log('  Final price:', addData.items[0].final_price);
  }

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
