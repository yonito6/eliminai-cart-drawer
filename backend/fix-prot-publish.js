const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function fix() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eliminai-test.myshopify.com' },
    select: { shopDomain: true, accessToken: true }
  });
  if (!store || !store.accessToken) { console.log('No token'); return; }
  const token = store.accessToken;
  const domain = store.shopDomain;

  // Publish the product (set published_at to now)
  const res = await fetch(`https://${domain}/admin/api/2025-01/products/10181490475321.json`, {
    method: 'PUT',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product: {
        id: 10181490475321,
        published: true
      }
    })
  });
  if (!res.ok) {
    console.log('Publish failed:', res.status, await res.text());
    return;
  }
  const data = await res.json();
  console.log('Published at:', data.product.published_at);
  console.log('Done — protection product now available for cart/add.js');
}
fix().finally(() => p.$disconnect());
