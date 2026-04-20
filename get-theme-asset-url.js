const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find the test store
  const store = await prisma.store.findFirst({ where: { shopDomain: 'eliminai-test.myshopify.com' } });
  if (!store) {
    console.log('Store not found, listing all stores:');
    const all = await prisma.store.findMany({ select: { shopDomain: true, demoThemeId: true } });
    console.log(all);
    return;
  }

  console.log('Store:', store.shopDomain);
  console.log('Demo theme:', store.demoThemeId);
  console.log('Access token exists:', !!store.accessToken);

  if (!store.accessToken) {
    console.log('No access token!');
    return;
  }

  // Get asset URL
  const themeId = store.demoThemeId || store.liveThemeId;
  if (!themeId) {
    // List themes
    const resp = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes.json', {
      headers: { 'X-Shopify-Access-Token': store.accessToken }
    });
    const data = await resp.json();
    console.log('Themes:', data.themes?.map(t => ({ id: t.id, name: t.name, role: t.role })));
    return;
  }

  // Get the v14-complete.js asset to find public URL
  const resp = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/themes/' + themeId + '/assets.json?asset[key]=assets/v14-complete.js', {
    headers: { 'X-Shopify-Access-Token': store.accessToken }
  });
  const data = await resp.json();
  if (data.asset) {
    console.log('Asset public URL:', data.asset.public_url);
    console.log('Asset CDN URL:', data.asset.public_url || 'N/A');
    console.log('Updated at:', data.asset.updated_at);
    console.log('Size:', data.asset.size);
  } else {
    console.log('Asset not found:', JSON.stringify(data).slice(0, 200));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
