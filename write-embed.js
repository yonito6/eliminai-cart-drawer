const fs = require('fs');

const liquid = `{% comment %}
  Eliminai Cart Drawer — App Embed Block (Standalone)
  Loads on every storefront page. CSS is embedded in the JS.
  Only ONE asset needed: v14-complete.js from extension CDN.
{% endcomment %}

<style id="ccd-theme-hide">
/* Base theme drawer elements — hidden always */
#CartDrawer, cart-drawer, .cart-drawer, [data-drawer=cart-drawer], .js-cart-drawer,
.drawer--cart, [data-section-type="cart-drawer"], .cart-drawer-wrapper,
.side-cart, #side-cart, .mini-cart-drawer, .ajax-cart__drawer,
cart-notification, .cart-notification,
/* Theme drawer in open state — prevent even a single frame of visibility */
#CartDrawer.is-open, #CartDrawer.active, #CartDrawer.drawer--is-open, #CartDrawer[open],
cart-drawer.is-open, cart-drawer[open], .cart-drawer.is-open, .cart-drawer.active,
.drawer--cart.is-open, .drawer--cart.drawer--is-open, .drawer.is-open,
/* Theme drawer overlay */
.drawer__overlay, .cart-drawer__overlay, .js-drawer-overlay,
/* Theme drawer inner content */
#CartDrawer .drawer__inner, #CartDrawer .drawer__header, #CartDrawer .drawer__contents,
#CartDrawer .drawer__footer, #CartDrawer .cart__items, #CartDrawer .drawer__scrollable,
cart-drawer .drawer__inner, cart-drawer .drawer__header, cart-drawer .drawer__contents {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
  transform: translateX(100%) !important;
  transition: none !important;
  animation: none !important;
  width: 0 !important;
  height: 0 !important;
  overflow: hidden !important;
  position: fixed !important;
  top: -9999px !important;
  left: -9999px !important;
}
</style>

<script>
(function() {
  if (window.__eliminai_cart_loaded) return;
  window.__eliminai_cart_loaded = true;

  window.__ccd_early_open = false;
  function handleCartClick(e) {
    if (e.target.closest && e.target.closest("#CCD-Drawer")) return;
    var link = e.target.closest ? e.target.closest('a[href*="/cart"]') : null;
    if (link) {
      var href = link.getAttribute("href") || "";
      if (href.indexOf("/checkout") !== -1 || href.indexOf("/cart/clear") !== -1) return;
      if (href === "/cart" || href.indexOf("/cart?") === 0 || href === "/cart/") {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        if (window.CCD && window.CCD.openDrawer) { window.CCD.openDrawer(); }
        else { window.__ccd_early_open = true; }
        return;
      }
    }
    var btn = e.target.closest ? e.target.closest('[data-cart-toggle], .js-drawer-open-cart, .js-cart-toggle, .site-header__cart, .header__icon--cart, [data-action="toggle-cart"], cart-toggle, .cart-icon-bubble, .cart-count-bubble, #cart-icon-bubble, [aria-controls="CartDrawer"]') : null;
    if (btn) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      if (window.CCD && window.CCD.openDrawer) { window.CCD.openDrawer(); }
      else { window.__ccd_early_open = true; }
    }
  }
  document.addEventListener("click", handleCartClick, true);
  document.addEventListener("mousedown", handleCartClick, true);
  document.addEventListener("touchstart", handleCartClick, true);

  // EARLY THEME JS SUPPRESSION — intercept before v14-complete.js loads
  ["cart:toggle", "cart:open", "drawer:open", "theme:cart:open", "ajaxCart:open"].forEach(function(evtName) {
    document.addEventListener(evtName, function(e) {
      e.stopImmediatePropagation();
      if (window.CCD && window.CCD.openDrawer) window.CCD.openDrawer();
      else window.__ccd_early_open = true;
    }, true);
  });

  var _earlyPoll = setInterval(function() {
    try {
      var cd = document.querySelector("cart-drawer");
      if (cd) {
        if (typeof cd.open === "function" && !cd.open._ccdOverridden) {
          cd.open = function() { if (window.CCD) CCD.openDrawer(); else window.__ccd_early_open = true; };
          cd.open._ccdOverridden = true;
        }
        if (typeof cd.renderContents === "function") cd.renderContents = function() {};
        if (typeof cd.getSectionsToRender === "function") cd.getSectionsToRender = function() { return []; };
        cd.style.setProperty("display", "none", "important");
      }
      var cn = document.querySelector("cart-notification");
      if (cn) {
        if (typeof cn.open === "function" && !cn.open._ccdOverridden) {
          cn.open = function() { if (window.CCD) CCD.openDrawer(); else window.__ccd_early_open = true; };
          cn.open._ccdOverridden = true;
        }
        if (typeof cn.renderContents === "function") cn.renderContents = function() {};
        cn.style.setProperty("display", "none", "important");
      }
      if (window.theme && window.theme.CartForm && window.theme.CartForm.prototype) {
        if (window.theme.CartForm.prototype.open && !window.theme.CartForm.prototype.open._ccdOverridden) {
          window.theme.CartForm.prototype.open = function() { if (window.CCD) CCD.openDrawer(); else window.__ccd_early_open = true; };
          window.theme.CartForm.prototype.open._ccdOverridden = true;
        }
      }
      if (window.theme && window.theme.cart) {
        if (window.theme.cart.open && !window.theme.cart.open._ccdOverridden) {
          window.theme.cart.open = function() { if (window.CCD) CCD.openDrawer(); else window.__ccd_early_open = true; };
          window.theme.cart.open._ccdOverridden = true;
        }
        if (window.theme.cart.toggle && !window.theme.cart.toggle._ccdOverridden) {
          window.theme.cart.toggle = function() { if (window.CCD) CCD.openDrawer(); else window.__ccd_early_open = true; };
          window.theme.cart.toggle._ccdOverridden = true;
        }
      }
      if (window.Shopify && window.Shopify.theme && window.Shopify.theme.cart) {
        if (window.Shopify.theme.cart.openDrawer && !window.Shopify.theme.cart.openDrawer._ccdOverridden) {
          window.Shopify.theme.cart.openDrawer = function() { if (window.CCD) CCD.openDrawer(); else window.__ccd_early_open = true; };
          window.Shopify.theme.cart.openDrawer._ccdOverridden = true;
        }
      }
      var _all = document.querySelectorAll("#CartDrawer, cart-drawer, .cart-drawer, .drawer--cart, cart-notification");
      for (var i = 0; i < _all.length; i++) {
        if (_all[i].id !== "CCD-Drawer") {
          _all[i].style.setProperty("display", "none", "important");
          _all[i].style.setProperty("visibility", "hidden", "important");
        }
      }
    } catch(e) {}
    if (window.__ccd_version) clearInterval(_earlyPoll);
  }, 100);

  // EARLY FETCH INTERCEPTION — strip sections from /cart/add
  var _origFetchEarly = window.fetch;
  window.fetch = function(url, opts) {
    if (typeof url === "string" && url.indexOf("/cart/add") !== -1 && opts && opts.body) {
      try {
        var b = typeof opts.body === "string" ? opts.body : "";
        if (b.indexOf("sections") !== -1) {
          var parsed = JSON.parse(b);
          if (parsed.sections) {
            delete parsed.sections;
            opts = Object.assign({}, opts, { body: JSON.stringify(parsed) });
          }
        }
      } catch(ex) {}
    }
    return _origFetchEarly.apply(this, arguments);
  };

  var PROXY_PATH = '/apps/eliminai-cart/config';
  var themeId = Shopify.theme ? Shopify.theme.id : null;
  var isReturning = false;
  var visitCount = 1;
  var sessionToken = null;
  try {
    var vc = parseInt(localStorage.getItem('ccd_visit_count') || '0', 10);
    visitCount = (isNaN(vc) ? 0 : vc) + 1;
    localStorage.setItem('ccd_visit_count', String(visitCount));
    isReturning = visitCount > 1;
    sessionToken = localStorage.getItem('ccd_session');
    if (!sessionToken) {
      sessionToken = 'ses-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      localStorage.setItem('ccd_session', sessionToken);
    }
  } catch(e) {}

  var deviceType = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'MOBILE' : 'DESKTOP';
  var hasCustomerId = typeof __st !== 'undefined' && __st.cid ? true : false;
  var payload = {
    sessionToken: sessionToken,
    deviceType: deviceType,
    isReturning: isReturning,
    visitCount: visitCount,
    hasCustomerId: hasCustomerId,
    themeId: themeId,
    prefetch: true
  };

  fetch(PROXY_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(function(res) {
    if (!res.ok) throw new Error('Config fetch failed: ' + res.status);
    return res.json();
  })
  .then(function(data) {
    if (!data.cartConfig) { console.warn('[Eliminai] No cart config returned'); return; }
    window.CCD_CONFIG = data.cartConfig;
    window.CCD_CONFIG._currency = data.currency;
    window.CCD_CONFIG._experiment = data.experiment;
    window.CCD_CONFIG._sessionId = data.sessionId;
    window.CCD_CONFIG._segment = data.segment;
    window.CCD_CONFIG._proxyPath = PROXY_PATH.replace('/config', '');
    var script = document.createElement('script');
    script.src = '{{ "v14-complete.js" | asset_url }}';
    script.async = true;
    document.body.appendChild(script);
  })
  .catch(function(err) { console.error('[Eliminai] Cart drawer init failed:', err); });
})();
</script>

{% schema %}
{
  "name": "Eliminai Cart Drawer",
  "target": "body",
  "settings": []
}
{% endschema %}
`;

fs.writeFileSync('extensions/cart-drawer/blocks/app-embed.liquid', liquid);
console.log('Written:', liquid.length, 'bytes');
