const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

async function upload() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  const token = store.accessToken;
  const domain = store.shopDomain;
  const DEMO_THEME = '158622155003';

  const code = fs.readFileSync('C:/Projects/eliminai-cart-drawer/v14-complete.js', 'utf8');
  require('./pre-upload-gate')(code, 'upload-demo-js → DEMO theme');
  console.log('JS file size:', code.length, 'bytes');

  const res = await fetch(`https://${domain}/admin/api/2025-01/themes/${DEMO_THEME}/assets.json`, {
    method: 'PUT',
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      asset: {
        key: 'assets/v14-complete.js',
        value: code
      }
    })
  });
  
  const data = await res.json();
  if (data.errors) {
    console.error('Upload errors:', JSON.stringify(data.errors));
  } else {
    console.log('Uploaded to DEMO theme:', data.asset?.key, '| updated_at:', data.asset?.updated_at);
  }
  
  await p.$disconnect();
}
upload().catch(e => { console.error(e); p.$disconnect(); });
