const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

async function main() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });

  async function gql(query) {
    var res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/graphql.json', {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query })
    });
    return res.json();
  }

  // Search for eleganto-case products
  var result1 = await gql('{ products(first: 10, query: "eleganto case") { nodes { id title handle status variants(first:1) { nodes { id price compareAtPrice } } } } }');
  console.log('=== "eleganto case" ===');
  if (result1.data.products.nodes.length === 0) console.log('  NONE');
  result1.data.products.nodes.forEach(function(n) {
    var v = n.variants.nodes[0];
    console.log('  ' + n.status + ' | ' + n.handle + ' | ' + n.title + ' | $' + v.price + ' | vid=' + v.id.split('/').pop());
  });

  // Search for golden love
  var result2 = await gql('{ products(first: 10, query: "golden love") { nodes { id title handle status variants(first:1) { nodes { id price compareAtPrice } } } } }');
  console.log('\n=== "golden love" ===');
  if (result2.data.products.nodes.length === 0) console.log('  NONE');
  result2.data.products.nodes.forEach(function(n) {
    var v = n.variants.nodes[0];
    console.log('  ' + n.status + ' | ' + n.handle + ' | ' + n.title + ' | $' + v.price + ' | vid=' + v.id.split('/').pop());
  });

  // Search by handle for the duplicates
  var result3 = await gql('{ productByHandle(handle: "gift-eleganto-case") { id title status variants(first:1) { nodes { id price } } } }');
  console.log('\n=== gift-eleganto-case by handle ===');
  if (result3.data.productByHandle) {
    var p2 = result3.data.productByHandle;
    console.log('  ' + p2.status + ' | ' + p2.title + ' | $' + p2.variants.nodes[0].price);
  } else {
    console.log('  NOT FOUND');
  }

  // Check product by known IDs from memory
  var result4 = await gql('{ product1: product(id: "gid://shopify/Product/9290097656059") { id title handle status variants(first:1) { nodes { id price } } } product2: product(id: "gid://shopify/Product/9290097688827") { id title handle status variants(first:1) { nodes { id price } } } }');
  console.log('\n=== Known gift product IDs from memory ===');
  ['product1', 'product2'].forEach(function(key) {
    var prod = result4.data[key];
    if (prod) {
      console.log('  ' + prod.status + ' | ' + prod.handle + ' | ' + prod.title + ' | $' + prod.variants.nodes[0].price + ' | vid=' + prod.variants.nodes[0].id.split('/').pop());
    } else {
      console.log('  ' + key + ': DELETED or NOT FOUND');
    }
  });

  await p.$disconnect();
}
main().catch(function(e) { console.error(e); p.$disconnect(); });
