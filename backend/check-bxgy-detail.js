const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function check() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  const token = store.accessToken;
  const domain = store.shopDomain;

  // Check details for "1+2 FREE" and "Eliminai Gift"
  const ids = [
    'gid://shopify/DiscountAutomaticNode/1588433027323',  // 1+2 FREE
    'gid://shopify/DiscountAutomaticNode/1787498004731',  // Eliminai Gift — Eleganto Case
    'gid://shopify/DiscountAutomaticNode/1632976961787',  // Watch Oganizer
  ];
  
  for (const id of ids) {
    const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{
        automaticDiscountNode(id: "${id}") {
          id
          automaticDiscount {
            ... on DiscountAutomaticBxgy {
              title
              status
              usesPerOrderLimit
              customerBuys {
                value { ... on DiscountQuantity { quantity } }
                items {
                  ... on AllDiscountItems { allItems }
                  ... on DiscountProducts { products(first: 10) { nodes { title handle id } } }
                  ... on DiscountCollections { collections(first: 5) { nodes { title handle id } } }
                }
              }
              customerGets {
                items {
                  ... on DiscountProducts { products(first: 10) { nodes { title handle id } } }
                  ... on DiscountCollections { collections(first: 5) { nodes { title handle id } } }
                }
              }
            }
            ... on DiscountAutomaticBasic {
              title
              status
              customerGets {
                items {
                  ... on AllDiscountItems { allItems }
                  ... on DiscountProducts { products(first: 10) { nodes { title handle id } } }
                }
                value { ... on DiscountPercentage { percentage } }
              }
            }
          }
        }
      }` })
    });
    const data = await res.json();
    if (data.errors) {
      console.log('Error for ' + id + ':', JSON.stringify(data.errors));
    } else {
      console.log('\n=== ' + id + ' ===');
      console.log(JSON.stringify(data.data.automaticDiscountNode.automaticDiscount, null, 2));
    }
  }
  await p.$disconnect();
}
check().catch(e => { console.error(e); p.$disconnect(); });
