// Test storefront cart API to see discount allocations
(async () => {
  const domain = 'eleganto-3011.myshopify.com';
  const cookies = {};

  const sf = async (path, body) => {
    const opts = {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      redirect: 'manual'
    };
    if (cookies.cart) opts.headers['Cookie'] = 'cart=' + cookies.cart;
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch('https://' + domain + path, opts);

    // Capture set-cookie
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const m = setCookie.match(/cart=([^;]+)/);
      if (m) cookies.cart = m[1];
    }

    const text = await res.text();
    try { return JSON.parse(text); } catch { return text; }
  };

  // 1. Clear cart
  console.log('Clearing cart...');
  await sf('/cart/clear.js', {});

  // 2. Add 3 watches + case
  console.log('Adding 3 watches + case...');
  const addRes = await sf('/cart/add.js', {
    items: [
      { id: 45167742681339, quantity: 1 },
      { id: 45175479304443, quantity: 1 },
      { id: 45167917367547, quantity: 1 },
      { id: 46941745742075, quantity: 1 }  // Eleganto Case
    ]
  });
  console.log('Add response items:', addRes?.items?.length || 'error');
  if (addRes?.description) console.log('Add error:', addRes.description);

  // 3. Get cart
  console.log('\nFetching cart...');
  const cart = await sf('/cart.js');

  if (typeof cart === 'string') {
    console.log('Cart response (text):', cart.substring(0, 500));
    return;
  }

  console.log('Cart total:', cart.total_price / 100);
  console.log('Cart total discount:', cart.total_discount / 100);
  console.log('Cart item count:', cart.item_count);
  console.log('\nItems:');
  cart.items?.forEach(item => {
    console.log('  ' + item.title + ' x' + item.quantity);
    console.log('    Price: $' + (item.price / 100) + ' | Line price: $' + (item.line_price / 100) + ' | Original: $' + (item.original_price / 100));
    console.log('    Final line price: $' + (item.final_line_price / 100) + ' | Original line price: $' + (item.original_line_price / 100));
    console.log('    Total discount: $' + (item.total_discount / 100));
    console.log('    Handle:', item.handle);
    if (item.line_level_discount_allocations?.length > 0) {
      item.line_level_discount_allocations.forEach(d => {
        console.log('    DISCOUNT:', d.discount_application?.title, '| Amount: $' + (d.amount / 100));
      });
    } else {
      console.log('    No line-level discounts');
    }
  });

  console.log('\nCart-level discounts:');
  if (cart.cart_level_discount_applications?.length > 0) {
    cart.cart_level_discount_applications.forEach(d => {
      console.log('  ' + d.title + ': $' + (d.total_allocated_amount / 100));
    });
  } else {
    console.log('  None');
  }
})();
