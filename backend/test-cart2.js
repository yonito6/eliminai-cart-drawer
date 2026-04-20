const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  var store = await p.store.findUnique({ where: { id: 'cmnyt3rca074juiqqf5z1whrg' }, select: { shopDomain: true, accessToken: true } });
  var domain = store.shopDomain;

  // Use a simple cookie tracking approach
  var allCookies = {};
  
  function saveCookies(res) {
    var raw = res.headers.raw ? res.headers.raw()['set-cookie'] : res.headers.getSetCookie();
    if (raw) {
      for (var c of raw) {
        var parts = c.split(';')[0].split('=');
        allCookies[parts[0]] = parts.slice(1).join('=');
      }
    }
  }
  
  function getCookieStr() {
    return Object.entries(allCookies).map(function(e) { return e[0] + '=' + e[1]; }).join('; ');
  }

  // Step 1: Visit password page to get initial cookies
  var r1 = await fetch('https://' + domain + '/password', { redirect: 'manual' });
  saveCookies(r1);
  
  // Step 2: Submit password
  var r2 = await fetch('https://' + domain + '/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': getCookieStr() },
    body: 'password=1234',
    redirect: 'manual'
  });
  saveCookies(r2);
  console.log('Password submit status:', r2.status);
  console.log('Cookies:', Object.keys(allCookies).join(', '));

  // Step 3: Follow redirect to get session
  if (r2.status === 302) {
    var loc = r2.headers.get('location');
    var r3 = await fetch(loc.startsWith('http') ? loc : 'https://' + domain + loc, {
      headers: { 'Cookie': getCookieStr() },
      redirect: 'manual'
    });
    saveCookies(r3);
  }

  var headers = { 'Content-Type': 'application/json', 'Cookie': getCookieStr() };

  // Clear cart
  await fetch('https://' + domain + '/cart/clear.js', { method: 'POST', headers: headers });
  
  // Add items - using correct variant IDs
  var items = [
    { id: 52086263185721, name: 'Inventory Not Tracked ($949.95)' },
    { id: 52086263447865, name: 'Complete Snowboard ($699.95)' },
    { id: 52086263611705, name: 'Collection Hydrogen ($600.00)' },
    { id: 52086263808313, name: 'Hidden Snowboard ($749.95)' },
    { id: 52086263775545, name: 'Compare at Price - GIFT#2 ($785.95)' },
    { id: 52086263841081, name: 'Videographer - GIFT#3 ($885.95)' },
  ];

  for (var item of items) {
    var addRes = await fetch('https://' + domain + '/cart/add.js', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ id: item.id, quantity: 1 })
    });
    saveCookies(addRes);
    var txt = await addRes.text();
    try {
      var j = JSON.parse(txt);
      console.log('Added ' + item.name + ': OK (' + (j.title || j.product_title) + ')');
    } catch(e) {
      console.log('Added ' + item.name + ': FAIL - ' + txt.substring(0, 100));
    }
  }

  // Get cart
  var cartRes = await fetch('https://' + domain + '/cart.js', { headers: { 'Cookie': getCookieStr() } });
  var cartTxt = await cartRes.text();
  try {
    var cart = JSON.parse(cartTxt);
    console.log('\n=== CART STATE ===');
    console.log('Total items: ' + cart.item_count);
    console.log('Original total: $' + (cart.original_total_price / 100).toFixed(2));
    console.log('Total price: $' + (cart.total_price / 100).toFixed(2));
    console.log('Total discount: $' + (cart.total_discount / 100).toFixed(2));
    
    console.log('\nLine items:');
    for (var li of cart.items) {
      var discount = li.total_discount || 0;
      console.log('  ' + li.title + ' — original: $' + (li.original_price/100).toFixed(2) + ' final: $' + (li.final_price/100).toFixed(2) + (discount > 0 ? ' DISCOUNT: -$' + (discount/100).toFixed(2) : ' (no discount)'));
      if (li.discounts && li.discounts.length > 0) {
        for (var d of li.discounts) {
          console.log('    → ' + d.title + ' -$' + (d.amount/100).toFixed(2));
        }
      }
      if (li.line_level_discount_allocations && li.line_level_discount_allocations.length > 0) {
        for (var d of li.line_level_discount_allocations) {
          console.log('    → ' + (d.discount_application ? d.discount_application.title : '?') + ' -$' + (d.amount/100).toFixed(2));
        }
      }
    }
  } catch(e) {
    console.log('Cart parse failed. Status:', cartRes.status, 'Body:', cartTxt.substring(0, 200));
  }
}
main().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
