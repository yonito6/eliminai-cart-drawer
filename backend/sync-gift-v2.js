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
    select: { id: true, shopDomain: true, accessToken: true } 
  });
  if (!store) { console.log('No store'); return; }
  const { shopDomain, accessToken: token } = store;

  const caseGid = 'gid://shopify/Product/8959501435131';
  const necklaceGid = 'gid://shopify/Product/7810439905531';
  const giftGids = [caseGid, necklaceGid];

  // Try using "all: true" for customerBuys — any product purchase qualifies
  console.log('Creating "Cart Drawer Gifts" with all:true for customerBuys...');
  const r = await gql(shopDomain, token, `
    mutation discountAutomaticBxgyCreate($automaticBxgyDiscount: DiscountAutomaticBxgyInput!) {
      discountAutomaticBxgyCreate(automaticBxgyDiscount: $automaticBxgyDiscount) {
        automaticDiscountNode { id automaticDiscount { ... on DiscountAutomaticBxgy { title status } } }
        userErrors { field message }
      }
    }
  `, {
    automaticBxgyDiscount: {
      title: 'Cart Drawer Gifts',
      startsAt: new Date().toISOString(),
      customerBuys: {
        items: { all: true },
        value: { quantity: "1" },
      },
      customerGets: {
        items: { products: { productsToAdd: giftGids } },
        value: { discountOnQuantity: { quantity: String(giftGids.length), effect: { percentage: 1.0 } } },
      },
      combinesWith: { productDiscounts: true, orderDiscounts: true, shippingDiscounts: true },
    },
  });
  
  const errors = r?.data?.discountAutomaticBxgyCreate?.userErrors;
  if (errors?.length > 0) {
    console.log('ERRORS:', JSON.stringify(errors, null, 2));
    
    // If all:true doesn't work, try with collections
    console.log('\nTrying with "All" collection...');
    const collections = await gql(shopDomain, token, `{ 
      collections(first: 5, query: "title:All") { nodes { id title } } 
    }`);
    console.log('Collections:', JSON.stringify(collections?.data?.collections?.nodes));
  } else {
    const node = r?.data?.discountAutomaticBxgyCreate?.automaticDiscountNode;
    console.log('SUCCESS:', node?.id, node?.automaticDiscount?.title);
  }

  await p.$disconnect();
})();
