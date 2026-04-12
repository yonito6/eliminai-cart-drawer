const https = require("https");
const fs = require("fs");
const path = require("path");

const store = "eleganto-3011.myshopify.com";
const STAGING_THEME = 158622155003;  // "Eliminai Cart Drawer Demo"
const LIVE_THEME = 158577557755;    // "Eliminai Cart Drawer Live" (published)
const isLive = process.argv.includes("--live");
const themeId = isLive ? LIVE_THEME : STAGING_THEME;
const label = isLive ? "LIVE" : "STAGING";

function loadEnv() {
  const vars = {};
  try {
    const raw = fs.readFileSync("C:/יוני/אפליקציות/Eleganto AI customer support/app/.env", "utf8");
    raw.split(String.fromCharCode(10)).forEach(function(line) {
      var m = line.match(/^([A-Z_]+)=(.*)/);
      if (m) vars[m[1]] = m[2].replace(/^"|"$/g, "").trim();
    });
  } catch(e) {}
  return vars;
}

function getToken(cid, csec) {
  return new Promise(function(resolve, reject) {
    var body = JSON.stringify({ client_id: cid, client_secret: csec, grant_type: "client_credentials" });
    var req = https.request({ hostname: store, path: "/admin/oauth/access_token", method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } }, function(res) {
      var d = ""; res.on("data", function(c) { d += c; }); res.on("end", function() {
        if (res.statusCode !== 200) { reject(new Error("OAuth: " + res.statusCode + " " + d)); return; }
        try { resolve(JSON.parse(d).access_token); } catch(e) { reject(e); }
      });
    }); req.on("error", reject); req.write(body); req.end();
  });
}

function upload(token, key, value) {
  return new Promise(function(resolve, reject) {
    var body = JSON.stringify({ asset: { key: key, value: value } });
    var req = https.request({ hostname: store, path: "/admin/api/2025-01/themes/" + themeId + "/assets.json", method: "PUT", headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } }, function(res) {
      var d = ""; res.on("data", function(c) { d += c; }); res.on("end", function() { console.log(key + ": " + res.statusCode); if (res.statusCode !== 200) console.log(d.substring(0, 500)); resolve(); });
    }); req.on("error", reject); req.write(body); req.end();
  });
}

var dir = path.dirname(__filename);
var js = fs.readFileSync(path.join(dir, "v14-complete.js"), "utf8");
var css = fs.readFileSync(path.join(dir, "v14-css.css"), "utf8");
var liquid = fs.readFileSync(path.join(dir, "v14-drawer.liquid"), "utf8");
var cartItem = fs.readFileSync(path.join(dir, "v14-cart-item.liquid"), "utf8");
var cartAjax = fs.readFileSync(path.join(dir, "v14-cart-ajax.liquid"), "utf8");

console.log("Target: " + label + " (theme " + themeId + ")");
console.log("JS:", js.length, "CSS:", css.length, "Liquid:", liquid.length, "CartItem:", cartItem.length, "CartAjax:", cartAjax.length);

(async function() {
  var env = loadEnv();
  if (!env.SHOPIFY_CLIENT_ID || !env.SHOPIFY_CLIENT_SECRET) { console.error("ERROR: missing Shopify credentials"); process.exit(1); }
  console.log("Authenticating via OAuth...");
  var token = await getToken(env.SHOPIFY_CLIENT_ID, env.SHOPIFY_CLIENT_SECRET);
  console.log("Uploading to " + label + "...");
  await upload(token, "assets/custom-cart-drawer.js", js);
  await upload(token, "assets/v14-complete.js", js);
  await upload(token, "assets/custom-cart-drawer.css", css);
  await upload(token, "snippets/cart-drawer.liquid", liquid);
  await upload(token, "snippets/cart-item.liquid", cartItem);
  await upload(token, "templates/cart.ajax.liquid", cartAjax);
  console.log("All 5 uploaded to " + label + "!");
})();