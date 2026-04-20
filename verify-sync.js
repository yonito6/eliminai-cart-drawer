const https = require('https');
const fs = require('fs');
const store = 'eleganto-3011.myshopify.com';
const LIVE_THEME = 158577557755;
const STAGING_THEME = 158622155003;

function loadEnv() {
  var vars = {};
  try {
    var raw = fs.readFileSync('C:/יוני/אפליקציות/Eleganto AI customer support/app/.env', 'utf8');
    raw.split('\n').forEach(function(line) {
      var m = line.match(/^([A-Z_]+)=(.*)/);
      if (m) vars[m[1]] = m[2].replace(/^"|"$/g, '').trim();
    });
  } catch(e) {}
  return vars;
}

function getToken(cid, csec) {
  return new Promise(function(resolve, reject) {
    var body = JSON.stringify({ client_id: cid, client_secret: csec, grant_type: 'client_credentials' });
    var req = https.request({ hostname: store, path: '/admin/oauth/access_token', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, function(res) {
      var d = ''; res.on('data', function(c) { d += c; }); res.on('end', function() {
        if (res.statusCode !== 200) { reject(new Error('OAuth: ' + res.statusCode)); return; }
        try { resolve(JSON.parse(d).access_token); } catch(e) { reject(e); }
      });
    }); req.on('error', reject); req.write(body); req.end();
  });
}

function getAsset(token, themeId, key) {
  return new Promise(function(resolve, reject) {
    var path = '/admin/api/2025-01/themes/' + themeId + '/assets.json?asset[key]=' + encodeURIComponent(key);
    var req = https.request({ hostname: store, path: path, method: 'GET', headers: { 'X-Shopify-Access-Token': token } }, function(res) {
      var d = ''; res.on('data', function(c) { d += c; }); res.on('end', function() {
        if (res.statusCode !== 200) { resolve(null); return; }
        try { resolve(JSON.parse(d).asset.value); } catch(e) { resolve(null); }
      });
    }); req.on('error', function() { resolve(null); }); req.end();
  });
}

(async function() {
  var env = loadEnv();
  var token = await getToken(env.SHOPIFY_CLIENT_ID, env.SHOPIFY_CLIENT_SECRET);

  var liveJs = await getAsset(token, LIVE_THEME, 'assets/custom-cart-drawer.js');
  var stagingJs = await getAsset(token, STAGING_THEME, 'assets/custom-cart-drawer.js');
  var liveCSS = await getAsset(token, LIVE_THEME, 'assets/custom-cart-drawer.css');
  var stagingCSS = await getAsset(token, STAGING_THEME, 'assets/custom-cart-drawer.css');

  console.log('JS match: ' + (liveJs === stagingJs ? 'IDENTICAL' : 'DIFFERENT'));
  console.log('  LIVE JS: ' + (liveJs ? liveJs.length : 0) + ' chars');
  console.log('  STAGING JS: ' + (stagingJs ? stagingJs.length : 0) + ' chars');

  // CSS should differ only by the green color
  if (liveCSS === stagingCSS) {
    console.log('CSS match: IDENTICAL');
  } else {
    var diff = stagingCSS.replace(liveCSS.replace('.ccd-item__price--free { font-weight: 700; }', ''), '');
    console.log('CSS match: DIFFERENT (expected — green Free color added)');
    console.log('  LIVE CSS: ' + (liveCSS ? liveCSS.length : 0) + ' chars');
    console.log('  STAGING CSS: ' + (stagingCSS ? stagingCSS.length : 0) + ' chars');
    console.log('  Diff size: ' + Math.abs(stagingCSS.length - liveCSS.length) + ' chars');
  }

  // Check Liquid templates
  var assets = ['snippets/cart-drawer.liquid', 'snippets/cart-item.liquid', 'templates/cart.ajax.liquid'];
  for (var i = 0; i < assets.length; i++) {
    var live = await getAsset(token, LIVE_THEME, assets[i]);
    var staging = await getAsset(token, STAGING_THEME, assets[i]);
    console.log(assets[i] + ': ' + (live === staging ? 'IDENTICAL' : 'DIFFERENT'));
  }
})();
