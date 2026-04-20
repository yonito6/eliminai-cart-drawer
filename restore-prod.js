const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

async function main() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  
  // Restore to v16.2 (last known good before today's session changes)
  var code = fs.readFileSync('snapshots/v16.2-universal-theme-suppress-20260418.js', 'utf8');
  var themes = [
    { id: 158622155003, name: 'DEMO' },
    { id: 145950245115, name: 'LIVE' }
  ];
  
  for (var t of themes) {
    var res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes/' + t.id + '/assets.json', {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': store.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ asset: { key: 'assets/v14-complete.js', value: code } })
    });
    var data = await res.json();
    if (data.asset) {
      console.log('RESTORED ' + t.name + ': ' + code.length + ' bytes (v16.2)');
    } else {
      console.log('ERROR ' + t.name + ':', JSON.stringify(data.errors || data));
    }
  }
  
  await p.$disconnect();
}
main().catch(function(e) { console.error(e); p.$disconnect(); });
