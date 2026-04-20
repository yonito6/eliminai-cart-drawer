const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eliminai-test.myshopify.com' },
    select: { id: true, shopDomain: true, accessToken: true, config: true }
  });
  if (!store) { console.log('Store not found'); await p.$disconnect(); return; }

  // Delete the Shopify product
  const productId = 10180285727033;
  console.log('Deleting Shopify product', productId, '...');
  const res = await fetch(`https://${store.shopDomain}/admin/api/2025-01/products/${productId}.json`, {
    method: 'DELETE',
    headers: { 'X-Shopify-Access-Token': store.accessToken },
  });
  console.log('Delete status:', res.status, res.ok ? 'OK' : 'FAILED');

  // Remove variantId from DB config so the app flow can create it fresh
  const cfg = store.config || {};
  const sp = cfg.addons?.shippingProtection || {};
  if (sp.variantId) delete sp.variantId;
  if (sp.config?.variantId) delete sp.config.variantId;
  if (sp.handle) delete sp.handle;
  cfg.addons = { ...cfg.addons, shippingProtection: sp };

  await p.store.update({ where: { id: store.id }, data: { config: cfg } });
  console.log('DB cleaned — variantId and handle removed');
  console.log('Now the app will show "Save & Create Product" so you can test the full flow');

  await p.$disconnect();
})();
