const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true, shopDomain: true } });
  const gql = async (query) => {
    const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-10/graphql.json', {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    return res.json();
  };

  // Deep check Gift #2 — does it have AllDiscountItems?
  const r = await gql(`{
    automaticDiscountNode(id: "gid://shopify/DiscountAutomaticNode/1787622359291") {
      automaticDiscount {
        ... on DiscountAutomaticBasic {
          title status
          customerGets {
            items {
              ... on AllDiscountItems { allItems }
              ... on DiscountProducts {
                products(first: 10) { nodes { id title } }
                productVariants(first: 10) { nodes { id title } }
              }
              ... on DiscountCollections { collections(first: 10) { nodes { id title } } }
            }
            value {
              ... on DiscountPercentage { percentage }
              ... on DiscountAmount { amount { amount } appliesOnEachItem }
            }
          }
        }
      }
    }
  }`);

  const d = r?.data?.automaticDiscountNode?.automaticDiscount;
  console.log('Gift #2 scope:');
  console.log('  allItems:', d?.customerGets?.items?.allItems);
  console.log('  products:', d?.customerGets?.items?.products?.nodes?.map(p => p.title));
  console.log('  variants:', d?.customerGets?.items?.productVariants?.nodes?.map(v => v.title));
  console.log('  collections:', d?.customerGets?.items?.collections?.nodes?.map(c => c.title));
  console.log('  percentage:', d?.customerGets?.value?.percentage);
  console.log('  amount:', d?.customerGets?.value?.amount);

  // Also check sun and moon scope
  const sm = await gql(`{
    automaticDiscountNode(id: "gid://shopify/DiscountAutomaticNode/1445180309755") {
      automaticDiscount {
        ... on DiscountAutomaticBasic {
          title status
          customerGets {
            items {
              ... on AllDiscountItems { allItems }
              ... on DiscountProducts { products(first: 10) { nodes { id title } } }
              ... on DiscountCollections { collections(first: 10) { nodes { id title } } }
            }
            value {
              ... on DiscountPercentage { percentage }
              ... on DiscountAmount { amount { amount } appliesOnEachItem }
            }
          }
        }
      }
    }
  }`);
  const s = sm?.data?.automaticDiscountNode?.automaticDiscount;
  console.log('\nsun and moon scope:');
  console.log('  allItems:', s?.customerGets?.items?.allItems);
  console.log('  products:', s?.customerGets?.items?.products?.nodes?.map(p => p.title));
  console.log('  collections:', s?.customerGets?.items?.collections?.nodes?.map(c => c.title));
  console.log('  amount:', s?.customerGets?.value?.amount);
  console.log('  appliesOnEachItem:', s?.customerGets?.value?.appliesOnEachItem);

  await p.$disconnect();
})();
