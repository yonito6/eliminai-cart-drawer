const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function patch() {
  const store = await p.store.findFirst({
    where: { shopDomain: 'eleganto-3011.myshopify.com' },
    select: { accessToken: true, shopDomain: true }
  });
  const token = store.accessToken;
  const domain = store.shopDomain;
  const LIVE_THEME = '158577557755';

  // Download current live JS
  console.log('Downloading live JS...');
  const res = await fetch(`https://${domain}/admin/api/2025-01/themes/${LIVE_THEME}/assets.json?asset[key]=assets/v14-complete.js`, {
    headers: { 'X-Shopify-Access-Token': token }
  });
  const data = await res.json();
  let code = data.asset.value;
  console.log('Live JS size:', code.length);

  // Patch 1: Replace the "add-only" path (else if toAdd.length > 0)
  // Find the exact pattern in the live code
  const addOnlyPattern = `} else if (toAdd.length > 0) {
        watchCaseBusy = true;
        fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: toAdd })
        })
        .then(function() { return fetch('/cart.js'); })
        .then(function(r) { return r.json(); })
        .then(function(c) { watchCaseBusy = false; CCD.refresh(c); })
        .catch(function() { watchCaseBusy = false; });
      }`;

  const addOnlyReplacement = `} else if (toAdd.length > 0) {
        watchCaseBusy = true;
        var _addChain = Promise.resolve();
        toAdd.forEach(function(item) {
          _addChain = _addChain.then(function() {
            return fetch('/cart/add.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: 'id=' + item.id + '&quantity=1&properties%5B_eliminai_gift%5D=true'
            });
          });
        });
        _addChain
        .then(function() { return fetch('/cart.js'); })
        .then(function(r) { return r.json(); })
        .then(function(c) { watchCaseBusy = false; CCD.refresh(c); })
        .catch(function() { watchCaseBusy = false; });
      }`;

  if (code.includes(addOnlyPattern)) {
    code = code.replace(addOnlyPattern, addOnlyReplacement);
    console.log('Patched add-only path ✓');
  } else {
    console.log('WARNING: add-only pattern NOT found, trying alternate...');
    // Try with error logging version (in case it was already patched with debug)
    const altPattern = code.indexOf("} else if (toAdd.length > 0) {");
    if (altPattern > -1) {
      console.log('Found toAdd block at index', altPattern);
      console.log('Context:', code.substring(altPattern, altPattern + 200));
    }
  }

  // Patch 2: Replace the "remove+add" path
  const removeAddPattern = `removeChain.then(function() {
          if (toAdd.length > 0) {
            return fetch('/cart/add.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items: toAdd })
            });
          }
        })`;

  const removeAddReplacement = `removeChain.then(function() {
          var _addChain2 = Promise.resolve();
          toAdd.forEach(function(item) {
            _addChain2 = _addChain2.then(function() {
              return fetch('/cart/add.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'id=' + item.id + '&quantity=1&properties%5B_eliminai_gift%5D=true'
              });
            });
          });
          return _addChain2;
        })`;

  if (code.includes(removeAddPattern)) {
    code = code.replace(removeAddPattern, removeAddReplacement);
    console.log('Patched remove+add path ✓');
  } else {
    console.log('WARNING: remove+add pattern NOT found');
  }

  // Gate: verify patched code passes all contracts before uploading
  require('./pre-upload-gate')(code, 'patch-live-js → LIVE theme');

  // Upload patched JS
  console.log('\nUploading patched JS to LIVE theme...');
  console.log('New size:', code.length);
  const uploadRes = await fetch(`https://${domain}/admin/api/2025-01/themes/${LIVE_THEME}/assets.json`, {
    method: 'PUT',
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      asset: {
        key: 'assets/v14-complete.js',
        value: code
      }
    })
  });
  const uploadData = await uploadRes.json();
  if (uploadData.errors) {
    console.error('Upload errors:', JSON.stringify(uploadData.errors));
  } else {
    console.log('Uploaded to LIVE theme:', uploadData.asset?.key, '| updated_at:', uploadData.asset?.updated_at);
  }

  await p.$disconnect();
}
patch().catch(e => { console.error(e); p.$disconnect(); });
