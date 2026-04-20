const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function check() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  const token = store.accessToken;
  const domain = store.shopDomain;

  const res = await fetch(`https://${domain}/admin/api/2025-01/themes/158577557755/assets.json?asset[key]=assets/v14-complete.js`, {
    headers: { 'X-Shopify-Access-Token': token }
  });
  const data = await res.json();
  require('fs').writeFileSync('live-v14-complete.js', data.asset.value, 'utf8');
  console.log('Saved live-v14-complete.js, length:', data.asset.value.length);
  
  await p.$disconnect();
}
check().catch(e => { console.error(e); p.$disconnect(); });
