const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

async function main() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eliminai-test.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  
  // Use the last known-good version before today's session changes
  var code = fs.readFileSync('snapshots/v16.2-universal-theme-suppress-20260418.js', 'utf8');
  var themeId = 185993036089; // main theme
  
  var res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes/' + themeId + '/assets.json', {
    method: 'PUT',
    headers: {
      'X-Shopify-Access-Token': store.accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ asset: { key: 'assets/v14-complete.js', value: code } })
  });
  var data = await res.json();
  if (data.asset) {
    console.log('RESTORED test-data theme: ' + code.length + ' bytes (v16.2 pre-session)');
  } else {
    console.log('ERROR:', JSON.stringify(data.errors || data));
  }
  
  await p.$disconnect();
}
main().catch(function(e) { console.error(e); p.$disconnect(); });
