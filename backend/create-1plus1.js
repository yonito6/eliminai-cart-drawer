const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function gql(domain, token, query, variables) {
  const res = await fetch(`https://${domain}/admin/api/2025-10/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}
(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: { contains: 'eleganto-3011' } },
    select: { shopDomain: true, accessToken: true },
  });
  const d = store.shopDomain, t = store.accessToken;
  const allItemsId = 'gid://shopify/Collection/399056961787';

  console.log('Creating 1+1 FREE with "All items" collection...');
  var r = await gql(d, t, `
    mutation discountAutomaticBxgyCreate($discount: DiscountAutomaticBxgyInput!) {
      discountAutomaticBxgyCreate(automaticBxgyDiscount: $discount) {
        automaticDiscountNode {
          id
          automaticDiscount {
            ... on DiscountAutomaticBxgy { title status }
          }
        }
        userErrors { field message }
      }
    }
  `, {
    discount: {
      title: "1+1 FREE",
      startsAt: new Date().toISOString(),
      customerBuys: {
        value: { quantity: "1" },
        items: { collections: { add: [allItemsId] } }
      },
      customerGets: {
        value: { discountOnQuantity: { quantity: "1", effect: { percentage: 1.0 } } },
        items: { collections: { add: [allItemsId] } }
      },
      combinesWith: { productDiscounts: true, orderDiscounts: true, shippingDiscounts: true }
    }
  });

  var errors = r?.data?.discountAutomaticBxgyCreate?.userErrors;
  if (errors?.length > 0) {
    console.log('ERRORS:', JSON.stringify(errors));
  } else {
    console.log('Created:', r?.data?.discountAutomaticBxgyCreate?.automaticDiscountNode?.automaticDiscount?.title);
    console.log('ID:', r?.data?.discountAutomaticBxgyCreate?.automaticDiscountNode?.id);
  }

  // Show all automatic discounts
  var all = await gql(d, t, `{
    automaticDiscountNodes(first: 10) {
      nodes { id automaticDiscount { ... on DiscountAutomaticBxgy { title status customerBuys { value { ... on DiscountQuantity { quantity } } items { ... on DiscountCollections { collections(first:2) { nodes { title } } } } } customerGets { value { ... on DiscountOnQuantity { quantity { quantity } } } items { ... on DiscountCollections { collections(first:2) { nodes { title } } } } } } } }
    }
  }`);
  console.log('\nAll automatic discounts:');
  for (var n of (all?.data?.automaticDiscountNodes?.nodes || [])) {
    var disc = n.automaticDiscount;
    if (!disc?.title) continue;
    console.log('  ' + disc.title + ' | buy ' + disc.customerBuys?.value?.quantity + ' from "' + disc.customerBuys?.items?.collections?.nodes?.[0]?.title + '" | get ' + disc.customerGets?.value?.quantity?.quantity + ' from "' + disc.customerGets?.items?.collections?.nodes?.[0]?.title + '"');
  }

  await p.$disconnect();
})();
