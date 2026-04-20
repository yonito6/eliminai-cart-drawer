const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

async function main() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });

  // Query BOTH duplicated gifts AND originals to prove only duplicates were touched
  const query = `{
    giftCase: product(id: "gid://shopify/Product/9290097656059") {
      title handle status
      variants(first: 1) { nodes { price } }
      collections(first: 20) {
        nodes { id title }
      }
    }
    giftNecklace: product(id: "gid://shopify/Product/9290097688827") {
      title handle status
      variants(first: 1) { nodes { price } }
      collections(first: 20) {
        nodes { id title }
      }
    }
    originalCase: product(id: "gid://shopify/Product/9290082681083") {
      title handle status
      variants(first: 1) { nodes { price } }
      collections(first: 20) {
        nodes { id title }
      }
    }
    originalNecklace: product(id: "gid://shopify/Product/7810455601403") {
      title handle status
      variants(first: 1) { nodes { price } }
      collections(first: 20) {
        nodes { id title }
      }
    }
  }`;

  const res = await fetch("https://" + store.shopDomain + "/admin/api/2025-01/graphql.json", {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': store.accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const data = await res.json();

  console.log('\n=== DUPLICATED GIFT PRODUCTS ($0) ===\n');

  console.log('Gift Case (DUPLICATE):');
  console.log('  Handle:', data.data.giftCase.handle);
  console.log('  Price: $' + data.data.giftCase.variants.nodes[0].price);
  console.log('  Collections:', data.data.giftCase.collections.nodes.map(c => c.title).join(', ') || 'NONE');

  console.log('\nGift Necklace (DUPLICATE):');
  console.log('  Handle:', data.data.giftNecklace.handle);
  console.log('  Price: $' + data.data.giftNecklace.variants.nodes[0].price);
  console.log('  Collections:', data.data.giftNecklace.collections.nodes.map(c => c.title).join(', ') || 'NONE');

  console.log('\n=== ORIGINAL PRODUCTS (FULL PRICE) ===\n');

  console.log('Eleganto Case (ORIGINAL):');
  console.log('  Handle:', data.data.originalCase.handle);
  console.log('  Price: $' + data.data.originalCase.variants.nodes[0].price);
  console.log('  Collections:', data.data.originalCase.collections.nodes.map(c => c.title).join(', ') || 'NONE');

  console.log('\nGolden Love Heart Necklace (ORIGINAL):');
  console.log('  Handle:', data.data.originalNecklace.handle);
  console.log('  Price: $' + data.data.originalNecklace.variants.nodes[0].price);
  console.log('  Collections:', data.data.originalNecklace.collections.nodes.map(c => c.title).join(', ') || 'NONE');

  // Check if "All items" collection has the originals
  const allItemsId = 'gid://shopify/Collection/399056961787';
  const origCaseInAllItems = data.data.originalCase.collections.nodes.some(c => c.id === allItemsId);
  const origNecklaceInAllItems = data.data.originalNecklace.collections.nodes.some(c => c.id === allItemsId);
  const giftCaseInAllItems = data.data.giftCase.collections.nodes.some(c => c.id === allItemsId);
  const giftNecklaceInAllItems = data.data.giftNecklace.collections.nodes.some(c => c.id === allItemsId);

  console.log('\n=== "All items" COLLECTION (399056961787) CHECK ===');
  console.log('  Original Case in "All items":', origCaseInAllItems ? 'YES ✅' : 'NO ❌');
  console.log('  Original Necklace in "All items":', origNecklaceInAllItems ? 'YES ✅' : 'NO ❌');
  console.log('  Gift Case (dup) in "All items":', giftCaseInAllItems ? 'YES ⚠️ PROBLEM' : 'NO ✅ REMOVED');
  console.log('  Gift Necklace (dup) in "All items":', giftNecklaceInAllItems ? 'YES ⚠️ PROBLEM' : 'NO ✅ REMOVED');

  await p.$disconnect();
}
main().catch(e => { console.error(e); p.$disconnect(); });
