const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function gql(domain, token, query, variables) {
  var res = await fetch('https://'+domain+'/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: query, variables: variables || {} })
  });
  return res.json();
}

async function main() {
  var store = await p.store.findUnique({ where: { id: 'cmnyt3rca074juiqqf5z1whrg' }, select: { shopDomain: true, accessToken: true } });

  // Use draftOrderCalculate to simulate checkout with automatic discounts
  // This shows exactly what Shopify would charge at checkout
  var variants = [
    'gid://shopify/ProductVariant/52086263185721',  // Inventory Not Tracked $949.95
    'gid://shopify/ProductVariant/52086263447865',  // Complete Snowboard $699.95
    'gid://shopify/ProductVariant/52086263611705',  // Collection Hydrogen $600.00
    'gid://shopify/ProductVariant/52086263808313',  // Hidden Snowboard $749.95
    'gid://shopify/ProductVariant/52086263775545',  // Compare at Price $785.95 (GIFT #2)
    'gid://shopify/ProductVariant/52086263841081',  // Videographer $885.95 (GIFT #3)
  ];

  var lineItems = variants.map(function(v) { return { variantId: v, quantity: 1 }; });

  var r = await gql(store.shopDomain, store.accessToken,
    'mutation($input: DraftOrderInput!) { draftOrderCalculate(input: $input) { calculatedDraftOrder { totalPrice subtotalPrice totalDiscountsSet { shopMoney { amount } } lineItems { title quantity originalTotal { amount currencyCode } discountedTotal { amount currencyCode } } } userErrors { field message } } }',
    { input: { lineItems: lineItems } }
  );

  if (r.errors) { console.log('GQL errors:', JSON.stringify(r.errors)); return; }
  if (r.data?.draftOrderCalculate?.userErrors?.length > 0) {
    console.log('User errors:', JSON.stringify(r.data.draftOrderCalculate.userErrors));
    return;
  }

  var calc = r.data?.draftOrderCalculate?.calculatedDraftOrder;
  if (!calc) { console.log('No result:', JSON.stringify(r.data)); return; }

  console.log('=== DRAFT ORDER CALCULATION (simulates checkout) ===');
  console.log('Subtotal: $' + calc.subtotalPrice);
  console.log('Total: $' + calc.totalPrice);
  console.log('Total discount: $' + calc.totalDiscountsSet?.shopMoney?.amount);
  console.log('\nLine items:');
  for (var li of calc.lineItems) {
    var discounted = li.originalTotal !== li.discountedTotal;
    console.log('  ' + li.title + ' — original: $' + li.originalTotal + ' → discounted: $' + li.discountedTotal + (discounted ? ' *** DISCOUNTED ***' : ''));
  }
}
main().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
