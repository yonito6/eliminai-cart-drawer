const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const p = new PrismaClient();

(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eliminai-test.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  const token = store.accessToken;
  const domain = store.shopDomain;
  const TEST_THEME = '185993036089';

  const code = fs.readFileSync(path.join(__dirname, '..', 'v14-complete.js'), 'utf8');
  require('./pre-upload-gate')(code, 'upload-test → TEST theme');
  console.log('Uploading to TEST theme', TEST_THEME, '| Size:', code.length, 'bytes');

  const res = await fetch('https://' + domain + '/admin/api/2025-01/themes/' + TEST_THEME + '/assets.json', {
    method: 'PUT',
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      asset: { key: 'assets/v14-complete.js', value: code }
    })
  });
  const data = await res.json();
  if (data.errors) {
    console.error('Upload errors:', JSON.stringify(data.errors));
  } else {
    console.log('Uploaded to TEST theme:', data.asset?.key, '| updated_at:', data.asset?.updated_at);
  }
  await p.$disconnect();
})();
