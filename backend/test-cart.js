const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  var store = await p.store.findUnique({ where: { id: 'cmnyt3rca074juiqqf5z1whrg' }, select: { shopDomain: true, accessToken: true } });
  
  // Get all products with variants via Admin API
  var res = await fetch('https://'+store.shopDomain+'/admin/api/2025-10/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ products(first: 15, query: "status:active") { nodes { id title handle variants(first: 3) { nodes { id title price } } } } }' })
  });
  var data = await res.json();
  
  console.log('=== ALL ACTIVE PRODUCTS ===');
  var variants = {};
  for (var prod of data.data.products.nodes) {
    for (var v of prod.variants.nodes) {
      var numId = v.id.replace('gid://shopify/ProductVariant/', '');
      variants[prod.handle] = numId;
      console.log(prod.handle + ' → variant ' + numId + ' ($' + v.price + ')');
    }
  }

  // Now test: add items to cart using storefront AJAX API with password cookie
  var domain = store.shopDomain;
  
  // Step 1: Get password cookie
  var passRes = await fetch('https://' + domain + '/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'password=1234',
    redirect: 'manual'
  });
  var cookies = passRes.headers.getSetCookie ? passRes.headers.getSetCookie() : [];
  var cookieStr = cookies.map(function(c) { return c.split(';')[0]; }).join('; ');
  console.log('\nPassword auth cookies:', cookieStr ? 'GOT THEM' : 'NONE');
  console.log('Password response status:', passRes.status);

  if (!cookieStr) {
    console.log('No cookies, trying headers.raw...');
    // Fallback
    cookieStr = '';
  }

  // Step 2: Clear cart
  await fetch('https://' + domain + '/cart/clear.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieStr }
  });

  // Step 3: Add 4 regular items + 2 gift items
  var itemsToAdd = [
    { handle: 'the-minimal-snowboard', name: 'Minimal Snowboard' },
    { handle: 'the-inventory-not-tracked-snowboard', name: 'Inventory Not Tracked' },
    { handle: 'the-complete-snowboard', name: 'Complete Snowboard' },
    { handle: 'the-collection-snowboard-hydrogen', name: 'Collection Hydrogen' },
    { handle: 'the-compare-at-price-snowboard', name: 'Compare (GIFT #2)' },
    { handle: 'the-videographer-snowboard', name: 'Videographer (GIFT #3)' },
  ];

  for (var item of itemsToAdd) {
    var vid = variants[item.handle];
    if (!vid) { console.log('SKIP: no variant for ' + item.handle); continue; }
    var addRes = await fetch('https://' + domain + '/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieStr },
      body: JSON.stringify({ id: parseInt(vid), quantity: 1 })
    });
    var addData = await addRes.json().catch(function() { return { error: 'parse fail, status=' + addRes.status }; });
    console.log('Add ' + item.name + ': ' + (addData.title || addData.product_title || JSON.stringify(addData).substring(0, 100)));
  }

  // Step 4: Get cart - check prices and discounts
  var cartRes = await fetch('https://' + domain + '/cart.js', {
    headers: { 'Cookie': cookieStr }
  });
  var cart = await cartRes.json().catch(function() { return null; });
  
  if (!cart) {
    console.log('Could not get cart (likely password issue)');
    return;
  }

  console.log('\n=== CART STATE ===');
  console.log('Total items: ' + cart.item_count);
  console.log('Total price: $' + (cart.total_price / 100).toFixed(2));
  console.log('Original total: $' + (cart.original_total_price / 100).toFixed(2));
  console.log('Total discount: $' + (cart.total_discount / 100).toFixed(2));
  
  console.log('\nLine items:');
  for (var li of cart.items) {
    var discount = li.total_discount || 0;
    var discountStr = discount > 0 ? ' DISCOUNT: -$' + (discount/100).toFixed(2) : '';
    console.log('  ' + li.title + ' — $' + (li.original_price/100).toFixed(2) + ' → $' + (li.final_price/100).toFixed(2) + discountStr);
    if (li.discounts && li.discounts.length > 0) {
      for (var d of li.discounts) {
        console.log('    Applied: ' + d.title + ' (-$' + (d.amount/100).toFixed(2) + ')');
      }
    }
  }
}
main().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
