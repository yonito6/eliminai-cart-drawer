const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({ where: { shopDomain: 'eleganto-3011.myshopify.com' }, select: { accessToken: true, shopDomain: true } });
  const gql = async (query, variables) => {
    const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-10/graphql.json', {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    return res.json();
  };

  // 1. Check what products are in "All Watch" collection (first 5)
  console.log('=== Products in "All Watch" collection ===');
  const collData = await gql(`{
    collection(id: "gid://shopify/Collection/432470327547") {
      title
      productsCount { count }
      products(first: 5) { nodes { id title status variants(first: 1) { nodes { id title price } } } }
    }
  }`);
  const coll = collData?.data?.collection;
  console.log('Collection:', coll?.title, '|', coll?.productsCount?.count, 'products');
  coll?.products?.nodes?.forEach(p => {
    const v = p.variants?.nodes?.[0];
    console.log('  -', p.title, '| status:', p.status, '| variant:', v?.id, '| $' + v?.price);
  });

  // 2. Use Shopify Draft Order to test discount application
  // Pick 3 variants from "All Watch" + the case variant
  const variants = coll?.products?.nodes?.slice(0, 3).map(p => p.variants?.nodes?.[0]?.id).filter(Boolean);
  const caseVariant = "gid://shopify/ProductVariant/46941745742075";
  console.log('\n=== Testing with 3 watches + case ===');
  console.log('Watch variants:', variants);
  console.log('Case variant:', caseVariant);

  // Create a draft order to test if discount applies
  const lineItems = [...variants.map(v => ({ variantId: v, quantity: 1 })), { variantId: caseVariant, quantity: 1 }];
  const draftRes = await gql(`mutation draftOrderCalculate($input: DraftOrderInput!) {
    draftOrderCalculate(input: $input) {
      calculatedDraftOrder {
        totalPrice
        subtotalPrice
        lineItems {
          title
          quantity
          originalTotal
          discountedTotal
          appliedDiscount { title value valueType description }
        }
        appliedDiscount { title value valueType }
      }
      userErrors { field message }
    }
  }`, { input: { lineItems } });

  const calc = draftRes?.data?.draftOrderCalculate;
  if (calc?.userErrors?.length > 0) {
    console.error('Errors:', JSON.stringify(calc.userErrors));
  }
  const order = calc?.calculatedDraftOrder;
  if (order) {
    console.log('\nTotal:', order.totalPrice, '| Subtotal:', order.subtotalPrice);
    order.lineItems?.forEach(li => {
      console.log('  -', li.title, 'x' + li.quantity, '| orig:', li.originalTotal, '| discounted:', li.discountedTotal, li.appliedDiscount ? '| discount: ' + JSON.stringify(li.appliedDiscount) : '');
    });
    if (order.appliedDiscount) console.log('Order discount:', JSON.stringify(order.appliedDiscount));
  } else {
    console.log('Full response:', JSON.stringify(draftRes, null, 2));
  }

  await p.$disconnect();
})();
