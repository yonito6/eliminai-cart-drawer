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

  // Find the empty catch block in the fetch interceptor
  // Pattern: } catch(ex) {} followed by scarcity check comment
  const oldPattern = `} catch(ex) {}

          // Scarcity check: block adding more of the locked item`;

  const newPattern = `} catch(ex) {
            // Body is form-encoded (not JSON) — can't inject inline,
            // so fire a SEPARATE protection add if needed
            if (!protectionDone && CFG.protectionDefaultOn !== false && CFG.protectionAutoAdd !== false) {
              protectionDone = true;
              origFetch('/cart/add.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: [{ id: PROT_VID, quantity: 1 }] })
              });
            }
          }

          // Scarcity check: block adding more of the locked item`;

  if (code.includes(oldPattern)) {
    code = code.replace(oldPattern, newPattern);
    console.log('Patched protection fallback in interceptor ✓');
  } else {
    console.log('WARNING: Pattern NOT found in live JS!');
    // Check if already patched
    if (code.includes('Body is form-encoded')) {
      console.log('Already patched — nothing to do.');
      await p.$disconnect();
      return;
    }
    // Show context around catch(ex)
    const idx = code.indexOf('catch(ex) {}');
    if (idx > -1) {
      console.log('Found catch(ex) at index', idx);
      console.log('Context:', code.substring(idx - 50, idx + 100));
    } else {
      console.log('catch(ex) {} not found at all');
      // Try variations
      const idx2 = code.indexOf('catch(ex)');
      if (idx2 > -1) {
        console.log('Found catch(ex) (without {}) at index', idx2);
        console.log('Context:', code.substring(idx2 - 50, idx2 + 150));
      }
    }
    await p.$disconnect();
    return;
  }

  // Gate: verify patched code passes all contracts before uploading
  require('./pre-upload-gate')(code, 'patch-protection-fallback → LIVE theme');

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
