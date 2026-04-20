const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  var store = await p.store.findUnique({ where: { id: 'cmnyt3rca074juiqqf5z1whrg' }, select: { shopDomain: true, accessToken: true } });

  // Check if there's a Storefront API token
  // If not, we need to create one via Admin API
  var r = await fetch('https://'+store.shopDomain+'/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ storefrontAccessTokens(first: 5) { nodes { title accessToken } } }' })
  });
  var data = await r.json();
  console.log('Storefront tokens:', JSON.stringify(data.data));
  
  var sfToken = data.data?.storefrontAccessTokens?.nodes?.[0]?.accessToken;
  
  if (!sfToken) {
    // Create one
    var cr = await fetch('https://'+store.shopDomain+'/admin/api/2025-10/graphql.json', {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'mutation { storefrontAccessTokenCreate(input: {title: "Test"}) { storefrontAccessToken { accessToken } userErrors { message } } }'
      })
    });
    var crd = await cr.json();
    sfToken = crd.data?.storefrontAccessTokenCreate?.storefrontAccessToken?.accessToken;
    console.log('Created storefront token:', sfToken ? 'OK' : 'FAILED');
    if (crd.data?.storefrontAccessTokenCreate?.userErrors?.length > 0) {
      console.log('Errors:', JSON.stringify(crd.data.storefrontAccessTokenCreate.userErrors));
    }
  }

  if (!sfToken) { console.log('No storefront token available'); return; }
  
  // Now use Storefront API to create a cart with items
  var sfGql = async function(query, variables) {
    var res = await fetch('https://'+store.shopDomain+'/api/2025-01/graphql.json', {
      method: 'POST',
      headers: { 'X-Shopify-Storefront-Access-Token': sfToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query, variables: variables || {} })
    });
    return res.json();
  };

  // Create cart with 6 items (4 regular + 2 gifts)
  var lines = [
    { merchandiseId: 'gid://shopify/ProductVariant/52086263185721', quantity: 1 },  // Inventory Not Tracked
    { merchandiseId: 'gid://shopify/ProductVariant/52086263447865', quantity: 1 },  // Complete Snowboard
    { merchandiseId: 'gid://shopify/ProductVariant/52086263611705', quantity: 1 },  // Collection Hydrogen
    { merchandiseId: 'gid://shopify/ProductVariant/52086263808313', quantity: 1 },  // Hidden Snowboard
    { merchandiseId: 'gid://shopify/ProductVariant/52086263775545', quantity: 1 },  // Compare (GIFT #2)
    { merchandiseId: 'gid://shopify/ProductVariant/52086263841081', quantity: 1 },  // Videographer (GIFT #3)
  ];

  var cartResult = await sfGql(
    'mutation($input: CartInput!) { cartCreate(input: $input) { cart { id cost { totalAmount { amount currencyCode } subtotalAmount { amount currencyCode } } lines(first: 10) { nodes { merchandise { ... on ProductVariant { product { title } } } quantity cost { totalAmount { amount } compareAtAmountPerQuantity { amount } amountPerQuantity { amount } } discountAllocations { discountedAmount { amount } ... on CartAutomaticDiscountAllocation { title } } } } discountAllocations { discountedAmount { amount } ... on CartAutomaticDiscountAllocation { title } } } userErrors { field message } } }',
    { input: { lines: lines } }
  );

  if (cartResult.errors) { console.log('Errors:', JSON.stringify(cartResult.errors)); return; }
  if (cartResult.data?.cartCreate?.userErrors?.length > 0) {
    console.log('User errors:', JSON.stringify(cartResult.data.cartCreate.userErrors)); return;
  }

  var cart = cartResult.data?.cartCreate?.cart;
  if (!cart) { console.log('No cart:', JSON.stringify(cartResult.data)); return; }

  console.log('\n=== STOREFRONT CART (shows automatic discount allocations) ===');
  console.log('Total: $' + cart.cost.totalAmount.amount);
  console.log('Subtotal: $' + cart.cost.subtotalAmount.amount);
  
  if (cart.discountAllocations && cart.discountAllocations.length > 0) {
    console.log('\nCart-level discounts:');
    for (var d of cart.discountAllocations) {
      console.log('  ' + (d.title || '?') + ': -$' + d.discountedAmount.amount);
    }
  }

  console.log('\nLine items:');
  for (var line of cart.lines.nodes) {
    var title = line.merchandise.product.title;
    var price = line.cost.amountPerQuantity.amount;
    var total = line.cost.totalAmount.amount;
    console.log('  ' + title + ' — price: $' + price + ' total: $' + total);
    if (line.discountAllocations && line.discountAllocations.length > 0) {
      for (var d of line.discountAllocations) {
        console.log('    *** DISCOUNT: ' + (d.title || '?') + ' -$' + d.discountedAmount.amount + ' ***');
      }
    }
  }
}
main().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
