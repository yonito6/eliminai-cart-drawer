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
    select: { id: true, shopDomain: true, accessToken: true, config: true } 
  });
  if (!store) { console.log('No store'); return; }
  const { shopDomain, accessToken: token } = store;

  // 1. Delete existing gift discounts
  console.log('Deleting old gift discounts...');
  const existing = await gql(shopDomain, token, `{
    automaticDiscountNodes(first: 50, query: "title:Gift OR title:Cart Drawer") {
      nodes { id automaticDiscount { ... on DiscountAutomaticBxgy { title } ... on DiscountAutomaticBasic { title } } }
    }
  }`);
  const toDelete = (existing?.data?.automaticDiscountNodes?.nodes || [])
    .filter(n => {
      const t = n.automaticDiscount?.title || '';
      return t.includes('Gift') || t.includes('Cart Drawer');
    });
  for (const n of toDelete) {
    console.log('  Deleting:', n.automaticDiscount?.title, n.id);
    await gql(shopDomain, token, `mutation($id: ID!) { discountAutomaticDelete(id: $id) { userErrors { field message } } }`, { id: n.id });
  }

  // 2. Ensure existing discounts combine with product discounts
  console.log('\nEnsuring combinesWith on existing discounts...');
  const allAuto = await gql(shopDomain, token, `{
    automaticDiscountNodes(first: 50) {
      nodes { id automaticDiscount { 
        ... on DiscountAutomaticBxgy { title combinesWith { productDiscounts } }
        ... on DiscountAutomaticBasic { title combinesWith { productDiscounts } }
      } }
    }
  }`);
  for (const n of (allAuto?.data?.automaticDiscountNodes?.nodes || [])) {
    const d = n.automaticDiscount;
    if (!d?.combinesWith || d.combinesWith.productDiscounts) continue;
    console.log('  Updating combinesWith on:', d.title);
    // Try Basic first, then BXGY
    let r = await gql(shopDomain, token, `mutation($id: ID!, $d: DiscountAutomaticBasicInput!) { 
      discountAutomaticBasicUpdate(id: $id, automaticBasicDiscount: $d) { userErrors { field message } } 
    }`, { id: n.id, d: { combinesWith: { productDiscounts: true, orderDiscounts: true, shippingDiscounts: true } } });
    if (r?.data?.discountAutomaticBasicUpdate?.userErrors?.length > 0) {
      r = await gql(shopDomain, token, `mutation($id: ID!, $d: DiscountAutomaticBxgyInput!) {
        discountAutomaticBxgyUpdate(id: $id, automaticBxgyDiscount: $d) { userErrors { field message } }
      }`, { id: n.id, d: { combinesWith: { productDiscounts: true, orderDiscounts: true, shippingDiscounts: true } } });
    }
    console.log('    Done');
  }

  // 3. Get all active product GIDs (for customerBuys)
  console.log('\nFetching all active products...');
  const allGids = [];
  let cursor = null;
  for (let page = 0; page < 10; page++) {
    const afterClause = cursor ? `, after: "${cursor}"` : '';
    const r = await gql(shopDomain, token, `{ products(first: 50, query: "status:active"${afterClause}) { pageInfo { hasNextPage endCursor } nodes { id } } }`);
    allGids.push(...(r?.data?.products?.nodes || []).map(n => n.id));
    if (!r?.data?.products?.pageInfo?.hasNextPage) break;
    cursor = r.data.products.pageInfo.endCursor;
  }
  console.log(`  Found ${allGids.length} active products`);

  // 4. Get gift product GIDs
  const caseGid = 'gid://shopify/Product/8959501435131';
  const necklaceGid = 'gid://shopify/Product/7810439905531';
  const giftGids = [caseGid, necklaceGid];
  const buyGids = allGids.filter(g => !giftGids.includes(g));
  console.log(`  Gift products: ${giftGids.length}, Buy products: ${buyGids.length}`);

  // 5. Create single BXGY discount for ALL gifts
  console.log('\nCreating "Cart Drawer Gifts" discount...');
  const createResult = await gql(shopDomain, token, `
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
        items: { products: { productsToAdd: buyGids } },
        value: { quantity: "1" },
      },
      customerGets: {
        items: { products: { productsToAdd: giftGids } },
        value: { discountOnQuantity: { quantity: String(giftGids.length), effect: { percentage: 1.0 } } },
      },
      combinesWith: { productDiscounts: true, orderDiscounts: true, shippingDiscounts: true },
    },
  });
  
  const errors = createResult?.data?.discountAutomaticBxgyCreate?.userErrors;
  if (errors?.length > 0) {
    console.log('  ERRORS:', JSON.stringify(errors));
  } else {
    const node = createResult?.data?.discountAutomaticBxgyCreate?.automaticDiscountNode;
    console.log('  Created:', node?.id, node?.automaticDiscount?.title, node?.automaticDiscount?.status);
  }

  // 6. Verify
  console.log('\nVerifying...');
  const verify = await gql(shopDomain, token, `{
    automaticDiscountNodes(first: 20) {
      nodes { id automaticDiscount {
        ... on DiscountAutomaticBxgy { title status
          customerGets { value { ... on DiscountOnQuantity { quantity { quantity } } } items { ... on DiscountProducts { products(first: 10) { nodes { id title } } } } }
          combinesWith { productDiscounts }
        }
      } }
    }
  }`);
  for (const n of (verify?.data?.automaticDiscountNodes?.nodes || [])) {
    const d = n.automaticDiscount;
    if (!d?.title) continue;
    const gets = d.customerGets;
    console.log(`  ${d.title}: qty=${gets?.value?.quantity?.quantity}, products=[${gets?.items?.products?.nodes?.map(p => p.title).join(', ')}], combinesWithProducts=${d.combinesWith?.productDiscounts}`);
  }

  await p.$disconnect();
})();
