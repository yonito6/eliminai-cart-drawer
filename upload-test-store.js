const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

async function upload() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eliminai-test.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });

  const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes.json', {
    headers: { 'X-Shopify-Access-Token': store.accessToken }
  });
  const data = await res.json();
  console.log('Themes:');
  data.themes.forEach(function(t) { console.log('  ' + t.id + ' - ' + t.name + ' (' + t.role + ')'); });

  const code = fs.readFileSync('v14-complete.js', 'utf8');
  for (const theme of data.themes) {
    const upRes = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes/' + theme.id + '/assets.json', {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': store.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ asset: { key: 'assets/v14-complete.js', value: code } })
    });
    const upData = await upRes.json();
    if (upData.asset) {
      console.log('UPLOADED to ' + theme.name + ' (' + theme.role + '): ' + code.length + ' bytes');
    } else {
      console.log('ERROR on ' + theme.name + ':', JSON.stringify(upData.errors || upData));
    }
  }
  await p.$disconnect();
}
upload().catch(function(e) { console.error(e); p.$disconnect(); });
