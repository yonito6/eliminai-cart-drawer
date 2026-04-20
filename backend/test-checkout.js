// Simulate what happens at checkout by checking cart pricing via Storefront API
// First, let's add items to a cart and see the discount breakdown

const STORE = 'eliminai-test.myshopify.com';
const PASSWORD = '1234';

async function getProducts() {
  // Use the storefront/public product listing
  var res = await fetch('https://' + STORE + '/products.json', {
    headers: { 'Cookie': '_shopify_country=IL' }
  });
  var data = await res.json();
  return data.products;
}

async function createCart(items) {
  // Add items to cart via AJAX API
  var res = await fetch('https://' + STORE + '/cart/clear.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  
  for (var item of items) {
    res = await fetch('https://' + STORE + '/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.variant_id, quantity: item.quantity })
    });
    var added = await res.json();
    console.log('Added: ' + (added.title || added.product_title) + ' variant=' + item.variant_id);
  }

  // Get full cart
  res = await fetch('https://' + STORE + '/cart.js');
  return await res.json();
}

async function main() {
  // Get products to find variant IDs
  var products = await getProducts();
  console.log('Products available:');
  for (var p of products) {
    for (var v of p.variants) {
      console.log('  ' + p.title + ' — variant ' + v.id + ' ($' + v.price + ') handle=' + p.handle);
    }
  }
}
main().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
