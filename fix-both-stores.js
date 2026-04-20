const fs = require('fs');
const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

async function listThemes(shopDomain, token) {
  const res = await fetch(`https://${shopDomain}/admin/api/2025-01/themes.json`, {
    headers: { 'X-Shopify-Access-Token': token }
  });
  const data = await res.json();
  return data.themes || [];
}

async function uploadAsset(shopDomain, token, themeId, key, value) {
  const res = await fetch(`https://${shopDomain}/admin/api/2025-01/themes/${themeId}/assets.json`, {
    method: 'PUT',
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ asset: { key, value } }),
  });
  if (!res.ok) {
    console.error('Upload failed:', res.status, await res.text());
    return false;
  }
  return true;
}

(async () => {
  // --- PART 1: Upload v14-complete.js to Eleganto DEMO theme ---
  console.log('\n=== PART 1: Eleganto DEMO theme ===');
  const eleganto = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { id: true, shopDomain: true, accessToken: true }
  });
  if (!eleganto) {
    console.log('Eleganto store not found in DB');
  } else {
    const themes = await listThemes(eleganto.shopDomain, eleganto.accessToken);
    console.log('Eleganto themes:');
    for (const t of themes) {
      console.log('  ' + t.id + ' | ' + t.name + ' | ' + t.role);
    }
    // Find unpublished (DEMO) themes
    const demoThemes = themes.filter(t => t.role !== 'main');
    if (demoThemes.length === 0) {
      console.log('No DEMO theme found on Eleganto');
    } else {
      const jsContent = fs.readFileSync('./v14-complete.js', 'utf8');
      for (const demo of demoThemes) {
        console.log(`Uploading to "${demo.name}" (${demo.id})...`);
        const ok = await uploadAsset(eleganto.shopDomain, eleganto.accessToken, demo.id, 'assets/v14-complete.js', jsContent);
        console.log(ok ? '  SUCCESS' : '  FAILED');
      }
    }
  }

  // --- PART 2: Create protection product on eliminai-test ---
  console.log('\n=== PART 2: Create protection product on eliminai-test ===');
  const testStore = await p.store.findFirst({
    where: { shopDomain: 'eliminai-test.myshopify.com' },
    select: { id: true, shopDomain: true, accessToken: true, config: true }
  });
  if (!testStore) {
    console.log('Test store not found');
    await p.$disconnect();
    return;
  }

  const cfg = testStore.config || {};
  const sp = (cfg.addons && cfg.addons.shippingProtection) || {};
  console.log('Current variantId:', sp.config?.variantId || sp.variantId || 'NONE');

  if (sp.config?.variantId || sp.variantId) {
    console.log('Protection product already exists, skipping creation');
  } else {
    console.log('Creating Shopify protection product...');

    // Create product via REST API
    const productData = {
      product: {
        title: 'Shipping Protection',
        body_html: 'Covers lost, stolen, or damaged packages',
        vendor: 'Eliminai',
        product_type: 'Service',
        tags: '_eliminai-cart-protection',
        published: false,
        variants: [{
          title: 'Default',
          price: '4.99',
          requires_shipping: false,
          taxable: false,
          inventory_management: null,
          inventory_policy: 'deny',
        }],
      }
    };

    const createRes = await fetch(`https://${testStore.shopDomain}/admin/api/2025-01/products.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': testStore.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(productData),
    });

    if (!createRes.ok) {
      console.error('Failed to create product:', createRes.status, await createRes.text());
    } else {
      const created = await createRes.json();
      const product = created.product;
      const variant = product.variants[0];
      console.log('Product created:', product.title, '(ID:', product.id + ')');
      console.log('Variant ID:', variant.id);
      console.log('Price:', variant.price);
      console.log('Handle:', product.handle);

      // Update DB config with variantId and handle
      const addons = cfg.addons || {};
      addons.shippingProtection = {
        ...sp,
        config: {
          ...(sp.config || {}),
          variantId: String(variant.id),
          price: 4.99,
          singlePrice: 4.99,
        },
        handle: product.handle,
        enabled: true,
        variantId: String(variant.id),
      };
      cfg.addons = addons;

      await p.store.update({
        where: { id: testStore.id },
        data: { config: cfg },
      });
      console.log('DB updated with variantId:', variant.id);

      // Unpublish from online store (make invisible to customers browsing)
      // The published:false in create should handle it, but let's also remove from sales channels
      try {
        const gqlRes = await fetch(`https://${testStore.shopDomain}/admin/api/2025-01/graphql.json`, {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': testStore.accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `mutation { publishableUnpublish(id: "gid://shopify/Product/${product.id}", input: { publicationId: "gid://shopify/Publication/1" }) { userErrors { message } } }`
          }),
        });
        console.log('Unpublished from Online Store');
      } catch (e) {
        console.log('Unpublish note:', e.message);
      }
    }
  }

  await p.$disconnect();
  console.log('\nDone!');
})();
