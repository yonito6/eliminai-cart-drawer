#!/usr/bin/env node
const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '..', 'backend', 'node_modules', '@prisma', 'client'));
const prisma = new PrismaClient();
const GIFT_TAG = '_eliminai-gift';

async function gql(d, t, q, v) {
  const r = await fetch('https://' + d + '/admin/api/2025-01/graphql.json', {
    method: 'POST', headers: { 'X-Shopify-Access-Token': t, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q, variables: v })
  });
  if (!r.ok) throw new Error('GQL ' + r.status);
  return r.json();
}

async function run() {
  var store = await prisma.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { id: true, shopDomain: true, accessToken: true, config: true, demoConfig: true },
  });
  if (!store || !store.accessToken) { console.error('Store not found'); process.exit(1); }
  console.log('Store:', store.id);
  var token = store.accessToken;

  // Step 1: Check existing duplicates
  console.log('\nStep 1: Check existing gift duplicates');
  var exQ = '{ products(first: 50, query: "tag:' + GIFT_TAG + '") { nodes { id title handle status variants(first:3) { nodes { id price } } } } }';
  var ex = await gql(store.shopDomain, token, exQ);
  var existing = ex?.data?.products?.nodes || [];
  console.log('Found', existing.length, 'existing duplicates');
  existing.forEach(function(p) { console.log('  -', p.title, p.handle, p.status, p.variants?.nodes?.[0]?.price); });

  // Step 2: Check original
  console.log('\nStep 2: Check original product');
  var orQ = '{ products(first: 5, query: "handle:eleganto-case") { nodes { id title handle status variants(first:3) { nodes { id price } } } } }';
  var or2 = await gql(store.shopDomain, token, orQ);
  var origs = or2?.data?.products?.nodes || [];
  origs.forEach(function(p) { console.log('  -', p.title, p.handle, p.status); (p.variants?.nodes||[]).forEach(function(v) { console.log('    ', v.id, v.price); }); });
  var orig = origs.find(function(p) { return p.handle === 'eleganto-case' && p.status === 'ACTIVE'; });
  if (!orig) { console.error('Original not found or not ACTIVE'); process.exit(1); }
  console.log('Original:', orig.title, orig.id, 'price:', orig.variants?.nodes?.[0]?.price);

  if (process.argv.indexOf('--execute') === -1) {
    console.log('\nDRY RUN - Run with --execute to sync');
    await prisma.$disconnect();
    return;
  }

  // Step 3: Delete old duplicates
  console.log('\nStep 3: Delete old duplicates');
  for (var i = 0; i < existing.length; i++) {
    var d = existing[i];
    console.log('  Deleting:', d.title, d.id);
    await gql(store.shopDomain, token, 'mutation { productDelete(input: { id: "' + d.id + '" }) { userErrors { field message } } }');
  }

  // Step 4: Duplicate at $0
  console.log('\nStep 4: Duplicate at $0');
  var dupQ = 'mutation productDuplicate($productId: ID!, $newTitle: String!, $includeImages: Boolean!, $newStatus: ProductStatus) { productDuplicate(productId: $productId, newTitle: $newTitle, includeImages: $includeImages, newStatus: $newStatus) { newProduct { id handle title variants(first: 10) { nodes { id price } } } userErrors { field message } } }';
  var dr = await gql(store.shopDomain, token, dupQ, { productId: orig.id, newTitle: orig.title, includeImages: true, newStatus: 'ACTIVE' });
  var de = dr?.data?.productDuplicate?.userErrors;
  if (de?.length > 0) { console.error('Failed:', de); process.exit(1); }
  var np = dr?.data?.productDuplicate?.newProduct;
  console.log('Created:', np.title, np.handle);
  var vs = np.variants?.nodes || [];
  var op = orig.variants?.nodes?.[0]?.price || '49.99';

  // Step 5: Set price to $0
  console.log('\nStep 5: Set price to $0');
  var varQ = 'mutation productVariantUpdate($input: ProductVariantInput!) { productVariantUpdate(input: $input) { productVariant { id price compareAtPrice } userErrors { field message } } }';
  for (var j = 0; j < vs.length; j++) {
    await gql(store.shopDomain, token, varQ, { input: { id: vs[j].id, price: '0', compareAtPrice: op } });
    console.log('  Set', vs[j].id, 'to $0');
  }

  // Step 6: Tag
  console.log('\nStep 6: Tag');
  await gql(store.shopDomain, token, 'mutation tagsAdd($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { field message } } }', { id: np.id, tags: [GIFT_TAG] });

  // Step 7: Unpublish
  console.log('\nStep 7: Unpublish');
  var pr = await gql(store.shopDomain, token, '{ publications(first: 10) { nodes { id name } } }');
  var osPub = (pr?.data?.publications?.nodes || []).find(function(p) { return p.name === 'Online Store'; });
  if (osPub) {
    await gql(store.shopDomain, token, 'mutation publishableUnpublish($id: ID!, $input: [PublicationInput!]!) { publishableUnpublish(id: $id, input: $input) { userErrors { field message } } }', { id: np.id, input: [{ publicationId: osPub.id }] });
    console.log('Unpublished');
  }

  // Step 8: Remove from collections
  console.log('\nStep 8: Remove from collections');
  var cr = await gql(store.shopDomain, token, '{ product(id: "' + np.id + '") { collections(first: 50) { nodes { id title } } } }');
  var colls = cr?.data?.product?.collections?.nodes || [];
  for (var k = 0; k < colls.length; k++) {
    await gql(store.shopDomain, token, 'mutation collectionRemoveProducts($id: ID!, $productIds: [ID!]!) { collectionRemoveProducts(id: $id, productIds: $productIds) { userErrors { field message } } }', { id: colls[k].id, productIds: [np.id] });
    console.log('  Removed from:', colls[k].title);
  }

  // Step 9: Update DB config
  console.log('\nStep 9: Update DB config');
  var dvid = vs[0].id.replace('gid://shopify/ProductVariant/', '');
  var gm = { originalHandle: 'eleganto-case', originalUrl: '/products/eleganto-case', duplicateHandle: np.handle, duplicateVariantId: dvid, duplicateGid: np.id };
  var fields = ['config', 'demoConfig'];
  for (var fi = 0; fi < fields.length; fi++) {
    var cf = fields[fi];
    var cfg = store[cf] || {};
    cfg.giftMappings = [gm];
    var tiers = cfg.addons?.freeShippingBar?.config?.tiers || [];
    for (var ti = 0; ti < tiers.length; ti++) {
      var tier = tiers[ti];
      var gps = tier.giftProducts || (tier.giftProduct ? [tier.giftProduct] : []);
      for (var gi = 0; gi < gps.length; gi++) {
        var gp = gps[gi];
        var lh = gp.originalHandle || gp.handle;
        if (lh === 'eleganto-case') {
          gp.originalHandle = 'eleganto-case'; gp.originalUrl = '/products/eleganto-case';
          gp.handle = np.handle; gp.variantId = parseInt(dvid) || gp.variantId;
        }
      }
      if (tier.giftProduct) {
        var gp2 = tier.giftProduct;
        var lh2 = gp2.originalHandle || gp2.handle;
        if (lh2 === 'eleganto-case') {
          gp2.originalHandle = 'eleganto-case'; gp2.originalUrl = '/products/eleganto-case';
          gp2.handle = np.handle; gp2.variantId = parseInt(dvid) || gp2.variantId;
        }
      }
    }
    var updateData = {};
    updateData[cf] = cfg;
    await prisma.store.update({ where: { id: store.id }, data: updateData });
    console.log('Updated', cf, 'handle:', np.handle, 'variant:', dvid);
  }

  console.log('\n=== SYNC COMPLETE ===');
  console.log('New gift:', np.handle, 'variant:', dvid, 'price: $0');
  await prisma.$disconnect();
}

run().catch(function(e) { console.error('ERROR:', e.message); process.exit(1); });
