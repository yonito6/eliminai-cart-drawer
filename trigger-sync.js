const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();
async function main() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { id: true, shopDomain: true }
  });
  console.log('Store:', store.id, store.shopDomain);
  
  // Trigger the gift discount sync API
  const url = 'https://eliminai-cart-drawer-production.up.railway.app/api/stores/' + store.id + '/gift-discounts';
  console.log('POST', url);
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  const data = await res.json();
  console.log('Response:', JSON.stringify(data, null, 2));
  
  await p.$disconnect();
}
main().catch(e => { console.error(e); p.$disconnect(); });
