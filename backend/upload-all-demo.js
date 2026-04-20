const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function upload() {
  const store = await prisma.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' } });
  if (!store || !store.accessToken || !store.demoThemeId) {
    console.log('Missing store/token/themeId');
    return;
  }

  const themeId = store.demoThemeId;
  const token = store.accessToken;
  const domain = store.shopDomain;

  const files = [
    { local: path.join(__dirname, '..', 'v14-complete.js'), remote: 'assets/v14-complete.js' },
    { local: path.join(__dirname, '..', 'v14-css.css'), remote: 'assets/v14-css.css' },
    { local: path.join(__dirname, '..', 'v14-drawer.liquid'), remote: 'snippets/v14-drawer.liquid' },
    { local: path.join(__dirname, '..', 'v14-cart-item.liquid'), remote: 'snippets/cart-item.liquid' },
  ];

  for (const file of files) {
    const content = fs.readFileSync(file.local, 'utf8');
    console.log('Uploading', file.remote, '(' + (content.length / 1024).toFixed(1) + ' KB)...');

    const resp = await fetch('https://' + domain + '/admin/api/2025-01/themes/' + themeId + '/assets.json', {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ asset: { key: file.remote, value: content } })
    });

    const data = await resp.json();
    if (data.asset) {
      console.log('  OK', file.remote, '- updated:', data.asset.updated_at);
    } else {
      console.log('  FAILED:', JSON.stringify(data.errors || data));
    }
  }

  console.log('\nAll files uploaded to DEMO theme', themeId);
}

upload().catch(console.error).finally(() => prisma.$disconnect());
