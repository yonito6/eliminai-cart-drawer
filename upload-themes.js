const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

async function upload() {
  // === PRE-UPLOAD GATE — tests MUST pass before uploading ===
  console.log('Running pre-upload tests...');
  try {
    require('child_process').execSync('node tests/pre-upload-gate.js', { stdio: 'inherit', timeout: 30000 });
  } catch (e) {
    console.error('UPLOAD ABORTED - fix failing tests first!');
    process.exit(1);
  }
  console.log('');

  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });

  const code = fs.readFileSync('v14-complete.js', 'utf8');

  // --live flag = deploy to both DEMO + LIVE
  // no flag = DEMO only (safe default)
  const deployLive = process.argv.includes('--live');

  const themes = [
    { id: 158622155003, name: 'DEMO' }
  ];
  if (deployLive) {
    themes.push({ id: 158577557755, name: 'LIVE' });
  } else {
    console.log('ℹ️  DEMO only (use --live to also deploy to LIVE)\n');
  }

  for (const theme of themes) {
    const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes/' + theme.id + '/assets.json', {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': store.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ asset: { key: 'assets/v14-complete.js', value: code } })
    });
    const data = await res.json();
    if (data.asset) {
      console.log(theme.name + ': uploaded (' + code.length + ' bytes)');
    } else {
      console.log(theme.name + ': ERROR', JSON.stringify(data.errors || data));
    }
  }

  await p.$disconnect();
}
upload().catch(e => { console.error(e); p.$disconnect(); });
