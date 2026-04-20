const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  const token = store.accessToken;
  const domain = store.shopDomain;

  async function gql(query, variables) {
    const body = variables ? { query, variables } : { query };
    const res = await fetch('https://' + domain + '/admin/api/2025-01/graphql.json', {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  }

  // Step 1: Try GraphQL to update variant inventory policy
  console.log('Step 1: Update inventory policy via GraphQL productVariantUpdate...');
  const r1 = await gql(
    'mutation($input: ProductVariantInput!) { productVariantUpdate(input: $input) { productVariant { id inventoryPolicy } userErrors { field message } } }',
    { input: { id: 'gid://shopify/ProductVariant/47779174023419', inventoryPolicy: 'CONTINUE' } }
  );
  console.log('  Result:', JSON.stringify(r1.data || r1.errors));

  // Step 2: Get locations
  const r2 = await gql('{ locations(first: 3) { nodes { id name } } }');
  if (r2.errors) {
    console.log('Location error:', JSON.stringify(r2.errors));
    // Try REST
    const locRes = await fetch('https://' + domain + '/admin/api/2025-01/locations.json', {
      headers: { 'X-Shopify-Access-Token': token }
    });
    const locTxt = await locRes.text();
    console.log('REST locations:', locTxt.substring(0, 200));
  } else {
    const loc = r2.data.locations.nodes[0];
    console.log('  Location:', loc.name, loc.id);

    // Step 3: Set inventory via GraphQL inventorySetQuantities
    console.log('\nStep 3: Set inventory via inventorySetQuantities...');
    const locId = loc.id;
    const r3 = await gql(
      'mutation($input: InventorySetQuantitiesInput!) { inventorySetQuantities(input: $input) { inventoryAdjustmentGroup { reason } userErrors { field message } } }',
      {
        input: {
          reason: "correction",
          name: "available",
          quantities: [{
            inventoryItemId: "gid://shopify/InventoryItem/49878816882939",
            locationId: locId,
            quantity: 999999
          }]
        }
      }
    );
    console.log('  Result:', JSON.stringify(r3.data || r3.errors));
  }

  // Verify
  console.log('\n=== VERIFY ===');
  const r4 = await gql('{ productVariant(id: "gid://shopify/ProductVariant/47779174023419") { id inventoryPolicy inventoryQuantity price }  }');
  console.log(JSON.stringify(r4.data, null, 2));

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
