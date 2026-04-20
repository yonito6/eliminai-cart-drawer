const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  const token = store.accessToken;
  const domain = store.shopDomain;
  async function api(method, path, body) {
    const opts = { method, headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch('https://' + domain + '/admin/api/2025-01/' + path, opts);
    return res.json();
  }
  console.log('Step 1: Changing inventory policy to continue...');
  const upd = await api('PUT', 'variants/47779174023419.json', { variant: { id: 47779174023419, inventory_policy: 'continue' } });
  console.log('  Policy:', upd.variant ? upd.variant.inventory_policy : JSON.stringify(upd));
  const vData = await api('GET', 'variants/47779174023419.json');
  const invItemId = vData.variant.inventory_item_id;
  console.log('Step 2: Inventory item:', invItemId);
  const gqlRes = await fetch('https://' + domain + '/admin/api/2025-01/graphql.json', {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ locations(first: 5) { nodes { id name } } }' })
  });
  const gqlData = await gqlRes.json();
  const locNodes = gqlData.data.locations.nodes;
  const locId = parseInt(locNodes[0].id.replace('gid://shopify/Location/', ''));
  console.log('Step 3: Location:', locId, locNodes[0].name);
  const setData = await api('POST', 'inventory_levels/set.json', { location_id: locId, inventory_item_id: invItemId, available: 999999 });
  console.log('Step 4: Inventory set to:', setData.inventory_level ? setData.inventory_level.available : JSON.stringify(setData));
  console.log('\n=== VERIFY ===');
  const fin = await api('GET', 'variants/47779174023419.json');
  console.log('Policy:', fin.variant.inventory_policy);
  console.log('Inventory:', fin.variant.inventory_quantity);
  console.log('Price:', fin.variant.price);
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
