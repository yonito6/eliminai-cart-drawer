#!/usr/bin/env node
var path = require('path');
var { PrismaClient } = require(path.resolve(__dirname, '..', 'backend', 'node_modules', '@prisma', 'client'));
var p = new PrismaClient();

async function gql(d, t, q) {
  var r = await fetch('https://' + d + '/admin/api/2025-01/graphql.json', {
    method: 'POST', headers: { 'X-Shopify-Access-Token': t, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q })
  });
  return r.json();
}

async function run() {
  var store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  var token = store.accessToken;
  var domain = store.shopDomain;

  // Duplicate product images
  var d1 = await gql(domain, token, '{ product(id: "gid://shopify/Product/9290736042235") { title handle featuredImage { url } images(first: 10) { nodes { id url position } } variants(first: 3) { nodes { id image { url } } } } }');
  var dup = d1.data.product;
  console.log('=== DUPLICATE (gift) ===');
  console.log('Title:', dup.title, '| Handle:', dup.handle);
  console.log('Featured:', dup.featuredImage && dup.featuredImage.url ? dup.featuredImage.url.substring(0, 130) : 'NONE');
  console.log('Images:');
  dup.images.nodes.forEach(function(img, i) {
    console.log('  ' + (i+1) + '. pos=' + img.position + '  ' + img.url.substring(0, 130));
    console.log('     ID: ' + img.id);
  });
  var vi = dup.variants.nodes[0];
  console.log('Variant image:', vi && vi.image ? vi.image.url.substring(0, 130) : 'NONE (uses product first image)');

  // Original product images
  var d2 = await gql(domain, token, '{ products(first: 2, query: "handle:eleganto-case status:active") { nodes { title handle featuredImage { url } images(first: 10) { nodes { id url position } } } } }');
  var orig = d2.data.products.nodes.find(function(p2) { return p2.handle === 'eleganto-case'; });
  if (orig) {
    console.log('\n=== ORIGINAL ===');
    console.log('Title:', orig.title, '| Handle:', orig.handle);
    console.log('Featured:', orig.featuredImage ? orig.featuredImage.url.substring(0, 130) : 'NONE');
    console.log('Images:');
    orig.images.nodes.forEach(function(img, i) {
      console.log('  ' + (i+1) + '. pos=' + img.position + '  ' + img.url.substring(0, 130));
    });
  }

  await p.$disconnect();
}
run().catch(function(e) { console.error(e); process.exit(1); });
