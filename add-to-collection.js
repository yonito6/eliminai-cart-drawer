const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });

  const gql = async (query) => {
    const res = await fetch('https://' + store.shopDomain + '/admin/api/2025-01/graphql.json', {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': store.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });
    return res.json();
  };

  const COLLECTION_ID = 'gid://shopify/Collection/399056961787';

  // Products to ADD (all missing except Shipping Protection and Eleganto Case)
  const toAdd = [
    { id: 'gid://shopify/Product/8278816129275', title: 'Snake Bone Cuban Chain' },
    { id: 'gid://shopify/Product/8321460830459', title: 'Eleganto Enigma' },
    { id: 'gid://shopify/Product/8321461158139', title: 'Eleganto Infinity' },
    { id: 'gid://shopify/Product/8321461321979', title: 'Eleganto Crystal' },
    { id: 'gid://shopify/Product/8321461551355', title: 'Eleganto Mystic' },
    { id: 'gid://shopify/Product/8321461747963', title: 'Eleganto Raven' },
    { id: 'gid://shopify/Product/8321461977339', title: 'Eleganto Business' },
    { id: 'gid://shopify/Product/8321462403323', title: 'Eleganto Garnet' },
    { id: 'gid://shopify/Product/8321462599931', title: 'Eleganto Shadow' },
    { id: 'gid://shopify/Product/8321462862075', title: 'Eleganto Terra' },
    { id: 'gid://shopify/Product/8321463091451', title: 'Eleganto Diamondy' },
    { id: 'gid://shopify/Product/8321463386363', title: 'Eleganto Rotary' },
    { id: 'gid://shopify/Product/8849042735355', title: 'Eleganto Mystery Jewelry Box' },
    { id: 'gid://shopify/Product/8924133949691', title: 'Eleganto Velora' },
    { id: 'gid://shopify/Product/8955027292411', title: 'Eleganto Viper' },
    { id: 'gid://shopify/Product/8962811724027', title: 'Eleganto Caspian' },
    { id: 'gid://shopify/Product/8962815033595', title: 'Eleganto SkyLine' },
    { id: 'gid://shopify/Product/9255281197307', title: 'Eleganto Golden Anchor' },
    { id: 'gid://shopify/Product/9255850770683', title: 'Eleganto Harbor' },
    { id: 'gid://shopify/Product/9255888617723', title: 'Eleganto Silver Anchor' },
    { id: 'gid://shopify/Product/9256483094779', title: 'Eleganto Gearline' },
    { id: 'gid://shopify/Product/9256664269051', title: 'Eleganto Obsidian' },
    { id: 'gid://shopify/Product/9258578346235', title: 'Eleganto Rivet' },
    { id: 'gid://shopify/Product/9258597843195', title: 'Eleganto Peloton' },
  ];

  // NOT adding (as requested):
  // - Shipping Protection (gid://shopify/Product/9001277718779)
  // - Eleganto Case (gid://shopify/Product/9290736042235)
  // NOT deleting anything.

  console.log('Adding ' + toAdd.length + ' products to "All items" collection...');
  console.log('NOT touching: Shipping Protection, Eleganto Case');
  console.log('NOT deleting any products.\n');

  const productIds = toAdd.map(p => '"' + p.id + '"').join(', ');

  const res = await gql(`mutation {
    collectionAddProducts(id: "${COLLECTION_ID}", productIds: [${productIds}]) {
      collection { id title }
      userErrors { field message }
    }
  }`);

  if (res.data?.collectionAddProducts?.userErrors?.length > 0) {
    console.log('ERRORS:', JSON.stringify(res.data.collectionAddProducts.userErrors, null, 2));
  } else if (res.data?.collectionAddProducts?.collection) {
    console.log('SUCCESS: Added all ' + toAdd.length + ' products to "' + res.data.collectionAddProducts.collection.title + '"');
    console.log('\nProducts added:');
    for (const p of toAdd) {
      console.log('  +', p.title);
    }
  } else {
    console.log('Unexpected response:', JSON.stringify(res, null, 2));
  }

  await p.$disconnect();
})();
