const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

async function uploadToTheme(shopDomain, token, themeId, themeName) {
  const jsCode = fs.readFileSync('../v14-complete.js', 'utf8');
  const res = await fetch(`https://${shopDomain}/admin/api/2025-10/themes/${themeId}/assets.json`, {
    method: 'PUT',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset: { key: 'assets/eliminai-cart-drawer.js', value: jsCode } }),
  });
  const data = await res.json();
  if (data.errors) {
    console.log(`  ERROR uploading to ${themeName}:`, data.errors);
  } else {
    console.log(`  Uploaded to ${themeName} (theme ${themeId}): ${jsCode.length} bytes`);
  }
}

(async () => {
  const store = await p.store.findFirst({ 
    where: { shopDomain: { contains: 'eleganto-3011' } },
    select: { shopDomain: true, accessToken: true }
  });
  if (!store) { console.log('No store'); return; }

  // Get all themes
  const res = await fetch(`https://${store.shopDomain}/admin/api/2025-10/themes.json`, {
    headers: { 'X-Shopify-Access-Token': store.accessToken },
  });
  const themes = (await res.json()).themes || [];
  
  for (const theme of themes) {
    if (theme.name.toLowerCase().includes('demo') || theme.role === 'main') {
      console.log(`Uploading to: ${theme.name} (${theme.id}, role=${theme.role})`);
      await uploadToTheme(store.shopDomain, store.accessToken, theme.id, theme.name);
    }
  }

  // Also upload to extension assets
  const extPath = '../extension/assets/eliminai-cart-drawer.js';
  if (fs.existsSync(extPath)) {
    fs.copyFileSync('../v14-complete.js', extPath);
    console.log('Copied to extension assets');
  }

  await p.$disconnect();
  console.log('Done!');
})();
