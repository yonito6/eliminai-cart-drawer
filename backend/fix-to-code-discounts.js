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
    select: { id: true, shopDomain: true, accessToken: true, config: true, demoConfig: true } 
  });
  if (!store) { console.log('No store'); return; }
  const { shopDomain, accessToken: token } = store;

  // 1. Delete "Cart Drawer Gifts" automatic BXGY we just created
  console.log('Step 1: Deleting automatic gift discounts...');
  const auto = await gql(shopDomain, token, `{
    automaticDiscountNodes(first: 50, query: "title:Gift OR title:Cart Drawer") {
      nodes { id automaticDiscount { ... on DiscountAutomaticBxgy { title } ... on DiscountAutomaticBasic { title } } }
    }
  }`);
  for (const n of (auto?.data?.automaticDiscountNodes?.nodes || [])) {
    const t = n.automaticDiscount?.title || '';
    if (t.includes('Gift') || t.includes('Cart Drawer')) {
      console.log('  Deleting:', t, n.id);
      await gql(shopDomain, token, `mutation($id: ID!) { discountAutomaticDelete(id: $id) { userErrors { field message } } }`, { id: n.id });
    }
  }

  // 2. Delete any existing code gift discounts
  console.log('\nStep 2: Deleting old code discounts...');
  const codes = await gql(shopDomain, token, `{
    codeDiscountNodes(first: 50, query: "title:Gift") {
      nodes { id codeDiscount { ... on DiscountCodeBxgy { title } ... on DiscountCodeBasic { title } } }
    }
  }`);
  for (const n of (codes?.data?.codeDiscountNodes?.nodes || [])) {
    const t = n.codeDiscount?.title || '';
    if (t.includes('Gift')) {
      console.log('  Deleting:', t, n.id);
      await gql(shopDomain, token, `mutation($id: ID!) { discountCodeDelete(id: $id) { userErrors { field message } } }`, { id: n.id });
    }
  }

  // 3. Create CODE discount for each gift product
  const gifts = [
    { handle: 'eleganto-premium-watch-organizer', title: 'Eleganto Case', gid: 'gid://shopify/Product/8959501435131' },
    { handle: 'geotrianglenecklace', title: 'Geometric Triangle Necklace', gid: 'gid://shopify/Product/7810439905531' },
  ];

  const giftCodes = [];
  console.log('\nStep 3: Creating code discounts for each gift...');
  
  for (let i = 0; i < gifts.length; i++) {
    const gift = gifts[i];
    const code = `GIFT-${(i + 1)}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    console.log(`  Creating code ${code} for ${gift.title}...`);
    
    const r = await gql(shopDomain, token, `
      mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode { id codeDiscount { ... on DiscountCodeBasic { title status codes(first: 1) { nodes { code } } } } }
          userErrors { field message }
        }
      }
    `, {
      basicCodeDiscount: {
        title: `Gift #${i + 1} - ${gift.title}`,
        startsAt: new Date().toISOString(),
        usageLimit: null,
        code,
        customerSelection: { all: true },
        customerGets: {
          items: { products: { productsToAdd: [gift.gid] } },
          value: { percentage: 1.0 },
        },
        combinesWith: { productDiscounts: true, orderDiscounts: true, shippingDiscounts: true },
      },
    });
    
    const errors = r?.data?.discountCodeBasicCreate?.userErrors;
    if (errors?.length > 0) {
      console.log('    ERROR:', JSON.stringify(errors));
    } else {
      const node = r?.data?.discountCodeBasicCreate?.codeDiscountNode;
      const createdCode = node?.codeDiscount?.codes?.nodes?.[0]?.code || code;
      console.log('    OK:', node?.id, createdCode);
      giftCodes.push(createdCode);
    }
  }

  // 4. Store codes in config so cart drawer can redirect through them at checkout
  console.log('\nStep 4: Saving gift codes to config...');
  const liveCfg = store.config || {};
  const demoCfg = store.demoConfig || {};
  liveCfg.giftDiscountCodes = giftCodes;
  demoCfg.giftDiscountCodes = giftCodes;
  await p.store.update({ where: { id: store.id }, data: { config: liveCfg, demoConfig: demoCfg } });
  console.log('  Saved codes:', giftCodes);

  // 5. Verify
  console.log('\nStep 5: Verifying...');
  const verifyAuto = await gql(shopDomain, token, `{
    automaticDiscountNodes(first: 20) {
      nodes { automaticDiscount { ... on DiscountAutomaticBxgy { title status combinesWith { productDiscounts } } } }
    }
  }`);
  console.log('  Automatic discounts:');
  for (const n of (verifyAuto?.data?.automaticDiscountNodes?.nodes || [])) {
    const d = n.automaticDiscount;
    if (d?.title) console.log(`    ${d.title} (${d.status}) combines=${d.combinesWith?.productDiscounts}`);
  }
  
  const verifyCodes = await gql(shopDomain, token, `{
    codeDiscountNodes(first: 20, query: "title:Gift") {
      nodes { codeDiscount { ... on DiscountCodeBasic { title status codes(first: 1) { nodes { code } } } } }
    }
  }`);
  console.log('  Code discounts:');
  for (const n of (verifyCodes?.data?.codeDiscountNodes?.nodes || [])) {
    const d = n.codeDiscount;
    if (d?.title) console.log(`    ${d.title} (${d.status}) code=${d.codes?.nodes?.[0]?.code}`);
  }

  await p.$disconnect();
  console.log('\nDone!');
})();
