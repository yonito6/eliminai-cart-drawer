const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

function usage() {
  console.log('Usage:');
  console.log('  node upload-themes.js <shopDomain> --list                # list themes for the store');
  console.log('  node upload-themes.js <shopDomain> --theme <nameOrId>    # upload to one theme (repeatable)');
  console.log('  node upload-themes.js <shopDomain> --unpublished         # upload to all unpublished (safe)');
  console.log('');
  console.log('Examples:');
  console.log('  node upload-themes.js eliminai-test.myshopify.com --list');
  console.log('  node upload-themes.js eliminai-test.myshopify.com --theme test-data');
  console.log('  node upload-themes.js eleganto-3011.myshopify.com --theme DEMO');
}

async function main() {
  const args = process.argv.slice(2);
  const shopDomain = args.find(a => !a.startsWith('--'));
  if (!shopDomain) { usage(); process.exit(1); }

  const list = args.includes('--list');
  const unpublished = args.includes('--unpublished');
  const themeArgs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--theme' && args[i + 1]) themeArgs.push(args[i + 1]);
  }

  if (!list && !unpublished && themeArgs.length === 0) { usage(); process.exit(1); }

  const store = await p.store.findFirst({
    where: { shopDomain },
    select: { accessToken: true, shopDomain: true }
  });
  if (!store || !store.accessToken) {
    console.error('Store not found or missing accessToken: ' + shopDomain);
    process.exit(1);
  }

  // Fetch all themes for this store
  const tRes = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes.json', {
    headers: { 'X-Shopify-Access-Token': store.accessToken }
  });
  const tData = await tRes.json();
  const allThemes = tData.themes || [];

  if (list) {
    console.log('Themes on ' + store.shopDomain + ':');
    for (const t of allThemes) console.log('  [' + t.id + '] ' + t.name + ' (' + t.role + ')');
    await p.$disconnect();
    return;
  }

  // Pre-upload gate (only for actual uploads)
  console.log('Running pre-upload tests...');
  try {
    require('child_process').execSync('node tests/pre-upload-gate.js', { stdio: 'inherit', timeout: 30000 });
  } catch (e) {
    console.error('UPLOAD ABORTED - fix failing tests first!');
    process.exit(1);
  }
  console.log('');

  // Resolve target themes
  const targets = [];
  if (unpublished) {
    for (const t of allThemes) if (t.role === 'unpublished') targets.push(t);
  }
  for (const arg of themeArgs) {
    const match = allThemes.find(t => String(t.id) === arg || t.name === arg);
    if (!match) { console.error('Theme not found on ' + store.shopDomain + ': ' + arg); process.exit(1); }
    if (!targets.find(t => t.id === match.id)) targets.push(match);
  }

  if (targets.length === 0) { console.error('No themes resolved.'); process.exit(1); }

  // Safety prompt for any main (published) theme
  const mainTargets = targets.filter(t => t.role === 'main');
  if (mainTargets.length > 0) {
    console.log('WARNING: targeting MAIN (published) theme(s):');
    for (const t of mainTargets) console.log('  - [' + t.id + '] ' + t.name);
    console.log('Customers will see changes immediately. Press Ctrl+C within 5s to abort.');
    await new Promise(r => setTimeout(r, 5000));
  }

  const code = fs.readFileSync('v14-complete.js', 'utf8');

  for (const theme of targets) {
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
      console.log(theme.name + ' [' + theme.role + ']: uploaded (' + code.length + ' bytes)');
    } else {
      console.log(theme.name + ' [' + theme.role + ']: ERROR ' + JSON.stringify(data.errors || data));
    }
  }

  await p.$disconnect();
}

main().catch(e => { console.error(e); p.$disconnect(); });
