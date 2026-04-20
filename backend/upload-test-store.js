const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();
const ROOT = path.join(__dirname, '..');

async function main() {
  const store = await prisma.store.findFirst({ where: { shopDomain: 'eliminai-test.myshopify.com' } });
  if (!store || !store.accessToken || !store.demoThemeId) {
    console.log('Missing store/token/themeId');
    return;
  }

  const themeId = store.demoThemeId;
  const token = store.accessToken;
  const domain = store.shopDomain;

  const files = [
    { local: path.join(ROOT, 'v14-complete.js'), remote: 'assets/v14-complete.js' },
    { local: path.join(ROOT, 'v14-css.css'), remote: 'assets/v14-css.css' },
    { local: path.join(ROOT, 'v14-drawer.liquid'), remote: 'snippets/v14-drawer.liquid' },
    { local: path.join(ROOT, 'v14-cart-item.liquid'), remote: 'snippets/cart-item.liquid' },
  ];

  for (const file of files) {
    const content = fs.readFileSync(file.local, 'utf8');
    console.log('Uploading', file.remote, '(' + (content.length / 1024).toFixed(1) + ' KB) to', domain, 'theme', themeId);

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
      console.log('  OK', file.remote, '- public_url:', data.asset.public_url || 'N/A');
    } else {
      console.log('  FAIL', file.remote, JSON.stringify(data).slice(0, 300));
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
