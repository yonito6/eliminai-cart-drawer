/* ============================================
   CUSTOM CART DRAWER — JavaScript v14
   Smart DOM morph (no blink), watch case auto-add,
   scroll overflow indicator, trust icon, gift item
   ============================================ */
(function() {
  // === MOBILE DEBUG LOG BUFFER — captures all CCD console output ===
  var _ccdLogs = [];
  var _origConsoleLog = console.log;
  var _origConsoleWarn = console.warn;
  var _origConsoleError = console.error;
  console.log = function() {
    _origConsoleLog.apply(console, arguments);
    var msg = Array.prototype.slice.call(arguments).join(' ');
    if (msg.indexOf('[CCD') !== -1 || msg.indexOf('changeQty') !== -1 || msg.indexOf('cart/change') !== -1 || msg.indexOf('_doRefresh') !== -1) { _ccdLogs.push('[LOG] ' + new Date().toISOString().slice(11,23) + ' ' + msg); if (_ccdLogs.length > 200) _ccdLogs.shift(); }
  };
  console.warn = function() {
    _origConsoleWarn.apply(console, arguments);
    var msg = Array.prototype.slice.call(arguments).join(' ');
    if (msg.indexOf('[CCD') !== -1 || msg.indexOf('changeQty') !== -1 || msg.indexOf('cart') !== -1) { _ccdLogs.push('[WARN] ' + new Date().toISOString().slice(11,23) + ' ' + msg); if (_ccdLogs.length > 200) _ccdLogs.shift(); }
  };
  console.error = function() {
    _origConsoleError.apply(console, arguments);
    var msg = Array.prototype.slice.call(arguments).join(' ');
    if (msg.indexOf('[CCD') !== -1 || msg.indexOf('changeQty') !== -1 || msg.indexOf('cart') !== -1) { _ccdLogs.push('[ERR] ' + new Date().toISOString().slice(11,23) + ' ' + msg); if (_ccdLogs.length > 200) _ccdLogs.shift(); }
  };
  window._ccdLogs = _ccdLogs;
  // === EARLY ATC CLICK / SUBMIT TRACING — runs before init() so we catch first-click race ===
  _ccdLogs.push('[BOOT] ' + new Date().toISOString().slice(11,23) + ' v14 script executing | readyState=' + document.readyState + ' | url=' + location.pathname);
  try {
    document.addEventListener('click', function(e) {
      var t = e.target;
      if (!t) return;
      var btn = t.closest && (t.closest('[name=add],button[name=add],[type=submit],.product-form__submit,.product-form__cart-submit,.add-to-cart,[data-add-to-cart],form[action*="/cart/add"] button'));
      if (btn) {
        var form = btn.closest('form');
        var action = form && form.action ? form.action : '(no form)';
        _ccdLogs.push('[BOOT-ATC-CLICK] ' + new Date().toISOString().slice(11,23) +
          ' | tag=' + (btn.tagName||'') + ' | name=' + (btn.name||'') +
          ' | type=' + (btn.type||'') + ' | form-action=' + action +
          ' | CCD-init=' + (typeof CCD !== 'undefined' && CCD._isInited ? 'YES' : 'NO') +
          ' | fetch-overridden=' + (typeof CCD !== 'undefined' && CCD._origFetch ? 'YES' : 'NO'));
      }
    }, true);
    document.addEventListener('submit', function(e) {
      var f = e.target;
      if (!f || !f.action || f.action.indexOf('/cart/add') === -1) return;
      _ccdLogs.push('[BOOT-ATC-SUBMIT] ' + new Date().toISOString().slice(11,23) +
        ' | action=' + f.action +
        ' | CCD-init=' + (typeof CCD !== 'undefined' && CCD._isInited ? 'YES' : 'NO') +
        ' | fetch-overridden=' + (typeof CCD !== 'undefined' && CCD._origFetch ? 'YES' : 'NO') +
        ' | defaultPrevented=' + e.defaultPrevented);
    }, true);
  } catch(e) {}

  window._ccdShowDebug = function() {
    var el = document.getElementById('ccd-debug-overlay');
    if (el) { el.remove(); return; }
    el = document.createElement('div');
    el.id = 'ccd-debug-overlay';
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);color:#0f0;font:11px/1.4 monospace;z-index:99999;overflow:auto;padding:10px;white-space:pre-wrap;word-break:break-all;';
    var _cartInfo = '';
    var _giftInfo = '';
    var _themeInfo = '';
    try {
      _themeInfo = '\n=== THEME / OVERRIDE STATE ===\n';
      _themeInfo += 'window.theme: ' + (typeof window.theme !== 'undefined' ? 'EXISTS' : 'undefined') + '\n';
      _themeInfo += 'window.theme.CartForm: ' + (window.theme && window.theme.CartForm ? 'EXISTS' : 'undefined') + '\n';
      var _cfPrototype = window.theme && window.theme.CartForm && window.theme.CartForm.prototype;
      _themeInfo += 'theme.CartForm.prototype.open._ccdOverridden: ' + (_cfPrototype && _cfPrototype.open && _cfPrototype.open._ccdOverridden ? 'YES' : 'NO') + '\n';
      _themeInfo += 'window.theme.cart: ' + (window.theme && window.theme.cart ? 'EXISTS' : 'undefined') + '\n';
      var _cdEl = document.querySelector('cart-drawer');
      _themeInfo += '<cart-drawer> element: ' + (_cdEl ? 'EXISTS' : 'NONE') + '\n';
      if (_cdEl) {
        _themeInfo += '  cart-drawer.open._ccdOverridden: ' + (_cdEl.open && _cdEl.open._ccdOverridden ? 'YES' : 'NO') + '\n';
        _themeInfo += '  cart-drawer display: ' + getComputedStyle(_cdEl).display + '\n';
      }
      var _cnEl = document.querySelector('cart-notification');
      _themeInfo += '<cart-notification> element: ' + (_cnEl ? 'EXISTS' : 'NONE') + '\n';
      _themeInfo += 'CCD._isInited: ' + (typeof CCD !== 'undefined' && CCD._isInited ? 'YES' : 'NO') + '\n';
      _themeInfo += 'CCD._origFetch (fetch override installed): ' + (typeof CCD !== 'undefined' && CCD._origFetch ? 'YES' : 'NO') + '\n';
      _themeInfo += 'window.fetch === CCD._origFetch: ' + (typeof CCD !== 'undefined' && window.fetch === CCD._origFetch ? 'YES (NOT overridden!)' : 'NO (overridden)') + '\n';
      _themeInfo += '#CCD-Drawer in DOM: ' + (document.getElementById('CCD-Drawer') ? 'YES' : 'NO') + '\n';
      _themeInfo += '__ccd_version: ' + (window.__ccd_version || 'undefined') + '\n';
      _themeInfo += '================\n';
    } catch(e) { _themeInfo = '\n[theme info error: ' + e.message + ']\n'; }
    try {
      _giftInfo = '\n=== GIFT CONFIG ===\n';
      _giftInfo += 'GIFT_CUSTOMER_CHOICE: ' + (typeof GIFT_CUSTOMER_CHOICE !== 'undefined' ? GIFT_CUSTOMER_CHOICE : 'undefined') + '\n';
      _giftInfo += 'GIFT_PICKER_TITLE: ' + (typeof GIFT_PICKER_TITLE !== 'undefined' ? GIFT_PICKER_TITLE : 'undefined') + '\n';
      _giftInfo += '_giftPickerShown: ' + (typeof _giftPickerShown !== 'undefined' ? _giftPickerShown : 'undefined') + '\n';
      if (typeof CFG !== 'undefined') {
        var _fsbDbg = (CFG.addons && CFG.addons.freeShippingBar && CFG.addons.freeShippingBar.config) || {};
        _giftInfo += 'tiers: ' + ((_fsbDbg.tiers || []).length) + '\n';
        (_fsbDbg.tiers || []).forEach(function(t, i) {
          var gp = t.giftProducts || (t.giftProduct ? [t.giftProduct] : []);
          _giftInfo += '  tier ' + i + ' (goal=' + t.goal + '): ' + gp.length + ' gifts\n';
          gp.forEach(function(g) { _giftInfo += '    ' + g.handle + ' vid=' + g.variantId + '\n'; });
        });
        _giftInfo += 'giftMappings: ' + ((CFG.giftMappings || []).length) + '\n';
        (CFG.giftMappings || []).forEach(function(m) { _giftInfo += '  ' + m.originalHandle + ' -> ' + m.duplicateHandle + ' vid=' + m.duplicateVariantId + '\n'; });
      }
      _giftInfo += '================\n';
    } catch(e) { _giftInfo = '\n[gift config error: ' + e.message + ']\n'; }
    try {
      var _lc = typeof CCD !== 'undefined' ? CCD._lastCart || {} : {};
      _cartInfo = '\n=== CART STATE ===\ntotal: ' + ((_lc.total_price||0)/100) + ' | items: ' + ((_lc.items||[]).length) + ' | _lastAddedVid: ' + ((typeof CCD !== 'undefined' && CCD._lastAddedVid)||'none') + '\n';
      (_lc.items||[]).forEach(function(it,i){ _cartInfo += i + ': vid=' + it.variant_id + ' key=' + (it.key||'?').substring(0,20) + '.. qty=' + it.quantity + ' $' + (it.final_line_price/100) + ' ' + it.title + '\n'; });
      _cartInfo += '================\n';
    } catch(e) { _cartInfo = '\n[cart state error]\n'; }
    var _fullDump = _themeInfo + _giftInfo + _cartInfo + _ccdLogs.join('\n');
    window._ccdLastDump = _fullDump;
    el.innerHTML = '<div style="position:sticky;top:0;background:#000;padding:5px;display:flex;gap:10px;flex-wrap:wrap"><b>CCD Debug (' + _ccdLogs.length + ' logs)</b><button onclick="this.parentElement.parentElement.remove()" style="margin-left:auto;color:#fff;background:#c00;border:none;padding:4px 12px;cursor:pointer">CLOSE</button><button onclick="navigator.clipboard.writeText(window._ccdLastDump).then(function(){alert(\'Copied\')})" style="color:#fff;background:#06c;border:none;padding:4px 12px;cursor:pointer">COPY ALL</button></div>\n' + _fullDump;
    document.body.appendChild(el);
  };

  // === FLOATING DEBUG BUTTON — always visible, bottom-left corner ===
  function _ccdAddDebugButton() {
    if (document.getElementById('ccd-debug-fab')) return;
    if (!document.body) { setTimeout(_ccdAddDebugButton, 100); return; }
    var fab = document.createElement('button');
    fab.id = 'ccd-debug-fab';
    fab.textContent = 'Debug';
    fab.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:99998;background:#7c3aed;color:#fff;border:none;border-radius:20px;padding:8px 14px;font:600 12px system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.25);opacity:0.9;';
    fab.addEventListener('click', function(e) {
      e.preventDefault(); e.stopPropagation();
      window._ccdShowDebug();
    }, true);
    document.body.appendChild(fab);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _ccdAddDebugButton);
  } else {
    _ccdAddDebugButton();
  }

  // === INJECT EMBEDDED CSS (standalone — no external stylesheet needed) ===
  (function() {
    if (document.getElementById('ccd-embedded-css')) return;
    var s = document.createElement('style');
    s.id = 'ccd-embedded-css';
    s.textContent = '#CartDrawer, cart-drawer, .cart-drawer, [data-drawer=cart-drawer], .js-cart-drawer, .drawer--cart, .drawer[data-drawer=cart-drawer], .side-cart, #side-cart, .mini-cart-drawer, .ajax-cart__drawer { display: none !important; visibility: hidden !important; pointer-events: none !important; }' +
      '/* Cart Drawer v15 — Theme-Independent. Standalone embedded CSS. */\n' +
      '#CCD-Drawer, #CCD-Drawer *, #CCD-Drawer *::before, #CCD-Drawer *::after { box-sizing: border-box !important; }\n' +
      '#CCD-Drawer .drawer__nav, #CCD-Drawer .drawer__cart-items-wrapper, #CCD-Drawer .cart__footer:not(.ccd-sticky-footer), #CCD-Drawer .cart__item-row, #CCD-Drawer .cart__item-sub, #CCD-Drawer .cart__discounts, #CCD-Drawer .cart__items:not(.ccd-items), #CCD-Drawer .drawer__footer, #CCD-Drawer .drawer__header:not(.ccd-header), #CCD-Drawer .drawer__scrollable:not(.ccd-scrollable), #CCD-Drawer .drawer__inner:not(.ccd-inner), #CCD-Drawer .drawer__fixed-header:not(.ccd-fixed-header), #CCD-Drawer .drawer__contents:not(.ccd-contents), #CCD-Drawer .drawer__cart-empty:not(.ccd-empty), #CCD-Drawer cart-drawer-items, #CCD-Drawer cart-items, #CCD-Drawer .cart-drawer__overlay { display: none !important; }\n' +
      '#CCD-Drawer .appear-animation { opacity: 1 !important; transform: none !important; animation: none !important; transition: none !important; }\n' +
      '#CCD-Drawer { position: fixed !important; top: 0 !important; right: 0 !important; bottom: 0 !important; background: var(--ccd-bg, #fff) !important; color: #111 !important; max-width: 380px !important; width: 100% !important; z-index: 9999 !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; height: 100vh !important; height: 100dvh !important; max-height: 100vh !important; max-height: 100dvh !important; transform: translateX(100%) !important; transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1) !important; will-change: transform !important; overflow: hidden !important; display: flex !important; flex-direction: column !important; }\n' +
      '#CCD-Drawer.ccd-open { display: flex !important; flex-direction: column !important; transform: translateX(0) !important; box-shadow: -12px 0 45px rgba(0,0,0,0.25) !important; }\n' +
      '#CCD-Drawer .ccd-fixed-header { background: var(--ccd-bg, #fff) !important; padding: 0 !important; flex-shrink: 0 !important; position: relative !important; z-index: 2 !important; height: auto !important; max-height: none !important; min-height: 0 !important; overflow: visible !important; border-bottom: none !important; }\n' +
      '#CCD-Drawer .ccd-fixed-header::after { display: none !important; }\n' +
      '#CCD-Drawer .ccd-header { display: flex !important; justify-content: space-between !important; align-items: center !important; padding: 20px 20px 8px 20px !important; width: 100% !important; overflow: visible !important; border-bottom: none !important; }\n' +
      '#CCD-Drawer .ccd-title { font-size: 22px !important; font-weight: 700 !important; color: #111 !important; letter-spacing: 0 !important; text-transform: none !important; margin: 0 !important; line-height: 1 !important; }\n' +
      '#CCD-Drawer .ccd-title-badge { display: inline-flex !important; align-items: center !important; justify-content: center !important; min-width: 20px !important; height: 20px !important; padding: 0 6px !important; margin-left: 8px !important; border-radius: 999px !important; background: #eeeeee !important; color: #111 !important; font-size: 12px !important; font-weight: 600 !important; line-height: 1 !important; }\n' +
      '#CCD-Drawer .ccd-close { display: flex !important; align-items: center !important; gap: 4px !important; position: static !important; flex-shrink: 0 !important; width: auto !important; vertical-align: initial !important; text-align: right !important; }\n' +
      '#CCD-Drawer .ccd-close-btn { background: none !important; border: none !important; color: #111 !important; cursor: pointer !important; padding: 8px !important; margin-right: 0 !important; line-height: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; position: static !important; right: auto !important; left: auto !important; height: auto !important; }\n' +
      '#CCD-Drawer .ccd-close-btn svg { width: 22px !important; height: 22px !important; stroke: #111 !important; stroke-width: 2.5 !important; }\n' +
      '#CCD-Drawer .ccd-sr-only { position: absolute !important; overflow: hidden !important; clip: rect(0 0 0 0) !important; height: 1px !important; width: 1px !important; margin: -1px !important; padding: 0 !important; border: 0 !important; }\n' +
      '.ccd-progress { padding: 10px 24px 14px !important; background: #f9f9f9 !important; border-bottom: none !important; }\n' +
      '.ccd-progress__message { text-align: center !important; font-size: var(--ccd-progress-text-size, 15px) !important; font-weight: var(--ccd-progress-text-weight, 400) !important; margin-bottom: 10px !important; line-height: 1.4 !important; }\n' +
      '.ccd-progress__message strong { font-weight: 700 !important; }\n' +
      '.ccd-progress__bar-wrap { display: flex !important; align-items: flex-start !important; gap: 0 !important; position: relative !important; }\n' +
      '.ccd-progress__line { display: block !important; flex: 1 !important; height: var(--ccd-progress-height, 3px) !important; background: var(--ccd-progress-bg, #ddd) !important; margin-top: 21px !important; border-radius: 0 !important; transition: background 0.4s !important; margin-left: -3px !important; margin-right: -3px !important; position: relative !important; z-index: 0 !important; }\n' +
      '.ccd-progress__line--filled { background: #ddd !important; }\n' +
      '.ccd-progress__line::after { content: "" !important; position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; background: var(--ccd-progress-fill, var(--ccd-primary, #111)) !important; border-radius: 0 !important; transform: scaleX(0) !important; transform-origin: left !important; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1) !important; }\n' +
      '.ccd-progress__line--filled::after { transform: scaleX(1) !important; }\n' +
      '.ccd-progress__line--half::after { transform: scaleX(0.5) !important; }\n' +
      '.ccd-progress--instant .ccd-progress__line::after { transition: none !important; }\n' +
      '.ccd-progress--instant .ccd-progress__icon { transition: none !important; animation: none !important; }\n' +
      '.ccd-progress--instant .ccd-progress__line { transition: none !important; }\n' +
      '.ccd-progress__milestone { display: flex !important; flex-direction: column !important; align-items: center !important; gap: 6px !important; z-index: 1 !important; flex-shrink: 0 !important; width: 44px !important; overflow: visible !important; }\n' +
      '.ccd-progress__icon { width: 44px !important; height: 44px !important; border-radius: 50% !important; display: flex !important; align-items: center !important; justify-content: center !important; background: var(--ccd-progress-bg, #ddd) !important; transition: all 0.4s !important; }\n' +
      '.ccd-progress__icon--reached { background: var(--ccd-progress-fill, #111) !important; }\n' +
      '.ccd-progress__icon svg { width: 22px !important; height: 22px !important; fill: #999 !important; transition: fill 0.4s !important; }\n' +
      '.ccd-progress__icon--reached svg { fill: #fff !important; }\n' +
      '.ccd-progress__label { font-size: 14px !important; color: #888 !important; text-align: center !important; letter-spacing: 0.3px !important; line-height: 1.3 !important; font-weight: 500 !important; max-width: 80px !important; word-wrap: break-word !important; }\n' +
      '.ccd-progress__milestone--reached .ccd-progress__label { color: #111 !important; font-weight: 600 !important; }\n' +
      '@keyframes ccdMilestonePulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); box-shadow: 0 0 0 6px rgba(17,17,17,0.08); } }\n' +
      '@keyframes ccdMilestoneBounce { 0%, 100% { transform: translateY(0) scale(1); } 30% { transform: translateY(-5px) scale(1.05); } 50% { transform: translateY(-2px) scale(1.02); } 70% { transform: translateY(-4px) scale(1.04); } }\n' +
      '@keyframes ccdMilestoneHeartbeat { 0%, 100% { transform: scale(1); } 14% { transform: scale(1.15); } 28% { transform: scale(1); } 42% { transform: scale(1.1); } 56% { transform: scale(1); } }\n' +
      '@keyframes ccdMilestoneShake { 0%, 100% { transform: rotate(0); } 15% { transform: rotate(-10deg); } 30% { transform: rotate(10deg); } 45% { transform: rotate(-6deg); } 60% { transform: rotate(6deg); } 75% { transform: rotate(-2deg); } }\n' +
      '.ccd-progress__icon--reached { animation: ccdMilestonePulse 1.8s ease-in-out infinite; }\n' +
      '.ccd-progress--no-celebrate .ccd-progress__icon--reached { animation: none !important; }\n' +
      '#CCD-Drawer .ccd-contents, #CCD-Drawer .ccd-drawer-contents { display: flex !important; flex-direction: column !important; flex: 1 1 0% !important; min-height: 0 !important; background: #fff !important; overflow: hidden !important; }\n' +
      '#CCD-Drawer .ccd-inner { background: var(--ccd-bg, #fff) !important; display: flex !important; flex-direction: column !important; flex: 1 1 0% !important; min-height: 0 !important; overflow: hidden !important; position: relative !important; }\n' +
      '#CCD-Drawer .ccd-scrollable { flex: 1 1 0% !important; overflow-y: auto !important; padding: 0 20px !important; -webkit-overflow-scrolling: touch !important; min-height: 0 !important; }\n' +
      '#CCD-Drawer .ccd-scrollable::-webkit-scrollbar { width: 6px; }\n' +
      '#CCD-Drawer .ccd-scrollable::-webkit-scrollbar-track { background: #f0f0f0; border-radius: 6px; }\n' +
      '#CCD-Drawer .ccd-scrollable::-webkit-scrollbar-thumb { background: #bbb; border-radius: 6px; }\n' +
      '#CCD-Drawer .ccd-scrollable::-webkit-scrollbar-thumb:hover { background: #999; }\n' +
      '@media (max-width: 768px) { #CCD-Drawer .ccd-scrollable { scrollbar-width: thin !important; scrollbar-color: #ccc transparent !important; } #CCD-Drawer .ccd-scrollable::-webkit-scrollbar { width: 4px !important; -webkit-appearance: none !important; display: block !important; } #CCD-Drawer .ccd-scrollable::-webkit-scrollbar-thumb { background: #ccc !important; border-radius: 4px !important; min-height: 30px !important; } #CCD-Drawer .ccd-scrollable::-webkit-scrollbar-track { background: transparent !important; } }\n' +
      '#CCD-Drawer .ccd-inner::after { content: "" !important; position: absolute !important; bottom: 0 !important; left: 0 !important; right: 0 !important; height: 32px !important; background: linear-gradient(to top, rgba(0,0,0,0.18), transparent) !important; pointer-events: none !important; z-index: 3 !important; transition: opacity 0.3s !important; opacity: 0 !important; }\n' +
      '#CCD-Drawer .ccd-inner.has-overflow::after { opacity: 1 !important; }\n' +
      '#CCD-Drawer .ccd-inner.scrolled-bottom::after { opacity: 0 !important; }\n' +
      '#CCD-Drawer .ccd-items { margin: 0 !important; padding: 0 !important; list-style: none !important; }\n' +
      '#CCD-Drawer a { color: var(--ccd-primary, #111) !important; }\n' +
      '.ccd-item { display: flex !important; gap: 16px !important; padding: 18px 0 !important; border-bottom: 1px solid #eee !important; position: relative !important; transition: opacity 0.3s ease, transform 0.3s ease !important; }\n' +
      '.ccd-item--removing { opacity: 0 !important; transform: translateX(30px) scale(0.95) !important; pointer-events: none !important; transition: opacity 0.3s ease, transform 0.3s ease, max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1) 0.1s, padding 0.35s cubic-bezier(0.4, 0, 0.2, 1) 0.1s, margin 0.35s cubic-bezier(0.4, 0, 0.2, 1) 0.1s, border-width 0.35s cubic-bezier(0.4, 0, 0.2, 1) 0.1s !important; }\n' +
      '.ccd-item--adding { animation: ccdSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards !important; }\n' +
      '@keyframes ccdSlideIn { from { opacity: 0; transform: translateY(-15px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }\n' +
      '.ccd-item:last-child { border-bottom: none !important; }\n' +
      '.ccd-item__image { width: 120px !important; min-width: 120px !important; border-radius: 8px !important; overflow: hidden !important; background: #f8f8f8 !important; align-self: flex-start !important; }\n' +
      '.ccd-item__image a { display: block !important; }\n' +
      '.ccd-item__image img { width: 100% !important; height: auto !important; display: block !important; object-fit: cover !important; }\n' +
      '.ccd-item__details { flex: 1 !important; display: flex !important; flex-direction: column !important; gap: 2px !important; min-width: 0 !important; }\n' +
      '.ccd-item__title-row { display: flex !important; justify-content: space-between !important; align-items: flex-start !important; gap: 8px !important; }\n' +
      '.ccd-item__name { font-size: 14px !important; font-weight: 700 !important; color: #111 !important; text-transform: uppercase !important; letter-spacing: 0.5px !important; text-decoration: none !important; line-height: 1.3 !important; }\n' +
      '.ccd-item__name:hover { color: #555 !important; text-decoration: none !important; }\n' +
      '.ccd-item__remove { background: none !important; border: none !important; color: #999 !important; cursor: pointer !important; padding: 2px !important; flex-shrink: 0 !important; transition: color 0.2s !important; line-height: 0 !important; }\n' +
      '.ccd-item__remove:hover { color: #333 !important; }\n' +
      '.ccd-item__remove svg { width: 18px !important; height: 18px !important; }\n' +
      '.ccd-item__variant-row { display: inline-flex !important; flex-wrap: wrap !important; align-items: center !important; gap: 4px 8px !important; margin-top: 2px !important; }\n' +
      '.ccd-item__variant { font-size: 11px !important; color: #888 !important; text-transform: uppercase !important; letter-spacing: 2.5px !important; font-weight: 400 !important; }\n' +
      '.ccd-item__bottom { display: flex !important; justify-content: space-between !important; align-items: flex-end !important; margin-top: 8px !important; }\n' +
      '.ccd-qty { display: flex !important; align-items: center !important; border: 1px solid #ddd !important; border-radius: 6px !important; overflow: hidden !important; }\n' +
      '.ccd-qty__btn { width: 36px !important; height: 36px !important; display: flex !important; align-items: center !important; justify-content: center !important; background: transparent !important; border: none !important; color: #333 !important; cursor: pointer !important; transition: background 0.15s !important; padding: 0 !important; }\n' +
      '.ccd-qty__btn:hover { background: #f5f5f5 !important; }\n' +
      '.ccd-qty__btn svg { width: 12px !important; height: 12px !important; fill: #333 !important; }\n' +
      '.ccd-qty__input { width: 32px !important; text-align: center !important; background: transparent !important; border: none !important; border-left: 1px solid #ddd !important; border-right: 1px solid #ddd !important; color: #111 !important; font-size: 14px !important; font-weight: 500 !important; padding: 0 !important; height: 36px !important; -moz-appearance: textfield !important; }\n' +
      '.ccd-qty__input::-webkit-inner-spin-button, .ccd-qty__input::-webkit-outer-spin-button { -webkit-appearance: none !important; margin: 0 !important; }\n' +
      '.ccd-qty__input--pulse { animation: ccdPulse 0.15s !important; }\n' +
      '@keyframes ccdPulse { 50% { transform: scale(1.15); } }\n' +
      '.ccd-item__price-col { text-align: right !important; display: flex !important; flex-direction: column !important; align-items: flex-end !important; gap: 2px !important; }\n' +
      '.ccd-item__price-row { display: flex !important; align-items: center !important; gap: 8px !important; }\n' +
      '.ccd-item__compare-price { font-size: 13px !important; color: #aaa !important; text-decoration: line-through !important; }\n' +
      '.ccd-item__price { font-size: 15px !important; font-weight: 600 !important; color: #111 !important; }\n' +
      '.ccd-item__price--free { font-weight: 700 !important; color: var(--ccd-free-color, #111) !important; }\n' +
      '.ccd-badge { display: inline-flex !important; align-items: center !important; gap: 5px !important; background: #111 !important; color: #fff !important; font-size: 10px !important; font-weight: 600 !important; padding: 4px 10px !important; border-radius: 4px !important; letter-spacing: 0.5px !important; white-space: nowrap !important; }\n' +
      '#CCD-Drawer .ccd-continue-btn { display: inline-block !important; padding: 12px 28px !important; background: #111 !important; border: none !important; border-radius: 6px !important; color: #fff !important; text-decoration: none !important; font-size: 14px !important; letter-spacing: 0.5px !important; cursor: pointer !important; }\n' +
      '.ccd-badge svg { width: 13px !important; height: 13px !important; fill: #fff !important; }\n' +
      '.ccd-qty__btn--locked { opacity: 0.3 !important; cursor: not-allowed !important; pointer-events: none !important; }\n' +
      '.ccd-qty__btn--locked:hover { background: transparent !important; }\n' +
      '.ccd-scarcity-toast { position: fixed !important; top: 20px !important; left: 50% !important; transform: translateX(-50%) translateY(-20px) !important; background: #1a1a1a !important; color: #fff !important; padding: 14px 24px !important; border-radius: 10px !important; font-size: 14px !important; font-weight: 500 !important; z-index: 99999 !important; display: flex !important; align-items: center !important; gap: 10px !important; box-shadow: 0 8px 30px rgba(0,0,0,0.2) !important; opacity: 0 !important; transition: opacity 0.3s, transform 0.3s !important; pointer-events: none !important; max-width: 90vw !important; text-align: center !important; }\n' +
      '.ccd-scarcity-toast--visible { opacity: 1 !important; transform: translateX(-50%) translateY(0) !important; }\n' +
      '.ccd-scarcity-toast svg { width: 20px !important; height: 20px !important; fill: #ff6b6b !important; flex-shrink: 0 !important; }\n' +
      '.ccd-scarcity-badge { display: flex !important; width: fit-content !important; align-items: center !important; gap: 4px !important; font-size: 10px !important; position: relative !important; top: -1px !important; font-weight: 600 !important; color: var(--ccd-scarcity-color, #d32f2f) !important; background: var(--ccd-scarcity-bg, #fff3f3) !important; padding: 2px 8px !important; border-radius: 4px !important; margin-top: 4px !important; letter-spacing: 0.3px !important; animation: ccdScarcityPulse 2s ease-in-out infinite !important; }\n' +
      '.ccd-scarcity-badge svg { width: 14px !important; height: 14px !important; fill: var(--ccd-scarcity-color, #d32f2f) !important; flex-shrink: 0 !important; }\n' +
      '@keyframes ccdScarcityPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }\n' +
      '.ccd-gift-item--entering { opacity: 0 !important; max-height: 0 !important; overflow: hidden !important; }\n' +
      '.ccd-gift-item { border-top: 1px dashed #ddd !important; margin-top: 8px !important; padding-top: 8px !important; transition: opacity 0.3s ease, max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), padding 0.35s cubic-bezier(0.4, 0, 0.2, 1), margin 0.35s cubic-bezier(0.4, 0, 0.2, 1) !important; }\n' +
      '.ccd-gift-label { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 6px !important; font-size: 12px !important; font-weight: 700 !important; color: #1a7a1a !important; background: color-mix(in srgb, var(--ccd-success, #1a7a1a) 10%, white) !important; padding: 4px 12px !important; border-radius: 20px !important; margin-bottom: 8px !important; letter-spacing: 0.3px !important; }\n' +
      '.ccd-gift-label svg { width: 16px !important; height: 16px !important; fill: var(--ccd-success, #1a7a1a) !important; }\n' +
      '.ccd-gift-item__body { display: flex !important; gap: 12px !important; align-items: center !important; }\n' +
      '.ccd-gift-item__body .ccd-item__image { width: 80px !important; min-width: 80px !important; }\n' +
      '.ccd-gift-item__info { flex: 1 !important; display: flex !important; flex-direction: column !important; gap: 4px !important; }\n' +
      '.ccd-gift-item__price-row { display: flex !important; align-items: center !important; gap: 8px !important; }\n' +
      '.ccd-gift-item__price-row .ccd-item__compare-price { font-size: 14px !important; }\n' +
      '.ccd-gift-item__remove { background: none !important; border: none !important; color: #999 !important; cursor: pointer !important; padding: 4px !important; line-height: 0 !important; flex-shrink: 0 !important; transition: color 0.15s !important; }\n' +
      '.ccd-gift-item__remove:hover { color: #333 !important; }\n' +
      '.ccd-gift-item__remove svg { width: 14px !important; height: 14px !important; }\n' +
      '#CCD-Drawer .ccd-sticky-footer { flex-shrink: 0 !important; flex-grow: 0 !important; }\n' +
      '.ccd-sticky-footer { flex-shrink: 0 !important; padding: 0 20px 10px !important; border-top: 1px solid #eee !important; background: var(--ccd-bg, #fff) !important; z-index: 10 !important; }\n' +
      '.ccd-shipping-protection { display: flex !important; align-items: center !important; gap: 10px !important; padding: 8px 0 4px !important; }\n' +
      '.ccd-shipping-protection__icon { width: 32px !important; height: 32px !important; flex-shrink: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; }\n' +
      '.ccd-shipping-protection__icon svg { width: 24px !important; height: 24px !important; fill: var(--ccd-prot-color, #555) !important; }\n' +
      '.ccd-shipping-protection__info { flex: 1 !important; min-width: 0 !important; }\n' +
      '.ccd-shipping-protection__title { font-size: 16px !important; font-weight: 600 !important; color: #111 !important; }\n' +
      '.ccd-shipping-protection__desc { font-size: 14px !important; color: #666 !important; margin-top: 2px !important; }\n' +
      '.ccd-shipping-protection__right { display: flex !important; flex-direction: column !important; align-items: flex-end !important; gap: 4px !important; flex-shrink: 0 !important; }\n' +
      '.ccd-shipping-protection__price { font-size: 16px !important; font-weight: 600 !important; color: #111 !important; }\n' +
      '.ccd-toggle { position: relative !important; width: 40px !important; height: 22px !important; display: inline-block !important; }\n' +
      '.ccd-toggle input { opacity: 0 !important; width: 0 !important; height: 0 !important; position: absolute !important; }\n' +
      '.ccd-toggle__slider { position: absolute !important; cursor: pointer !important; inset: 0 !important; background: #ccc !important; transition: 0.3s !important; border-radius: 22px !important; }\n' +
      '.ccd-toggle__slider:before { position: absolute !important; content: "" !important; height: 16px !important; width: 16px !important; left: 3px !important; bottom: 3px !important; background: var(--ccd-bg, #fff) !important; transition: 0.3s !important; border-radius: 50% !important; }\n' +
      '.ccd-toggle input:checked + .ccd-toggle__slider { background: #111 !important; }\n' +
      '.ccd-toggle input:checked + .ccd-toggle__slider:before { transform: translateX(18px) !important; }\n' +
      '.ccd-toggle--instant { transition: none !important; }\n' +
      '.ccd-toggle--instant:before { transition: none !important; }\n' +
      '.ccd-discount-row { display: flex !important; justify-content: space-between !important; align-items: center !important; padding: 2px 0 !important; }\n' +
      '.ccd-discount-row__left { display: flex !important; align-items: center !important; gap: 8px !important; flex-wrap: wrap !important; }\n' +
      '.ccd-discount-row__label { font-size: 13px !important; color: #111 !important; }\n' +
      '.ccd-discount-row__amount { font-size: 15px !important; font-weight: 600 !important; color: #111 !important; }\n' +
      '.ccd-discount-row__promo-name { display: inline-flex !important; align-items: center !important; gap: 4px !important; font-size: 12px !important; font-weight: 600 !important; color: #111 !important; }\n' +
      '.ccd-discount-row__promo-name svg { width: 14px !important; height: 14px !important; fill: #111 !important; flex-shrink: 0 !important; }\n' +
      // ── Discount Code INPUT row (id-scoped to override the colliding `.ccd-discount-row` totals styles above) ──
      '#ccd-discount-code-row { display: flex !important; align-items: stretch !important; justify-content: stretch !important; gap: 0 !important; padding: 0 !important; margin: 8px 0 10px !important; position: relative !important; flex-wrap: wrap !important; }\n' +
      '#ccd-discount-code-row .ccd-discount-row__input { flex: 1 1 auto !important; min-width: 0 !important; padding: 11px 14px !important; border: 1px solid #d4d4d8 !important; border-right: none !important; border-radius: 8px 0 0 8px !important; background: var(--ccd-bg, #fff) !important; color: #111 !important; font-size: 14px !important; line-height: 1.2 !important; outline: none !important; transition: border-color 0.15s, box-shadow 0.15s !important; box-shadow: none !important; -webkit-appearance: none !important; appearance: none !important; }\n' +
      '#ccd-discount-code-row .ccd-discount-row__input::placeholder { color: #9ca3af !important; opacity: 1 !important; }\n' +
      '#ccd-discount-code-row .ccd-discount-row__input:focus { border-color: #111 !important; box-shadow: 0 0 0 1px #111 inset !important; }\n' +
      '#ccd-discount-code-row .ccd-discount-row__apply { flex: 0 0 auto !important; padding: 11px 18px !important; background: var(--ccd-da-bg, #111) !important; color: #fff !important; border: 1px solid var(--ccd-da-bg, #111) !important; border-radius: 0 8px 8px 0 !important; font-size: 13px !important; font-weight: 700 !important; letter-spacing: 0.5px !important; text-transform: uppercase !important; cursor: pointer !important; transition: filter 0.15s !important; white-space: nowrap !important; }\n' +
      '#ccd-discount-code-row .ccd-discount-row__apply:hover:not(:disabled) { filter: brightness(1.15) !important; }\n' +
      '#ccd-discount-code-row .ccd-discount-row__apply:active:not(:disabled) { filter: brightness(0.85) !important; }\n' +
      '#ccd-discount-code-row .ccd-discount-row__apply:disabled { opacity: 0.6 !important; cursor: default !important; }\n' +
      '#ccd-discount-code-row .ccd-discount-row__status { flex: 0 0 100% !important; min-height: 0 !important; padding: 0 2px !important; margin: 4px 0 0 !important; font-size: 12px !important; color: #6b7280 !important; line-height: 1.3 !important; }\n' +
      '#ccd-discount-code-row .ccd-discount-row__status:empty { display: none !important; }\n' +
      '#ccd-discount-code-row .ccd-discount-row__status--applied { color: #047857 !important; font-weight: 600 !important; }\n' +
      // ── Order Notes row ──
      '.ccd-notes-row { display: flex !important; flex-direction: column !important; gap: 6px !important; padding: 0 !important; margin: 8px 0 10px !important; }\n' +
      '.ccd-notes-row__label { font-size: 12px !important; font-weight: 600 !important; color: #374151 !important; letter-spacing: 0.2px !important; }\n' +
      '.ccd-notes-row__input { width: 100% !important; min-height: 44px !important; padding: 11px 14px !important; border: 1px solid #d4d4d8 !important; border-radius: 8px !important; background: var(--ccd-bg, #fff) !important; color: #111 !important; font-size: 14px !important; font-family: inherit !important; line-height: 1.4 !important; resize: vertical !important; outline: none !important; transition: border-color 0.15s, box-shadow 0.15s !important; box-shadow: none !important; -webkit-appearance: none !important; appearance: none !important; }\n' +
      '.ccd-notes-row__input::placeholder { color: #9ca3af !important; opacity: 1 !important; }\n' +
      '.ccd-notes-row__input:focus { border-color: #111 !important; box-shadow: 0 0 0 1px #111 inset !important; }\n' +
      '.ccd-checkout-btn { display: flex !important; align-items: center !important; justify-content: center !important; gap: 8px !important; width: 100% !important; padding: 14px 24px !important; background: #111 !important; color: #fff !important; border: 1px solid #222 !important; border-radius: 8px !important; font-size: 15px !important; font-weight: 700 !important; letter-spacing: 1px !important; text-transform: uppercase !important; cursor: pointer !important; transition: all 0.15s !important; margin-top: 6px !important; }\n' +
      '.ccd-checkout-btn:hover { background: #222 !important; }\n' +
      '.ccd-checkout-btn:active { background: #000 !important; }\n' +
      '.ccd-checkout-btn svg { width: 16px !important; height: 16px !important; fill: #fff !important; }\n' +
      '.ccd-trust { display: flex !important; align-items: center !important; justify-content: center !important; gap: 8px !important; padding: 4px 0 2px !important; font-size: 14px !important; color: #777 !important; }\n' +
      '.ccd-express { display: block !important; }\n' +
      '.ccd-express--below { margin-top: 12px !important; }\n' +
      '.ccd-express--above { margin-bottom: 12px !important; }\n' +
      '.ccd-trust svg { width: 18px !important; height: 18px !important; fill: #6BA4E8 !important; }\n' +
      '.ccd-trust strong { color: #111 !important; font-weight: 700 !important; }\n' +
      '.ccd-trust__line { display: flex !important; align-items: center !important; gap: 4px !important; }\n' +
      '.ccd-trust__icon { width: 16px !important; height: 16px !important; flex-shrink: 0 !important; }\n' +
      '.ccd-trust__badges { display: none !important; }\n' +
      '#CCD-Drawer .ccd-cart-empty, #CCD-Drawer .ccd-empty { color: #111 !important; text-align: center !important; flex: 1 !important; display: none !important; align-items: center !important; justify-content: flex-start !important; padding-top: 80px !important; }\n' +
      '#CCD-Drawer .ccd-cart-empty.ccd-show, #CCD-Drawer .ccd-empty.ccd-show { display: flex !important; flex-direction: column !important; gap: 16px !important; padding: 20px 20px 60px !important; }\n' +
      '.ccd-continue-btn { background: #111 !important; color: #fff !important; border: none !important; padding: 12px 24px !important; border-radius: 6px !important; cursor: pointer !important; font-size: 14px !important; font-weight: 600 !important; }\n' +
      '@media (min-width: 769px) { #CCD-Drawer { max-width: var(--ccd-desktop-width, 480px) !important; } }\n' +
      '@media (max-width: 768px) { #CCD-Drawer { max-width: var(--ccd-mobile-width, 85%) !important; height: 100vh !important; height: 100dvh !important; } #CCD-Drawer.ccd-open { transform: translateX(0) !important; } #CCD-Drawer .ccd-close { display: flex !important; position: static !important; flex-shrink: 0 !important; margin: 0 !important; padding: 0 !important; width: auto !important; } #CCD-Drawer .ccd-close-btn { position: static !important; right: auto !important; left: auto !important; margin: 0 !important; padding: 12px !important; display: flex !important; height: auto !important; } .ccd-item__image { width: 100px !important; min-width: 100px !important; } .ccd-item { padding: 14px 0 !important; gap: 12px !important; } .ccd-progress { padding: 6px 16px 10px !important; } .ccd-progress__icon { width: 36px !important; height: 36px !important; } .ccd-progress__icon svg { width: 18px !important; height: 18px !important; } .ccd-progress__milestone { width: 36px !important; } .ccd-progress__line { margin-top: 18px !important; } .ccd-progress__message { font-size: 14px !important; margin-bottom: 8px !important; } .ccd-progress__label { font-size: 12px !important; } #CCD-Drawer .ccd-header { padding: 16px 16px 6px 16px !important; } .ccd-sticky-footer { padding: 0 16px 8px !important; } .ccd-checkout-btn { padding: 13px 20px !important; font-size: 14px !important; } .ccd-gift-item__body .ccd-item__image { width: 60px !important; min-width: 60px !important; } }\n' +
      '@keyframes ccdSpin { to { transform: rotate(360deg); } }\n' +
      '.ccd-spinner { display: inline-block !important; width: 16px !important; height: 16px !important; border: 2px solid rgba(255,255,255,0.3) !important; border-top-color: #fff !important; border-radius: 50% !important; animation: ccdSpin 0.6s linear infinite !important; }\n' +
      '.ccd-item--loading { opacity: 0.5 !important; pointer-events: none !important; }\n' +
      '.ccd-qty__btn--loading svg { display: none !important; }\n' +
      '.ccd-qty__btn--loading::after { content: "" !important; display: block !important; width: 12px !important; height: 12px !important; border: 1.5px solid rgba(0,0,0,0.15) !important; border-top-color: #333 !important; border-radius: 50% !important; animation: ccdSpin 0.6s linear infinite !important; }\n' +
      '.ccd-checkout-btn--loading { pointer-events: none !important; opacity: 0.6 !important; cursor: not-allowed !important; transition: none !important; }\n' +
      '.ccd-checkout-btn--loading > svg { display: none !important; }\n' +
      '.ccd-checkout-total { transition: opacity 0.2s ease !important; }\n' +
      '#CartDrawer, cart-drawer, .cart-drawer, [data-drawer=cart-drawer], .js-cart-drawer, .drawer--cart { display: none !important; visibility: hidden !important; }\n' +
      '#CartDrawer .ccd-trust, #CartDrawer .drawer__cart-empty, #CartDrawer .ccd-progress, #CartDrawer .appear-animation { display: none !important; }\n' +
      '.ccd-checkout-btn--loading::before { content: "" !important; display: inline-block !important; width: 16px !important; height: 16px !important; border: 2px solid rgba(255,255,255,0.3) !important; border-top-color: #fff !important; border-radius: 50% !important; animation: ccdSpin 0.7s linear infinite !important; vertical-align: middle !important; flex-shrink: 0 !important; }\n' +
      '.ccd-gift-picker { border-top: 1px dashed #ddd !important; margin-top: 8px !important; padding: 12px 0 !important; }\n' +
      '.ccd-gift-picker--change { border-top: none !important; margin: 4px 0 6px !important; padding: 8px 10px !important; background: #f9fafb !important; border-radius: 10px !important; }\n' +
      '.ccd-gift-picker__title { font-size: 13px !important; font-weight: 600 !important; color: #1a7a1a !important; margin-bottom: 10px !important; display: flex !important; align-items: center !important; gap: 6px !important; }\n' +
      '.ccd-gift-picker__title svg { width: 16px !important; height: 16px !important; fill: #1a7a1a !important; }\n' +
      '.ccd-gift-picker__options { display: flex !important; flex-direction: column !important; gap: 6px !important; }\n' +
      '.ccd-gift-picker__opt { display: flex !important; align-items: center !important; gap: 10px !important; padding: 8px 10px !important; border-radius: 10px !important; border: 2px solid #e5e7eb !important; background: #fff !important; cursor: pointer !important; transition: all 0.2s cubic-bezier(0.4,0,0.2,1) !important; }\n' +
      '.ccd-gift-picker__opt:hover { border-color: var(--ccd-gift-change-color, #111) !important; opacity: 0.8 !important; }\n' +
      '.ccd-gift-picker__opt--selected { border-color: var(--ccd-gift-change-color, #111) !important; background: rgba(0,0,0,0.03) !important; }\n' +
      '.ccd-gift-picker__opt img { width: 50px !important; height: 50px !important; border-radius: 6px !important; object-fit: cover !important; flex-shrink: 0 !important; }\n' +
      '.ccd-gift-picker__opt-info { flex: 1 !important; }\n' +
      '.ccd-gift-picker__opt-title { font-size: 12px !important; font-weight: 500 !important; color: #111 !important; }\n' +
      '.ccd-gift-picker__opt-price { font-size: 11px !important; color: #6b7280 !important; }\n' +
      '.ccd-gift-picker__opt-price span { text-decoration: line-through !important; }\n' +
      '.ccd-gift-picker__opt-check { width: 20px !important; height: 20px !important; border-radius: 50% !important; border: 2px solid #d1d5db !important; flex-shrink: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; transition: all 0.15s !important; }\n' +
      '.ccd-gift-picker__opt--selected .ccd-gift-picker__opt-check { border-color: var(--ccd-gift-change-color, #111) !important; background: var(--ccd-gift-change-color, #111) !important; }\n' +
      '.ccd-gift-badge { width: fit-content !important; display: inline-flex !important; white-space: nowrap !important; align-self: flex-end !important; align-items: center !important; gap: 4px !important; font-size: 11px !important; font-weight: 600 !important; color: #1a7a1a !important; background: #edf7ed !important; border-radius: 4px !important; padding: 2px 8px !important; margin-top: 4px !important; line-height: 1.4 !important; }\n' +
      '.ccd-gift-badge svg { width: 14px !important; height: 14px !important; flex-shrink: 0 !important; }\n' +
      '.ccd-gift-change { display: inline-flex !important; align-items: center !important; gap: 3px !important; font-size: 10px !important; font-weight: 500 !important; color: var(--ccd-gift-change-color, #111) !important; background: none !important; border: none !important; padding: 2px 0 !important; cursor: pointer !important; transition: opacity 0.15s !important; margin-top: 3px !important; opacity: 0.5 !important; width: fit-content !important; text-decoration: underline !important; text-underline-offset: 2px !important; }\n' +
      '.ccd-gift-change:hover { opacity: 1 !important; }\n' +
      
      '.ccd-trust-badges { text-align: center !important; padding: 8px 0 4px !important; opacity: 1 !important; }\n' +
      '.ccd-trust-icons { display: flex !important; align-items: center !important; justify-content: center !important; gap: 6px !important; margin-bottom: 4px !important; }\n' +
      '.ccd-trust-label { font-size: 9px !important; color: var(--ccd-text-muted, #999) !important; margin-right: 4px !important; }\n' +
      '.ccd-trust-text { font-size: 11px !important; color: var(--ccd-text-muted, #999) !important; letter-spacing: 0.02em !important; }\n' +
      '.ccd-overlay { display: block !important; position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; background: rgba(0,0,0,0.4) !important; z-index: 9998 !important; opacity: 0 !important; transition: opacity 0.35s !important; pointer-events: none !important; }\n' +
      '.ccd-overlay--visible { opacity: 1 !important; pointer-events: auto !important; }\n' +
      // ── BUG-3 FIX: Loading overlay for smooth background refresh ──
      '.ccd-loading-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 10; pointer-events: none; opacity: 0; transition: opacity 0.15s ease; }\n' +
      '.ccd-loading-overlay--visible { opacity: 1; pointer-events: auto; }\n' +
      '.ccd-loading-shimmer { display: none; }\n' +
      '.ccd-items-crossfade { transition: opacity 0.15s ease; }\n' +
      '.ccd-items-crossfade--out { opacity: 0.5; }\n' +
      '.ccd-refreshing .ccd-qty__btn, .ccd-refreshing .ccd-item__remove, .ccd-refreshing .ccd-toggle { pointer-events: none !important; opacity: 0.4 !important; }\n' +
      '.ccd-spinner { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 28px; height: 28px; border: 2.5px solid rgba(150,150,150,0.15); border-top-color: rgba(150,150,150,0.6); border-radius: 50%; animation: ccd-spin 0.6s linear infinite; z-index: 11; }\n' +
      '@keyframes ccd-spin { 100% { transform: translate(-50%, -50%) rotate(360deg); } }\n';
    // Remove any existing external CSS link (we're standalone now)
    var oldCss = document.getElementById('ccd-css-fallback');
    if (oldCss) oldCss.parentNode.removeChild(oldCss);
    document.head.appendChild(s);
  })();

  // === THEME CART OVERRIDE ===
  // Neutralize the theme's cart rebuild to prevent flicker during our animations.
  // Every major cart app (Rebuy, Slide Cart, EliteCart) does this.
  // We override buildCart + block cart events during our animations.
  (function() {
    // 0. EARLY MutationObserver — catch theme drawers BEFORE init() runs
    //    Fires synchronously on script load, not waiting for DOMContentLoaded.
    var _earlySelectors = '#CartDrawer, cart-drawer, .cart-drawer, [data-drawer=cart-drawer], .js-cart-drawer, .drawer--cart, .side-cart, #side-cart, .mini-cart-drawer, .ajax-cart__drawer';
    function _earlySuppress() {
      try {
        var els = document.querySelectorAll(_earlySelectors);
        els.forEach(function(el) {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
          el.setAttribute('aria-hidden', 'true');
          if (typeof el.open === 'function' && !el.open._ccdOverridden) {
            el.open = function() { if (window.CCD) CCD.openDrawer(); };
            el.open._ccdOverridden = true;
          }
          if (typeof el.renderContents === 'function') { el.renderContents = function() {}; }
          if (typeof el.getSectionsToRender === 'function') { el.getSectionsToRender = function() { return []; }; }
        });
      } catch(e) {}
    }
    _earlySuppress();
    if (typeof MutationObserver !== 'undefined') {
      // Only treat attribute changes on KNOWN cart drawer elements as cart-open signals.
      // Watching the entire subtree for 'is-active'/'active' causes false triggers on
      // mobile carousels, accordions, tabs, sliders, etc. that use the same class names.
      var _cartDrawerSelectorList = _earlySelectors.split(',').map(function(s) { return s.trim(); });
      function _isCartDrawerElement(el) {
        if (!el || !el.matches) return false;
        try { return el.matches(_earlySelectors); } catch(e) { return false; }
      }
      var _earlyObserver = new MutationObserver(function(mutations) {
        var needsCheck = false;
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          if (m.addedNodes && m.addedNodes.length) { needsCheck = true; break; }
          if (m.type === 'attributes') {
            var el = m.target;
            if (el.id === 'CCD-Drawer' || (el.closest && el.closest('#CCD-Drawer'))) continue;
            // ONLY react to known cart drawer elements — NOT random page elements
            if (!_isCartDrawerElement(el)) continue;
            if (el.classList && (el.classList.contains('is-open') || el.classList.contains('drawer--is-open') ||
                el.classList.contains('active') || el.classList.contains('is-active')) ||
                el.hasAttribute('open')) {
              el.style.setProperty('display', 'none', 'important');
              if (el.classList) el.classList.remove('is-open', 'drawer--is-open', 'active', 'is-active');
              el.removeAttribute('open');
              if (window.CCD && !CCD._isOpen) CCD.openDrawer();
            }
          }
        }
        if (needsCheck) _earlySuppress();
      });
      var _observeTarget = document.body || document.documentElement;
      _earlyObserver.observe(_observeTarget, {
        childList: true, subtree: true,
        attributes: true, attributeFilter: ['class', 'style', 'open', 'aria-hidden']
      });
      window.__ccd_early_observer = _earlyObserver;
    }

    // 1. Override theme.cart.buildCart when it becomes available
    var _checkTheme = setInterval(function() {
      _earlySuppress();
      if (window.theme && window.theme.cart) {
        var _origBuildCart = window.theme.cart.buildCart;
        window.theme.cart.buildCart = function(cart, openDrawer) {
          if (window.__ccd_block_rebuild) return; // skip during our animation
          // Outside animation window, let theme rebuild normally
          if (_origBuildCart) return _origBuildCart.call(window.theme.cart, cart, openDrawer);
        };
        // Also override _updateCart to prevent theme's own /cart/change.js calls
        if (window.theme.cart._updateCart) {
          var _origUpdateCart = window.theme.cart._updateCart;
          window.theme.cart._updateCart = function(params) {
            if (window.__ccd_block_rebuild) return Promise.resolve(window.__ccd_last_cart || {});
            return _origUpdateCart.call(window.theme.cart, params);
          };
        }
        // Also override changeItem
        if (window.theme.cart.changeItem) {
          var _origChangeItem = window.theme.cart.changeItem;
          window.theme.cart.changeItem = function(key, qty) {
            if (window.__ccd_block_rebuild) return;
            return _origChangeItem.call(window.theme.cart, key, qty);
          };
        }
        clearInterval(_checkTheme);
      }
    }, 50);
    // Stop checking after 10s
    setTimeout(function() { clearInterval(_checkTheme); }, 10000);

    // 2. Swallow cart events during animation (backup)
    var _origDispatch = document.dispatchEvent.bind(document);
    document.dispatchEvent = function(evt) {
      if (window.__ccd_block_rebuild && evt.type &&
          (evt.type === 'cart:updated' || evt.type === 'cart:build' || evt.type === 'cart:quantity')) {
        return true;
      }
      return _origDispatch(evt);
    };
  })();
  'use strict';


  var CFG = window.CCD_CONFIG || {};
  var _sp = (CFG.addons && CFG.addons.shippingProtection) || {};
  var PROT = _sp.handle || CFG.protectionHandle || 'shipping-protection-1';
  var _spCfg = _sp.config || _sp;
  var PROT_TIERS = _spCfg.tiers || [];
  var PROT_VID_SINGLE = parseInt(_spCfg.variantId || CFG.protectionVariantId) || 0;
  if (PROT_TIERS.length === 0 && PROT_VID_SINGLE) {
    PROT_TIERS = [{ vid: PROT_VID_SINGLE, price: parseInt(_spCfg.price || CFG.protectionPrice) || 499, maxValue: null }];
  }
  var PROT_VID = PROT_TIERS.length > 0 ? PROT_TIERS[0].vid : 0;
  function getProtTier(cartValueCents) {
    for (var i = 0; i < PROT_TIERS.length; i++) {
      if (PROT_TIERS[i].maxValue === null || cartValueCents <= PROT_TIERS[i].maxValue) {
        return PROT_TIERS[i];
      }
    }
    return PROT_TIERS[PROT_TIERS.length - 1] || null;
  }
  var PROT_ENABLED = _sp.enabled === true || (CFG.protectionEnabled === true);
  var PROT_COLOR = _spCfg.iconColor || '#555';
  // ── Dynamic reward tiers (from dashboard config) ──
  // Data lives at CFG.addons.freeShippingBar.config.* — flatten with fallback to flat CFG.*
  var _fsb = (CFG.addons && CFG.addons.freeShippingBar && CFG.addons.freeShippingBar.config) || {};
  var REWARD_TIERS = _fsb.tiers || CFG.tiers || [];
  var THRESHOLD_MODE = _fsb.thresholdMode || CFG.thresholdMode || 'items';
  var HIGHEST_TIER_ONLY = !!(_fsb.highestTierOnly || CFG.highestTierOnly);
  var ALL_REWARDS_TEXT = _fsb.allRewardsUnlockedText || CFG.allRewardsUnlockedText || '\uD83C\uDF89 You\u2019ve unlocked all rewards!';
  var MILESTONE_ANIMATION = (_fsb.milestoneAnimation !== undefined ? _fsb.milestoneAnimation : CFG.milestoneAnimation) !== false;
  var MILESTONE_ANIM_TYPE = _fsb.milestoneAnimationType || CFG.milestoneAnimationType || 'pulse';
  var GIFT_BADGE_ENABLED = (_fsb.giftBadgeEnabled !== undefined ? _fsb.giftBadgeEnabled : CFG.giftBadgeEnabled) !== false;
  var GIFT_BADGE_TEXT = _fsb.giftBadgeText || CFG.giftBadgeText || 'Bonus gift';
  var GIFT_BADGE_TEXT_COLOR = _fsb.giftBadgeTextColor || CFG.giftBadgeTextColor || '#1a7a1a';
  var GIFT_BADGE_BG_COLOR = _fsb.giftBadgeBgColor || CFG.giftBadgeBgColor || '#edf7ed';
  var GIFT_SHOW_COMPARE_PRICE = (_fsb.giftShowComparePrice !== undefined ? _fsb.giftShowComparePrice : CFG.giftShowComparePrice) !== false;
  var GIFT_HIDE_DISCOUNT_LABEL = (_fsb.giftHideDiscountLabel !== undefined ? _fsb.giftHideDiscountLabel : CFG.giftHideDiscountLabel) !== false;
  var FREE_PRICE_LABEL = _fsb.freePriceLabel || CFG.freePriceLabel || 'Free';
  var FREE_PRICE_COLOR = _fsb.freePriceColor || CFG.freePriceColor || '#111';
  var GIFT_CUSTOMER_CHOICE = !!(_fsb.giftCustomerChoice || CFG.giftCustomerChoice);
  var GIFT_CHANGE_COLOR = _fsb.giftChangeColor || CFG.giftChangeColor || '#111';
  var GIFT_CHANGE_TEXT = _fsb.giftChangeText || CFG.giftChangeText || 'Change';
  var GIFT_PICKER_TITLE = _fsb.giftPickerTitle || CFG.giftPickerTitle || 'Choose your free gift';
  console.log('[CCD DEBUG] GIFT_CUSTOMER_CHOICE=' + GIFT_CUSTOMER_CHOICE + ' GIFT_PICKER_TITLE=' + GIFT_PICKER_TITLE);
  console.log('[CCD DEBUG] _fsb.giftCustomerChoice=' + _fsb.giftCustomerChoice + ' CFG.giftCustomerChoice=' + CFG.giftCustomerChoice);
  console.log('[CCD DEBUG] GIFT_TIERS count=' + (REWARD_TIERS.filter(function(t){return (t.giftProducts||[]).length>0}).length));
  console.log('[CCD DEBUG] All tier gifts:', JSON.stringify(REWARD_TIERS.map(function(t){return {goal:t.goal, gifts:(t.giftProducts||[]).map(function(g){return g.handle})}})));


  // Backwards compat: derive PROMO_GOAL from last tier's goal
  var PROMO_GOAL = REWARD_TIERS.length > 0 ? REWARD_TIERS[REWARD_TIERS.length - 1].goal : (CFG.promoGoal || 3);
  // Resolve primary gift from a tier — checks giftProducts[] first, falls back to giftProduct
  // Returns first gift (for legacy/backwards compat)
  function tierGift(t) {
    if (t.giftProducts && t.giftProducts.length > 0) return t.giftProducts[0];
    if (t.giftProduct) return t.giftProduct;
    return null;
  }
  // Returns ALL gifts for a tier
  function tierGifts(t) {
    if (t.giftProducts && t.giftProducts.length > 0) return t.giftProducts;
    if (t.giftProduct) return [t.giftProduct];
    return [];
  }
  // Build a set of all gift handles across tiers
  var GIFT_HANDLES = {};
  var GIFT_VIDS = {}; // variant_id → true for ALL gift variants
  REWARD_TIERS.forEach(function(t) {
    tierGifts(t).forEach(function(g) { if (g.variantId) GIFT_VIDS[String(g.variantId)] = true; });
  });
  var GIFT_DISCOUNT_CODES = [];
  var GIFT_URL_MAP = {}; // duplicate handle → original product URL
  var GIFT_TIERS = []; // tiers that have a gift product
  REWARD_TIERS.forEach(function(t) {
    var gifts = tierGifts(t);
    if (gifts.length > 0) {
      gifts.forEach(function(g) { if (g.handle) GIFT_HANDLES[g.handle] = true; });
      GIFT_TIERS.push(t);
    }
  });
  // Legacy single gift (backwards compat for stores not yet using tiers)
  var _lastGift = GIFT_TIERS.length > 0 ? tierGift(GIFT_TIERS[GIFT_TIERS.length - 1]) : null;
  var WATCH_CASE_HANDLE = CFG.giftHandle || (_lastGift ? _lastGift.handle : 'eleganto-premium-watch-organizer');
  var WATCH_CASE_VID = parseInt(CFG.giftVariantId) || (_lastGift ? _lastGift.variantId : 46941745742075);
  var WATCH_GOAL = CFG.giftGoal || (GIFT_TIERS.length > 0 ? GIFT_TIERS[GIFT_TIERS.length - 1].goal : 3);
  var busy = false;
  var _pendingOp = null; // queued operation when busy
  var _refreshGen = 0; // generation counter — stale refreshes silently no-op
  var protectionDone = false;
  var _protReorderBusy = false;
  var toggling = false;
  var _userToggledOff = false;
  var watchCaseBusy = false;
  var _giftPickerShown = false;
  var _giftChosenByCustomer = {}; // tracks tier goals where customer already chose — {goal: handle}
    var _giftAddFails = {}; // handle → fail count, prevents infinite retry
  var scarcityVariantId = null;
  try { scarcityVariantId = sessionStorage.getItem('ccd_scarcity_vid'); } catch(e) {}
  // Restore sticky scarcity lock from sessionStorage (persists across cart open/close and page refreshes)
  var _initScarcityLockedVid = null;
  try { _initScarcityLockedVid = sessionStorage.getItem('ccd_scarcity_locked_vid'); } catch(e) {}
  // ── Low-stock badge addon config (CFG.addons.lowStockBadge.config) ──
  // Backward compat: if no addon entry, falls back to legacy CFG.scarcityX keys.
  var _lsb = (CFG.addons && CFG.addons.lowStockBadge) || {};
  var _lsbCfg = _lsb.config || {};
  var LSB_ENABLED;
  if (_lsb && (_lsb.enabled === true || _lsb.enabled === false)) {
    LSB_ENABLED = _lsb.enabled === true;
  } else {
    LSB_ENABLED = CFG.scarcityEnabled !== false;
  }
  var LSB_MODE = _lsbCfg.mode || 'fake';
  var LSB_TARGET = _lsbCfg.target || CFG.scarcityTarget || '2';
  var LSB_FAKE_QTY = parseInt(_lsbCfg.fakeQty) || 1;
  var LSB_THRESHOLD = parseInt(_lsbCfg.threshold) || 5;
  var LSB_TEXT = _lsbCfg.text || CFG.scarcityText || 'Only {n} left!';
  var LSB_ICON = _lsbCfg.icon || CFG.scarcityIcon || 'fire';
  var LSB_BLOCK_ADD = _lsbCfg.blockAddToCart !== false;
  var LSB_TOAST = _lsbCfg.toastMessage || CFG.scarcityToastMsg || 'Only {n} left — already in your cart!';
  function lsbText(template, n) { return String(template || '').replace(/\{n\}/g, String(n != null ? n : 1)); }
  var caseDismissed = false;
  try { caseDismissed = sessionStorage.getItem('ccd_case_dismissed') === '1'; } catch(e) {} // locked to first product added this session
  // scarcity computed fresh on every cart refresh — no caching
  var TAG_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/></svg>';
  var FIRE_SVG = '🔥';
  var CLOCK_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>';
  var WARN_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>';
  var GIFT_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z"/></svg>';

  // ── Reward icon SVGs (must match addon-definitions.ts REWARD_ICONS) ──
  var REWARD_ICON_SVGS = {
    shipping: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/></svg>',
    gift: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
    crown: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg>',
    percent: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>',
    fire: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 3H4c-1.1 0-2 .9-2 2v2h20V5c0-1.1-.9-2-2-2zM2 19c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9H2v10zm8-8h4v2h-4v-2z"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 21h-1l1-7H7.5c-.88 0-.33-.75-.31-.78C8.48 10.94 10.42 7.54 13.01 3h1l-1 7h3.51c.4 0 .62.19.4.66C12.97 17.55 11 21 11 21z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>',
    ribbon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 2v18l8-4 8 4V2H4zm14 14.47l-6-3-6 3V4h12v12.47z"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z"/><path d="M19 1l-1.26 2.75L15 5l2.74 1.26L19 9l1.25-2.74L23 5l-2.75-1.25z" opacity=".6"/><path d="M19 15l-.62 1.38L17 17l1.38.62L19 19l.62-1.38L21 17l-1.38-.62z" opacity=".6"/></svg>',
    diamond: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5L2 9l10 12L22 9l-3-6zM9.62 8l1.5-3h1.76l1.5 3H9.62zM11 10v6.68L5.44 10H11zm2 0h5.56L13 16.68V10zm6.26-2h-2.65l-1.5-3h2.65l1.5 3zM6.24 5h2.65l-1.5 3H4.74l1.5-3z"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5H15V3H3c-1.1 0-2 .9-2 2v9h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2V9.65l-3.08-3.64zM6 15.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm12 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM3 7h4v4H1V7h2zm14 0h1.5l2.09 2.53H17V7z"/></svg>',
    coins: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15 4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/><path d="M3 12c0-2.61 1.67-4.83 4-5.65V4.26C3.55 5.15 1 8.27 1 12s2.55 6.85 6 7.74v-2.09c-2.33-.82-4-3.04-4-5.65z"/><path d="M15 8h-2v3h-3v2h3v3h2v-3h3v-2h-3z"/></svg>',
    medal: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 1l1.27 2.58L16 11.2l-2 1.95.47 2.76L12 14.69l-2.47 1.22L10 13.15l-2-1.95 2.73-.62L12 8z"/><path d="M20 2H4v2l4.86 3.64a6.95 6.95 0 016.28 0L20 4V2z"/></svg>'
  };

  var CCD = {

    // Per-store feature flag check. Reads from window.CCD_CONFIG.featureFlags injected by proxy/config.
    // Returns true only if the named flag is explicitly true. Unset/missing/non-boolean → false (safe default).
    // Usage: if (CCD.FF('myFeatureV2')) { newBehavior() } else { legacyBehavior() }
    FF: function(name) {
      try {
        var flags = (window.CCD_CONFIG && window.CCD_CONFIG.featureFlags) || {};
        return flags[name] === true;
      } catch (e) { return false; }
    },

    fixMobileWidth: function() {
      // Mobile width controlled by --ccd-mobile-width CSS var (default 85%, configurable in dashboard)
    },

    showScarcityToast: function(msg) {
      // Works on ANY page (product page, collection, cart drawer)
      var toastId = 'ccd-scarcity-toast';
      var existing = document.getElementById(toastId);
      if (existing) { existing.remove(); }
      var toast = document.createElement('div');
      toast.id = toastId;
      toast.textContent = msg || 'Only 1 left!';
      toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%) translateY(20px);z-index:2147483647;background:#1a1a2e;color:#fff;padding:14px 28px;border-radius:12px;font-size:14px;font-weight:600;box-shadow:0 8px 32px rgba(0,0,0,0.3);opacity:0;transition:opacity 0.3s ease,transform 0.3s ease;pointer-events:none;max-width:90vw;text-align:center;';
      document.body.appendChild(toast);
      // Force reflow then animate in
      toast.offsetHeight;
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
      setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
        setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 350);
      }, 3000);
    },
    // ── Theme-Independent Drawer Shell ──
    // Creates our own complete drawer DOM so we don't depend on ANY theme's markup
    renderDrawerShell: function() {
      // If our drawer already exists (Liquid-rendered), just ensure overlay exists and return
      var existingDrawer = document.getElementById('CCD-Drawer');
      if (existingDrawer) {
        if (!document.getElementById('CCD-Overlay')) {
          var ov = document.createElement('div');
          ov.id = 'CCD-Overlay';
          ov.className = 'ccd-overlay';
          ov.textContent = '\u200B'; // prevent div:empty{display:none} in theme CSS
          ov.addEventListener('click', function() { CCD.closeDrawer(); });
          document.body.appendChild(ov);
        }
        return;
      }
      // Hide any theme cart drawer elements
      var themeDrawer = document.getElementById('CartDrawer');
      if (themeDrawer) {
        // Keep #CartDrawer ID so theme JS doesn't fallback to /cart redirect
        // But empty its contents and ensure it stays hidden
        themeDrawer.innerHTML = '';
        themeDrawer.style.setProperty('display', 'none', 'important');
        themeDrawer.style.setProperty('visibility', 'hidden', 'important');
        themeDrawer.style.setProperty('pointer-events', 'none', 'important');
        themeDrawer.setAttribute('aria-hidden', 'true');
      }
      // Also hide <cart-drawer> custom element (used by some themes like Dawn)
      var dawnDrawer = document.querySelector('cart-drawer');
      if (dawnDrawer) {
        dawnDrawer.style.display = 'none';
        dawnDrawer.setAttribute('aria-hidden', 'true');
        // Neutralize renderContents to prevent theme errors when product-form.js calls it
        if (typeof dawnDrawer.renderContents === 'function') {
          dawnDrawer.renderContents = function() {};
        }
        // Also neutralize getSectionsToRender if present
        if (typeof dawnDrawer.getSectionsToRender === 'function') {
          dawnDrawer.getSectionsToRender = function() { return []; };
        }
      }

      // Create overlay
      var overlay = document.createElement('div');
      overlay.id = 'CCD-Overlay';
      overlay.className = 'ccd-overlay';
      overlay.textContent = '\u200B'; // prevent div:empty{display:none} in theme CSS
      overlay.addEventListener('click', function() { CCD.closeDrawer(); });
      document.body.appendChild(overlay);

      // Protection toggle HTML
      var _currentTier = getProtTier(0);
      var protPrice = _currentTier ? _currentTier.price : (parseInt(CFG.protectionPrice) || 499);
      var displayPrice = (protPrice / 100).toFixed(2);
      var protChecked = (CFG.protectionDefaultOn !== false) ? ' checked' : '';
      var protHtml = '';
      if (PROT_ENABLED && PROT_VID) {
        protHtml = '<div class="ccd-shipping-protection">' +
          '<div class="ccd-shipping-protection__icon" style="--ccd-prot-color:' + PROT_COLOR + '">' + (_spCfg.iconUrl ? '<img src="' + _spCfg.iconUrl + '" style="width:20px;height:20px" alt="" />' : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"></path></svg>') + '</div>' +
          '<div class="ccd-shipping-protection__info">' +
            '<div class="ccd-shipping-protection__title">' + (CFG.protectionTitle || 'Shipping Protection') + '</div>' +
            '<div class="ccd-shipping-protection__desc">' + (CFG.protectionDesc || 'Against loss, theft & damage') + '</div>' +
          '</div>' +
          '<div class="ccd-shipping-protection__right">' +
            '<span class="ccd-shipping-protection__price" data-prot-price="' + protPrice + '">' + CCD.fmt(protPrice) + '</span>' +
            '<label class="ccd-toggle">' +
              '<input type="checkbox" id="ccd-shipping-toggle"' + protChecked + '>' +
              '<span class="ccd-toggle__slider ccd-toggle--instant"></span>' +
            '</label>' +
          '</div>' +
        '</div>';
      }

      // Build the complete drawer HTML
      var drawerHtml = '<div class="ccd-drawer-contents">' +
        '<div class="ccd-fixed-header">' +
          '<div class="ccd-header">' +
            '<h2 class="ccd-title">' + (CFG.cartTitle || 'Your cart') + '</h2>' +
            '<div class="ccd-close" style="display:flex;align-items:center;gap:4px">' +
              ((window.Shopify && false && (window.Shopify.shop === "eliminai-test.myshopify.com" || window.Shopify.shop === "eleganto-3011.myshopify.com")) ? '<button onclick="window._ccdShowDebug()" style="background:#eee;border:1px solid #ccc;color:#333;font:10px monospace;padding:2px 6px;cursor:pointer;border-radius:4px;opacity:0.4" title="Debug">DBG</button>' : '') +
              '<button class="ccd-close-btn" aria-label="Close cart">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
              '</button>' +
            '</div>' +
          '</div>' +
          '<div class="ccd-progress" data-ccd-progress style="display:none">'  +
            '<div class="ccd-progress__message" data-ccd-progress-msg></div>' +
            '<div class="ccd-progress__bar-wrap"></div>' +
          '</div>' +
        '</div>' +
        '<div class="ccd-inner" data-ccd-inner style="display:none">'  +
          '<div class="ccd-scrollable" data-products>' +
            '<div class="ccd-items" data-real-count="0" data-unique-count="0" data-cart-subtotal="0"></div>' +
          '</div>' +
        '</div>' +
        '<div class="ccd-cart-empty">' +
          '<svg viewBox="0 0 24 24" width="48" height="48" fill="#bbb" style="margin-bottom:8px"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>' +
          '<p style="color:#111;font-size:15px">' + (CFG.emptyCartText || 'Your cart is empty') + '</p>' +
          '<button class="ccd-continue-btn" onclick="CCD.closeDrawer()">' + (CFG.continueShoppingText || 'Continue Shopping') + '</button>' +
        '</div>' +
        '<div class="ccd-sticky-footer" data-ccd-footer style="display:none">'  +
          protHtml +
          '<div class="ccd-discount-row" data-ccd-discounts style="display:none"></div>' +
          '<button class="ccd-checkout-btn">' +
            '<svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" fill="currentColor"/></svg> ' +
            (CFG.checkoutText || 'SECURE CHECKOUT') + ' · <span class="ccd-checkout-total" data-subtotal>$0.00</span>' +
          '</button>' +
          '<div class="ccd-trust">' +
            '<div class="ccd-trust__line">' +
              '<svg class="ccd-trust__icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"></path></svg> ' +
              (CFG.trustText || '<strong>30 day</strong> risk free returns') +
            '</div>' +
            '<div class="ccd-trust__badges">' +
              '<span class="ccd-badge">PayPal</span>' +
              '<span class="ccd-badge ccd-badge--visa">VISA</span>' +
              '<span class="ccd-badge ccd-badge--amex">AMEX</span>' +
              '<span class="ccd-badge ccd-badge--discover"><svg viewBox="0 0 38 24"><rect width="38" height="24" rx="3" fill="#f76b1c"/><text x="19" y="15" fill="#fff" font-size="8" font-weight="700" text-anchor="middle">DISC</text></svg></span>' +
              '<span class="ccd-badge ccd-badge--mc"><svg viewBox="0 0 38 24"><circle cx="15" cy="12" r="7" fill="#eb001b" opacity=".8"/><circle cx="23" cy="12" r="7" fill="#f79e1b" opacity=".8"/></svg></span>' +
              '<span class="ccd-badge"><svg viewBox="0 0 38 24"><rect width="38" height="24" rx="3" fill="#000"/><text x="19" y="15" fill="#fff" font-size="7" font-weight="500" text-anchor="middle" font-family="sans-serif">Pay</text></svg></span>' +
              '<span class="ccd-badge"><svg viewBox="0 0 38 24"><rect width="38" height="24" rx="3" fill="#fff" stroke="#ddd"/><text x="19" y="15" fill="#5f6368" font-size="7" font-weight="500" text-anchor="middle" font-family="sans-serif">GPay</text></svg></span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

      var drawer = document.createElement('div');
      drawer.id = 'CCD-Drawer';
      drawer.className = 'ccd-drawer ccd--right';
      drawer.style.cssText = '';
      drawer.innerHTML = drawerHtml;
      document.body.appendChild(drawer);

      // Close button handler
      drawer.querySelector('.ccd-close-btn').addEventListener('click', function() {
        CCD.closeDrawer();
      });

      // ESC key handler
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') CCD.closeDrawer();
      });

      return drawer;
    },

    // Render a single cart item from /cart.js JSON
    _renderDiscountBadges: function(item) {
      if (!item.line_level_discount_allocations || !item.line_level_discount_allocations.length) return '';
      var html = '';
      for (var i = 0; i < item.line_level_discount_allocations.length; i++) {
        var da = item.line_level_discount_allocations[i];
        var title = da.discount_application ? da.discount_application.title : '';
        if (!title) continue;
        // Only show badge if discount actually applies to this item (amount > 0)
        if (!da.amount || parseInt(da.amount, 10) <= 0) continue;
        html += '<span class="ccd-badge"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/></svg>' + title.replace(/</g, '&lt;') + '</span>';
      }
      return html;
    },

    renderItemHTML: function(item) {
      var imgUrl = item.image || (item.featured_image ? item.featured_image.url : '');
      // Shopify returns protocol-relative URLs — ensure they work
      if (imgUrl && imgUrl.indexOf('//') === 0) imgUrl = 'https:' + imgUrl;
      // Resize to 240px for performance
      if (imgUrl && imgUrl.indexOf('cdn.shopify.com') !== -1) {
        imgUrl = imgUrl.replace(/(\.[a-z]+)\?/, '_240x$1?');
        if (imgUrl.indexOf('_240x') === -1) imgUrl = imgUrl.replace(/(\.[a-z]+)$/, '_240x$1');
      }

      var variantHtml = '';
      if (item.variant_title) {
        variantHtml = '<div class="ccd-item__variant-row"><span class="ccd-item__variant">' +
          item.variant_title.replace(/</g, '&lt;') + '</span></div>';
      }

      // Price display — show Free for gift items (code applied at checkout) or discounted items
      var priceRowHtml = '';
      var unitPrice = item.final_price != null ? item.final_price : item.price;
      var linePrice = item.final_line_price != null ? item.final_line_price : (unitPrice * item.quantity);
      var origLinePrice = item.original_line_price || (item.original_price || item.price) * item.quantity;
      var hasDiscount = item.discounts && item.discounts.some(function(d) { return d.amount > 0; });
      var isGiftItem = GIFT_HANDLES[item.handle] || item.handle === WATCH_CASE_HANDLE;
      var showFree = linePrice === 0 && (isGiftItem || hasDiscount);
      if (showFree) {
        priceRowHtml = '<div class="ccd-item__price-row">' +
          (origLinePrice > 0 ? '<span class="ccd-item__compare-price">' + CCD.fmt(origLinePrice) + '</span>' : '') +
          '<span class="ccd-item__price ccd-item__price--free">' + FREE_PRICE_LABEL + '</span>' +
        '</div>';
      } else if (origLinePrice > linePrice) {
        priceRowHtml = '<div class="ccd-item__price-row">' +
          '<span class="ccd-item__compare-price">' + CCD.fmt(origLinePrice) + '</span>' +
          '<span class="ccd-item__price">' + CCD.fmt(linePrice) + '</span>' +
        '</div>';
      } else {
        priceRowHtml = '<div class="ccd-item__price-row">' +
          '<span class="ccd-item__price">' + CCD.fmt(linePrice) + '</span>' +
        '</div>';
      }

      var itemUrl = GIFT_URL_MAP[item.handle] || item.url || '/products/' + item.handle;
      return '<div class="ccd-item" data-key="' + item.key + '" data-variant-id="' + item.variant_id + '">' +
        '<div class="ccd-item__image">' +
          '<a href="' + itemUrl + '">' +
            '<img src="' + imgUrl + '" alt="' + (item.title || '').replace(/"/g, '&quot;') + '" loading="lazy">' +
          '</a>' +
        '</div>' +
        '<div class="ccd-item__details">' +
          '<div class="ccd-item__title-row">' +
            '<a class="ccd-item__name" href="' + itemUrl + '">' + (function(t) { return t.replace(/^\[Gift\]\s*/, ''); })(item.product_title || item.title || '').replace(/</g, '&lt;') + '</a>' +
            '<button class="ccd-item__remove" data-key="' + item.key + '" aria-label="Remove">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14M10 11v6M14 11v6"/></svg>' +
            '</button>' +
          '</div>' +
          variantHtml +
          '<div class="ccd-item__bottom">' +
            '<div class="ccd-qty">' +
              '<button class="ccd-qty__btn ccd-qty__btn--minus" aria-label="Decrease quantity">' +
                '<svg viewBox="0 0 12 2"><line x1="0" y1="1" x2="12" y2="1" stroke="currentColor" stroke-width="1.5"/></svg>' +
              '</button>' +
              '<input class="ccd-qty__input" type="number" value="' + item.quantity + '" min="0" data-id="' + item.key + '">' +
              '<button class="ccd-qty__btn ccd-qty__btn--plus" aria-label="Increase quantity">' +
                '<svg viewBox="0 0 12 12"><line x1="6" y1="0" x2="6" y2="12" stroke="currentColor" stroke-width="1.5"/><line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" stroke-width="1.5"/></svg>' +
              '</button>' +
            '</div>' +
            '<div class="ccd-item__price-col">' + priceRowHtml + CCD._renderDiscountBadges(item) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    },

    // Build a .ccd-items element with all items rendered from cart JSON
    renderCartItems: function(cart) {
      if (!cart || !cart.items) return null;
      var el = document.createElement('div');
      el.className = 'ccd-items';
      el.setAttribute('data-real-count', CCD.getRealCount(cart));
      el.setAttribute('data-unique-count', CCD.getUniqueVariants(cart));
      el.setAttribute('data-watch-count', CCD.getWatchCount(cart));
      el.setAttribute('data-cart-subtotal', CCD.getAdjustedTotal(cart));
      // Preserve watch handles from config
      if (CCD._watchHandles) {
        el.setAttribute('data-watch-handles', CCD._watchHandles.join(','));
      }
      var html = '';
      cart.items.forEach(function(item) {
        if (item.handle === PROT) return; // Only filter protection — gifts rendered by enforceGiftItem
        html += CCD.renderItemHTML(item);
      });
      el.innerHTML = html;
      return el;
    },

    _lastRealCount: -1,
    openDrawer: function() {
      var d = document.getElementById('CCD-Drawer');
      if (!d) return;
      if (d.classList.contains('ccd-open')) return;
      // Use last known cart state to show correct view instantly (no flash)
      var _pb = d.querySelector('[data-ccd-progress]');
      var _ft = d.querySelector('[data-ccd-footer]');
      var _id = d.querySelector('[data-ccd-inner]');
      var _es = d.querySelector('.ccd-cart-empty, .ccd-empty');
      if (CCD._lastRealCount === 0) {
        // Cart was empty last time — show empty state, hide content
        if (_pb) _pb.style.display = 'none';
        if (_ft) _ft.style.display = 'none';
        if (_id) _id.style.display = 'none';
        if (_es) _es.classList.add('ccd-show');
      } else if (CCD._lastRealCount > 0) {
        // Cart had items — show content, hide empty state
        if (_es) _es.classList.remove('ccd-show');
        if (_id) _id.style.display = 'flex';
        if (_pb) _pb.style.display = 'block';
        if (_ft) _ft.style.display = 'block';
        // Pre-populate checkout total from last known cart to prevent $0 flash
        if (CCD._lastCart) {
          var _ot = CCD.getAdjustedTotal(CCD._lastCart);
          var _ct = d.querySelector('.ccd-checkout-total');
          var _st2 = d.querySelector('[data-subtotal]');
          if (_ct && _ot > 0) _ct.textContent = CCD.fmt(_ot);
          if (_st2 && _ot > 0) _st2.textContent = CCD.fmt(_ot);
        }
      } else {
        // First open ever (_lastRealCount is -1) — hide everything, let fetch decide
        if (_pb) _pb.style.display = 'none';
        if (_ft) _ft.style.display = 'none';
        if (_id) _id.style.display = 'none';
      }
      CCD._isOpen = true;
      d.classList.add('ccd-open');
      d.style.display = 'flex';
      var ov = document.getElementById('CCD-Overlay');
      if (ov) ov.classList.add('ccd-overlay--visible');
      document.body.style.overflow = 'hidden';
      CCD.refreshOnOpen();
    },

    _reorderProtectionLast: function() { /* removed — no-op */ },

    closeDrawer: function() {
      var d = document.getElementById('CCD-Drawer');
      if (!d) return;
      CCD._isOpen = false;
      CCD._lastAddedVid = null; // Clear stale scarcity target on cart close
      // Keep _scarcityLockedVid across close/reopen within same page
      d.classList.remove('ccd-open');
      var ov = document.getElementById('CCD-Overlay');
      if (ov) ov.classList.remove('ccd-overlay--visible');
      document.body.style.overflow = '';
      window._ccdReturnUrl = null;
      protectionDone = false;
    },

    // Universal cart open interception — works on ANY theme
    interceptCartOpens: function() {
      document.addEventListener('click', function(e) {
        // Already inside our drawer? Let it through
        if (e.target.closest('#CCD-Drawer')) return;

        var link = e.target.closest('a[href*="/cart"]');
        var cartBtn = e.target.closest('[data-cart-toggle], .cart-icon-bubble, .js-cart-toggle, .site-header__cart, .header__icon--cart, [data-action="toggle-cart"], cart-toggle');

        // Cart link — but NOT checkout links
        if (link) {
          var href = link.getAttribute('href') || '';
          // Allow checkout and cart/clear
          if (href.indexOf('/checkout') !== -1 || href.indexOf('/cart/clear') !== -1) return;
          // Only intercept /cart (exact or with query params)
          if (href === '/cart' || href.match(/^\/cart(\?|$)/)) {
            e.preventDefault();
            e.stopPropagation();
            CCD.openDrawer();
            return;
          }
        }

        // Cart icon buttons
        if (cartBtn) {
          e.preventDefault();
          e.stopPropagation();
          CCD.openDrawer();
          return;
        }

        // Dawn-specific: cart-icon-bubble inside header
        var bubble = e.target.closest('.cart-count-bubble, #cart-icon-bubble');
        if (bubble) {
          e.preventDefault();
          e.stopPropagation();
          CCD.openDrawer();
          return;
        }
      }, true); // useCapture to fire before theme handlers

      // Intercept Shopify's cart-drawer open via custom events
      document.addEventListener('cart:toggle', function(e) { e.stopImmediatePropagation(); CCD.openDrawer(); }, true);

      // UNIVERSAL FALLBACK: MutationObserver catches theme drawers opened by unknown JS
      // If any theme element becomes visible that looks like a cart drawer, suppress it and open ours
      var _themeDrawerSelectors = '#CartDrawer, cart-drawer, .cart-drawer, [data-drawer=cart-drawer], .js-cart-drawer, .drawer--cart, .drawer[data-drawer=cart-drawer], .side-cart, #side-cart, .mini-cart-drawer, .ajax-cart__drawer';
      var _themeEls = document.querySelectorAll(_themeDrawerSelectors);
      if (_themeEls.length) {
        var _drawerObserver = new MutationObserver(function(mutations) {
          mutations.forEach(function(m) {
            if (m.type !== 'attributes') return;
            var el = m.target;
            // Skip our own drawer
            if (el.id === 'CCD-Drawer' || el.closest('#CCD-Drawer')) return;
            // Check if theme drawer became visible (class or style change)
            var isVisible = el.classList.contains('is-open') || el.classList.contains('drawer--is-open') ||
              el.classList.contains('active') || el.classList.contains('is-active') ||
              (el.style.display !== 'none' && el.style.visibility !== 'hidden' && el.hasAttribute('open'));
            if (isVisible) {
              // Suppress theme drawer immediately
              el.style.setProperty('display', 'none', 'important');
              el.classList.remove('is-open', 'drawer--is-open', 'active', 'is-active');
              el.removeAttribute('open');
              // Open ours instead
              if (!CCD._isOpen) CCD.openDrawer();
            }
          });
        });
        _themeEls.forEach(function(el) {
          _drawerObserver.observe(el, { attributes: true, attributeFilter: ['class', 'style', 'open', 'aria-hidden'] });
        });
      }
    },

    // Update all cart count indicators on the page (theme header bubble, etc.)
    updateCartBubble: function(cart) {
      if (!cart) return;
      var rc = CCD.getRealCount(cart); CCD._lastRealCount = rc;
      // Try common cart count selectors across themes
      var selectors = [
        '.cart-link__bubble-num',      // Impulse
        '.cart-count-bubble span',     // Dawn
        '#cart-icon-bubble span',      // Dawn alternate
        '.cart-count',                 // Various
        '.site-header__cart-count',    // Debut
        '.cart-link__count',           // Various
        '[data-cart-count]',           // Various
        '.js-cart-count',             // Various
        '.header__cart-count'         // Various
      ];
      selectors.forEach(function(sel) {
        document.querySelectorAll(sel).forEach(function(el) {
          el.textContent = rc;
        });
      });
      // UNIVERSAL FALLBACK: find number-only elements inside any cart link
      // Works on ANY theme — every theme has <a href="/cart"> with a count element inside
      document.querySelectorAll('a[href="/cart"], a[href^="/cart?"], a[href="/cart/"]').forEach(function(a) {
        if (a.closest('#CCD-Drawer')) return;
        a.querySelectorAll('*').forEach(function(el) {
          // Only target leaf elements containing just a number (1-3 digits)
          if (el.children.length === 0 && /^\s*\d{1,3}\s*$/.test(el.textContent)) {
            el.textContent = rc;
          }
        });
      });
      // Toggle bubble visibility
      var bubbles = document.querySelectorAll('.cart-link__bubble, .cart-count-bubble, #cart-icon-bubble');
      bubbles.forEach(function(b) {
        if (b.classList.contains('cart-link__bubble')) {
          b.classList.toggle('cart-link__bubble--visible', cart.item_count > 0);
        } else {
          b.style.display = cart.item_count > 0 ? '' : 'none';
        }
      });
    },


    // Suppress ALL known theme cart drawer mechanisms
    _suppressThemeDrawer: function() {
      // Universal theme suppressor — polls continuously until all theme JS is overridden
      var _overrideCount = 0;
      var _checkTheme = function() {
        // Impulse/Archetype: theme.CartForm
        if (window.theme && window.theme.CartForm) {
          var origOpen = window.theme.CartForm.prototype && window.theme.CartForm.prototype.open;
          if (origOpen && !origOpen._ccdOverridden) {
            window.theme.CartForm.prototype.open = function() { CCD.openDrawer(); };
            window.theme.CartForm.prototype.open._ccdOverridden = true;
            _overrideCount++;
          }
        }
        // Dawn/OS2: cart-drawer custom element
        var cartDrawerEl = document.querySelector('cart-drawer');
        if (cartDrawerEl) {
          if (cartDrawerEl.open && !cartDrawerEl.open._ccdOverridden) {
            cartDrawerEl.open = function() { CCD.openDrawer(); };
            cartDrawerEl.open._ccdOverridden = true;
            _overrideCount++;
          }
          if (typeof cartDrawerEl.renderContents === 'function' && !cartDrawerEl.renderContents._ccdNeutralized) {
            cartDrawerEl.renderContents = function() {};
            cartDrawerEl.renderContents._ccdNeutralized = true;
          }
          if (typeof cartDrawerEl.getSectionsToRender === 'function' && !cartDrawerEl.getSectionsToRender._ccdNeutralized) {
            cartDrawerEl.getSectionsToRender = function() { return []; };
            cartDrawerEl.getSectionsToRender._ccdNeutralized = true;
          }
        }
        // Generic: Shopify.theme.cart
        if (window.Shopify && window.Shopify.theme && window.Shopify.theme.cart) {
          if (window.Shopify.theme.cart.openDrawer && !window.Shopify.theme.cart.openDrawer._ccdOverridden) {
            window.Shopify.theme.cart.openDrawer = function() { CCD.openDrawer(); };
            window.Shopify.theme.cart.openDrawer._ccdOverridden = true;
            _overrideCount++;
          }
        }
        // Cart notification (some themes use cart-notification instead of drawer)
        var cartNotif = document.querySelector('cart-notification');
        if (cartNotif) {
          if (typeof cartNotif.open === 'function' && !cartNotif.open._ccdOverridden) {
            cartNotif.open = function() { CCD.openDrawer(); };
            cartNotif.open._ccdOverridden = true;
            _overrideCount++;
          }
          cartNotif.style.setProperty('display', 'none', 'important');
        }
        // Force-hide all theme drawers every check (catches any theme JS that re-shows them)
        var _allTheme = document.querySelectorAll('#CartDrawer, cart-drawer, .cart-drawer, .drawer--cart, .side-cart, .mini-cart-drawer, .ajax-cart__drawer, cart-notification');
        _allTheme.forEach(function(el) {
          if (el.id === 'CCD-Drawer') return;
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
        });
      };
      // Run immediately, then poll every 200ms for 10 seconds to catch late-loading theme JS
      _checkTheme();
      var _pollInterval = setInterval(function() { _checkTheme(); }, 200);
      setTimeout(function() { clearInterval(_pollInterval); }, 10000);
      // Continue checking every 2s after initial burst (for lazy-loaded theme scripts)
      setInterval(_checkTheme, 2000);
      // Intercept cart-related custom events (Impulse, Archetype, etc.)
      ['drawer:open', 'cart:open', 'theme:cart:open', 'ajaxCart:open'].forEach(function(evtName) {
        document.addEventListener(evtName, function(e) {
          if (e.detail && e.detail.drawer && e.detail.drawer !== 'cart-drawer') return;
          e.stopImmediatePropagation();
          CCD.openDrawer();
        }, true);
      });
    },

    init: function() {
      // Set free price color from config
      document.documentElement.style.setProperty('--ccd-free-color', FREE_PRICE_COLOR);
      // VERSION STAMP
      console.log('%c[CCD v16.11] Universal theme suppression — early observer + continuous polling + section strip', 'background:#6b21a8;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold');
      window.__ccd_version = '16.10';
      window.__eliminai_cart_loaded = true;

      // Build our own drawer DOM (theme-independent)
      this.renderDrawerShell();
      this.fixMobileWidth();
      this.bindEvents();
      this.interceptAddToCart();
      this.interceptCartOpens();
      // Suppress theme drawer JS: override known theme cart open functions
      this._suppressThemeDrawer();
      // Neutralize theme drawer toggle functions so they cannot open theme drawer or redirect
      if (window.theme && window.theme.cart) {
        window.theme.cart.open = function() { CCD.openDrawer(); };
        window.theme.cart.toggle = function() { CCD.openDrawer(); };
      }
      // Impulse/Archetype: override CartDrawer open methods
      var _cd = document.getElementById("CartDrawer");
      if (_cd && _cd.open) { _cd.open = function() { CCD.openDrawer(); }; }
      // Override any js-drawer-open-cart click handlers by re-binding
      document.querySelectorAll(".js-drawer-open-cart").forEach(function(el) {
        el.addEventListener("click", function(e) {
          e.preventDefault(); e.stopImmediatePropagation();
          CCD.openDrawer();
        }, true);
      });
      this.setupScrollIndicator();
      this.buildProgressBar();
      this.updateProgress();
      this.checkOverflow();
      // Pre-fetch experiment config on page load so cart opens instantly
      this.loadExperiment(function(c2) { if (c2) CCD._mergeTiersFromConfig(c2); }, true);
      // If user clicked cart before our script loaded, open drawer now
      if (window.__ccd_early_open) {
        window.__ccd_early_open = false;
        var self = this;
        setTimeout(function() { self.openDrawer(); }, 50);
      }
      // Remove instant class only on first user interaction with the toggle
      var tglInput = document.getElementById("ccd-shipping-toggle");
      if (tglInput) {
        tglInput.addEventListener("change", function onFirstToggle() {
          var sl = tglInput.nextElementSibling;
          if (sl) sl.classList.remove("ccd-toggle--instant");
          tglInput.removeEventListener("change", onFirstToggle);
        });
      }
      CCD._isInited = true;
      try { window._ccdLogs && window._ccdLogs.push('[INIT-DONE] ' + new Date().toISOString().slice(11,23) + ' v14 init() finished | fetch-overridden=' + (CCD._origFetch ? 'YES' : 'NO')); } catch(e) {}
    },


    _mergeTiersFromConfig: function(config) {
      if (!config || !config.cartConfig || !config.cartConfig.addons) return;
      var fsb = config.cartConfig.addons.freeShippingBar;
      if (!fsb || !fsb.config || !fsb.config.tiers || fsb.config.tiers.length === 0) return;
      REWARD_TIERS = fsb.config.tiers;
      THRESHOLD_MODE = fsb.config.thresholdMode || 'items';
      HIGHEST_TIER_ONLY = !!fsb.config.highestTierOnly;
      // Reload gift picker settings from backend config
      GIFT_CUSTOMER_CHOICE = !!fsb.config.giftCustomerChoice;
      GIFT_CHANGE_COLOR = fsb.config.giftChangeColor || '#111';
      GIFT_CHANGE_TEXT = fsb.config.giftChangeText || 'Change';
      GIFT_PICKER_TITLE = fsb.config.giftPickerTitle || 'Choose your free gift';
      if (fsb.config.allRewardsUnlockedText) ALL_REWARDS_TEXT = fsb.config.allRewardsUnlockedText;
      GIFT_HANDLES = {};
      GIFT_TIERS = [];
      REWARD_TIERS.forEach(function(t) {
        var gifts = tierGifts(t);
        if (gifts.length > 0) {
          gifts.forEach(function(g) { if (g.handle) GIFT_HANDLES[g.handle] = true; });
          GIFT_TIERS.push(t);
        }
      });
      var _lg2 = GIFT_TIERS.length > 0 ? tierGift(GIFT_TIERS[GIFT_TIERS.length - 1]) : null;
      if (_lg2) {
        WATCH_CASE_HANDLE = _lg2.handle;
        WATCH_CASE_VID = parseInt(_lg2.variantId) || WATCH_CASE_VID;
      }
      WATCH_GOAL = GIFT_TIERS.length > 0 ? GIFT_TIERS[GIFT_TIERS.length - 1].goal : (CFG.giftGoal || 3);
      GIFT_DISCOUNT_CODES = config.cartConfig.giftDiscountCodes || [];
      GIFT_VIDS = {};
      GIFT_TIERS.forEach(function(t) {
        tierGifts(t).forEach(function(g) { if (g.variantId) GIFT_VIDS[String(g.variantId)] = true; });
      });
      if (WATCH_CASE_VID) GIFT_VIDS[String(WATCH_CASE_VID)] = true;
      // Load gift URL map — duplicate handle → original product URL
      GIFT_URL_MAP = {};
      (config.cartConfig.giftMappings || []).forEach(function(m) {
        if (m.duplicateHandle && m.originalUrl) GIFT_URL_MAP[m.duplicateHandle] = m.originalUrl;
      });
      console.log('[CCD] Loaded tiers from backend:', REWARD_TIERS.length, 'tiers, GIFT_HANDLES=', JSON.stringify(GIFT_HANDLES), 'GIFT_CODES=', GIFT_DISCOUNT_CODES.length, 'GIFT_URL_MAP=', JSON.stringify(GIFT_URL_MAP));
      try {
        var sp = config.cartConfig.addons.shippingProtection;
        if (sp && sp.enabled && sp.config) {
          var spCfg = sp.config;
          PROT = spCfg.handle || PROT;
          PROT_ENABLED = true;
          PROT_COLOR = spCfg.iconColor || PROT_COLOR;
          if (spCfg.productName) {
            CFG.protectionTitle = spCfg.productName;
            var _ptEl = document.querySelector('.ccd-shipping-protection__title');
            if (_ptEl) _ptEl.textContent = spCfg.productName;
          }
          if (spCfg.description) {
            CFG.protectionDesc = spCfg.description;
            var _pdEl = document.querySelector('.ccd-shipping-protection__desc');
            if (_pdEl) _pdEl.textContent = spCfg.description;
          }
          var newTiers = spCfg.tiers || [];
          if (newTiers.length > 0) {
            PROT_TIERS = newTiers.map(function(t) {
              var priceCents = Math.round((parseFloat(t.price) || 0) * 100);
              return { vid: t.vid, price: priceCents, maxValue: t.maxValue };
            });
            PROT_VID = PROT_TIERS[0].vid;
            PROT_VID_SINGLE = PROT_TIERS[0].vid;
          } else if (spCfg.variantId) {
            PROT_VID_SINGLE = parseInt(spCfg.variantId) || PROT_VID_SINGLE;
            PROT_VID = PROT_VID_SINGLE;
            var pCents = Math.round((parseFloat(spCfg.price) || 0) * 100) || 499;
            PROT_TIERS = [{ vid: PROT_VID_SINGLE, price: pCents, maxValue: null }];
          }
          if ('defaultOn' in spCfg) {
            CFG.protectionDefaultOn = spCfg.defaultOn;
            var _tgl = document.getElementById('ccd-shipping-toggle');
            if (_tgl) _tgl.checked = !!spCfg.defaultOn;
          }
          // Update protection price in DOM (HTML was built before proxy responded)
          if (PROT_TIERS.length > 0) {
            var _mergedPrice = PROT_TIERS[0].price;
            CFG.protectionPrice = _mergedPrice;
            var _ppEl = document.querySelector('.ccd-shipping-protection__price');
            if (_ppEl) {
              _ppEl.textContent = CCD.fmt(_mergedPrice);
              _ppEl.setAttribute('data-prot-price', String(_mergedPrice));
            }
          }
          console.log('[CCD] Protection merged from backend: handle=' + PROT + ' vid=' + PROT_VID + ' price=' + (PROT_TIERS[0] ? PROT_TIERS[0].price : 'none') + ' defaultOn=' + CFG.protectionDefaultOn);
        }
      } catch(e) {}
    },

    _isExcludedHandle: function(handle) {
      return handle === PROT || handle === WATCH_CASE_HANDLE || !!GIFT_HANDLES[handle];
    },

    getRealCount: function(cart) {
      var c = 0;
      if (cart && cart.items) {
        cart.items.forEach(function(i) {
          if (!CCD._isExcludedHandle(i.handle)) c += i.quantity;
        });
      }
      return c;
    },

    getUniqueVariants: function(cart) {
      var seen = {}, count = 0;
      if (cart && cart.items) {
        cart.items.forEach(function(i) {
          if (!CCD._isExcludedHandle(i.handle) && !seen[i.variant_id]) {
            seen[i.variant_id] = true;
            count++;
          }
        });
      }
      return count;
    },

    getWatchCount: function(cart) {
      var count = 0;
      var wh = CCD._watchHandles || [];
      if (cart && cart.items) {
        cart.items.forEach(function(i) {
          if (!CCD._isExcludedHandle(i.handle)) {
            var isWatch = (i.product_type && i.product_type.toLowerCase() === "watch") ||
                          wh.indexOf(i.handle) !== -1;
            if (isWatch) count += i.quantity;
          }
        });
      }
      return count;
    },

    // Calculate what Shopify is actually charging for gift items.
    // If Shopify applied a discount, final_line_price is 0 — nothing to subtract.
    // If Shopify didn't apply a discount, final_line_price is full price — subtract it.
    getGiftSavings: function(cart) {
      var cost = 0;
      if (!cart || !cart.items) return 0;
      cart.items.forEach(function(item) {
        var isGift = GIFT_HANDLES[item.handle] || item.handle === WATCH_CASE_HANDLE;
        if (!isGift) return;
        // Use explicit null check — 0 is a valid value (means Shopify already made it free)
        var lineCost = (item.final_line_price != null) ? item.final_line_price : (item.price * item.quantity);
        cost += lineCost;
      });
      return cost;
    },

    // Get the total to display — sum of final_line_price for non-excluded items
    // This is robust against race conditions: we NEVER subtract gift costs from cart.total_price.
    // Instead, we sum only what the customer is paying for (non-gift, non-protection items).
    // Protection is shown separately via the toggle, so we exclude it from the displayed total.
    getAdjustedTotal: function(cart) {
      if (!cart || !cart.items) return 0;
      // Primary: sum final_line_price of real items (excludes gifts + protection)
      var realTotal = 0;
      var hasRealItems = false;
      cart.items.forEach(function(i) {
        if (CCD._isExcludedHandle(i.handle)) return;
        hasRealItems = true;
        realTotal += (i.final_line_price != null ? i.final_line_price : (i.price * i.quantity));
      });
      // Protection total (add back — customer sees this as part of checkout)
      var protTotal = 0;
      cart.items.forEach(function(i) {
        if (i.handle === PROT) protTotal += (i.final_line_price != null ? i.final_line_price : (i.price * i.quantity));
      });
      var total = realTotal + protTotal;
      // Safety: never show $0 when real items exist
      if (total <= 0 && hasRealItems) {
        console.warn("[CCD] getAdjustedTotal fallback — realTotal=" + realTotal + " protTotal=" + protTotal + " cart.total_price=" + cart.total_price + " items=" + cart.items.length);
        cart.items.forEach(function(i) { console.warn("[CCD]   item: handle=" + i.handle + " price=" + i.price + " qty=" + i.quantity + " final_line_price=" + i.final_line_price + " excluded=" + CCD._isExcludedHandle(i.handle)); });
        // Fallback to cart.total_price minus gift item costs
        var giftCost = CCD.getGiftSavings(cart);
        total = (cart.total_price || 0) - giftCost;
        if (total < 0) total = 0;
        // Last resort: use raw cart.total_price
        if (total <= 0 && cart.total_price > 0) total = cart.total_price;
      }
      return isNaN(total) ? 0 : total;
    },

    bindEvents: function() {

      // Reset checkout button when returning via back button (bfcache)
      window.addEventListener("pageshow", function(e) {
        var btn = document.querySelector(".ccd-checkout-btn--loading");
        if (btn) {
          btn.classList.remove("ccd-checkout-btn--loading");
          /*<svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg> ' + lbl + ' · <span class="ccd-checkout-total" data-subtotal>' + tot + '</span>'; */
        }
      });

      // Checkout button — show spinner INSTANTLY, then validate + redirect
      document.addEventListener('click', function(e) {
        var checkoutBtn = e.target.closest('.ccd-checkout-btn');
        if (checkoutBtn && !checkoutBtn.classList.contains('ccd-checkout-btn--loading')) {
          checkoutBtn.classList.add('ccd-checkout-btn--loading');
          e.preventDefault();
          e.stopPropagation();

          // BUG-022 FIX: Force browser repaint so spinner renders BEFORE any redirect/async work
          // Without this, the browser batches the class add + location change and never paints the spinner
          void checkoutBtn.offsetHeight;
          requestAnimationFrame(function() {

          // GUARD: Remove unearned gift items before checkout
          var lastCart = CCD._lastCart;
          if (lastCart && lastCart.items && GIFT_TIERS.length > 0) {
            var score = THRESHOLD_MODE === 'dollars'
              ? (CCD.getAdjustedTotal(lastCart) / 100)
              : CCD.getRealCount(lastCart);
            // Determine which gift handles are earned
            var earned = {};
            var eligibleGifts = [];
            GIFT_TIERS.forEach(function(t) {
              if (tierGifts(t).length > 0 && score >= t.goal) eligibleGifts.push(t);
            });
            if (HIGHEST_TIER_ONLY && eligibleGifts.length > 0) {
              tierGifts(eligibleGifts[eligibleGifts.length - 1]).forEach(function(g) { if (g.handle) earned[g.handle] = true; });
            } else {
              eligibleGifts.forEach(function(t) {
                tierGifts(t).forEach(function(g) { if (g.handle) earned[g.handle] = true; });
              });
            }
            // Find unearned gift items in cart
            var unearnedKeys = [];
            lastCart.items.forEach(function(i) {
              if ((GIFT_HANDLES[i.handle] || i.handle === WATCH_CASE_HANDLE) && !earned[i.handle]) {
                unearnedKeys.push(i.key);
              }
            });
            if (unearnedKeys.length > 0) {
              console.warn('[CCD] Removing ' + unearnedKeys.length + ' unearned gift items before checkout');
              var _oF = CCD._origFetch || fetch;
              var removeChain = Promise.resolve();
              unearnedKeys.forEach(function(key) {
                removeChain = removeChain.then(function() {
                  return _oF('/cart/change.js', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: key, quantity: 0 })
                  });
                });
              });
              removeChain.then(function() {
                window.location.href = '/checkout';
              }).catch(function() {
                window.location.href = '/checkout';
              });
              return;
            }
          }
          window.location.href = '/checkout';

          }); // end requestAnimationFrame
        }
      });

      document.addEventListener('click', function(e) {
        var minusBtn = e.target.closest('.ccd-qty__btn--minus');
        var plusBtn = e.target.closest('.ccd-qty__btn--plus');
        var removeBtn = e.target.closest('.ccd-item__remove');

        if (minusBtn) {
          e.preventDefault();
          e.stopImmediatePropagation();
          var input = minusBtn.closest('.ccd-qty').querySelector('.ccd-qty__input');
          var newVal = Math.max(0, parseInt(input.value) - 1);
          if (newVal > 0) input.value = newVal; // optimistic: show new qty instantly
          CCD.updateProgressOptimistic(-1);
          CCD.changeQty(input.dataset.id, newVal, minusBtn);
        }

        if (plusBtn) {
          e.preventDefault();
          e.stopImmediatePropagation();
          var input = plusBtn.closest('.ccd-qty').querySelector('.ccd-qty__input');
          var newVal = parseInt(input.value) + 1;
          input.value = newVal; // optimistic: show new qty instantly
          CCD.updateProgressOptimistic(+1);
          CCD.changeQty(input.dataset.id, newVal, plusBtn);
        }

        if (removeBtn) {
          e.preventDefault();
          e.stopImmediatePropagation();
          var item = removeBtn.closest('.ccd-item');
          if (item && !busy) {
            // Dim item immediately (no collapse) — morphDOM handles removal
            item.classList.add('ccd-item--removing');
            item.style.opacity = '0.3';
            item.style.pointerEvents = 'none';
            item.style.transition = 'opacity 0.15s ease';
          }
          // Show loading overlay immediately
          if (CCD._isOpen) CCD.showLoading();
          var rmKey = removeBtn.dataset.key;
          if (CCD._caseKey && rmKey === CCD._caseKey) {
            caseDismissed = true;
            try { sessionStorage.setItem('ccd_case_dismissed', '1'); } catch(ex) {}
          }
          // If removing a watch might drop below gift goal, hide gift instantly
          var curWatchCount = parseInt((document.querySelector(".ccd-items") || {}).dataset && document.querySelector(".ccd-items").dataset.watchCount || "0");
          if (curWatchCount <= WATCH_GOAL) {
            var gEl = document.querySelector('#CCD-Drawer .ccd-item[data-gift="1"]');
            if (gEl) { gEl.classList.add("ccd-item--removing"); }
          }
          // Optimistic progress update: count will decrease
          CCD.updateProgressOptimistic(-1);
          CCD.changeQty(rmKey, 0);
        }

        var giftRemoveBtn = e.target.closest('.ccd-gift-item__remove');
        if (giftRemoveBtn) {
          e.preventDefault();
          e.stopImmediatePropagation();
          caseDismissed = true;
          try { sessionStorage.setItem('ccd_case_dismissed', '1'); } catch(ex) {}
          var giftItem = giftRemoveBtn.closest('.ccd-gift-item');
          if (giftItem) {
            giftItem.classList.add('ccd-item--removing');
            giftItem.style.opacity = '0.3';
            giftItem.style.pointerEvents = 'none';
            giftItem.style.transition = 'opacity 0.15s ease';
          }
          if (CCD._isOpen) CCD.showLoading();
          var giftKey = giftRemoveBtn.dataset.key;
          if (giftKey) {
            fetch('/cart/change.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: giftKey, quantity: 0 })
            })
            .then(function(r) { return r.json(); })
            .then(function(cart) { CCD._caseKey = null; CCD.refresh(cart); });
          }
        }
      });

      document.addEventListener('change', function(e) {
        if (e.target.classList.contains('ccd-qty__input')) {
          CCD.changeQty(e.target.dataset.id, Math.max(0, parseInt(e.target.value) || 0));
        }

        if (e.target.id === 'ccd-shipping-toggle') {
          CCD.toggleProtection(e.target.checked);
        }
      });

      // Track checkout clicks via event delegation (button is rebuilt on every refresh)
      document.addEventListener('click', function(e) {
        if (e.target && e.target.closest('.ccd-checkout-btn')) {
          var cart = null;
          try { cart = JSON.parse(sessionStorage.getItem('ecart_last_cart')); } catch(e2) {}
          CCD.sendEvent('CHECKOUT_CLICKED', {
            cartTotal: cart ? cart.total_price : 0,
            itemCount: cart ? cart.item_count : 0
          });
        }
      });
    },

    changeQty: function(key, qty, btnEl) {
      if (busy) {
        // Queue this operation — will execute after current op finishes
        _pendingOp = { key: key, qty: qty, btnEl: btnEl };
        return;
      }
      // Only block theme rebuild for removes
      if (qty === 0) {
        window.__ccd_block_rebuild = true;
        window.__ccd_is_removing = true;
      }
      // Block increasing scarcity item above the displayed limit (gated by addon's blockAddToCart)
      if (LSB_BLOCK_ADD && scarcityVariantId && qty > LSB_FAKE_QTY) {
        var keyVid = String(key).split(':')[0];
        if (keyVid === scarcityVariantId) {
          CCD.showScarcityToast(lsbText(LSB_TOAST, LSB_FAKE_QTY));
          return;
        }
      }
      busy = true;
      // Safety timeout: reset busy after 10s to prevent mobile stuck state
      var _busyTimer = setTimeout(function() {
        if (busy) {
          console.warn('[CCD] changeQty: busy timeout after 10s — resetting');
          busy = false;
          window.__ccd_is_removing = false;
          window.__ccd_block_rebuild = false;
          CCD.hideLoading();
          // Force refresh from server
          var _oFT = CCD._origFetch || fetch;
          _oFT('/cart.js').then(function(r) { return r.json(); }).then(function(c) { CCD.refresh(c); }).catch(function(){});
        }
      }, 10000);
      if (btnEl) btnEl.classList.add('ccd-qty__btn--loading');
      var item = btnEl ? btnEl.closest('.ccd-item') : null;
      if (item && qty === 0) item.classList.add('ccd-item--removing');
      // Show loading for ALL operations — keeps drawer in loading state until fresh data arrives
      if (CCD._isOpen && qty !== 0) CCD.showLoading();

      // Use origFetch to avoid any interceptor interference
      var _oFC = CCD._origFetch || fetch;
      var _isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
      // Cache-bust on mobile to bypass service workers and browser cache
      var _cacheBust = _isMobile ? '?_=' + Date.now() : '';
      console.log('[CCD] changeQty: key=' + key + ' qty=' + qty + ' mobile=' + _isMobile);
      _oFC('/cart/change.js' + _cacheBust, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: key, quantity: qty }),
        cache: 'no-store'
      })
      .then(function(r) { return r.json(); })
      .then(function(cart) {
        clearTimeout(_busyTimer);
        console.log('[CCD] changeQty response: items=' + (cart.items ? cart.item_count : 'UNDEFINED') + ' total=' + cart.total_price);

        // BUG FIX: If Shopify returned an error (no items array), the key was stale.
        // Fetch fresh cart, find item by variant_id, retry with correct key.
        if (!cart.items) {
          console.warn('[CCD] changeQty got error response (stale key?) — fetching fresh cart to retry');
          var _vid = String(key).split(':')[0];
          _oFC('/cart.js' + (_isMobile ? '?_=' + Date.now() : ''), { cache: 'no-store' })
          .then(function(r2) { return r2.json(); })
          .then(function(freshCart) {
            if (!freshCart.items) {
              console.error('[CCD] Fresh cart also has no items — aborting');
              busy = false; window.__ccd_is_removing = false; window.__ccd_block_rebuild = false;
              CCD.hideLoading();
              return;
            }
            var freshItem = null;
            for (var fi = 0; fi < freshCart.items.length; fi++) {
              if (String(freshCart.items[fi].variant_id) === _vid) { freshItem = freshCart.items[fi]; break; }
            }
            if (freshItem) {
              console.log('[CCD] Retrying with fresh key: ' + freshItem.key + ' (was: ' + key + ')');
              _oFC('/cart/change.js' + (_isMobile ? '?_=' + Date.now() : ''), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: freshItem.key, quantity: qty }),
                cache: 'no-store'
              })
              .then(function(r3) { return r3.json(); })
              .then(function(retryCart) {
                console.log('[CCD] Retry success: items=' + (retryCart.items ? retryCart.item_count : 'ERR'));
                var finalCart = retryCart.items ? retryCart : freshCart;
                CCD._lastCart = finalCart; window.__ccd_last_cart = finalCart;
                CCD._finishChangeQty(finalCart, freshItem.key, qty, btnEl, item);
              })
              .catch(function() {
                CCD._lastCart = freshCart; window.__ccd_last_cart = freshCart;
                CCD._finishChangeQty(freshCart, key, qty, btnEl, item);
              });
            } else {
              // Item not found — already removed or doesn't exist
              CCD._lastCart = freshCart; window.__ccd_last_cart = freshCart;
              CCD._finishChangeQty(freshCart, key, qty, btnEl, item);
            }
          })
          .catch(function() {
            busy = false; window.__ccd_is_removing = false; window.__ccd_block_rebuild = false;
            CCD.hideLoading();
          });
          return;
        }

        // REMOVE VERIFICATION: if we tried to remove (qty=0) but item still in cart, retry with line index
        if (qty === 0) {
          var stillThere = cart.items.some(function(ci) { return ci.key === key; });
          if (stillThere) {
            console.warn('[CCD] Remove FAILED silently — key=' + key + ' still in cart! Retrying with line index...');
            var lineIdx = -1;
            for (var li = 0; li < cart.items.length; li++) {
              if (cart.items[li].key === key) { lineIdx = li + 1; break; }
            }
            if (lineIdx > 0) {
              _oFC('/cart/change.js' + (_isMobile ? '?_=' + Date.now() : ''), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ line: lineIdx, quantity: 0 }),
                cache: 'no-store'
              })
              .then(function(r2) { return r2.json(); })
              .then(function(retryCart) {
                console.log('[CCD] Retry remove by line=' + lineIdx + ': items=' + retryCart.item_count);
                CCD._lastCart = retryCart;
                window.__ccd_last_cart = retryCart;
                CCD._finishChangeQty(retryCart, key, qty, btnEl, item);
              })
              .catch(function() {
                CCD._lastCart = cart;
                window.__ccd_last_cart = cart;
                CCD._finishChangeQty(cart, key, qty, btnEl, item);
              });
              return;
            }
          }
        }
        CCD._lastCart = cart;
        window.__ccd_last_cart = cart;
        CCD._finishChangeQty(cart, key, qty, btnEl, item);
      })
      .catch(function(err) {
        clearTimeout(_busyTimer);
        console.error('[CCD] changeQty FAILED:', err, 'key=' + key, 'qty=' + qty);
        window.__ccd_block_rebuild = false;
        window.__ccd_is_removing = false;
        busy = false;
        if (btnEl) btnEl.classList.remove('ccd-qty__btn--loading');
        if (item) { item.classList.remove('ccd-item--removing'); item.style.opacity = ''; item.style.pointerEvents = ''; }
        CCD.hideLoading();
        // On error, force-refresh from Shopify to restore correct state (cache-bust on mobile)
        var _oFE = CCD._origFetch || fetch;
        _oFE('/cart.js' + (_isMobile ? '?_=' + Date.now() : ''), { cache: 'no-store' }).then(function(r) { return r.json(); }).then(function(c) {
          CCD._lastCart = c; window.__ccd_last_cart = c; CCD.refresh(c);
        }).catch(function(){});
        // Execute queued operation if any
        if (_pendingOp) {
          var p = _pendingOp;
          _pendingOp = null;
          CCD.changeQty(p.key, p.qty, p.btnEl);
        }
      });
    },

    // Extracted post-change handler (used by changeQty and its remove-retry)
    _finishChangeQty: function(cart, key, qty, btnEl, item) {
      // Clear stale scarcity target after remove — will re-evaluate on next refresh
      if (qty === 0) CCD._lastAddedVid = null;
      if (btnEl) btnEl.classList.remove('ccd-qty__btn--loading');
      // Execute queued operation if any
      if (_pendingOp) {
        var p = _pendingOp;
        _pendingOp = null;
        window.__ccd_is_removing = false;
        window.__ccd_block_rebuild = false;
        if (p.qty === 0) {
          var qItem = p.btnEl ? p.btnEl.closest('.ccd-item') : document.querySelector('.ccd-item[data-key="' + p.key + '"]');
          if (qItem && !qItem.classList.contains('ccd-item--removing')) {
            qItem.classList.add('ccd-item--removing');
            qItem.style.opacity = '0.3';
            qItem.style.pointerEvents = 'none';
            qItem.style.transition = 'opacity 0.15s ease';
          }
        }
        CCD.changeQty(p.key, p.qty, p.btnEl);
        return;
      }
      var _isRemoving = window.__ccd_is_removing;
      window.__ccd_is_removing = false;
      if (_isRemoving) {
        if (CCD._isOpen) CCD.showLoading();
        CCD.updateCartBubble(cart);
        var _rc = CCD.getRealCount(cart);
        if (_rc === 0) {
          busy = false;
          setTimeout(function() { window.__ccd_block_rebuild = false; CCD.refresh(cart); }, 50);
        } else {
          window.__ccd_block_rebuild = false;
          var _rmGen = ++_refreshGen;
          var _oF = CCD._origFetch || fetch;
          var _mobCB = /Mobi|Android|iPhone/i.test(navigator.userAgent) ? '?_=' + Date.now() : '';
          _oF("/cart.js" + _mobCB, { cache: 'no-store' }).then(function(r) { return r.json(); }).then(function(freshCart) {
            console.log('[CCD] Fresh /cart.js after remove: items=' + freshCart.item_count + ' total=' + freshCart.total_price);
            busy = false;
            CCD.refresh(freshCart, _rmGen);
          }).catch(function(err) {
            busy = false;
            console.warn("[CCD] post-remove /cart.js fetch failed:", err);
            CCD.hideLoading();
          });
        }
      } else {
        busy = false;
        CCD.refresh(cart);
      }
    },

    toggleProtection: function(isChecked) {
      if (toggling) return;
      toggling = true;
      if (isChecked) { _userToggledOff = false; }
      else { _userToggledOff = true; protectionDone = true; }
      var cb = document.getElementById('ccd-shipping-toggle');
      if (cb) cb.disabled = true;

      // Read protection price from last known cart, DOM, or config
      var protPrice = 0;
      var lastCart = window.__ccd_last_cart;
      if (lastCart && lastCart.items) {
        var protCartItem = lastCart.items.find(function(i) { return i.handle === PROT; });
        if (protCartItem) protPrice = protCartItem.price || 0;
      }
      if (!protPrice) {
        var protEl = document.querySelector('[data-prot-price]');
        if (protEl) protPrice = parseInt(protEl.getAttribute('data-prot-price')) || 0;
      }
      if (!protPrice) protPrice = parseInt(CFG.protectionPrice) || 499;

      // Read displayed total and update optimistically
      var ct = document.querySelector('.ccd-checkout-total');
      var st = document.querySelector('#CCD-Drawer [data-subtotal]');
      var displayedText = (ct && ct.textContent) || (st && st.textContent) || '0';
      var displayedCents = Math.round(parseFloat(displayedText.replace(/[^0-9.]/g, '')) * 100) || 0;
      var newCents = isChecked ? displayedCents + protPrice : Math.max(0, displayedCents - protPrice);
      if (isNaN(newCents) || newCents < 0) newCents = 0;
      if (ct) ct.textContent = CCD.fmt(newCents);
      if (st) st.textContent = CCD.fmt(newCents);

      var _of = CCD._origFetch || fetch;
      var unlock = function() { toggling = false; if (cb) cb.disabled = false; };

      if (isChecked) {
        _of('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [{ id: (getProtTier(CCD.getAdjustedTotal(window.__ccd_last_cart || {items:[]})) || {vid:PROT_VID}).vid, quantity: 1 }] })
        })
        .then(function() { return _of('/cart.js'); })
        .then(function(r) { return r.json(); })
        .then(function(cart) { unlock(); CCD.refreshLight(cart); })
        .catch(function() { unlock(); });
      } else {
        if (CCD._protKey) {
          _of('/cart/change.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: CCD._protKey, quantity: 0 })
          })
          .then(function(r) { return r.json(); })
          .then(function(c) { CCD._protKey = null; unlock(); CCD.refreshLight(c); })
          .catch(function() { unlock(); });
        } else {
          _of('/cart.js')
          .then(function(r) { return r.json(); })
          .then(function(cart) {
            var item = cart.items.find(function(i) { return i.handle === PROT; });
            if (item) {
              _of('/cart/change.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: item.key, quantity: 0 })
              })
              .then(function(r) { return r.json(); })
              .then(function(c) { CCD._protKey = null; unlock(); CCD.refreshLight(c); })
              .catch(function() { unlock(); });
            } else {
              unlock();
            }
          })
          .catch(function() { unlock(); });
        }
      }
    },

    ensureProtection: function() {
      if (protectionDone || toggling || _userToggledOff) return;
      // Respect defaultOn setting — if false, don't auto-add protection
      var shouldAutoAdd = PROT_ENABLED && PROT_VID && CFG.protectionDefaultOn !== false && CFG.protectionAutoAdd !== false;
      if (!shouldAutoAdd) return;
      protectionDone = true;
      // Immediately show toggle as ON so user never sees a flash of OFF
      CCD.setToggleNoTransition(true);
      fetch('/cart.js')
      .then(function(r) { return r.json(); })
      .then(function(cart) {
        var rc = CCD.getRealCount(cart); CCD._lastRealCount = rc;
        if (rc === 0) { CCD.setToggleNoTransition(false); return; }
        var has = cart.items.some(function(i) { return i.handle === PROT; });
        if (!has) {
          fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: [{ id: (getProtTier(CCD.getAdjustedTotal(cart)) || {vid:PROT_VID}).vid, quantity: 1 }] })
          })
          .then(function() { return fetch('/cart.js'); })
          .then(function(r) { return r.json(); })
          .then(function(updatedCart) { CCD.refresh(updatedCart); });
        } else {
          CCD.refresh(cart);
        }
      });
    },

    interceptAddToCart: function() {
      // Form-level scarcity block: prevent submit BEFORE theme shows loading
      document.addEventListener("submit", function(e) {
        var form = e.target;
        if (!form || !form.action || form.action.indexOf("/cart/add") === -1) return;
        if (!LSB_ENABLED || !LSB_BLOCK_ADD) return;
        // Read fresh from sessionStorage every time (not stale closure)
        var sVid = null;
        try { sVid = sessionStorage.getItem("ccd_scarcity_vid"); } catch(ex) {}
        if (!sVid) return;
        // Extract variant ID from form
        var vidInput = form.querySelector("input[name=id], select[name=id]");
        var formVid = vidInput ? String(vidInput.value) : null;
        if (!formVid) return;
        // Track the variant being added via form submit (works even if theme bypasses fetch/XHR)
        CCD._lastAddedVid = formVid;
        console.log('[CCD] Form submit tracked vid:', formVid);
        if (formVid === sVid) {
          e.preventDefault();
          e.stopImmediatePropagation();
          CCD.showScarcityToast(lsbText(LSB_TOAST, LSB_FAKE_QTY));
          return;
        }
      }, true); // useCapture=true to fire BEFORE theme handlers

      // GUARD: Block form-based adds of gift variants
      document.addEventListener("submit", function(e) {
        var form = e.target;
        if (!form || !form.action || form.action.indexOf("/cart/add") === -1) return;
        var vidInput = form.querySelector("input[name=id], select[name=id]");
        var formVid = vidInput ? String(vidInput.value) : null;
        if (formVid && GIFT_VIDS[formVid]) {
          e.preventDefault();
          e.stopImmediatePropagation();
          CCD.showScarcityToast("This gift is automatically added when you qualify ✨");
        }
      }, true);

      // UNIVERSAL FORM INTERCEPT: Catch ALL form POSTs to /cart/add
      // Theme JS (e.g. Dawn's product-form.js) may cache window.fetch before our
      // override is installed, so even when theme JS handles the submit via fetch,
      // that fetch bypasses our override and the drawer never opens.
      // Solution: ALWAYS intercept — prevent default + stop propagation so no theme
      // handler runs, then route through our fetch override (which opens the drawer).
      var _formAddBusy = false;
      document.addEventListener("submit", function(e) {
        var form = e.target;
        if (!form || !form.action || form.action.indexOf("/cart/add") === -1) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        // Debounce: prevent double-click adding multiple items
        if (_formAddBusy) return;
        _formAddBusy = true;
        // Show loading on ATC button — drawer opens AFTER item is in cart (no empty flash)
        var submitBtn = form.querySelector('[type="submit"], button:not([type="button"])');
        var _origBtnText = '';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.style.pointerEvents = 'none';
          _origBtnText = submitBtn.textContent;
          submitBtn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px"><svg width="16" height="16" viewBox="0 0 24 24" style="animation:ccd-spin .6s linear infinite"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31 31" stroke-linecap="round"/></svg> Adding...</span>';
        }
        // Extract form data and POST via fetch (goes through our fetch override
        // which handles scarcity, protection auto-add, drawer open, etc.)
        var formData = new FormData(form);
        var body = {};
        formData.forEach(function(v, k) { body[k] = v; });
        console.log('[CCD] Form intercept: routing /cart/add through fetch override', body.id);
        // Do NOT open drawer here — let the fetch response handler open it
        // AFTER the item is in the cart (prevents empty-cart flash)
        fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }).then(function() {
          _formAddBusy = false;
          if (submitBtn) { submitBtn.disabled = false; submitBtn.style.pointerEvents = ''; submitBtn.textContent = _origBtnText; }
        }).catch(function(err) {
          _formAddBusy = false;
          if (submitBtn) { submitBtn.disabled = false; submitBtn.style.pointerEvents = ''; submitBtn.textContent = _origBtnText; }
          console.error('[CCD] Form intercept add failed:', err);
        });
      }, true);

      var origFetch = window.fetch;
      CCD._origFetch = origFetch;
      window.fetch = function(url, opts) {
        if (typeof url === 'string' && url.indexOf('/cart/add') !== -1 && opts && opts.method && opts.method.toUpperCase() === 'POST') {
          // Track the variant being added — used by applyScarcity to badge the LAST ADDED item
          try {
            var _addBody = typeof opts.body === 'string' ? JSON.parse(opts.body) : opts.body;
            if (_addBody && _addBody.items && _addBody.items.length > 0) {
              CCD._lastAddedVid = String(_addBody.items[0].id);
            } else if (_addBody && _addBody.id) {
              CCD._lastAddedVid = String(_addBody.id);
            }
            console.log('[CCD] Tracked last added vid:', CCD._lastAddedVid);
          } catch(_ae) {}
          try {
            var body = JSON.parse(opts.body);
            var cartAlreadyHasProt = window.__ccd_last_cart && window.__ccd_last_cart.items && window.__ccd_last_cart.items.some(function(ci) { return ci.handle === PROT; });
            var _shouldInject = !cartAlreadyHasProt && !protectionDone && !_userToggledOff && PROT_ENABLED && PROT_VID && CFG.protectionDefaultOn !== false && CFG.protectionAutoAdd !== false;
            if (body && body.items && Array.isArray(body.items)) {
              var hasProt = body.items.some(function(it) { return PROT_TIERS.some(function(t){return t.vid === it.id || String(t.vid) === String(it.id);}); });
              if (!hasProt && _shouldInject) {
                body.items.push({ id: (getProtTier(0) || {vid:PROT_VID}).vid, quantity: 1 });
                opts.body = JSON.stringify(body);
                protectionDone = true;
              }
            } else if (body && body.id && _shouldInject) {
              // Simple {id, quantity} format (from form interceptor) — convert to items array with protection
              var _simpleItem = { id: parseInt(body.id) || body.id, quantity: parseInt(body.quantity) || 1 };
              if (body.properties) _simpleItem.properties = body.properties;
              var _items = [_simpleItem, { id: (getProtTier(0) || {vid:PROT_VID}).vid, quantity: 1 }];
              opts.body = JSON.stringify({ items: _items });
              protectionDone = true;
            }
          } catch(ex) {
            // Body is form-encoded — convert to JSON and inject protection into same request
            var _cartAlreadyHasProt = window.__ccd_last_cart && window.__ccd_last_cart.items && window.__ccd_last_cart.items.some(function(ci) { return ci.handle === PROT; });
            if (!_cartAlreadyHasProt && !protectionDone && !_userToggledOff && PROT_ENABLED && PROT_VID && CFG.protectionDefaultOn !== false && CFG.protectionAutoAdd !== false) {
              try {
                var formParams = new URLSearchParams(opts.body);
                var formId = formParams.get('id');
                if (formId) CCD._lastAddedVid = String(formId);
                var formQty = parseInt(formParams.get('quantity')) || 1;
                if (formId) {
                  var items = [{ id: parseInt(formId) || formId, quantity: formQty }];
                  var props = {};
                  formParams.forEach(function(v, k) {
                    var pm = k.match(/^properties\[(.+)\]$/);
                    if (pm) props[pm[1]] = v;
                  });
                  if (Object.keys(props).length > 0) items[0].properties = props;
                  items.push({ id: (getProtTier(0) || {vid:PROT_VID}).vid, quantity: 1 });
                  opts.body = JSON.stringify({ items: items });
                  opts.headers = opts.headers || {};
                  if (typeof opts.headers.set === 'function') {
                    opts.headers.set('Content-Type', 'application/json');
                  } else {
                    opts.headers['Content-Type'] = 'application/json';
                  }
                  protectionDone = true;
                } else {
                  protectionDone = true;
                  CCD._pendingProtAdd = origFetch('/cart/add.js', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: [{ id: (getProtTier(0) || {vid:PROT_VID}).vid, quantity: 1 }] })
                  });
                }
              } catch(formEx) {
                protectionDone = true;
                CCD._pendingProtAdd = origFetch('/cart/add.js', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ items: [{ id: (getProtTier(0) || {vid:PROT_VID}).vid, quantity: 1 }] })
                });
              }
            }
          }

          // Scarcity check: block adding more of the locked item
          // Read fresh from sessionStorage (not stale closure variable)
          try { scarcityVariantId = sessionStorage.getItem("ccd_scarcity_vid"); } catch(svEx) {}
          if (LSB_ENABLED && LSB_BLOCK_ADD && scarcityVariantId) {
            var scBlocked = false;
            try {
              var rawBody = opts.body;
              if (typeof rawBody === 'string') {
                // Could be JSON or URL-encoded
                try {
                  var jb = JSON.parse(rawBody);
                  var addItems = jb.items || [jb];
                  scBlocked = addItems.some(function(ai) { return String(ai.id) === scarcityVariantId; });
                } catch(je) {
                  // URL-encoded: id=12345&quantity=1
                  var params = new URLSearchParams(rawBody);
                  if (String(params.get('id')) === scarcityVariantId) scBlocked = true;
                }
              } else if (rawBody instanceof FormData) {
                if (String(rawBody.get('id')) === scarcityVariantId) scBlocked = true;
              }
            } catch(ex2) {}
            if (scBlocked) {
              CCD.showScarcityToast(lsbText(LSB_TOAST, LSB_FAKE_QTY));
              return Promise.resolve(new Response(JSON.stringify({status:422, message:"Cart Error", description:"Only " + LSB_FAKE_QTY + " left"}), {status: 422, statusText: "Unprocessable Entity", headers: {"Content-Type": "application/json"}}));
            }
          }

          // Gift case guard: block adding case if already in cart
          try {
            var addBody = JSON.parse(opts.body);
            var addList = addBody.items || [addBody];
            var caseAlreadyInCart = CCD._caseKey != null;
            var tryingToAddCase = addList.some(function(ai) {
              return parseInt(ai.id) === WATCH_CASE_VID || String(ai.id) === String(WATCH_CASE_VID);
            });
            if (caseAlreadyInCart && tryingToAddCase) {
              return Promise.resolve(new Response(JSON.stringify({items:[]}), {status: 200}));
            }
          } catch(caseEx) {}

          // GUARD: Block external adds of gift variants — gifts are auto-added when qualified
          try {
            var _giftBody = JSON.parse(opts.body);
            var _giftList = _giftBody.items || [_giftBody];
            var _isOurGiftAdd = _giftList.some(function(ai) { return ai.properties && ai.properties._eliminai_gift === 'true'; });
            if (!_isOurGiftAdd) {
              var _hasGiftVariant = _giftList.some(function(ai) { return GIFT_VIDS[String(ai.id)]; });
              if (_hasGiftVariant) {
                CCD.showScarcityToast('This gift is automatically added when you qualify ✨');
                return Promise.resolve(new Response(JSON.stringify({items:[]}), {status: 200}));
              }
            }
          } catch(_giftEx) {}
          // Also check form-encoded body for gift variant
          try {
            if (typeof opts.body === 'string' && opts.body.indexOf('{') === -1) {
              var _giftParams = new URLSearchParams(opts.body);
              var _giftFormId = _giftParams.get('id');
              var _giftFormIsOurs = opts.body.indexOf('_eliminai_gift') !== -1;
              if (_giftFormId && GIFT_VIDS[String(_giftFormId)] && !_giftFormIsOurs) {
                CCD.showScarcityToast('This gift is automatically added when you qualify ✨');
                return Promise.resolve(new Response(JSON.stringify({items:[]}), {status: 200}));
              }
            }
          } catch(_giftFormEx) {}

          // BUG-3: Show loading overlay during add operation
          if (CCD._isOpen) CCD.showLoading();
          // Hide empty-state immediately so theme can't flash it during add
          var _es = document.querySelector('#CCD-Drawer .ccd-cart-empty, #CCD-Drawer .ccd-empty');
          if (_es) _es.classList.remove('ccd-show');
          return origFetch.call(this, url, opts).then(function(resp) {
            var clone = resp.clone();
            clone.json().then(function() {
              // Wait for any pending separate protection add (form-encoded path) before fetching cart
              (CCD._pendingProtAdd || Promise.resolve()).then(function() {
                CCD._pendingProtAdd = null;
                var _interceptGen = ++_refreshGen;
                origFetch('/cart.js').then(function(r) { return r.json(); }).then(function(cart) {
                  // After add completes: if protection missing and should be on, add it now
                  var _hasProt = cart.items.some(function(i) { return i.handle === PROT; });
                  var _shouldAdd = PROT_ENABLED && PROT_VID && CFG.protectionDefaultOn !== false && CFG.protectionAutoAdd !== false;
                  // BUG-020 FIX: Open drawer ONLY after ALL async ops complete + render immediately (no debounce)
                  // This prevents: (1) empty drawer flash, (2) price-without-protection flash
                  function _renderAndOpen(finalCart) {
                    CCD._lastCart = finalCart;
                    CCD._lastRealCount = CCD.getRealCount(finalCart);
                    // Load experiment config (from cache — instant) so milestones/features render
                    CCD.loadExperiment(function(config) {
                      if (config) {
                        CCD.applyExperimentFeatures(config);
                        if (config.editorOverrides) CCD.applyEditorOverrides(config.editorOverrides);
                        if (config.cartConfig && config.cartConfig.addons) {
                          var sp = config.cartConfig.addons.shippingProtection;
                          if (sp && sp.config) {
                            if ('defaultOn' in sp.config) CFG.protectionDefaultOn = sp.config.defaultOn;
                            if ('price' in sp.config) CFG.protectionPrice = Math.round((parseFloat(sp.config.price) || 0) * 100) || 499;
                          }
                          CCD._mergeTiersFromConfig(config);
                        }
                        if (config.cartConfig && config.cartConfig.desktopWidth) {
                          var dw = parseInt(config.cartConfig.desktopWidth);
                          if (dw > 0 && !isNaN(dw)) document.documentElement.style.setProperty('--ccd-desktop-width', dw + 'px');
                        }
                        if (config.cartConfig && config.cartConfig.mobileWidth) {
                          var mw = parseInt(config.cartConfig.mobileWidth);
                          if (mw >= 70 && mw <= 100 && !isNaN(mw)) document.documentElement.style.setProperty('--ccd-mobile-width', mw + '%');
                        }
                      }
                      // Cancel any pending debounced refresh — render cart IMMEDIATELY before showing drawer
                      if (CCD._refreshTimer) { clearTimeout(CCD._refreshTimer); CCD._refreshTimer = null; }
                      CCD._pendingCart = null;
                      CCD._doRefresh(finalCart);
                      CCD._skipRefreshOnOpen = true;
                      CCD.openDrawer();
                    });
                  }
                  if (!_hasProt && !_userToggledOff && _shouldAdd && !protectionDone && CCD.getRealCount(cart) > 0) {
                    protectionDone = true;
                    CCD.setToggleNoTransition(true);
                    var _updObj = {};
                    _updObj[(getProtTier(CCD.getAdjustedTotal(cart)) || {vid:PROT_VID}).vid] = 1;
                    origFetch('/cart/update.js', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ updates: _updObj })
                    })
                    .then(function(r2) { return r2.json(); })
                    .then(function(fullCart) { _renderAndOpen(fullCart); })
                    .catch(function() { _renderAndOpen(cart); });
                  } else {
                    if (_hasProt) CCD.setToggleNoTransition(true);
                    var _protQtyItem = cart.items.find(function(i) { return i.handle === PROT; });
                    if (_protQtyItem && _protQtyItem.quantity > 1) {
                      var _fixObj = {};
                      _fixObj[_protQtyItem.variant_id] = 1;
                      origFetch('/cart/update.js', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ updates: _fixObj })
                      })
                      .then(function(r3) { return r3.json(); })
                      .then(function(fixedCart) { _renderAndOpen(fixedCart); })
                      .catch(function() { _renderAndOpen(cart); });
                    } else {
                      _renderAndOpen(cart);
                    }
                  }
                });
              });
            }).catch(function(){});
            return resp;
          });
        }
        // SECTION-RENDERING INTERCEPTION: Strip cart-drawer sections from /cart/add responses
        // Dawn/OS2 themes pass 'sections' param to /cart/add.js — the response includes
        // rendered HTML that theme's product-form.js uses to update the cart drawer.
        // We strip it so the theme has nothing to render, preventing flash.
        if (typeof url === 'string' && url.indexOf('/cart/add') !== -1 && opts && opts.body) {
          try {
            var _secBody = typeof opts.body === 'string' ? opts.body : '';
            if (_secBody.indexOf('sections') !== -1) {
              var _secParsed = JSON.parse(_secBody);
              if (_secParsed.sections) {
                delete _secParsed.sections;
                opts = Object.assign({}, opts, { body: JSON.stringify(_secParsed) });
              }
            }
          } catch(_secEx) {}
        }
        return origFetch.apply(this, arguments);
      };

      // Also intercept XMLHttpRequest for themes that use XHR instead of fetch
      var origXHROpen = XMLHttpRequest.prototype.open;
      var origXHRSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function(method, url) {
        this._ccdUrl = url;
        this._ccdMethod = method;
        return origXHROpen.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function(body) {
        if (this._ccdUrl && this._ccdUrl.indexOf && this._ccdUrl.indexOf('/cart/add') !== -1 && this._ccdMethod && this._ccdMethod.toUpperCase() === 'POST') {
          // Track last added vid for scarcity badge
          try {
            var _xab = typeof body === 'string' ? JSON.parse(body) : body;
            if (_xab && _xab.items && _xab.items[0]) CCD._lastAddedVid = String(_xab.items[0].id);
            else if (_xab && _xab.id) CCD._lastAddedVid = String(_xab.id);
          } catch(_xat) {
            try { var _xfp = new URLSearchParams(body); if (_xfp.get('id')) CCD._lastAddedVid = String(_xfp.get('id')); } catch(_xft) {}
          }
          // GUARD: Block external adds of gift variants via XHR
          try {
            var _xhrBody = typeof body === 'string' ? body : '';
            var _xhrIsOurs = _xhrBody.indexOf('_eliminai_gift') !== -1;
            if (!_xhrIsOurs) {
              try {
                var _xb = JSON.parse(_xhrBody);
                var _xl = _xb.items || [_xb];
                if (_xl.some(function(ai) { return GIFT_VIDS[String(ai.id)]; })) {
                  CCD.showScarcityToast('This gift is automatically added when you qualify ✨');
                  return;
                }
              } catch(_xje) {
                var _xp = new URLSearchParams(_xhrBody);
                if (GIFT_VIDS[String(_xp.get('id'))]) {
                  CCD.showScarcityToast('This gift is automatically added when you qualify ✨');
                  return;
                }
              }
            }
          } catch(_xgEx) {}
          var self = this;
          this.addEventListener('load', function() {
            var _oF = CCD._origFetch || fetch;
            _oF('/cart.js').then(function(r) { return r.json(); }).then(function(cart) {
              CCD.refresh(cart);
              CCD.openDrawer();
            });
          });
        }
        return origXHRSend.apply(this, arguments);
      };

    // Also intercept XMLHttpRequest for /cart/add
    var OrigXHR = window.XMLHttpRequest;
    var xhrProto = OrigXHR.prototype;
    var origOpen = xhrProto.open;
    var origSend = xhrProto.send;
    xhrProto.open = function(method, xhrUrl) {
      this._ccdUrl = xhrUrl;
      this._ccdMethod = method;
      return origOpen.apply(this, arguments);
    };
    xhrProto.send = function(body) {
      if (this._ccdMethod && this._ccdMethod.toUpperCase() === 'POST' && this._ccdUrl && this._ccdUrl.indexOf('/cart/add') !== -1) {
        try { scarcityVariantId = sessionStorage.getItem("ccd_scarcity_vid"); } catch(svEx2) {}
          if (LSB_ENABLED && LSB_BLOCK_ADD && scarcityVariantId && body) {
          var xhrBlocked = false;
          try {
            if (typeof body === 'string') {
              try {
                var xjb = JSON.parse(body);
                var xItems = xjb.items || [xjb];
                xhrBlocked = xItems.some(function(xi) { return String(xi.id) === scarcityVariantId; });
              } catch(xe) {
                var xp = new URLSearchParams(body);
                if (String(xp.get('id')) === scarcityVariantId) xhrBlocked = true;
              }
            }
          } catch(ex3) {}
          if (xhrBlocked) {
            CCD.showScarcityToast(lsbText(LSB_TOAST, LSB_FAKE_QTY));
            var self = this;
            setTimeout(function() {
              Object.defineProperty(self, "readyState", {get: function(){return 4;}, configurable: true});
              Object.defineProperty(self, "status", {get: function(){return 422;}, configurable: true});
              Object.defineProperty(self, "responseText", {get: function(){return JSON.stringify({description:"Only 1 left"});}, configurable: true});
              if (typeof self.onreadystatechange === "function") self.onreadystatechange();
              if (typeof self.onload === "function") self.onload();
              try { self.dispatchEvent(new Event("load")); } catch(evx) {}
              try { self.dispatchEvent(new Event("loadend")); } catch(evx) {}
            }, 10);
            return;
          }
        }
      }
      return origSend.apply(this, arguments);
    };
    },

    setToggleNoTransition: function(checked) {
      var tgl = document.getElementById('ccd-shipping-toggle');
      if (!tgl) return;
      var slider = tgl.nextElementSibling;
      if (slider) {
        slider.style.transition = 'none';
      }
      tgl.checked = checked;
      if (slider) {
        slider.offsetHeight;
        setTimeout(function() { slider.style.transition = ''; }, 50);
      }
    },

    rebuildDiscountRow: function(cart) {
      var allDrs = document.querySelectorAll('[data-ccd-discounts]');
      if (!allDrs.length) return;
      var dr = allDrs[0];

      // Hide ALL discount rows first (Liquid may render duplicates)
      allDrs.forEach(function(el) { el.style.setProperty('display', 'none', 'important'); });

      if (!cart || cart.total_discount <= 0) {
        return;
      }

      var discounts = [];
      var seenTitles = {};
      var hiddenGiftDiscountAmount = 0;

      if (cart.cart_level_discount_applications) {
        cart.cart_level_discount_applications.forEach(function(d) {
          if (d.title && !seenTitles[d.title]) {
            if (GIFT_HIDE_DISCOUNT_LABEL && (d.title.indexOf('Free Gift') === 0 || d.title.indexOf('Eliminai Gift') === 0)) return;
            discounts.push(d.title);
            seenTitles[d.title] = true;
          }
        });
      }

      if (cart.items) {
        cart.items.forEach(function(item) {
          var isGift = GIFT_HANDLES[item.handle] || item.handle === WATCH_CASE_HANDLE;
          if (item.line_level_discount_allocations) {
            item.line_level_discount_allocations.forEach(function(a) {
              var title = a.discount_application ? a.discount_application.title : '';
              if (GIFT_HIDE_DISCOUNT_LABEL && isGift) {
                hiddenGiftDiscountAmount += (a.amount ? parseInt(a.amount, 10) : 0);
                return;
              }
              if (title && !seenTitles[title]) {
                if (GIFT_HIDE_DISCOUNT_LABEL && (title.indexOf('Free Gift') === 0 || title.indexOf('Eliminai Gift') === 0)) return;
                discounts.push(title);
                seenTitles[title] = true;
              }
            });
          }
        });
      }

      // Show only non-gift discounts in the discount row
      // Gift savings are already handled by getAdjustedTotal()
      var visibleDiscount = cart.total_discount - hiddenGiftDiscountAmount;
      if (visibleDiscount < 0) visibleDiscount = 0;

      if (discounts.length > 0 && visibleDiscount > 0) {
        dr.style.setProperty('display', 'flex', 'important');
        var badgesHtml = discounts.map(function(title) {
          return '<span class="ccd-discount-row__promo-name">' + TAG_SVG + ' ' + title + '</span>';
        }).join(' ');
        dr.innerHTML = '<div class="ccd-discount-row__left">' +
          '<span class="ccd-discount-row__label">Discount</span> ' +
          badgesHtml +
          '</div>' +
          '<span class="ccd-discount-row__amount">-' + CCD.fmt(visibleDiscount) + '</span>';
      } else {
        dr.style.setProperty('display', 'none', 'important');
      }
    },

    _showGiftPicker: function(options, shouldHave) {
      var container = document.querySelector('#CCD-Drawer .ccd-items');
      if (!container) return;
      var existing = container.querySelector('.ccd-gift-picker');
      if (existing) return; // already showing

      // Find gift info from tiers for images/titles
      var giftInfo = {};
      GIFT_TIERS.forEach(function(t) {
        tierGifts(t).forEach(function(g) { giftInfo[g.handle] = g; });
      });
      // Also check giftMappings for image URLs
      var mappings = CFG.giftMappings || [];

      var html = '<div class="ccd-gift-picker">' +
        '<div class="ccd-gift-picker__title">' +
        '<svg viewBox="0 0 24 24"><path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z"/></svg>' +
        GIFT_PICKER_TITLE +
        '</div>' +
        '<div class="ccd-gift-picker__options">';

      options.forEach(function(opt) {
        var info = giftInfo[opt.handle] || {};
        var title = info.title || opt.handle;
        var imgUrl = info.imageUrl || '';
        var price = info.price || '';
        var imgHtml = imgUrl ? '<img src="' + imgUrl + '" alt="" />' : '';
        var priceHtml = price ? '<div class="ccd-gift-picker__opt-price"><span>$' + price + '</span> ' + FREE_PRICE_LABEL + '</div>' : '<div class="ccd-gift-picker__opt-price">' + FREE_PRICE_LABEL + '</div>';
        html += '<div class="ccd-gift-picker__opt" data-handle="' + opt.handle + '" data-vid="' + opt.variantId + '">' +
          imgHtml +
          '<div class="ccd-gift-picker__opt-info">' +
          '<div class="ccd-gift-picker__opt-title">' + title + '</div>' +
          priceHtml +
          '</div>' +
          '<div class="ccd-gift-picker__opt-check"><svg viewBox="0 0 12 12" fill="none" style="width:12px;height:12px"><path d="M2 6l3 3 5-5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
          '</div>';
      });

      html += '</div></div>';
      container.insertAdjacentHTML('beforeend', html);
      container.querySelector('.ccd-gift-picker').style.setProperty('--ccd-gift-change-color', GIFT_CHANGE_COLOR);

      // Click handler for picking a gift
      container.querySelector('.ccd-gift-picker').addEventListener('click', function(e) {
        var opt = e.target.closest('.ccd-gift-picker__opt');
        if (!opt) return;
        var vid = opt.dataset.vid;
        var handle = opt.dataset.handle;
        if (!vid) return;

        // Visual feedback — select this option
        container.querySelectorAll('.ccd-gift-picker__opt').forEach(function(o) { o.classList.remove('ccd-gift-picker__opt--selected'); });
        opt.classList.add('ccd-gift-picker__opt--selected');

        // Add selected gift to cart
        watchCaseBusy = true;
        if (CCD._isOpen) CCD.showLoading();
        var body = 'id=' + vid + '&quantity=1&properties%5B_eliminai_gift%5D=true';
        var _oF = CCD._origFetch || fetch;
        _oF('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body
        }).then(function(r) { return r.json(); })
        .then(function() {
          // Mark this gift as customer's choice — prevents picker from re-showing
          _giftChosenByCustomer[handle] = true;
          _giftPickerShown = true; // Keep true so picker doesn't re-show
          // Remove picker UI
          var picker = document.querySelector('#CCD-Drawer .ccd-gift-picker');
          if (picker) picker.remove();
          return _oF('/cart.js').then(function(r) { return r.json(); });
        })
        .then(function(cart) {
          watchCaseBusy = false;
          CCD.refresh(cart);
        })
        .catch(function() { watchCaseBusy = false; });
      });
    },

    _hideGiftPicker: function() {
      var picker = document.querySelector('#CCD-Drawer .ccd-gift-picker');
      if (picker) picker.remove();
    },

        checkWatchCase: function(cart) {
      console.log('[CCD GIFT] checkWatchCase called. watchCaseBusy=' + watchCaseBusy + ' GIFT_TIERS=' + GIFT_TIERS.length + ' items=' + (cart && cart.items ? cart.items.length : 'null'));
      if (watchCaseBusy) return;
      if (!cart || !cart.items) return;

      var score = THRESHOLD_MODE === 'dollars'
        ? (CCD.getAdjustedTotal(cart) / 100)
        : CCD.getRealCount(cart);

      // Build map of gift handles currently in cart
      var giftInCart = {}; // handle → { key, qty }
      cart.items.forEach(function(i) {
        if (GIFT_HANDLES[i.handle]) {
          giftInCart[i.handle] = { key: i.key, qty: i.quantity };
          _giftAddFails[i.handle] = 0; // reset fail count on success
        }
        // Legacy single gift compat
        if (i.handle === WATCH_CASE_HANDLE) {
          giftInCart[i.handle] = { key: i.key, qty: i.quantity };
        }
      });

      // Determine which gifts SHOULD be in cart
      var shouldHave = {}; // handle → variantId
      if (GIFT_TIERS.length > 0) {
        // New tier-based gifts -- each tier can have MULTIPLE gift products
        var eligibleGifts = [];
        GIFT_TIERS.forEach(function(t) {
          var gifts = tierGifts(t);
          if (gifts.length > 0 && score >= t.goal) {
            eligibleGifts.push(t);
          }
        });
        if (HIGHEST_TIER_ONLY && eligibleGifts.length > 0) {
          // Only keep the highest tier's gifts (all of them)
          var highest = eligibleGifts[eligibleGifts.length - 1];
          tierGifts(highest).forEach(function(g) { if (g.handle) shouldHave[g.handle] = g.variantId; });
        } else {
          eligibleGifts.forEach(function(t) {
            tierGifts(t).forEach(function(g) { if (g.handle) shouldHave[g.handle] = g.variantId; });
          });
        }
      } else if (WATCH_CASE_HANDLE && WATCH_CASE_VID) {
        // Legacy single gift
        if (score >= WATCH_GOAL) {
          shouldHave[WATCH_CASE_HANDLE] = WATCH_CASE_VID;
        }
      }

      // GUARD: Fix qty > 1 on any gift
      var fixKey = null;
      Object.keys(giftInCart).forEach(function(h) {
        if (giftInCart[h].qty > 1) fixKey = giftInCart[h].key;
      });
      if (fixKey) {
        watchCaseBusy = true;
        var _oF = CCD._origFetch || fetch;
        _oF('/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: fixKey, quantity: 1 })
        })
        .then(function(r) { return r.json(); })
        .then(function(c) { watchCaseBusy = false; CCD.refresh(c); })
        .catch(function() { watchCaseBusy = false; });
        return;
      }

      console.log('[CCD GIFT] score=' + score + ' GIFT_TIERS=' + GIFT_TIERS.length + ' shouldHave=' + JSON.stringify(shouldHave) + ' giftInCart=' + JSON.stringify(Object.keys(giftInCart)) + ' HIGHEST_TIER_ONLY=' + HIGHEST_TIER_ONLY + ' GIFT_HANDLES=' + JSON.stringify(GIFT_HANDLES));
      GIFT_TIERS.forEach(function(t) { console.log('[CCD GIFT] tier goal=' + t.goal + ' giftProducts=' + JSON.stringify((t.giftProducts||[]).map(function(g){return g.handle})) + ' eligible=' + (score >= t.goal)); });
      // ADD gifts that should be in cart but aren't
      var toAdd = [];
      var eligibleForPicker = []; // gifts the customer can choose from
      Object.keys(shouldHave).forEach(function(h) {
        if (!giftInCart[h] && !caseDismissed) {
          if ((_giftAddFails[h] || 0) >= 3) {
            console.warn('[CCD GIFT] Skipping ' + h + ' — failed ' + _giftAddFails[h] + ' times');
            return;
          }
          if (GIFT_CUSTOMER_CHOICE && Object.keys(shouldHave).length > 1) {
            // Customer choice mode with 2+ options — collect for picker
            // But skip if customer already chose a gift (one of shouldHave is in cart)
            var _anyChosen = Object.keys(giftInCart).some(function(gc) { return !!shouldHave[gc]; });
            if (!_anyChosen) {
              eligibleForPicker.push({ handle: h, variantId: shouldHave[h] });
            }
          } else {
            // Auto-add mode or only 1 gift — add directly
            toAdd.push({ id: shouldHave[h], quantity: 1, properties: { _eliminai_gift: 'true' } });
          }
        }
      });

      console.log('[CCD DEBUG] eligibleForPicker=' + eligibleForPicker.length + ' toAdd=' + toAdd.length + ' _giftPickerShown=' + _giftPickerShown + ' GIFT_CUSTOMER_CHOICE=' + GIFT_CUSTOMER_CHOICE + ' shouldHaveKeys=' + Object.keys(shouldHave).length);
      console.log('[CCD DEBUG] shouldHave:', JSON.stringify(shouldHave));
      // Show gift picker if customer choice mode and eligible gifts available
      if (eligibleForPicker.length > 0 && !_giftPickerShown) {
        CCD._showGiftPicker(eligibleForPicker, shouldHave);
        _giftPickerShown = true;
      } else if (eligibleForPicker.length === 0) {
        CCD._hideGiftPicker();
        _giftPickerShown = false;
      }

      // REMOVE gifts that are in cart but shouldn't be
      var toRemove = [];
      Object.keys(giftInCart).forEach(function(h) {
        if (!shouldHave[h]) {
          toRemove.push(giftInCart[h].key);
        }
      });

      // Reset dismiss when no gifts should be present
      if (Object.keys(shouldHave).length === 0 && !Object.keys(giftInCart).length) {
        caseDismissed = false;
        try { sessionStorage.removeItem('ccd_case_dismissed'); } catch(e) {}
      }

      // Helper: add one gift using form-encoded (JSON items array fails for some variants)
      function _addOneGift(item) {
        var body = 'id=' + item.id + '&quantity=1&properties%5B_eliminai_gift%5D=true';
        var _oF = CCD._origFetch || fetch;
        return _oF('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body
        }).then(function(r) {
          if (r.status !== 200) {
            return r.json().then(function(err) {
              console.error('[CCD GIFT] add failed id=' + item.id + ':', JSON.stringify(err));
              var h = Object.keys(shouldHave).find(function(k) { return shouldHave[k] == item.id; });
              if (h) {
                // Permanent skip for variants that don't exist — retrying won't help
                if (err && err.description && err.description.indexOf('Cannot find variant') !== -1) {
                  _giftAddFails[h] = 999;
                  console.warn('[CCD GIFT] Variant ' + item.id + ' does not exist — permanently skipped');
                } else {
                  _giftAddFails[h] = (_giftAddFails[h] || 0) + 1;
                }
              }
            });
          }
          console.log('[CCD GIFT] added id=' + item.id);
          var h = Object.keys(shouldHave).find(function(k) { return shouldHave[k] == item.id; });
          if (h) _giftAddFails[h] = 0;
        });
      }

      // Execute removals and adds — batch for speed
      if (toRemove.length > 0 || toAdd.length > 0) {
        watchCaseBusy = true;
        if (toRemove.length > 0) {
          document.querySelectorAll('#CCD-Drawer .ccd-item[data-gift="1"]').forEach(function(el) {
            var rmBtn = el.querySelector('.ccd-item__remove');
            var elKey = rmBtn && rmBtn.dataset.key;
            if (elKey && toRemove.indexOf(elKey) !== -1) el.remove();
          });
        }
        var _oFBatch = CCD._origFetch || fetch;
        var removePromise = Promise.resolve();
        if (toRemove.length > 0) {
          var removeUpdates = {};
          toRemove.forEach(function(key) { removeUpdates[key] = 0; });
          removePromise = _oFBatch('/cart/update.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates: removeUpdates })
          });
        }
        removePromise.then(function() {
          if (toAdd.length === 0) return _oFBatch('/cart.js');
          console.log('[CCD GIFT] Adding items:', JSON.stringify(toAdd));
          return _oFBatch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: toAdd })
          }).then(function(r) {
            if (r.status !== 200) {
              console.warn('[CCD GIFT] batch add failed, falling back to sequential');
              var addChain = Promise.resolve();
              toAdd.forEach(function(item) {
                addChain = addChain.then(function() { return _addOneGift(item); });
              });
              return addChain.then(function() { return _oFBatch('/cart.js'); });
            }
            return _oFBatch('/cart.js');
          });
        })
        .then(function(r) { return r.json(); })
        .then(function(c) { watchCaseBusy = false; ++_refreshGen; CCD.refresh(c); })
        .catch(function(err) { console.error('[CCD GIFT] batch catch:', err); watchCaseBusy = false; });
      }

      // Update _caseKey for dismiss tracking (use first gift found)
      CCD._caseKey = null;
      Object.keys(giftInCart).forEach(function(h) {
        if (!CCD._caseKey) CCD._caseKey = giftInCart[h].key;
      });
    },

    /* Smart DOM morph — updates items in-place, preserves images (no blink) */
    morphDOM: function(container, newCartItems) {
      var existing = container.querySelector('.ccd-items');
      if (!existing) {
        container.innerHTML = newCartItems.outerHTML;
        return;
      }

      var attrs = ['data-count', 'data-real-count', 'data-unique-count', 'data-watch-count', 'data-watch-handles', 'data-cart-subtotal'];
      attrs.forEach(function(a) {
        var v = newCartItems.getAttribute(a);
        if (v !== null) existing.setAttribute(a, v);
      });

      var existMap = {};
      existing.querySelectorAll('.ccd-item').forEach(function(el) {
        var inp = el.querySelector('.ccd-qty__input');
        var rmBtn = el.querySelector('.ccd-item__remove');
        var key = (inp && inp.dataset.id) || (rmBtn && rmBtn.dataset.key);
        if (key) existMap[key] = el;
      });

      var newList = [];
      newCartItems.querySelectorAll('.ccd-item').forEach(function(el) {
        var inp = el.querySelector('.ccd-qty__input');
        var rmBtn = el.querySelector('.ccd-item__remove');
        var key = (inp && inp.dataset.id) || (rmBtn && rmBtn.dataset.key);
        newList.push({ key: key, el: el });
      });

      Object.keys(existMap).forEach(function(k) {
        var found = newList.some(function(n) { return n.key === k; });
        if (!found) {
          var el = existMap[k];
          // Item not in new cart — remove it from DOM immediately
          // (it's already dimmed at 0.3 opacity from the click handler)
          el.remove();
        }
      });

      var giftEl = existing.querySelector('.ccd-gift-item');
      // Items removed instantly — remaining items reflow naturally

      newList.forEach(function(n) {
        if (existMap[n.key]) {
          var ex = existMap[n.key];
          var exInp = ex.querySelector('.ccd-qty__input');
          var nInp = n.el.querySelector('.ccd-qty__input');
          if (exInp && nInp && exInp.value !== nInp.value) {
            exInp.value = nInp.value;
          }
          var exPrice = ex.querySelector('.ccd-item__price');
          var nPrice = n.el.querySelector('.ccd-item__price');
          if (exPrice && nPrice && exPrice.textContent !== nPrice.textContent) exPrice.textContent = nPrice.textContent;
          var exComp = ex.querySelector('.ccd-item__compare-price');
          var nComp = n.el.querySelector('.ccd-item__compare-price');
          if (nComp && !exComp) {
            var pr = ex.querySelector('.ccd-item__price-row');
            if (pr) pr.insertBefore(nComp, pr.firstChild);
          } else if (!nComp && exComp) {
            exComp.remove();
          } else if (exComp && nComp && exComp.textContent !== nComp.textContent) {
            exComp.textContent = nComp.textContent;
          }
          var exBdg = ex.querySelector('.ccd-badge');
          var nBdg = n.el.querySelector('.ccd-badge');
          var exPC = ex.querySelector('.ccd-item__price-col');
          if (nBdg && !exBdg && exPC) { exPC.appendChild(nBdg); }
          else if (!nBdg && exBdg) { exBdg.remove(); }
          else if (exBdg && nBdg && exBdg.innerHTML !== nBdg.innerHTML) { exBdg.innerHTML = nBdg.innerHTML; }
          // BUG-023 FIX: track which DOM element to use for reordering
          n._domEl = ex;
        } else {
          // Animate new item: smooth expand + fade in + scroll into view
          n.el.style.maxHeight = '0';
          n.el.style.paddingTop = '0';
          n.el.style.paddingBottom = '0';
          n.el.style.marginBottom = '0';
          n.el.style.overflow = 'hidden';
          n.el.style.opacity = '0';
          // no transform — pure slide expand
          if (giftEl) { existing.insertBefore(n.el, giftEl); }
          else { existing.appendChild(n.el); }
          n.el.classList.add('ccd-item--adding');
          n._domEl = n.el; // new items use the newly inserted element
          // Two-frame rAF: ensures browser has painted the collapsed state
          requestAnimationFrame(function() {
            var naturalHeight = n.el.scrollHeight;
            requestAnimationFrame(function() {
              n.el.style.transition = 'max-height 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.25s ease 0.05s, padding-top 0.3s cubic-bezier(0.32, 0.72, 0, 1), padding-bottom 0.3s cubic-bezier(0.32, 0.72, 0, 1), margin-bottom 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
              n.el.style.maxHeight = (naturalHeight + 32) + 'px';
              n.el.style.paddingTop = '';
              n.el.style.paddingBottom = '';
              n.el.style.marginBottom = '';
              n.el.style.opacity = '1';
              // no transform needed
              // Smooth scroll so the new item is visible
              var scrollable = existing.closest('.drawer__content') || existing.parentElement;
              if (scrollable && scrollable.scrollHeight > scrollable.clientHeight) {
                scrollable.scrollTo({ top: scrollable.scrollHeight, behavior: 'smooth' });
              }
              // Clean up inline styles after animation completes
              setTimeout(function() {
                n.el.style.maxHeight = '';
                n.el.style.overflow = '';
                n.el.style.transition = '';
                n.el.style.opacity = '';
                // transform not used
                n.el.style.paddingTop = '';
                n.el.style.paddingBottom = '';
                n.el.classList.remove('ccd-item--adding');
              }, 350);
            });
          });
        }
      });

      // BUG-023 FIX: Reorder DOM children to match Shopify's cart.items order
      // Without this, existing items stay in their old DOM position when Shopify
      // returns them in a different order (e.g., after gift add/remove refreshes cart)
      var _giftRef = existing.querySelector('.ccd-gift-item');
      for (var _ri = 0; _ri < newList.length; _ri++) {
        var _el = newList[_ri]._domEl;
        if (!_el || !_el.parentNode) continue;
        if (_giftRef) { existing.insertBefore(_el, _giftRef); }
        else { existing.appendChild(_el); }
      }

      var exGift = existing.querySelector('.ccd-gift-item');
      var nGift = newCartItems.querySelector('.ccd-gift-item');
      if (nGift && !exGift) {
        existing.appendChild(nGift);
      } else if (!nGift && exGift) {
        exGift.remove();
      } else if (exGift && nGift) {
        exGift.setAttribute('data-key', nGift.getAttribute('data-key') || '');
        var exPR = exGift.querySelector('.ccd-gift-item__price-row');
        var nPR = nGift.querySelector('.ccd-gift-item__price-row');
        if (exPR && nPR) exPR.innerHTML = nPR.innerHTML;
      }
    },


    enforceGiftItem: function(cart) {
      var container = document.querySelector("#CCD-Drawer .ccd-items");
      if (!container) return;

      // Find ALL gift items in cart
      var giftItems = [];
      if (cart && cart.items) {
        cart.items.forEach(function(i) {
          if (GIFT_HANDLES[i.handle] || i.handle === WATCH_CASE_HANDLE) {
            giftItems.push(i);
          }
        });
      }
      if (giftItems.length === 0) return;

      // If already a .ccd-gift-item (old template), convert to regular format
      var oldGift = container.querySelector('.ccd-gift-item');
      if (oldGift) oldGift.remove();

      giftItems.forEach(function(giftCartItem) {
        var giftKey = giftCartItem.key;

        // BUG-024: Compute compare price from REWARD_TIERS config early.
        // Gift products are $0 duplicates, so giftCartItem.price is always 0.
        // Display label is always 'Free'; compare price is looked up from tier config.
        // Iterate REWARD_TIERS and parseFloat the price string ("49.99") * 100 for fmt() cents.
        var _GIFT_PRICE_LABEL = 'Free';
        var _giftOrigPrice = 0;
        var _giftHandle = giftCartItem.handle;
        for (var _ti = 0; _ti < REWARD_TIERS.length && _giftOrigPrice === 0; _ti++) {
          var _tGifts = tierGifts(REWARD_TIERS[_ti]);
          for (var _gi = 0; _gi < _tGifts.length; _gi++) {
            if (_tGifts[_gi].handle === _giftHandle && _tGifts[_gi].price) {
              _giftOrigPrice = parseFloat(_tGifts[_gi].price) * 100;
              break;
            }
          }
        }
        if (_giftOrigPrice === 0) {
          _giftOrigPrice = giftCartItem.original_price || giftCartItem.compare_at_price || giftCartItem.price || 0;
        }

        // Find the gift rendered as a regular .ccd-item
        var giftEl = null;
        container.querySelectorAll('.ccd-item').forEach(function(el) {
          var rmBtn = el.querySelector('.ccd-item__remove');
          if (rmBtn && rmBtn.dataset.key === giftKey) giftEl = el;
        });
        // If gift was filtered by renderCartItems, create it now
        if (!giftEl) {
          var tmp = document.createElement("div");
          tmp.innerHTML = CCD.renderItemHTML(giftCartItem);
          giftEl = tmp.firstElementChild;
          if (!giftEl) return;
          container.appendChild(giftEl);
        }

        // 1. Move to bottom
        if (giftEl.nextElementSibling) container.appendChild(giftEl);

        // 2. Hide qty buttons
        var qtyWrap = giftEl.querySelector('.ccd-qty');
        if (qtyWrap) qtyWrap.style.setProperty('display', 'none', 'important');
        var priceColEl = giftEl.querySelector('.ccd-item__price-col');
        if (priceColEl) priceColEl.style.marginLeft = 'auto';

        // 3. Add configurable gift badge
        if (GIFT_BADGE_ENABLED && !giftEl.querySelector('.ccd-gift-badge')) {
          var badge = document.createElement('span');
          badge.className = 'ccd-gift-badge';
          badge.style.color = GIFT_BADGE_TEXT_COLOR;
          badge.style.background = GIFT_BADGE_BG_COLOR;
          badge.innerHTML = GIFT_SVG + ' ' + GIFT_BADGE_TEXT;
          var priceCol = giftEl.querySelector('.ccd-item__price-col');
          if (priceCol) priceCol.appendChild(badge);
        }

        // 3b. Add "Change" button if customer choice mode and multiple options exist
        if (GIFT_CUSTOMER_CHOICE && GIFT_TIERS.some(function(t) { return tierGifts(t).length > 1; })) {
          if (!giftEl.querySelector('.ccd-gift-change')) {
            var changeBtn = document.createElement('button');
            changeBtn.className = 'ccd-gift-change';
            changeBtn.innerHTML = GIFT_CHANGE_TEXT;
            changeBtn.addEventListener('click', function(ev) {
              ev.stopPropagation();
              var currentHandle = giftCartItem.handle;
              var currentKey = giftCartItem.key;

              // Toggle picker — if already showing, close it
              var existingPicker = document.querySelector('#CCD-Drawer .ccd-gift-picker');
              if (existingPicker) { existingPicker.style.opacity='0'; existingPicker.style.transform='translateY(-5px)'; setTimeout(function(){existingPicker.remove()},150); return; }

              // Build options from tiers
              var tierOptions = [];
              GIFT_TIERS.forEach(function(t) { tierGifts(t).forEach(function(g) { if (g.handle && g.variantId) tierOptions.push(g); }); });
              if (tierOptions.length < 2) return;

              var giftInfo = {};
              GIFT_TIERS.forEach(function(t) { tierGifts(t).forEach(function(g) { giftInfo[g.handle] = g; }); });

              var pickerHtml = '<div class="ccd-gift-picker ccd-gift-picker--change" style="opacity:0;transform:translateY(-5px);transition:opacity 0.2s,transform 0.2s">' +
                '<div class="ccd-gift-picker__options">';

              tierOptions.forEach(function(opt) {
                var info = giftInfo[opt.handle] || {};
                var title = info.title || opt.handle;
                var imgUrl = info.imageUrl || '';
                var isSelected = opt.handle === currentHandle;
                var selectedClass = isSelected ? ' ccd-gift-picker__opt--selected' : '';
                var imgHtml = imgUrl ? '<img src="' + imgUrl + '" alt="" />' : '';
                pickerHtml += '<div class="ccd-gift-picker__opt' + selectedClass + '" data-handle="' + opt.handle + '" data-vid="' + opt.variantId + '">' +
                  imgHtml +
                  '<div class="ccd-gift-picker__opt-info"><div class="ccd-gift-picker__opt-title">' + title + '</div>' +
                  '<div class="ccd-gift-picker__opt-price">' + FREE_PRICE_LABEL + '</div></div>' +
                  '<div class="ccd-gift-picker__opt-check"><svg viewBox="0 0 12 12" fill="none" style="width:12px;height:12px"><path d="M2 6l3 3 5-5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>';
              });
              pickerHtml += '</div></div>';

              // Insert after this gift item
              giftEl.insertAdjacentHTML('afterend', pickerHtml);
              var picker = giftEl.nextElementSibling;
              picker.style.setProperty('--ccd-gift-change-color', GIFT_CHANGE_COLOR);
              requestAnimationFrame(function() { picker.style.opacity='1'; picker.style.transform='translateY(0)'; });

              // Click handler — swap gift
              picker.addEventListener('click', function(pe) {
                var optEl = pe.target.closest('.ccd-gift-picker__opt');
                if (!optEl) return;
                var newHandle = optEl.dataset.handle;
                var newVid = optEl.dataset.vid;
                if (!newVid || newHandle === currentHandle) {
                  picker.style.opacity='0'; picker.style.transform='translateY(-5px)';
                  setTimeout(function(){picker.remove()},150);
                  return;
                }
                // Instant visual select + close picker immediately
                picker.querySelectorAll('.ccd-gift-picker__opt').forEach(function(o){o.classList.remove('ccd-gift-picker__opt--selected')});
                optEl.classList.add('ccd-gift-picker__opt--selected');
                picker.style.opacity='0'; picker.style.transform='translateY(-5px)';
                setTimeout(function(){picker.remove()},150);
                // Swap in background: remove old + add new
                if (CCD._isOpen) CCD.showLoading();
                var _oF = CCD._origFetch || fetch;
                _oF('/cart/change.js', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:currentKey,quantity:0}) })
                .then(function(){
                  return _oF('/cart/add.js', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:'id='+newVid+'&quantity=1&properties%5B_eliminai_gift%5D=true' });
                })
                .then(function(){ return _oF('/cart.js'); })
                .then(function(r){ return r.json(); })
                .then(function(cart){
                  _giftChosenByCustomer[newHandle] = true;
                  _giftPickerShown = true;
                  CCD.refresh(cart);
                })
                .catch(function(){ if(CCD._isOpen) CCD.hideLoading(); });
              });
            });
            // Apply configured color as CSS variable
            giftEl.style.setProperty('--ccd-gift-change-color', GIFT_CHANGE_COLOR);
            // Place below variant name in the info area
            var variantRow = giftEl.querySelector('.ccd-item__variant-row');
            var infoArea = giftEl.querySelector('.ccd-item__info');
            if (variantRow) {
              variantRow.parentElement.insertBefore(changeBtn, variantRow.nextSibling);
            } else if (infoArea) {
              infoArea.appendChild(changeBtn);
            }
          }
        }

        // 4. Set price to "Free" with compare price from tier config
        var priceEl = giftEl.querySelector('.ccd-item__price');
        if (priceEl) {
          priceEl.textContent = 'Free';
          priceEl.classList.add('ccd-item__price--free');
        }
        // Gift compare price was computed at top of forEach (see BUG-024 block above)
        var origPrice = _giftOrigPrice;
        console.log('[CCD GIFT] comparePrice: handle=' + _giftHandle + ' origPrice=' + origPrice + ' REWARD_TIERS=' + REWARD_TIERS.length + ' SHOW=' + GIFT_SHOW_COMPARE_PRICE);
        var priceRow = giftEl.querySelector('.ccd-item__price-row') || (priceEl ? priceEl.parentElement : null);
        if (GIFT_SHOW_COMPARE_PRICE && priceRow && origPrice > 0) {
          var existingCompare = priceRow.querySelector('.ccd-item__compare-price');
          if (existingCompare) {
            existingCompare.textContent = CCD.fmt(origPrice);
          } else {
            var cp = document.createElement('span');
            cp.className = 'ccd-item__compare-price';
            cp.textContent = CCD.fmt(origPrice);
            priceRow.insertBefore(cp, priceRow.firstChild);
          }
        }

        // 5. Hide discount labels on gift item (Shopify theme renders these from line_level_discount_allocations)
        if (GIFT_HIDE_DISCOUNT_LABEL) {
          giftEl.querySelectorAll('.ccd-badge, .cart-discount, .cart-item__discount, [class*="discount-label"]').forEach(function(el) {
            el.style.display = 'none';
          });
        }

        // 6. Mark gift for dismiss tracking
        giftEl.setAttribute('data-gift', '1');
      });
    },
    // ── BUG-3 FIX: Loading overlay helpers ──
    _loadingOverlay: null,
    showLoading: function() {
      var d = document.getElementById('CCD-Drawer');
      if (!d) return;
      d.classList.add('ccd-refreshing');
      var scrollable = d.querySelector('.ccd-scrollable');
      if (!scrollable) return;
      var ov = scrollable.querySelector('.ccd-loading-overlay');
      if (!ov) {
        ov = document.createElement('div');
        ov.className = 'ccd-loading-overlay';
        scrollable.style.position = 'relative';
        scrollable.appendChild(ov);
      }
      if (!ov.querySelector('.ccd-spinner')) {
        var sp = document.createElement('div');
        sp.className = 'ccd-spinner';
        ov.appendChild(sp);
      }
      CCD._loadingOverlay = ov;
      var items = d.querySelector('[data-products]');
      if (items) { items.classList.add('ccd-items-crossfade'); items.classList.add('ccd-items-crossfade--out'); }
      // Disable checkout button during loading to prevent $0 / stale-cart checkout
      var _chkBtn = d.querySelector('.ccd-checkout-btn');
      if (_chkBtn) _chkBtn.classList.add('ccd-checkout-btn--loading');
      requestAnimationFrame(function() { ov.classList.add('ccd-loading-overlay--visible'); });
      // Safety: auto-hide loading after 5s in case refresh never completes
      if (CCD._loadingSafety) clearTimeout(CCD._loadingSafety);
      CCD._loadingSafety = setTimeout(function() {
        CCD._loadingSafety = null;
        CCD.hideLoading();
        console.warn('[CCD] Safety timeout: loading auto-hidden after 5s');
      }, 5000);
    },
    hideLoading: function() {
      if (CCD._loadingSafety) { clearTimeout(CCD._loadingSafety); CCD._loadingSafety = null; }
      var d = document.getElementById('CCD-Drawer');
      if (!d) return;
      d.classList.remove('ccd-refreshing');
      var ov = CCD._loadingOverlay || (d.querySelector && d.querySelector('.ccd-loading-overlay'));
      if (ov) { ov.classList.remove('ccd-loading-overlay--visible'); }
      // Re-enable checkout button after loading completes
      var _chkBtn2 = d.querySelector('.ccd-checkout-btn');
      if (_chkBtn2) _chkBtn2.classList.remove('ccd-checkout-btn--loading');
      var items = d.querySelector('[data-products]');
      if (items) { items.classList.remove('ccd-items-crossfade--out'); }
    },

        // Lightweight refresh: update totals, progress, empty state — NO morphDOM
    refreshLight: function(cart) {
      CCD.updateCartBubble(cart);
      CCD.enforceGiftItem(cart);
      var _adjTotal = CCD.getAdjustedTotal(cart);
      // Safety: if calculated total is $0 but cart has value, use cart.total_price
      if (_adjTotal <= 0 && cart.total_price > 0 && CCD.getRealCount(cart) > 0) {
        _adjTotal = cart.total_price;
        console.warn('[CCD] Total was $0 but cart.total_price=' + cart.total_price + ' — using fallback');
      }
      var ct = document.querySelector('.ccd-checkout-total');
      if (ct) ct.textContent = CCD.fmt(_adjTotal);
      var st = document.querySelector('#CCD-Drawer [data-subtotal]');
      if (st) st.textContent = CCD.fmt(_adjTotal);
      CCD.rebuildDiscountRow(cart);
      var protItem = cart.items.find(function(i) { return i.handle === PROT; });
      CCD._protKey = protItem ? protItem.key : null;
      if (protItem && protItem.quantity > 1) {
        var _oFP = CCD._origFetch || fetch;
        _oFP('/cart/change.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: protItem.key, quantity: 1 }) });
      }
      // Silent tier swap in refreshLight
      // Total is already updated above — safe to return early
      if (protItem && PROT_TIERS.length > 1) {
        var cartValExProtL = CCD.getAdjustedTotal(cart);
        var correctTierL = getProtTier(cartValExProtL);
        if (correctTierL && protItem.variant_id !== correctTierL.vid) {
          CCD.hideLoading(); // Prevent stuck loading during tier swap
          CCD._lastCart = cart;
          window.__ccd_last_cart = cart;
          var _oSwapL = CCD._origFetch || fetch;
          _oSwapL('/cart/change.js', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: protItem.key, quantity: 0 }) })
          .then(function() { return _oSwapL('/cart/add.js', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ items: [{ id: correctTierL.vid, quantity: 1 }] }) }); })
          .then(function() { return _oSwapL('/cart.js'); })
          .then(function(r) { return r.json(); })
          .then(function(swappedCart) { CCD.refreshLight(swappedCart); })
          .catch(function() { CCD.hideLoading(); });
          return;
        }
      }
      // Update protection price display for current tier (refreshLight)
      var _tierNowL = getProtTier(CCD.getAdjustedTotal(cart));
      if (_tierNowL) {
        var _priceElL = document.querySelector('.ccd-shipping-protection__price');
        if (_priceElL) {
          _priceElL.textContent = CCD.fmt(_tierNowL.price);
          _priceElL.setAttribute('data-prot-price', _tierNowL.price);
        }
      }
      // If defaultOn and protection is being auto-added, keep toggle ON to avoid flash
      var defaultOnPending = CFG.protectionDefaultOn !== false && CFG.protectionAutoAdd !== false && !_userToggledOff && !protItem && CCD.getRealCount(cart) > 0;
      CCD.setToggleNoTransition(!!protItem || defaultOnPending);
      var cie = document.querySelector('#CCD-Drawer .ccd-items');
      if (cie) {
        cie.setAttribute('data-real-count', CCD.getRealCount(cart));
        cie.setAttribute('data-unique-count', CCD.getUniqueVariants(cart));
        cie.setAttribute('data-cart-subtotal', CCD.getAdjustedTotal(cart));
      }
      CCD.updateProgress(cart);
      CCD.applyScarcity(cart);
      CCD.lockScarcityQty();
      // BUG-3: Ensure loading overlay is hidden after full refresh
      CCD.hideLoading();
      var rc = CCD.getRealCount(cart); CCD._lastRealCount = rc;
      var es = document.querySelector('#CCD-Drawer .ccd-cart-empty, #CCD-Drawer .ccd-empty');
      var id = document.querySelector('#CCD-Drawer [data-ccd-inner]');
      var pb = document.querySelector('[data-ccd-progress]');
      var ft = document.querySelector('[data-ccd-footer]');
      if (rc === 0) {
        if (cart.item_count > 0) {
          cart.items.filter(function(i) { return CCD._isExcludedHandle(i.handle); }).forEach(function(pi) {
            fetch('/cart/change.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: pi.key, quantity: 0 }) });
          });
        }
        if (es) es.classList.add('ccd-show');
        if (id) id.style.display = 'none';
        if (pb) pb.style.display = 'none';
        if (ft) ft.style.display = 'none';
      } else {
        if (es) es.classList.remove('ccd-show');
        if (id) id.style.display = 'flex';
        if (pb) pb.style.display = 'block';
        if (ft) ft.style.display = 'block';
      }
      // Cart-aware scarcity timer: empty → remove + clear; items → inject (lightweight path)
      CCD._syncScarcityTimer();
      // Cart-aware upsells: empty → remove "You may also like"; items → re-inject if missing
      CCD._syncUpsells();
      // BUG-3: Ensure loading overlay hidden after refreshLight
      CCD.hideLoading();
      // Delay overflow check until browser has completed layout paint
      requestAnimationFrame(function() { CCD.checkOverflow(); });
    },
    // Debounced refresh entry point: coalesces rapid calls into one render
    _refreshTimer: null,
    _pendingCart: null,
    refresh: function(cart, _gen) {
      // Store the latest cart data — if multiple refreshes fire rapidly,
      // we always render the LATEST cart, not an intermediate state
      if (cart) CCD._pendingCart = cart;
      var finalCart = CCD._pendingCart || cart;
      if (!finalCart) return;
      // Debounce: cancel any pending refresh, schedule a new one in 50ms
      // This coalesces double/triple refreshes (e.g., remove + gift change + protection)
      // into a single visual update
      if (CCD._refreshTimer) clearTimeout(CCD._refreshTimer);
      CCD._refreshTimer = setTimeout(function() {
        CCD._refreshTimer = null;
        CCD._doRefresh(CCD._pendingCart);
      }, 50);
    },
    _doRefresh: function(cart) {
      if (!cart) return;
      CCD._pendingCart = null;
      console.log("[CCD] _doRefresh() called — single render");

      // CART-DIFF DETECTION: detect newly added items by comparing old vs new cart
      // This works regardless of HOW items are added (fetch, XHR, form submit, Ajax.js, theme JS)
      if (CCD._lastCart && CCD._lastCart.items && cart.items && cart.items.length > 0) {
        var _oldQtyMap = {};
        for (var _di = 0; _di < CCD._lastCart.items.length; _di++) {
          var _ov = String(CCD._lastCart.items[_di].variant_id);
          _oldQtyMap[_ov] = (_oldQtyMap[_ov] || 0) + CCD._lastCart.items[_di].quantity;
        }
        // Shopify returns newest items FIRST — scan from start to find new/increased items
        for (var _dj = 0; _dj < cart.items.length; _dj++) {
          var _nv = String(cart.items[_dj].variant_id);
          var _oldQ = _oldQtyMap[_nv] || 0;
          if (cart.items[_dj].quantity > _oldQ) {
            CCD._lastAddedVid = _nv;
            console.log('[CCD] Cart-diff detected new item: vid=' + _nv + ' (old qty=' + _oldQ + ', new qty=' + cart.items[_dj].quantity + ')');
            break;
          }
        }
      } else if (!CCD._lastCart && cart.items && cart.items.length > 0) {
        // First cart load — badge the first item (newest, since Shopify orders newest first)
        CCD._lastAddedVid = String(cart.items[0].variant_id);
      }

      CCD.updateCartBubble(cart);

      // Pre-set toggle to ON before morphDOM can flash it off
      var shouldDefaultOn = CFG.protectionDefaultOn !== false && CFG.protectionAutoAdd !== false;
      if (shouldDefaultOn && CCD.getRealCount(cart) > 0 && !_userToggledOff) {
        CCD.setToggleNoTransition(true);
      }

      // Theme-independent: render items from cart JSON (no /cart?view=ajax)
      // BUG-3 FIX: Build new DOM, then crossfade transition (no visible flash)
      var pc = document.querySelector("#CCD-Drawer [data-products]");
      if (pc) {
        var ni = CCD.renderCartItems(cart);
        if (ni) {
          // If items already showing, crossfade: dim → morph → brighten
          if (pc.children.length > 0 && CCD._isOpen) {
            pc.classList.add('ccd-items-crossfade');
            CCD.morphDOM(pc, ni);
            // Remove dim after morph (hideLoading handles full fade-in)
            requestAnimationFrame(function() {
              pc.classList.remove('ccd-items-crossfade--out');
              CCD.hideLoading();
            });
          } else {
            CCD.morphDOM(pc, ni);
            CCD.hideLoading();
          }
        }
      }

      CCD.enforceGiftItem(cart);

      var _adjTotal = CCD.getAdjustedTotal(cart);
      // Safety: if calculated total is $0 but cart has value, use cart.total_price
      if (_adjTotal <= 0 && cart.total_price > 0 && CCD.getRealCount(cart) > 0) {
        _adjTotal = cart.total_price;
        console.warn('[CCD] Total was $0 but cart.total_price=' + cart.total_price + ' — using fallback');
      }
      var ct = document.querySelector('.ccd-checkout-total');
      var st = document.querySelector('#CCD-Drawer [data-subtotal]');
      // Checkout loading animation: if price changed, briefly show spinner then reveal new price
      var checkoutBtn = document.querySelector('.ccd-checkout-btn');
      var oldTotal = ct ? ct.textContent : '';
      var newTotal = CCD.fmt(_adjTotal);
      if (checkoutBtn && oldTotal && newTotal !== oldTotal) {
        checkoutBtn.classList.add('ccd-checkout-btn--loading');
        if (ct) ct.style.opacity = '0';
        setTimeout(function() {
          if (ct) { ct.textContent = newTotal; ct.style.opacity = '1'; }
          if (st) st.textContent = newTotal;
          checkoutBtn.classList.remove('ccd-checkout-btn--loading');
        }, 400);
      } else {
        if (ct) ct.textContent = newTotal;
        if (st) st.textContent = newTotal;
      }

      CCD.rebuildDiscountRow(cart);

      var protItem = cart.items.find(function(i) { return i.handle === PROT; });
      CCD._protKey = protItem ? protItem.key : null;
      if (protItem && protItem.quantity > 1) {
        var _oFP = CCD._origFetch || fetch;
        _oFP('/cart/change.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: protItem.key, quantity: 1 }) });
      }
      // Silent tier swap — if cart value changed, swap to correct tier
      // Total + loading are already updated above — safe to return early
      if (protItem && PROT_TIERS.length > 1) {
        var cartValExProt = CCD.getAdjustedTotal(cart);
        var correctTier = getProtTier(cartValExProt);
        if (correctTier && protItem.variant_id !== correctTier.vid) {
          CCD.hideLoading(); // Prevent stuck loading during tier swap
          CCD._lastCart = cart;
          window.__ccd_last_cart = cart;
          var _oSwap = CCD._origFetch || fetch;
          _oSwap('/cart/change.js', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: protItem.key, quantity: 0 }) })
          .then(function() { return _oSwap('/cart/add.js', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ items: [{ id: correctTier.vid, quantity: 1 }] }) }); })
          .then(function() { return _oSwap('/cart.js'); })
          .then(function(r) { return r.json(); })
          .then(function(swappedCart) { ++_refreshGen; CCD.refresh(swappedCart); })
          .catch(function() { CCD.hideLoading(); });
          return; // Skip rest of refresh — will re-enter with correct cart
        }
      }
      // Update protection price display for current tier
      var _tierNow = getProtTier(CCD.getAdjustedTotal(cart));
      if (_tierNow) {
        var _priceEl = document.querySelector('.ccd-shipping-protection__price');
        if (_priceEl) {
          _priceEl.textContent = CCD.fmt(_tierNow.price);
          _priceEl.setAttribute('data-prot-price', _tierNow.price);
        }
      }
      CCD._lastCart = cart;
      window.__ccd_last_cart = cart;

      // Protection reorder removed — we render it separately, no need to shuffle Shopify cart order

      // If defaultOn and protection is being auto-added, keep toggle ON to avoid flash
      var defaultOnPending = CFG.protectionDefaultOn !== false && CFG.protectionAutoAdd !== false && !_userToggledOff && !protItem && CCD.getRealCount(cart) > 0;
      CCD.setToggleNoTransition(!!protItem || defaultOnPending);

      var cie = document.querySelector('#CCD-Drawer .ccd-items');
      if (cie) {
        var whs = (cie.getAttribute('data-watch-handles') || '').split(',').filter(Boolean);
        if (whs.length > 0) CCD._watchHandles = whs;
      }

      if (cie) {
        cie.setAttribute('data-real-count', CCD.getRealCount(cart));
        cie.setAttribute('data-unique-count', CCD.getUniqueVariants(cart));
        cie.setAttribute('data-cart-subtotal', CCD.getAdjustedTotal(cart));
      }

      CCD.updateProgress(cart);
      CCD.applyScarcity(cart);
      CCD.lockScarcityQty();

      var rc = CCD.getRealCount(cart); CCD._lastRealCount = rc;
      var es = document.querySelector('#CCD-Drawer .ccd-cart-empty, #CCD-Drawer .ccd-empty');
      var id = document.querySelector('#CCD-Drawer [data-ccd-inner]');
      var pb = document.querySelector('[data-ccd-progress]');
      var ft = document.querySelector('[data-ccd-footer]');

      if (rc === 0) {
        if (cart.item_count > 0) {
          var toRemove = cart.items.filter(function(i) {
            return CCD._isExcludedHandle(i.handle);
          });
          toRemove.forEach(function(pi) {
            fetch('/cart/change.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: pi.key, quantity: 0 })
            });
          });
        }
        if (es) es.classList.add('ccd-show');
        if (id) id.style.display = 'none';
        if (pb) pb.style.display = 'none';
        if (ft) ft.style.display = 'none';
        protectionDone = false;
        CCD.hideLoading();
      } else {
        if (es) es.classList.remove('ccd-show');
        if (id) id.style.display = 'flex';
        if (pb) pb.style.display = 'block';
        if (ft) ft.style.display = 'block';
      }

      CCD.checkWatchCase(cart);
      // Cart-aware scarcity timer: empty → remove + clear; items → inject
      CCD._syncScarcityTimer();
      // Cart-aware upsells: empty → remove "You may also like"; items → re-inject if missing
      CCD._syncUpsells();
      // Delay overflow check until browser has completed layout paint
      requestAnimationFrame(function() { CCD.checkOverflow(); CCD.setupScrollIndicator(); });
    },

    getScarcitySvg: function() {
      var icon = LSB_ICON;
      if (icon === 'fire') return FIRE_SVG;
      if (icon === 'clock') return CLOCK_SVG;
      if (icon === 'warning') return WARN_SVG;
      return '';
    },

    applyScarcity: function(cart) {
      if (!LSB_ENABLED) return;
      if (!cart || !cart.items) return;

      var realItems = cart.items.filter(function(it) {
        return !CCD._isExcludedHandle(it.handle);
      });
      var targetVid = null;
      var target = LSB_TARGET;

      // AUTO mode: badge shown on first item with inventory_quantity <= threshold.
      // Skips Fake-mode Nth-variant logic entirely.
      if (LSB_MODE === 'auto') {
        var autoQty = null;
        for (var ai = 0; ai < realItems.length; ai++) {
          var invQ = realItems[ai].inventory_quantity;
          if (typeof invQ === 'number' && invQ > 0 && invQ <= LSB_THRESHOLD) {
            targetVid = String(realItems[ai].variant_id);
            autoQty = invQ;
            break;
          }
        }
        scarcityVariantId = targetVid;
        try {
          if (targetVid) { sessionStorage.setItem('ccd_scarcity_vid', targetVid); }
          else { sessionStorage.removeItem('ccd_scarcity_vid'); }
        } catch(e) {}
        var autoItems = document.querySelectorAll('#CCD-Drawer .ccd-item');
        autoItems.forEach(function(el) {
          var inp = el.querySelector('.ccd-qty__input');
          var existingBadge = el.querySelector('.ccd-scarcity-badge');
          var itemVid = inp ? String(inp.dataset.id).split(':')[0] : '';
          if (targetVid && inp && itemVid === targetVid) {
            if (!existingBadge) {
              var badge = document.createElement('span');
              badge.className = 'ccd-scarcity-badge';
              badge.innerHTML = CCD.getScarcitySvg() + ' ' + lsbText(LSB_TEXT, autoQty);
              var variant = el.querySelector('.ccd-item__variant');
              if (variant && !variant.parentElement.classList.contains('ccd-item__variant-row')) {
                var row = document.createElement('div');
                row.className = 'ccd-item__variant-row';
                variant.parentElement.insertBefore(row, variant);
                row.appendChild(variant);
                row.appendChild(badge);
              } else if (variant && variant.parentElement.classList.contains('ccd-item__variant-row')) {
                variant.parentElement.appendChild(badge);
              } else {
                var titleRow = el.querySelector('.ccd-item__title-row');
                if (titleRow) titleRow.after(badge);
              }
            }
          } else if (existingBadge) {
            existingBadge.remove();
          }
        });
        return;
      }

      // Always recompute target from current cart state (no sticky override)
      if (realItems.length > 0) {
        var idx = -1;
        if (target === 'last') { idx = realItems.length - 1; }
        else if (target === 'random') {
          var storedRand = -1;
          try { storedRand = parseInt(sessionStorage.getItem('ccd_scarcity_rand') || '-1'); } catch(e) {}
          if (storedRand >= 0 && storedRand < realItems.length) {
            idx = storedRand;
          } else {
            idx = Math.floor(Math.random() * realItems.length);
            try { sessionStorage.setItem('ccd_scarcity_rand', String(idx)); } catch(e) {}
          }
        }
        else {
          // Numeric target: activate scarcity when N+ unique variants exist
          // Badge goes on the LAST item in the cart (most recently added — Shopify orders by add time)
          var tNum = parseInt(target) || 1;
          var seenVids = {};
          var uniqueCount = 0;
          for (var i = 0; i < realItems.length; i++) {
            var vid = String(realItems[i].variant_id);
            if (!seenVids[vid]) {
              seenVids[vid] = true;
              uniqueCount++;
            }
          }
          // STICKY BADGE: locked to one variant forever. Shows when that variant is in cart.
          // Never jumps. If removed and re-added, badge returns. Persisted across page loads.
          var _lockedVid = CCD._scarcityLockedVid || _initScarcityLockedVid;
          if (_lockedVid) {
            for (var j = 0; j < realItems.length; j++) {
              if (String(realItems[j].variant_id) === _lockedVid) { idx = j; break; }
            }
            if (!CCD._scarcityLockedVid) CCD._scarcityLockedVid = _lockedVid;
          } else if (uniqueCount >= tNum) {
            if (CCD._lastAddedVid) {
              for (var jj = 0; jj < realItems.length; jj++) {
                if (String(realItems[jj].variant_id) === CCD._lastAddedVid) { idx = jj; break; }
              }
            }
            if (idx < 0) idx = 0;
            CCD._scarcityLockedVid = String(realItems[idx].variant_id);
            try { sessionStorage.setItem('ccd_scarcity_locked_vid', CCD._scarcityLockedVid); } catch(e) {}
          }
          if (idx >= 0) {
            console.log('[CCD] Scarcity: badge idx=' + idx + ' vid=' + realItems[idx].variant_id + ' (locked=' + CCD._scarcityLockedVid + ')');
          }
        }

        if (idx >= 0) {
          targetVid = String(realItems[idx].variant_id);
          // Force qty down to displayed limit if block-add is on
          if (LSB_BLOCK_ADD && realItems[idx].quantity > LSB_FAKE_QTY) {
            fetch('/cart/change.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: realItems[idx].key, quantity: LSB_FAKE_QTY })
            }).then(function(r) { return r.json(); })
              .then(function(c) { CCD.refresh(c); });
          }
        }
      }
      // Save to session + global
      scarcityVariantId = targetVid;
      try {
        if (targetVid) { sessionStorage.setItem('ccd_scarcity_vid', targetVid); }
        else { sessionStorage.removeItem('ccd_scarcity_vid'); }
      } catch(e) {}

      // Render badges
      console.log('[CCD] applyScarcity: targetVid=' + targetVid + ' realItems=' + realItems.map(function(ri) { return ri.variant_id + '(' + ri.product_title + ')'; }).join(', '));
      var items = document.querySelectorAll('#CCD-Drawer .ccd-item');
      items.forEach(function(el) {
        var inp = el.querySelector('.ccd-qty__input');
        var existingBadge = el.querySelector('.ccd-scarcity-badge');
        var itemVid = inp ? String(inp.dataset.id).split(':')[0] : '';

        if (targetVid && inp && itemVid === targetVid) {
          if (!existingBadge) {
            var badge = document.createElement('span');
            badge.className = 'ccd-scarcity-badge';
            badge.innerHTML = CCD.getScarcitySvg() + ' ' + lsbText(LSB_TEXT, LSB_FAKE_QTY);
            var variant = el.querySelector('.ccd-item__variant');
            if (variant && !variant.parentElement.classList.contains('ccd-item__variant-row')) {
              var row = document.createElement('div');
              row.className = 'ccd-item__variant-row';
              variant.parentElement.insertBefore(row, variant);
              row.appendChild(variant);
              row.appendChild(badge);
            } else if (variant && variant.parentElement.classList.contains('ccd-item__variant-row')) {
              variant.parentElement.appendChild(badge);
            } else {
              var titleRow = el.querySelector('.ccd-item__title-row');
              if (titleRow) titleRow.after(badge);
            }
          }
        } else if (existingBadge) {
          existingBadge.remove();
        }
      });
    },

                lockScarcityQty: function() {
      if (!LSB_ENABLED || !LSB_BLOCK_ADD || !scarcityVariantId) return;
      var items = document.querySelectorAll('#CCD-Drawer .ccd-item');
      items.forEach(function(el) {
        var inp = el.querySelector('.ccd-qty__input');
        var lockVid = inp ? String(inp.dataset.id).split(':')[0] : '';
        if (inp && lockVid === scarcityVariantId) {
          var plusBtn = el.querySelectorAll('.ccd-qty__btn')[1];
          if (plusBtn && !plusBtn.classList.contains('ccd-qty__btn--locked')) {
            plusBtn.classList.add('ccd-qty__btn--locked');
          }
        }
      });
    },

    // Rebuild progress bar milestones from dynamic tier config
    buildProgressBar: function(force) {
      var tiers = REWARD_TIERS;
      if (!tiers || tiers.length === 0) return; // keep legacy HTML
      var wrap = document.querySelector('.ccd-progress__bar-wrap');
      if (!wrap) return;
      // Don't rebuild if already built with dynamic classes (unless forced by config update)
      if (!force && wrap.querySelector('.ccd-progress__milestone--tier-0')) return;
      wrap.innerHTML = '';
      tiers.forEach(function(tier, idx) {
        // Line segment before milestone
        var line = document.createElement('div');
        line.className = 'ccd-progress__line ccd-progress__line--tier-' + idx;
        wrap.appendChild(line);
        // Milestone circle + label
        var ms = document.createElement('div');
        ms.className = 'ccd-progress__milestone ccd-progress__milestone--tier-' + idx;
        var iconSvg = REWARD_ICON_SVGS[tier.icon] || REWARD_ICON_SVGS.star;
        ms.innerHTML = '<div class="ccd-progress__icon">' + iconSvg + '</div>' +
          '<span class="ccd-progress__label">' + (tier.label || '') + '</span>';
        wrap.appendChild(ms);
      });
    },

    _lastProgressValue: null,

    updateProgress: function(cart) {
      var rc, uv, cartTotal;
      if (cart && cart._optimisticCount !== undefined) {
        rc = cart._optimisticCount;
        uv = rc;
        cartTotal = 0;
      } else if (cart) {
        rc = CCD.getRealCount(cart);
        uv = CCD.getUniqueVariants(cart);
        cartTotal = (CCD.getAdjustedTotal(cart) || 0) / 100;
      } else {
        var a = document.querySelector('[data-real-count]');
        rc = a ? parseInt(a.getAttribute('data-real-count') || '0') : 0;
        uv = a ? parseInt(a.getAttribute('data-unique-count') || '0') : 0;
        cartTotal = a ? parseInt(a.getAttribute('data-cart-subtotal') || '0') / 100 : 0;
        if (!a || !a.getAttribute('data-unique-count')) uv = rc;
      }

      var tiers = REWARD_TIERS;
      var currentValue = THRESHOLD_MODE === 'dollars' ? cartTotal : rc;

      // Skip animation if progress hasn't changed (cart reopened, not a new item)
      var progressWrap = document.querySelector('.ccd-progress');
      var skipAnim = (this._lastProgressValue !== null && this._lastProgressValue === currentValue);
      if (skipAnim && progressWrap) {
        progressWrap.classList.add('ccd-progress--instant');
      }
      this._lastProgressValue = currentValue;

      // Hide progress bar if no tiers
      if (!tiers || tiers.length === 0) {
        if (progressWrap) progressWrap.style.display = 'none';
        return;
      }
      // Show progress bar when tiers exist AND cart has items (prevents flash on empty cart)
      if (progressWrap && currentValue > 0) progressWrap.style.display = '';
      if (progressWrap && currentValue === 0) { progressWrap.style.display = 'none'; return; }
      // Legacy fallback when no dynamic tiers configured (dead code after above)
      if (false) {
        tiers = [
          { id: 'legacy-1', goal: 1, label: '', icon: 'shipping', beforeText: '', afterText: '' },
          { id: 'legacy-2', goal: PROMO_GOAL, label: '', icon: 'tag', beforeText: 'Add {remaining} more for FREE', afterText: '' }
        ];
      }

      var allReached = tiers.every(function(t) { return currentValue >= t.goal; });
      var lastTier = tiers[tiers.length - 1];
      var overallRemaining = Math.max(0, lastTier.goal - currentValue);

      var msgEl = document.querySelector('[data-ccd-progress-msg]');
      if (msgEl) {
        // Editor template overrides (set on .ccd-progress via applyEditorOverrides).
        // When present they REPLACE the default message; vars: {{amount}} (remaining
        // toward the goal) and {{tierName}} (the relevant tier label).
        var progElForTpl = document.querySelector('.ccd-progress');
        var preUnlockTpl = progElForTpl ? (progElForTpl.getAttribute('data-pre-unlock') || '') : '';
        var unlockedTpl = progElForTpl ? (progElForTpl.getAttribute('data-unlocked') || '') : '';
        if (allReached) {
          if (unlockedTpl) {
            msgEl.innerHTML = unlockedTpl
              .replace(/\{\{amount\}\}/g, '<strong>0</strong>')
              .replace(/\{\{tierName\}\}/g, '<strong>' + (lastTier.label || '') + '</strong>');
          } else {
            msgEl.innerHTML = ALL_REWARDS_TEXT;
          }
          msgEl.classList.add('ccd-progress__message--done');
        } else {
          var nextTier = null;
          for (var ti = 0; ti < tiers.length; ti++) { if (currentValue < tiers[ti].goal) { nextTier = tiers[ti]; break; } }
          var tierRem = nextTier ? Math.max(0, nextTier.goal - currentValue) : overallRemaining;
          var unit = THRESHOLD_MODE === 'dollars' ? '$' + tierRem.toFixed(0) : tierRem;
          if (preUnlockTpl) {
            msgEl.innerHTML = preUnlockTpl
              .replace(/\{\{amount\}\}/g, '<strong>' + unit + '</strong>')
              .replace(/\{\{tierName\}\}/g, '<strong>' + (nextTier && nextTier.label ? nextTier.label : '') + '</strong>');
          } else if (nextTier && nextTier.beforeText) {
            msgEl.innerHTML = nextTier.beforeText.replace('{remaining}', '<strong>' + unit + '</strong>');
          } else {
            msgEl.innerHTML = 'Add <strong>' + overallRemaining + '</strong> more for <strong>FREE</strong>';
          }
          msgEl.classList.remove('ccd-progress__message--done');
        }
      }

      // Update each milestone (supports both legacy and dynamic class names)
      tiers.forEach(function(tier, idx) {
        var tierReached = currentValue >= tier.goal;
        var ms = document.querySelector('.ccd-progress__milestone--tier-' + idx);
        var line = document.querySelector('.ccd-progress__line--tier-' + idx);
        if (!ms && idx === 0) ms = document.querySelector('.ccd-progress__milestone--shipping');
        if (!ms && idx === 1) ms = document.querySelector('.ccd-progress__milestone--promo');
        if (!line && idx === 0) line = document.querySelector('.ccd-progress__line--first');
        if (!line && idx === 1) line = document.querySelector('.ccd-progress__line--second');

        if (ms) {
          var icon = ms.querySelector('.ccd-progress__icon');
          if (tierReached) {
            ms.classList.add('ccd-progress__milestone--reached');
            if (icon) icon.classList.add('ccd-progress__icon--reached');
            if (line) { line.classList.add('ccd-progress__line--filled'); line.classList.remove('ccd-progress__line--half'); }
          } else {
            ms.classList.remove('ccd-progress__milestone--reached');
            if (icon) icon.classList.remove('ccd-progress__icon--reached');
            if (line) {
              line.classList.remove('ccd-progress__line--filled');
              var tierRem2 = tier.goal - currentValue;
              if (tierRem2 === 1 && THRESHOLD_MODE === 'items') { line.classList.add('ccd-progress__line--half'); }
              else { line.classList.remove('ccd-progress__line--half'); }
            }
          }
        }
      });

      // Remove instant class after a frame so future changes animate normally
      if (skipAnim && progressWrap) {
        requestAnimationFrame(function() { progressWrap.classList.remove('ccd-progress--instant'); });
      }

      // Sync all milestone animations to same cycle (skip on reopen to avoid blink)
      if (!skipAnim) {
        var reachedEls = document.querySelectorAll('.ccd-progress__icon--reached');
        if (reachedEls.length > 0) {
          var animName = 'none';
          if (MILESTONE_ANIMATION) {
            if (MILESTONE_ANIM_TYPE === 'pulse') animName = 'ccdMilestonePulse 1.8s ease-in-out infinite';
            else if (MILESTONE_ANIM_TYPE === 'bounce') animName = 'ccdMilestoneBounce 1.6s ease-in-out infinite';
            else if (MILESTONE_ANIM_TYPE === 'heartbeat') animName = 'ccdMilestoneHeartbeat 1.8s ease-in-out infinite';
            else if (MILESTONE_ANIM_TYPE === 'shake') animName = 'ccdMilestoneShake 1.5s ease-in-out infinite';
          }
          reachedEls.forEach(function(el) { el.style.animation = 'none'; });
          void document.body.offsetHeight;
          reachedEls.forEach(function(el) { el.style.animation = animName; });
        }
      }
    },

    // Optimistic progress update: adjust count by delta without waiting for API
    updateProgressOptimistic: function(delta) {
      var a = document.querySelector('[data-real-count]');
      if (!a) return;
      var rc = parseInt(a.getAttribute('data-real-count') || '0') + delta;
      if (rc < 0) rc = 0;
      a.setAttribute('data-real-count', rc);
      // Build a minimal fake cart object for updateProgress
      CCD.updateProgress({ items: [], _optimisticCount: rc });
    },

    refreshOnOpen: function() {
      // Skip if response handler already provided fresh cart data (no redundant fetch)
      if (CCD._skipRefreshOnOpen) {
        CCD._skipRefreshOnOpen = false;
        CCD.hideLoading();
        return;
      }
      var self = this;
      this.loadExperiment(function(config) {
        if (config) {
          self.applyExperimentFeatures(config);
          if (config.editorOverrides) self.applyEditorOverrides(config.editorOverrides);
          // Merge backend addon config into CFG so all stores get the right settings
          // (not just stores using Liquid theme settings)
          if (config.cartConfig && config.cartConfig.addons) {
            var sp = config.cartConfig.addons.shippingProtection;
            if (sp && sp.config) {
              if ('defaultOn' in sp.config) CFG.protectionDefaultOn = sp.config.defaultOn;
              if ('price' in sp.config) CFG.protectionPrice = Math.round((parseFloat(sp.config.price) || 0) * 100) || 499;
            }
            // ── Merge reward tiers from backend config ──
            CCD._mergeTiersFromConfig(config);
          }
          // ── Apply desktop width from backend config ──
          if (config.cartConfig && config.cartConfig.desktopWidth) {
            var dw = parseInt(config.cartConfig.desktopWidth);
            if (dw > 0 && !isNaN(dw)) {
              document.documentElement.style.setProperty('--ccd-desktop-width', dw + 'px');
            }
          }
          // ── Apply mobile width from backend config ──
          if (config.cartConfig && config.cartConfig.mobileWidth) {
            var mw = parseInt(config.cartConfig.mobileWidth);
            if (mw >= 70 && mw <= 100 && !isNaN(mw)) {
              document.documentElement.style.setProperty('--ccd-mobile-width', mw + '%');
            }
          }
        }
        // Track CART_OPENED on first actual cart open (not on pre-fetch)
        if (!self._cartOpenTracked) {
          self._cartOpenTracked = true;
          self.sendEvent('CART_OPENED', { source: 'client-open' });
        }
        // BUG-3: Show loading during initial cart fetch
        if (CCD._lastRealCount > 0) CCD.showLoading();
        // Single cart fetch — no race between ensureProtection and refresh
        fetch('/cart.js')
        .then(function(r) { return r.json(); })
        .then(function(cart) {
          var rc = CCD.getRealCount(cart); CCD._lastRealCount = rc;
          // Add protection if needed (inline instead of separate ensureProtection to avoid double fetch)
          var shouldAutoAdd = PROT_ENABLED && PROT_VID && CFG.protectionDefaultOn !== false && CFG.protectionAutoAdd !== false;
          var hasProt = cart.items.some(function(i) { return i.handle === PROT; });
          if (!toggling && !_userToggledOff && shouldAutoAdd && rc > 0 && !hasProt) {
            // Protection should be in cart but isn't — add via /cart/update.js (single round-trip, no flash)
            protectionDone = true;
            CCD.setToggleNoTransition(true);
            var _oF = CCD._origFetch || fetch;
            var updObj = {};
            updObj[(getProtTier(CCD.getAdjustedTotal(cart)) || {vid:PROT_VID}).vid] = 1;
            _oF('/cart/update.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ updates: updObj })
            })
            .then(function(r2) { return r2.json(); })
            .then(function(updatedCart) { CCD.refresh(updatedCart); })
            .catch(function() { CCD.refresh(cart); });
          } else {
            if (shouldAutoAdd && hasProt) protectionDone = true;
            CCD.refresh(cart);
          }
        })
        .catch(function() {});
      });
      CCD.fixMobileWidth();
    },

    setupScrollIndicator: function() {
      var scrollable = document.querySelector('#CCD-Drawer .ccd-scrollable');
      var inner = document.querySelector('#CCD-Drawer .ccd-inner');
      if (scrollable && inner && !scrollable._ccdScrollBound) {
        scrollable._ccdScrollBound = true;
        scrollable.addEventListener('scroll', function() {
          var atBottom = scrollable.scrollHeight - scrollable.scrollTop - scrollable.clientHeight < 8;
          inner.classList.toggle('scrolled-bottom', atBottom);
        });
      }
    },

    checkOverflow: function() {
      var scrollable = document.querySelector('#CCD-Drawer .ccd-scrollable');
      var inner = document.querySelector('#CCD-Drawer .ccd-inner');
      if (scrollable && inner) {
        var hasOverflow = scrollable.scrollHeight > scrollable.clientHeight + 8;
        inner.classList.toggle('has-overflow', hasOverflow);
      }
    },

    fmt: function(cents) {
      var c = parseInt(cents, 10);
      if (isNaN(c) || c < 0) c = 0;
      return String.fromCharCode(36) + (c / 100).toFixed(2);
    },

    /* ── Experiment-aware config loading ── */

    getSessionToken: function() {
      var STORAGE_KEY = 'ecart_session';
      var VISIT_KEY = 'ecart_visits';
      var token = null;
      try { token = sessionStorage.getItem(STORAGE_KEY); } catch(e) {}
      if (token) {
        var vc = 1;
        try { vc = parseInt(localStorage.getItem(VISIT_KEY)) || 1; } catch(e) {}
        return { token: token, isReturning: false, visitCount: vc, hasCustomerId: this._detectCustomerId() };
      }
      var isReturning = false;
      var visitCount = 1;
      try {
        var prev = localStorage.getItem(STORAGE_KEY);
        if (prev) {
          isReturning = true;
          token = prev; // Reuse localStorage token — same browser = same session across tabs
        }
        var vc = parseInt(localStorage.getItem(VISIT_KEY)) || 0;
        visitCount = vc + 1;
        localStorage.setItem(VISIT_KEY, String(visitCount));
      } catch(e) {}
      if (!token) {
        token = 'ecart_' + Math.random().toString(36).substr(2) + Date.now().toString(36);
      }
      try {
        sessionStorage.setItem(STORAGE_KEY, token);
        localStorage.setItem(STORAGE_KEY, token);
      } catch(e) {}
      return { token: token, isReturning: isReturning, visitCount: visitCount, hasCustomerId: this._detectCustomerId() };
    },

    _detectCustomerId: function() {
      try {
        if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.page && window.ShopifyAnalytics.meta.page.customerId) return true;
        if (window.__st && window.__st.cid) return true;
      } catch(e) {}
      return false;
    },

    getDeviceType: function() {
      var w = window.innerWidth;
      if (w < 768) return 'MOBILE';
      if (w < 1024) return 'TABLET';
      return 'DESKTOP';
    },

    loadExperiment: function(callback, prefetch) {
      var cached = null;
      try {
        var raw = sessionStorage.getItem('ecart_config');
        if (raw) {
          var parsed = JSON.parse(raw);
          // Cache expires after 5 minutes so dashboard changes propagate quickly
          if (parsed._ts && Date.now() - parsed._ts < 5 * 60 * 1000) {
            cached = parsed;
          } else {
            sessionStorage.removeItem('ecart_config');
          }
        }
      } catch(e) {}

      var sess = this.getSessionToken();
      var self = this;

      if (cached) {
        callback(cached);
        // Always re-stamp cart attributes (cart may have been cleared at checkout)
        self.writeCartAttributes(sess.token, cached);
        return;
      }

      fetch('/apps/eliminai-cart/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken: sess.token,
          deviceType: self.getDeviceType(),
          isReturning: sess.isReturning,
          visitCount: sess.visitCount,
          hasCustomerId: sess.hasCustomerId,
          referralSource: document.referrer || 'direct',
          country: window.Shopify && window.Shopify.country ? window.Shopify.country : null,
          themeId: window.Shopify && window.Shopify.theme ? window.Shopify.theme.id : null,
          prefetch: !!prefetch
        })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        try { data._ts = Date.now(); sessionStorage.setItem('ecart_config', JSON.stringify(data)); } catch(e) {}
        callback(data);
        self.writeCartAttributes(sess.token, data);
      })
      .catch(function(err) {
        callback(null);
      });
    },

    writeCartAttributes: function(sessionToken, config) {
      if (!config || !config.experiment) return;
      fetch('/cart/update.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attributes: {
            _eliminai_session: sessionToken,
            _eliminai_variant: config.experiment.variant,
            _eliminai_experiment: config.experiment.id
          }
        })
      }).catch(function() {});
    },

    sendEvent: function(eventType, metadata) {
      var cached = null;
      try { cached = JSON.parse(sessionStorage.getItem('ecart_config')); } catch(e) {}
      var sess = this.getSessionToken();
      var now = new Date();

      var payload = JSON.stringify({
        sessionToken: sess.token,
        experimentId: cached && cached.experiment ? cached.experiment.id : null,
        variantId: cached && cached.experiment ? cached.experiment.variant : null,
        eventType: eventType,
        hasCustomerId: sess.hasCustomerId,
        hourOfDay: now.getHours(),
        dayOfWeek: now.getDay(),
        metadata: metadata || {}
      });

      // Use sendBeacon for CHECKOUT_CLICKED — page navigates away before fetch completes
      if (eventType === 'CHECKOUT_CLICKED' && navigator.sendBeacon) {
        navigator.sendBeacon('/apps/eliminai-cart/event', new Blob([payload], { type: 'application/json' }));
      } else {
        fetch('/apps/eliminai-cart/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload
        }).catch(function() {});
      }
    },

    // Addon key → inject/remove handlers. Add new addons here — everything else is automatic.
    _addonHandlers: {
      trustBadges:          { inject: function(c) { CCD.injectTrustBadges(c); },    remove: function() { var e = document.getElementById('ccd-trust-badges'); if (e) e.remove(); } },
      scarcityTimer:        { inject: function(c) { CCD.injectScarcityTimer(c); },  remove: function() { if (CCD._scarcityTick) { clearInterval(CCD._scarcityTick); CCD._scarcityTick = null; } var e = document.getElementById('ccd-scarcity-timer'); if (e) e.remove(); try { sessionStorage.removeItem(CCD._SCARCITY_STORAGE_KEY); } catch (err) {} } },
      freeShippingBar:      { inject: function(c) { CCD.injectFreeShippingBar(c); },remove: function() { var e = document.getElementById('ccd-free-shipping-bar'); if (e) e.remove(); } },
      socialProof:          { inject: function(c) { CCD.injectSocialProof(c); },    remove: function() { var e = document.getElementById('ccd-social-proof'); if (e) e.remove(); } },
      upsellRecommendations:{ inject: function(c) { CCD.injectUpsells(c); },        remove: function() { var e = document.getElementById('ccd-upsells'); if (e) e.remove(); } },
      notes:                { inject: function(c) { CCD.injectNotes(c); },          remove: function() { var e = document.getElementById('ccd-notes-row'); if (e) e.remove(); } },
      customCode:           { inject: function(c) { CCD.injectCustomCode(c); },     remove: function() { var ns = document.querySelectorAll('.ccd-custom-code'); for (var i=0;i<ns.length;i++) ns[i].remove(); } },
      discountCode:         { inject: function(c) { CCD.injectDiscountCode(c); },   remove: function() { var e = document.getElementById('ccd-discount-code-row'); if (e) e.remove(); } },
      termsCheckbox:        { inject: function(c) { CCD.injectTermsCheckbox(c); },  remove: function() { var e = document.getElementById('ccd-terms-row'); if (e) e.remove(); CCD._termsBlock = null; } },
      expressPayments:      { inject: function(c) { CCD.injectExpressPayments(c); },remove: function() { var h = document.getElementById('ccd-native-express-host'); if (h) { h.hidden = true; h.setAttribute('aria-hidden', 'true'); h.style.display = 'none'; document.body.appendChild(h); } var e = document.getElementById('ccd-express-payments'); if (e) e.remove(); } }
    },

    applyExperimentFeatures: function(config) {
      if (!config) return;
      var addons = config.cartConfig && config.cartConfig.addons ? config.cartConfig.addons : {};
      var self = this;
      var show = {};

      // 1. Always-on addons (enabled + NOT being A/B tested)
      for (var k in addons) {
        if (addons[k] && addons[k].enabled && addons[k].mode !== 'auto-optimize') {
          show[k] = addons[k].config || {};
        }
      }

      // 2. A/B tested addons (mode === 'auto-optimize') — show ONLY if experiment says _enabled: true
      if (config.experiment && config.experiment.features) {
        var feat = config.experiment.features;
        for (var ak in addons) {
          if (addons[ak] && addons[ak].mode === 'auto-optimize') {
            if (feat._enabled) { show[ak] = addons[ak].config || {}; }
            else { delete show[ak]; }
          }
        }
        // Legacy feature flags — only set if NOT already populated by addons config
        if (feat.showTrustBadges && !show.trustBadges) show.trustBadges = {};
        if (feat.showScarcityTimer && !show.scarcityTimer) show.scarcityTimer = {};
        if (feat.showProgressBar && !show.freeShippingBar) show.freeShippingBar = {};
        if (feat.showUpsells && !show.upsellRecommendations) show.upsellRecommendations = {};
        if (feat.showSocialProof && !show.socialProof) show.socialProof = {};
      }

      // 3. Inject shown addons, remove hidden ones
      for (var hk in self._addonHandlers) {
        if (show[hk]) { self._addonHandlers[hk].inject(show[hk]); }
        else { self._addonHandlers[hk].remove(); }
      }

      // Remember scarcity-timer resolved config so cart-state changes can re-inject
      // it when the cart goes from empty → has-items, or remove it when emptied.
      // null = scarcity addon is OFF for this tenant; falsy here means don't re-inject.
      CCD._scarcityCfg = show.scarcityTimer || null;
      // Same pattern for the Upsell Recommendations addon so refreshLight can sync
      // "You may also like" with cart state (remove on empty, re-inject when items return).
      CCD._upsellsCfg = show.upsellRecommendations || null;
    },

    // ──────────────────────────────────────────────────────────────────
    // Cart Editor — editorOverrides fallback reads (chunk 4.5)
    // Applies per-element styling/text overrides AFTER the drawer is built.
    // All reads are guarded: every field has a fallback to the current CFG/default.
    // Stashes the full overrides object on CCD._EO so other addons (notes, terms,
    // milestoneBar position, etc.) can read shared visual contracts.
    // ──────────────────────────────────────────────────────────────────
    applyEditorOverrides: function(eo) {
      if (!eo || typeof eo !== 'object') return;
      CCD._EO = eo;
      var drawer = document.getElementById('CCD-Drawer');
      if (!drawer) return;

      // ── Checkout-button icon helpers (mirror src/lib/cart-editor/defaults.ts ──
      //    so the dashboard preview and this live drawer render byte-identical icons).
      var CCD_ICON_PATHS = {
        lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
        arrow: 'M16.01 11H4v2h12.01v3L20 12l-3.99-4z',
        cart: 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z'
      };
      var CCD_RADIUS_PX = { sharp: '0', soft: '8px', rounded: '14px', pill: '999px' };
      var CCD_HEIGHT_PAD = { S: '10px 24px', M: '14px 24px', L: '18px 24px', XL: '22px 24px' };
      var CCD_HEADER_PADDING = { compact: '12px 20px 6px', comfortable: '20px 20px 8px', roomy: '28px 20px 12px' };
      var CCD_HEADER_MIN_HEIGHT = { slim: 'auto', tall: '72px' };
      var CCD_CLOSE_ICON_SIZE = { S: '18px', M: '22px', L: '28px' };
      var CCD_CLOSE_ICON_SVG = {
        x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
        chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"></polyline></svg>',
        arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>'
      };
      function ccdSanitizeSvg(raw) {
        if (typeof raw !== 'string') return '';
        var s = raw.trim();
        if (!/^<svg[\s>]/i.test(s)) return '';
        s = s.replace(/<script[\s\S]*?<\/script\s*>/gi, '');
        s = s.replace(/<\/?script[^>]*>/gi, '');
        s = s.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
        s = s.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
        s = s.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');
        s = s.replace(/javascript:/gi, '');
        return s;
      }
      function ccdRenderIcon(icon, iconCustom) {
        if (icon === 'none') return '';
        if (iconCustom) {
          var clean = ccdSanitizeSvg(iconCustom);
          if (clean) return clean;
        }
        var key = icon || 'lock';
        var path = CCD_ICON_PATHS[key];
        if (!path) return '';
        return '<svg viewBox="0 0 24 24"><path d="' + path + '"></path></svg>';
      }

      // ── HEADER ──
      if (eo.header && typeof eo.header === 'object') {
        var h = eo.header;
        var headerEl = drawer.querySelector('.ccd-header');
        var titleEl = drawer.querySelector('.ccd-title');

        if (titleEl) {
          // Title text — supports {{cart_quantity}} token
          if (typeof h.title === 'string') {
            var qty = (CCD._lastCart && CCD._lastCart.item_count) || 0;
            titleEl.textContent = h.title.replace(/\{\{cart_quantity\}\}/g, String(qty));
          }
          // Alignment: 'center' or 'side' (left)
          if (h.titleAlignment === 'center') titleEl.style.textAlign = 'center';
          else if (h.titleAlignment === 'side') titleEl.style.textAlign = 'left';
          // Title font size (14-48px)
          if (typeof h.titleFontSize === 'number') titleEl.style.fontSize = h.titleFontSize + 'px';
          // Title font weight
          if (h.titleFontWeight === 'normal') titleEl.style.fontWeight = '400';
          else if (h.titleFontWeight === 'semibold') titleEl.style.fontWeight = '600';
          else if (h.titleFontWeight === 'bold') titleEl.style.fontWeight = '700';
          // Title color
          if (typeof h.titleColor === 'string') titleEl.style.color = h.titleColor;
          // Heading level swap (h2 ↔ h3 ↔ h4)
          if (h.headingLevel && /^h[234]$/.test(h.headingLevel) && h.headingLevel !== titleEl.tagName.toLowerCase()) {
            var newEl = document.createElement(h.headingLevel);
            newEl.className = titleEl.className;
            newEl.textContent = titleEl.textContent;
            newEl.style.cssText = titleEl.style.cssText;
            titleEl.parentNode.replaceChild(newEl, titleEl);
          }
        }

        if (headerEl) {
          if (typeof h.bgColor === 'string') headerEl.style.backgroundColor = h.bgColor;
          // Padding applied inline (no modifier CSS exists)
          if (h.padding && CCD_HEADER_PADDING[h.padding]) {
            headerEl.style.padding = CCD_HEADER_PADDING[h.padding];
          }
          // Height preset → min-height (slim = auto, tall = taller header)
          if (h.heightPreset && CCD_HEADER_MIN_HEIGHT[h.heightPreset]) {
            headerEl.style.minHeight = CCD_HEADER_MIN_HEIGHT[h.heightPreset];
          }
          // Border style: none / line (1px bottom in title color) / shadow
          if (h.borderStyle === 'none') {
            headerEl.style.borderBottom = 'none';
            headerEl.style.boxShadow = 'none';
          } else if (h.borderStyle === 'line') {
            headerEl.style.borderBottom = '1px solid ' + (h.titleColor || '#111111');
            headerEl.style.boxShadow = 'none';
          } else if (h.borderStyle === 'shadow') {
            headerEl.style.borderBottom = 'none';
            headerEl.style.boxShadow = '0 2px 8px rgba(0,0,0,.08)';
          }
        }

        // ── ITEM-COUNT BADGE ── small pill next to the title
        if (titleEl) {
          var badgeEl = drawer.querySelector('.ccd-title-badge');
          if (h.showItemCountBadge === true) {
            if (!badgeEl) {
              badgeEl = document.createElement('span');
              badgeEl.className = 'ccd-title-badge';
              titleEl.parentNode.insertBefore(badgeEl, titleEl.nextSibling);
            }
            var bqty = (CCD._lastCart && CCD._lastCart.item_count) || 0;
            badgeEl.textContent = String(bqty);
            if (typeof h.badgeColor === 'string') badgeEl.style.backgroundColor = h.badgeColor;
            badgeEl.style.display = '';
          } else if (badgeEl) {
            badgeEl.style.display = 'none';
          }
        }

        // ── CLOSE BUTTON ──
        if (h.closeButton && typeof h.closeButton === 'object') {
          var cb = h.closeButton;
          var btn = drawer.querySelector('.ccd-close-btn');
          if (btn) {
            // Swap the close icon (x / chevron / arrow) before styling the svg
            if (h.closeIcon === 'x' || h.closeIcon === 'chevron' || h.closeIcon === 'arrow') {
              btn.innerHTML = CCD_CLOSE_ICON_SVG[h.closeIcon];
            }
            if (typeof cb.bgColor === 'string') {
              btn.style.setProperty('--ccd-cb-bg', cb.bgColor);
              btn.style.backgroundColor = cb.bgColor;
            }
            if (typeof cb.bgHoverColor === 'string') {
              btn.style.setProperty('--ccd-cb-bg-hover', cb.bgHoverColor);
            }
            if (typeof cb.iconColor === 'string') btn.style.color = cb.iconColor;
            // Icon size applied inline (no modifier CSS exists)
            var svg = btn.querySelector('svg');
            if (svg && cb.iconSize && CCD_CLOSE_ICON_SIZE[cb.iconSize]) {
              svg.style.width = CCD_CLOSE_ICON_SIZE[cb.iconSize];
              svg.style.height = CCD_CLOSE_ICON_SIZE[cb.iconSize];
            }
            // Stroke weight on the SVG (normal=2, thick=3)
            if (svg) {
              if (cb.strokeWeight === 'thick') svg.setAttribute('stroke-width', '3');
              else if (cb.strokeWeight === 'normal') svg.setAttribute('stroke-width', '2');
            }
            // Border style + color
            if (cb.border === 'none') {
              btn.style.border = 'none';
            } else if (cb.border === 'thin' || cb.border === 'normal' || cb.border === 'thick') {
              var bw = (cb.border === 'thin') ? '1px' : (cb.border === 'thick' ? '3px' : '2px');
              btn.style.border = bw + ' solid ' + (cb.borderColor || 'currentColor');
            }
            if (typeof cb.borderColor === 'string') btn.style.setProperty('--ccd-cb-border', cb.borderColor);
            if (typeof cb.borderHoverColor === 'string') btn.style.setProperty('--ccd-cb-border-hover', cb.borderHoverColor);
          }
        }
      }

      // ── LINE ITEM ──
      // Line items are re-rendered on every cart refresh, so per-element styling
      // is applied via CSS custom properties on the drawer + modifier classes on
      // the .ccd-items wrapper. Both inherit through every future re-render.
      if (eo.lineItem && typeof eo.lineItem === 'object') {
        var li = eo.lineItem;
        var itemsEl = drawer.querySelector('.ccd-items') || drawer;

        // Image size (S/M/L → 80/120/160 px) — CSS var read by .ccd-item__image
        if (li.imageSize === 'S') drawer.style.setProperty('--ccd-li-img-size', '80px');
        else if (li.imageSize === 'M') drawer.style.setProperty('--ccd-li-img-size', '120px');
        else if (li.imageSize === 'L') drawer.style.setProperty('--ccd-li-img-size', '160px');

        // Image shape (square / rounded / circle) → border-radius via CSS var
        if (li.imageShape === 'square') drawer.style.setProperty('--ccd-li-img-radius', '0');
        else if (li.imageShape === 'rounded') drawer.style.setProperty('--ccd-li-img-radius', '8px');
        else if (li.imageShape === 'circle') drawer.style.setProperty('--ccd-li-img-radius', '50%');

        // Show/hide variant text + SKU text (boolean) — class on the wrapper
        if (li.showVariant === false) itemsEl.classList.add('ccd-items--no-variant');
        else if (li.showVariant === true) itemsEl.classList.remove('ccd-items--no-variant');
        if (li.showSku === false) itemsEl.classList.add('ccd-items--no-sku');
        else if (li.showSku === true) itemsEl.classList.remove('ccd-items--no-sku');

        // Qty control modifier (minusPlus / stepper / dropdown)
        itemsEl.classList.remove('ccd-items--qty-minusPlus', 'ccd-items--qty-stepper', 'ccd-items--qty-dropdown');
        if (li.qtyControl === 'minusPlus' || li.qtyControl === 'stepper' || li.qtyControl === 'dropdown') {
          itemsEl.classList.add('ccd-items--qty-' + li.qtyControl);
        }

        // Remove style modifier (x / trash / text)
        itemsEl.classList.remove('ccd-items--rm-x', 'ccd-items--rm-trash', 'ccd-items--rm-text');
        if (li.removeStyle === 'x' || li.removeStyle === 'trash' || li.removeStyle === 'text') {
          itemsEl.classList.add('ccd-items--rm-' + li.removeStyle);
        }

        // Compare-at price + savings badge visibility
        if (li.showCompareAtPrice === false) itemsEl.classList.add('ccd-items--no-compare');
        else if (li.showCompareAtPrice === true) itemsEl.classList.remove('ccd-items--no-compare');
        if (li.showSavingsBadge === false) itemsEl.classList.add('ccd-items--no-savings');
        else if (li.showSavingsBadge === true) itemsEl.classList.remove('ccd-items--no-savings');

        // Separator style (line / spacing / card)
        itemsEl.classList.remove('ccd-items--sep-line', 'ccd-items--sep-spacing', 'ccd-items--sep-card');
        if (li.separator === 'line' || li.separator === 'spacing' || li.separator === 'card') {
          itemsEl.classList.add('ccd-items--sep-' + li.separator);
        }

        // Title size + weight → CSS vars (read by .ccd-item__name)
        if (typeof li.titleSize === 'number') drawer.style.setProperty('--ccd-li-title-size', li.titleSize + 'px');
        if (typeof li.titleWeight === 'number') drawer.style.setProperty('--ccd-li-title-weight', String(li.titleWeight));
      }

      // ── EMPTY STATE ──
      // The .ccd-cart-empty block exists in the drawer at all times — visibility
      // toggles based on cart.item_count === 0. Overrides update text/CTA/icon.
      if (eo.emptyState && typeof eo.emptyState === 'object') {
        var es = eo.emptyState;
        var emptyEl = drawer.querySelector('.ccd-cart-empty');
        if (emptyEl) {
          // Heading text (the main "Your cart is empty" paragraph)
          if (typeof es.heading === 'string') {
            var headingEl = emptyEl.querySelector('p');
            if (headingEl) headingEl.textContent = es.heading;
          }
          // Subtext — create or update a secondary paragraph below the heading
          if (typeof es.subtext === 'string') {
            var subEl = emptyEl.querySelector('.ccd-cart-empty__subtext');
            if (!subEl) {
              subEl = document.createElement('p');
              subEl.className = 'ccd-cart-empty__subtext';
              var p = emptyEl.querySelector('p');
              if (p && p.nextSibling) p.parentNode.insertBefore(subEl, p.nextSibling);
              else emptyEl.appendChild(subEl);
            }
            subEl.textContent = es.subtext;
          }
          // Icon — applied as data-icon attribute for CSS to swap (safe: no DOM injection)
          if (typeof es.icon === 'string') emptyEl.setAttribute('data-icon', es.icon);
          // CTA label
          var ctaBtn = emptyEl.querySelector('.ccd-continue-btn');
          if (ctaBtn) {
            if (typeof es.ctaLabel === 'string') ctaBtn.textContent = es.ctaLabel;
            // CTA link — navigate instead of just closing the drawer
            if (typeof es.ctaLink === 'string' && (es.ctaLink === '/' || /^\/[^/]/.test(es.ctaLink) || /^https:\/\//.test(es.ctaLink))) {
              var safeLink = es.ctaLink;
              ctaBtn.onclick = function() { window.location.href = safeLink; };
            }
            // Inherits checkout-button visual style — toggle modifier class
            if (es.ctaInheritsCheckoutStyle === true) ctaBtn.classList.add('ccd-continue-btn--checkout-style');
            else if (es.ctaInheritsCheckoutStyle === false) ctaBtn.classList.remove('ccd-continue-btn--checkout-style');
          }
        }
      }

      // ── FOOTER ──
      // .ccd-sticky-footer is the bottom block containing protection, discount
      // badges, the checkout button, and the trust line. Visibility toggles are
      // applied via classes; values use CSS custom properties.
      if (eo.footer && typeof eo.footer === 'object') {
        var ft = eo.footer;
        var footEl = drawer.querySelector('.ccd-sticky-footer');
        if (footEl) {
          // Visibility booleans — modifier classes the CSS uses to hide sub-elements
          if (ft.showSubtotal === false) footEl.classList.add('ccd-footer--no-subtotal');
          else if (ft.showSubtotal === true) footEl.classList.remove('ccd-footer--no-subtotal');
          if (ft.showShippingNote === false) footEl.classList.add('ccd-footer--no-shipping-note');
          else if (ft.showShippingNote === true) footEl.classList.remove('ccd-footer--no-shipping-note');
          if (ft.showTaxNote === false) footEl.classList.add('ccd-footer--no-tax-note');
          else if (ft.showTaxNote === true) footEl.classList.remove('ccd-footer--no-tax-note');
          if (ft.showYouSaved === false) footEl.classList.add('ccd-footer--no-you-saved');
          else if (ft.showYouSaved === true) footEl.classList.remove('ccd-footer--no-you-saved');
          if (ft.showCrossedOutSubtotal === false) footEl.classList.add('ccd-footer--no-crossed');
          else if (ft.showCrossedOutSubtotal === true) footEl.classList.remove('ccd-footer--no-crossed');
          if (ft.showGiftNote === false) footEl.classList.add('ccd-footer--no-gift-note');
          else if (ft.showGiftNote === true) footEl.classList.remove('ccd-footer--no-gift-note');

          // totalOutsideButton — when true, move total label out of the button
          if (ft.totalOutsideButton === true) footEl.classList.add('ccd-footer--total-outside');
          else if (ft.totalOutsideButton === false) footEl.classList.remove('ccd-footer--total-outside');

          // totalLabel — updates the existing total label text (XSS-safe)
          if (typeof ft.totalLabel === 'string') {
            var labelEl = footEl.querySelector('.ccd-checkout-total-label');
            if (labelEl) labelEl.textContent = ft.totalLabel;
            else footEl.setAttribute('data-total-label', ft.totalLabel);
          }

          // totalSize + totalWeight → CSS custom properties (read by .ccd-checkout-total)
          if (typeof ft.totalSize === 'number') drawer.style.setProperty('--ccd-footer-total-size', ft.totalSize + 'px');
          if (typeof ft.totalWeight === 'number') drawer.style.setProperty('--ccd-footer-total-weight', String(ft.totalWeight));

          // bgStyle modifier (transparent / surface / accent)
          footEl.classList.remove('ccd-footer--bg-transparent', 'ccd-footer--bg-surface', 'ccd-footer--bg-accent');
          if (ft.bgStyle === 'transparent' || ft.bgStyle === 'surface' || ft.bgStyle === 'accent') {
            footEl.classList.add('ccd-footer--bg-' + ft.bgStyle);
          }

          // borderTop modifier (none / line / shadow)
          footEl.classList.remove('ccd-footer--border-none', 'ccd-footer--border-line', 'ccd-footer--border-shadow');
          if (ft.borderTop === 'none' || ft.borderTop === 'line' || ft.borderTop === 'shadow') {
            footEl.classList.add('ccd-footer--border-' + ft.borderTop);
          }

          // stickyFooter — toggle position:sticky vs static
          if (ft.stickyFooter === false) footEl.classList.add('ccd-footer--not-sticky');
          else if (ft.stickyFooter === true) footEl.classList.remove('ccd-footer--not-sticky');
        }
      }

      // ----- editorOverrides.checkoutButton -----
      if (eo.checkoutButton && typeof eo.checkoutButton === 'object') {
        var cbtn = eo.checkoutButton;
        var btnEl = drawer.querySelector('.ccd-checkout-btn');
        if (btnEl) {
          // label — XSS-safe textContent on the button's TEXT node. firstChild is
          // the SVG element, so walk childNodes to find the first text node
          // (nodeType 3) and preserve the trailing .ccd-checkout-total span.
          if (typeof cbtn.label === 'string') {
            var tn = null;
            for (var ci = 0; ci < btnEl.childNodes.length; ci++) {
              if (btnEl.childNodes[ci].nodeType === 3) { tn = btnEl.childNodes[ci]; break; }
            }
            if (tn) {
              tn.textContent = ' ' + cbtn.label + ' · ';
            } else {
              btnEl.insertBefore(document.createTextNode(' ' + cbtn.label + ' · '), btnEl.firstChild);
            }
          }
          // colors
          if (typeof cbtn.bgColor === 'string') {
            btnEl.style.backgroundColor = cbtn.bgColor;
            btnEl.style.setProperty('--ccd-co-bg', cbtn.bgColor);
          }
          if (typeof cbtn.bgHoverColor === 'string') {
            btnEl.style.setProperty('--ccd-co-bg-hover', cbtn.bgHoverColor);
          }
          if (typeof cbtn.textColor === 'string') {
            btnEl.style.color = cbtn.textColor;
          }
          // radius enum -> inline border-radius (v14 ships no modifier-class CSS)
          if (cbtn.radius && CCD_RADIUS_PX[cbtn.radius]) {
            btnEl.style.borderRadius = CCD_RADIUS_PX[cbtn.radius];
          }
          // height enum -> inline padding (v14 ships no modifier-class CSS)
          if (cbtn.height && CCD_HEIGHT_PAD[cbtn.height]) {
            btnEl.style.padding = CCD_HEIGHT_PAD[cbtn.height];
          }
          // fontWeight (100-900)
          if (typeof cbtn.fontWeight === 'number') {
            btnEl.style.fontWeight = String(cbtn.fontWeight);
          }
          // letterSpacing
          if (typeof cbtn.letterSpacing === 'number') {
            btnEl.style.letterSpacing = cbtn.letterSpacing + 'px';
          }
          // icon — actually swap the SVG markup (data-icon had no CSS to swap it,
          // so it was a silent no-op). Fires when icon OR a custom svg is provided;
          // custom svg is sanitized by ccdRenderIcon before insertion.
          if (cbtn.icon !== undefined || cbtn.iconCustom !== undefined) {
            var oldSvg = btnEl.querySelector('svg');
            if (oldSvg && oldSvg.parentNode) oldSvg.parentNode.removeChild(oldSvg);
            var iconHtml = ccdRenderIcon(cbtn.icon, cbtn.iconCustom);
            if (iconHtml) btnEl.insertAdjacentHTML('afterbegin', iconHtml);
          }
          // fullWidth boolean -> modifier class
          if (cbtn.fullWidth === false) btnEl.classList.add('ccd-checkout-btn--auto-width');
          else if (cbtn.fullWidth === true) btnEl.classList.remove('ccd-checkout-btn--auto-width');
          // loadingAnim enum -> data attribute (CSS picks animation style)
          if (cbtn.loadingAnim === 'spinner' || cbtn.loadingAnim === 'dots' || cbtn.loadingAnim === 'shimmer') {
            btnEl.setAttribute('data-loading-anim', cbtn.loadingAnim);
          }
        }
      }

      // ----- editorOverrides.trustLine -----
      if (eo.trustLine && typeof eo.trustLine === 'object') {
        var tl = eo.trustLine;
        var trustEl = drawer.querySelector('.ccd-trust');
        if (trustEl) {
          if (typeof tl.text === 'string') {
            // Update text node only; preserve any child icons/badges
            var textNode = null;
            for (var i = 0; i < trustEl.childNodes.length; i++) {
              if (trustEl.childNodes[i].nodeType === 3 && trustEl.childNodes[i].textContent.trim()) {
                textNode = trustEl.childNodes[i];
                break;
              }
            }
            if (textNode) textNode.textContent = ' ' + tl.text + ' ';
            else trustEl.setAttribute('data-text', tl.text);
          }
          if (tl.showLockIcon === false) trustEl.classList.add('ccd-trust--no-lock');
          else if (tl.showLockIcon === true) trustEl.classList.remove('ccd-trust--no-lock');
          // position relative to checkout button
          if (tl.position === 'above') trustEl.setAttribute('data-position', 'above');
          else if (tl.position === 'below') trustEl.setAttribute('data-position', 'below');
          if (typeof tl.textSize === 'number') trustEl.style.fontSize = tl.textSize + 'px';
          if (typeof tl.textColor === 'string') trustEl.style.color = tl.textColor;
          // paymentIcons: { visa: true, mc: false, ... } -> data-pay-{provider} attrs
          if (tl.paymentIcons && typeof tl.paymentIcons === 'object') {
            for (var prov in tl.paymentIcons) {
              if (Object.prototype.hasOwnProperty.call(tl.paymentIcons, prov)) {
                if (/^[a-z0-9_-]{1,40}$/i.test(prov)) {
                  trustEl.setAttribute('data-pay-' + prov.toLowerCase(), tl.paymentIcons[prov] ? '1' : '0');
                }
              }
            }
          }
        }
      }

      // ----- editorOverrides.milestoneBar -----
      // Moves the .ccd-progress bar element to match the editor's position setting.
      // top/underHeader = its default home (inside .ccd-fixed-header, after the header);
      // aboveCheckout = insertBefore the sticky footer so it sits right above checkout.
      function CCD_relocateProgress(progEl, position, drawer) {
        if (!progEl) return;
        if (position === 'aboveCheckout') {
          var footer = drawer.querySelector('[data-ccd-footer]');
          if (footer && footer.parentNode && progEl !== footer.previousElementSibling) {
            footer.parentNode.insertBefore(progEl, footer);
          }
        } else {
          // top / underHeader → restore to default home inside the fixed header
          var fixedHeader = drawer.querySelector('.ccd-fixed-header');
          if (fixedHeader && progEl.parentNode !== fixedHeader) {
            fixedHeader.appendChild(progEl);
          }
        }
      }
      if (eo.milestoneBar && typeof eo.milestoneBar === 'object') {
        var mb = eo.milestoneBar;
        var progEl = drawer.querySelector('.ccd-progress');
        if (progEl) {
          // templates stored as data attrs; engine picks them up on next render
          if (typeof mb.preUnlockTemplate === 'string') progEl.setAttribute('data-pre-unlock', mb.preUnlockTemplate);
          if (typeof mb.unlockedTemplate === 'string') progEl.setAttribute('data-unlocked', mb.unlockedTemplate);
          if (mb.celebrationAnim === false) progEl.classList.add('ccd-progress--no-celebrate');
          else if (mb.celebrationAnim === true) progEl.classList.remove('ccd-progress--no-celebrate');
          if (typeof mb.fillColor === 'string') drawer.style.setProperty('--ccd-progress-fill', mb.fillColor);
          if (typeof mb.trackColor === 'string') drawer.style.setProperty('--ccd-progress-bg', mb.trackColor);
          if (typeof mb.height === 'number') drawer.style.setProperty('--ccd-progress-height', mb.height + 'px');
          if (mb.position === 'top' || mb.position === 'underHeader' || mb.position === 'aboveCheckout') {
            progEl.setAttribute('data-position', mb.position);
            CCD_relocateProgress(progEl, mb.position, drawer);
          }
          if (typeof mb.textSize === 'number') drawer.style.setProperty('--ccd-progress-text-size', mb.textSize + 'px');
          if (typeof mb.textWeight === 'number') drawer.style.setProperty('--ccd-progress-text-weight', String(mb.textWeight));
        }
      }

      // ----- editorOverrides.global -----
      if (eo.global && typeof eo.global === 'object') {
        var g = eo.global;
        if (g.side === 'left') drawer.classList.add('ccd-side-left');
        else if (g.side === 'right') drawer.classList.remove('ccd-side-left');
        if (typeof g.widthDesktop === 'number') drawer.style.setProperty('--ccd-desktop-width', g.widthDesktop + 'px');
        if (typeof g.widthMobilePct === 'number') drawer.style.setProperty('--ccd-mobile-width', g.widthMobilePct + '%');
        if (typeof g.backdropColor === 'string') drawer.style.setProperty('--ccd-backdrop-color', g.backdropColor);
        if (typeof g.backdropOpacity === 'number') drawer.style.setProperty('--ccd-backdrop-opacity', String(g.backdropOpacity));
        if (g.openAnim === 'slide' || g.openAnim === 'fade' || g.openAnim === 'scale') {
          drawer.setAttribute('data-open-anim', g.openAnim);
        }
        if (typeof g.openDurationMs === 'number') drawer.style.setProperty('--ccd-open-duration', g.openDurationMs + 'ms');
        // palette colors -> CSS vars
        if (g.palette && typeof g.palette === 'object') {
          var pal = g.palette;
          if (typeof pal.bg === 'string') drawer.style.setProperty('--ccd-bg', pal.bg);
          if (typeof pal.surface === 'string') drawer.style.setProperty('--ccd-surface', pal.surface);
          if (typeof pal.text === 'string') drawer.style.setProperty('--ccd-text', pal.text);
          if (typeof pal.muted === 'string') drawer.style.setProperty('--ccd-text-muted', pal.muted);
          if (typeof pal.accent === 'string') drawer.style.setProperty('--ccd-accent', pal.accent);
          if (typeof pal.border === 'string') drawer.style.setProperty('--ccd-border', pal.border);
          if (typeof pal.success === 'string') drawer.style.setProperty('--ccd-success', pal.success);
          if (typeof pal.danger === 'string') drawer.style.setProperty('--ccd-danger', pal.danger);
        }
        // fontFamily — schema regex restricts to safe chars; still set via style for safety
        if (typeof g.fontFamily === 'string' && /^[a-zA-Z0-9 ,\-_'"]+$/.test(g.fontFamily)) {
          drawer.style.fontFamily = g.fontFamily;
        }
        if (typeof g.baseFontSize === 'number') drawer.style.setProperty('--ccd-base-font-size', g.baseFontSize + 'px');
        if (typeof g.headingScale === 'number') drawer.style.setProperty('--ccd-heading-scale', String(g.headingScale));
        if (g.spacing === 'compact' || g.spacing === 'comfortable' || g.spacing === 'roomy') {
          drawer.classList.remove('ccd-spacing--compact', 'ccd-spacing--comfortable', 'ccd-spacing--roomy');
          drawer.classList.add('ccd-spacing--' + g.spacing);
        }
        if (g.radius === 'sharp' || g.radius === 'soft' || g.radius === 'rounded') {
          drawer.classList.remove('ccd-radius--sharp', 'ccd-radius--soft', 'ccd-radius--rounded');
          drawer.classList.add('ccd-radius--' + g.radius);
        }
        // behavior subobject — these are reads other code paths consult
        if (g.behavior && typeof g.behavior === 'object') {
          // stash on CCD so engine code can read flags later
          CCD._EOBehavior = g.behavior;
        }
      }
    },

    // Cart-aware scarcity timer lifecycle. Called after every cart refresh so the
    // timer mirrors cart state:
    //   - Empty cart      → no timer, sessionStorage cleared (fresh start next time)
    //   - Items present   → timer present (re-injects with stored start time)
    //   - Addon disabled  → no-op
    _syncScarcityTimer: function() {
      if (!CCD._scarcityCfg) return; // addon not enabled for this tenant
      var rc = (typeof CCD._lastRealCount === 'number') ? CCD._lastRealCount : -1;
      var hasEl = !!document.getElementById('ccd-scarcity-timer');
      if (rc === 0) {
        if (hasEl || CCD._scarcityTick) {
          CCD._addonHandlers.scarcityTimer.remove();
        } else {
          // No element yet but cart is empty — make sure no stale start time lingers
          try { sessionStorage.removeItem(CCD._SCARCITY_STORAGE_KEY); } catch (err) {}
        }
      } else if (rc > 0 && !hasEl) {
        CCD.injectScarcityTimer(CCD._scarcityCfg);
      }
    },

    // Cart-aware Upsell Recommendations lifecycle. Mirrors _syncScarcityTimer because
    // applyExperimentFeatures is NOT called on item removal — only on drawer open + ATC.
    // Without this sync, "You may also like" stays visible after the last item is removed.
    //   - Empty cart (rc===0) → remove #ccd-upsells, clear anchor key (force re-fetch next time)
    //   - Items present (rc>0) → re-inject if missing (e.g. cart went empty→items)
    //   - Addon disabled (_upsellsCfg null) → no-op
    _syncUpsells: function() {
      if (!CCD._upsellsCfg) return; // addon not enabled for this tenant
      var rc = (typeof CCD._lastRealCount === 'number') ? CCD._lastRealCount : -1;
      var hasEl = !!document.getElementById('ccd-upsells');
      if (rc === 0) {
        if (hasEl) {
          CCD._addonHandlers.upsellRecommendations.remove();
          CCD._upsellsAnchorKey = '';
        }
      } else if (rc > 0 && !hasEl) {
        CCD.injectUpsells(CCD._upsellsCfg);
      }
    },

    // Payment SVGs — same as dashboard preview so cart matches exactly
    _paymentSvgs: {
      'visa': '<svg viewBox="0 0 780 500" width="38" height="24"><rect width="780" height="500" rx="40" fill="#1434CB"/><path d="M489.8 143.1c-46.8 0-88.7 24.3-88.7 69.2 0 51.4 74.2 55 74.2 80.8 0 10.9-12.5 20.6-33.8 20.6-30.2 0-52.8-13.6-52.8-13.6l-9.7 45.3s26 11.5 60.6 11.5c51.2 0 91.5-25.5 91.5-71.1 0-54.4-74.5-57.8-74.5-81.8 0-8.5 10.2-17.9 31.5-17.9 24 0 43.5 9.9 43.5 9.9l9.5-43.7s-21.3-8.9-51.3-8.9zM61.3 146.4l-1.1 6.6s19.7 3.6 37.4 10.8c22.9 8.2 24.5 13.1 28.4 27.9l41.9 161.7h56.2l86.6-207.1h-56.1l-55.6 140.8-22.7-119.3c-2.1-13.7-12.6-21.5-25.5-21.5H61.3zm271.9 0L289.3 353.5h53.5l43.8-207.1h-53.3zm298.3 0c-12.9 0-19.7 6.9-24.7 19l-78.4 188.1h56.1l10.9-30.1h68.3l6.6 30.1h49.5l-43.2-207.1h-45.1zm7.3 55.9l16.6 77.7h-44.5l27.9-77.7z" fill="#fff"/></svg>',
      'mastercard': '<svg viewBox="0 0 780 500" width="38" height="24"><rect width="780" height="500" rx="40" fill="#000"/><path d="M465.7 69.1H314.2v273h151.6z" fill="#FF5A00"/><path d="M323.9 205.6c0-55.5 26.1-104.7 66.1-136.5A189.6 189.6 0 00282.9 32C186.9 32 109.3 109.6 109.3 205.6s77.6 173.6 173.6 173.6c40.5 0 77.6-14 107.1-37.1a189.6 189.6 0 01-66.1-136.5z" fill="#EB001B"/><path d="M670.7 205.6c0 96-77.6 173.6-173.6 173.6-40.5 0-77.6-14-107-37.1a189.6 189.6 0 000-273.1c29.4-23.1 66.5-37.1 107-37.1 96 0 173.6 77.6 173.6 173.6z" fill="#F79E1B"/></svg>',
      'amex': '<svg viewBox="0 0 780 500" width="38" height="24"><rect width="780" height="500" rx="40" fill="#006FCF"/><text x="390" y="320" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="190" fill="white" letter-spacing="10">AMEX</text></svg>',
      'paypal': '<svg viewBox="0 0 780 500" width="38" height="24"><rect width="780" height="500" rx="40" fill="#fff" stroke="#ddd" stroke-width="2"/><text x="390" y="310" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="180"><tspan fill="#003087">Pay</tspan><tspan fill="#009CDE">Pal</tspan></text></svg>',
      'apple-pay': '<svg viewBox="0 0 780 500" width="38" height="24"><rect width="780" height="500" rx="40" fill="#000"/><g transform="translate(55,82) scale(14)"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" fill="white"/></g><text x="400" y="250" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-weight="300" font-size="180" dominant-baseline="central" fill="white">Pay</text></svg>',
      'google-pay': '<svg viewBox="0 0 780 500" width="38" height="24"><rect width="780" height="500" rx="40" fill="#fff" stroke="#ddd" stroke-width="2"/><text x="390" y="310" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="180" fill="#5f6368">GPay</text></svg>',
      'shop-pay': '<svg viewBox="0 0 780 500" width="38" height="24"><rect width="780" height="500" rx="40" fill="#5A31F4"/><text x="390" y="290" text-anchor="middle" font-family="Arial" font-weight="700" font-size="110" fill="white">Shop Pay</text></svg>',
      'discover': '<svg viewBox="0 0 780 500" width="38" height="24"><rect width="780" height="500" rx="40" fill="#4D4D4D"/><circle cx="415" cy="214" r="53" fill="#F47216"/><text x="390" y="410" text-anchor="middle" font-family="Arial" font-weight="700" font-size="100" fill="#fff">DISCOVER</text></svg>',
      'klarna': '<svg viewBox="0 0 780 500" width="38" height="24"><rect width="780" height="500" rx="40" fill="#FFB3C7"/><text x="390" y="300" text-anchor="middle" font-family="Arial" font-weight="800" font-size="160" fill="#0A0B09">Klarna</text></svg>',
      'afterpay': '<svg viewBox="0 0 780 500" width="38" height="24"><rect width="780" height="500" rx="40" fill="#B2FCE4"/><text x="390" y="290" text-anchor="middle" font-family="Arial" font-weight="700" font-size="120" fill="#000">afterpay</text></svg>',
      'stripe': '<svg viewBox="0 0 780 500" width="38" height="24"><rect width="780" height="500" rx="40" fill="#635BFF"/><text x="390" y="300" text-anchor="middle" font-family="Arial" font-weight="700" font-size="160" fill="white">stripe</text></svg>'
    },

    injectTrustBadges: function(cfg) {
      // FF gate: trustBadgesV2 — when ON, suppress this legacy renderer entirely
      // so the new BEM renderer (which respects config.badges and config.text) can
      // take over. FF off (default): legacy behavior preserved verbatim — Eleganto unchanged.
      if (CCD.FF('trustBadgesV2')) return;
      if (document.getElementById('ccd-trust-badges')) return;
      cfg = cfg || {};
      var icons = cfg.icons || ['visa', 'mastercard', 'amex', 'discover', 'paypal', 'apple-pay', 'google-pay'];
      var rawText = cfg.text || '';
      // Treat <br>-only or whitespace-only text as empty (no orphan text div / green sliver)
      var visibleText = rawText.replace(/<br\s*\/?>/gi, '').replace(/&nbsp;/gi, '').replace(/<[^>]+>/g, '').trim();
      var text = visibleText ? rawText : '';
      var position = cfg.position || 'below-checkout';
      var svgs = CCD._paymentSvgs || {};

      // Build icons HTML
      var iconsHtml = '';
      for (var i = 0; i < icons.length; i++) {
        var svg = svgs[icons[i]];
        if (svg) iconsHtml += svg;
      }

      // Build text row
      var textHtml = '';
      if (text) {
        textHtml = '<div class="ccd-trust-text">' + text + '</div>';
      }

      var row = document.createElement('div');
      row.id = 'ccd-trust-badges';
      row.className = 'ccd-trust-badges';
      row.innerHTML = '<div class="ccd-trust-icons">' + iconsHtml + '</div>' + textHtml;

      // Position: below-checkout (default = after .ccd-trust risk-free row), above-checkout, below-items
      if (position === 'above-checkout') {
        var checkout = document.querySelector('.ccd-checkout-btn');
        if (checkout && checkout.parentNode) checkout.parentNode.insertBefore(row, checkout);
      } else if (position === 'below-items') {
        var footer = document.querySelector('.ccd-sticky-footer');
        if (footer) footer.insertBefore(row, footer.firstChild);
      } else {
        // Insert after .ccd-trust (risk-free returns) so order matches preview:
        // Checkout → Risk free → Trust badges
        var trustRow = document.querySelector('.ccd-sticky-footer .ccd-trust');
        if (trustRow && trustRow.parentNode) {
          trustRow.parentNode.insertBefore(row, trustRow.nextSibling);
        } else {
          var checkout2 = document.querySelector('.ccd-checkout-btn');
          if (checkout2 && checkout2.parentNode) checkout2.parentNode.insertBefore(row, checkout2.nextSibling);
        }
      }
    }
  };

  // ── Future addon stubs — implement visuals when ready ──
  CCD._scarcityTick = null;
  CCD._SCARCITY_STORAGE_KEY = 'ccd_scarcity_start';
  // Empty cart = no reservation = no timer. Bail and clear any stale start time.
  CCD._cartIsEmptyForScarcity = function() {
    var rc = (typeof CCD._lastRealCount === 'number') ? CCD._lastRealCount : -1;
    // -1 means "not yet computed" — let the caller decide; only treat 0 as empty.
    return rc === 0;
  };
  CCD.injectScarcityTimer = function(cfg) {
    if (document.getElementById('ccd-scarcity-timer')) return;
    if (CCD._cartIsEmptyForScarcity()) {
      // Don't start the reservation clock for an empty cart.
      try { sessionStorage.removeItem(CCD._SCARCITY_STORAGE_KEY); } catch (e) {}
      return;
    }
    // Defer injection until cart count is known. When applyExperimentFeatures
    // runs at drawer-open time, _lastRealCount is still -1 ("not yet fetched");
    // injecting now and then removing in _syncScarcityTimer (after the cart
    // fetch resolves with an empty cart) produces a visible flash. The
    // post-fetch _syncScarcityTimer will re-inject for non-empty carts.
    if (CCD._lastRealCount === -1) return;
    cfg = cfg || {};
    var rawText = cfg.text != null ? String(cfg.text) : '<span style="color:#d32f2f">Your cart is reserved for <strong>{time}</strong></span>';
    var durationMin = typeof cfg.duration === 'number' ? cfg.duration : (parseFloat(cfg.duration) || 10);
    if (!isFinite(durationMin) || durationMin < 1) durationMin = 1;
    if (durationMin > 60) durationMin = 60;
    var durationSec = Math.round(durationMin * 60);
    var onComplete = cfg.onComplete === 'reset' ? 'reset' : 'hide';
    var position = cfg.position || 'below-header';

    // Visual styling (background, text color, font size, font weight, padding,
    // border radius) is controlled inline via the rich text editor toolbar in
    // rawText — no separate fields. Only pulse animation is a wrapper-level toggle.
    var pulseAnimation = cfg.pulseAnimation !== false;

    // Per-cart-session start time (sessionStorage so the timer survives navigation
    // within the session but resets on a new session/tab).
    // Cleared whenever the cart goes empty — see _addonHandlers.scarcityTimer.remove
    // and _syncScarcityTimer below.
    var STORAGE_KEY = CCD._SCARCITY_STORAGE_KEY;
    var startMs;
    try {
      var stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        var n = parseInt(stored, 10);
        if (isFinite(n) && n > 0) startMs = n;
      }
    } catch (e) { /* sessionStorage may be unavailable */ }
    if (!startMs) {
      startMs = Date.now();
      try { sessionStorage.setItem(STORAGE_KEY, String(startMs)); } catch (e) {}
    }

    // Build wrapper element
    // NOTE: NOT using .ccd-scarcity-badge class — that class has !important rules
    // that override inline styles and is reserved for the per-item "only X left" badge.
    // Using unique #ccd-scarcity-timer ID so all visuals come from inline styles
    // driven by the dashboard config (nothing hardcoded — fully editable per tenant).
    var el = document.createElement('div');
    el.id = 'ccd-scarcity-timer';
    // Alignment lives inside rawText (text-align inline styles set via the rich text editor).
    el.style.cssText =
      'display:block;width:auto;box-sizing:border-box;' +
      'padding:8px 16px;border-radius:6px;' +
      (pulseAnimation ? 'animation:ccdScarcityPulse 2s ease-in-out infinite;' : '');

    // Inject placeholder span where {time} appears so we can update only the time text
    var html = rawText.replace(/\{time\}/g, '<span class="ccd-scarcity-time">--:--</span>');
    el.innerHTML = html;

    // Insert at the chosen position
    var inserted = false;
    if (position === 'above-checkout') {
      var checkoutBtn = document.querySelector('.ccd-checkout-btn');
      if (checkoutBtn && checkoutBtn.parentNode) {
        checkoutBtn.parentNode.insertBefore(el, checkoutBtn);
        inserted = true;
      }
    } else if (position === 'floating-top') {
      // Self-rendered shell only — never reference theme-specific classes
      var header = document.querySelector('.ccd-fixed-header');
      if (header && header.parentNode) {
        header.parentNode.insertBefore(el, header);
        inserted = true;
      }
    }
    if (!inserted) {
      // below-header (default) — insert at top of inner panel
      // Self-rendered shell only — never reference theme-specific classes
      var inner = document.querySelector('.ccd-inner');
      if (inner && inner.parentNode) {
        inner.parentNode.insertBefore(el, inner);
        inserted = true;
      }
    }
    if (!inserted) return;

    // Tick: format mm:ss and handle completion
    function fmt(totalSec) {
      if (totalSec < 0) totalSec = 0;
      var m = Math.floor(totalSec / 60);
      var s = totalSec % 60;
      return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }
    function tick() {
      var node = document.getElementById('ccd-scarcity-timer');
      if (!node) {
        if (CCD._scarcityTick) { clearInterval(CCD._scarcityTick); CCD._scarcityTick = null; }
        return;
      }
      var elapsed = Math.floor((Date.now() - startMs) / 1000);
      var remaining = durationSec - elapsed;
      if (remaining <= 0) {
        if (onComplete === 'reset') {
          startMs = Date.now();
          try { sessionStorage.setItem(STORAGE_KEY, String(startMs)); } catch (e) {}
          remaining = durationSec;
        } else {
          // hide
          if (CCD._scarcityTick) { clearInterval(CCD._scarcityTick); CCD._scarcityTick = null; }
          if (node.parentNode) node.parentNode.removeChild(node);
          try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) {}
          return;
        }
      }
      var spans = node.querySelectorAll('.ccd-scarcity-time');
      var formatted = fmt(remaining);
      for (var i = 0; i < spans.length; i++) spans[i].textContent = formatted;
    }
    if (CCD._scarcityTick) { clearInterval(CCD._scarcityTick); CCD._scarcityTick = null; }
    tick();
    CCD._scarcityTick = setInterval(tick, 1000);
  };
  CCD._lastTiersJSON = '';
  CCD.injectFreeShippingBar = function(cfg) {
    // Apply dynamic tier config from dashboard when it arrives via API
    if (cfg && cfg.tiers && cfg.tiers.length > 0) {
      // Check if tiers actually changed (avoid DOM rebuild on cart reopen)
      var newJSON = JSON.stringify(cfg.tiers);
      var tiersChanged = (newJSON !== CCD._lastTiersJSON);
      CCD._lastTiersJSON = newJSON;

      REWARD_TIERS = cfg.tiers;
      THRESHOLD_MODE = cfg.thresholdMode || 'items';
      HIGHEST_TIER_ONLY = !!cfg.highestTierOnly;
      ALL_REWARDS_TEXT = cfg.allRewardsUnlockedText || '\uD83C\uDF89 You\u2019ve unlocked all rewards!';
      MILESTONE_ANIMATION = cfg.milestoneAnimation !== false;
      MILESTONE_ANIM_TYPE = cfg.milestoneAnimationType || 'pulse';
      GIFT_BADGE_ENABLED = cfg.giftBadgeEnabled !== false;
      GIFT_BADGE_TEXT = cfg.giftBadgeText || 'Bonus gift';
      GIFT_BADGE_TEXT_COLOR = cfg.giftBadgeTextColor || '#1a7a1a';
      GIFT_BADGE_BG_COLOR = cfg.giftBadgeBgColor || '#edf7ed';
      GIFT_SHOW_COMPARE_PRICE = cfg.giftShowComparePrice !== false;
      GIFT_HIDE_DISCOUNT_LABEL = cfg.giftHideDiscountLabel !== false;
      PROMO_GOAL = REWARD_TIERS[REWARD_TIERS.length - 1].goal;
      // Rebuild gift handles map
      GIFT_HANDLES = {};
      GIFT_TIERS = [];
      REWARD_TIERS.forEach(function(t) {
        var gifts = tierGifts(t);
        if (gifts.length > 0) {
          gifts.forEach(function(g) { if (g.handle) GIFT_HANDLES[g.handle] = true; });
          GIFT_TIERS.push(t);
        }
      });
      // Only force-rebuild progress bar if tiers changed (not on every cart open)
      CCD.buildProgressBar(tiersChanged);
      // Refresh progress state
      fetch('/cart.js').then(function(r) { return r.json(); }).then(function(cart) {
        CCD.updateProgress(cart);
        CCD.checkWatchCase(cart);
      }).catch(function() {});
    }
  };
  CCD.injectSocialProof = function(cfg) {
    if (document.getElementById('ccd-social-proof')) return;
    // TODO: implement social proof indicator
  };
  // Upsell recommendations — supports three sources:
  //   • shopify-recommendations → /recommendations/products.json?intent=related (co-purchase signal)
  //   • ai-selected             → /recommendations/products.json?intent=complementary (Shopify Magic ML)
  //   • manual                  → cfg.manualProducts (merchant-picked in dashboard)
  // All sources render to a single #ccd-upsells container. Re-injection short-circuits if the
  // cart contents (used to anchor the fetch) haven't changed since last render.
  CCD._upsellsAnchorKey = '';
  CCD._upsellsInflight = false;
  CCD.injectUpsells = function(cfg) {
    cfg = cfg || {};
    if (CCD._upsellsInflight) return;

    // Empty-cart guard. When the customer has nothing in the cart (or removed the last item),
    // recommending complementary products is junk — there's no anchor and the section looks
    // weird hovering over an empty cart message. Bail and clean up any existing element so
    // re-renders after a "remove last item" action don't leave a stale "You may also like".
    // Mirrors the proven _syncScarcityTimer pattern (rc===0 → remove + clear state).
    if (CCD._lastRealCount === 0) {
      var _stale = document.getElementById('ccd-upsells');
      if (_stale && _stale.parentNode) _stale.parentNode.removeChild(_stale);
      CCD._upsellsAnchorKey = '';
      return;
    }

    var source = cfg.source || 'shopify-recommendations';
    // Legacy slugs from when headline was a preset dropdown — map to bold+centered HTML.
    var LEGACY_HEADLINES = {
      'you-may-also-like': '<div style="text-align:center"><strong>You may also like</strong></div>',
      'complete-your-order': '<div style="text-align:center"><strong>Complete your order</strong></div>',
      'customers-also-bought': '<div style="text-align:center"><strong>Customers also bought</strong></div>'
    };
    var rawHeadline = (typeof cfg.headline === 'string') ? cfg.headline.trim() : '';
    if (LEGACY_HEADLINES[rawHeadline]) rawHeadline = LEGACY_HEADLINES[rawHeadline];
    var headlineHtml = rawHeadline || '<div style="text-align:center"><strong>You may also like</strong></div>';
    var layout = cfg.layout || 'horizontal-scroll';
    var position = cfg.position || 'below-items';
    var maxN = Math.max(1, Math.min(6, parseInt(cfg.maxProducts, 10) || 3));
    var manualProducts = Array.isArray(cfg.manualProducts) ? cfg.manualProducts : [];

    function pickAnchorProductId(cart) {
      // Anchor on the first cart line item. Excludes our $0 gift duplicates (they're tagged or
      // their handle starts with "gift-"), since recommending complements of a free gift is junk.
      var items = (cart && cart.items) || [];
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (!it || !it.product_id) continue;
        var handle = String(it.handle || '').toLowerCase();
        if (handle.indexOf('gift-') === 0) continue;
        var price = Number(it.price) || 0;
        if (price === 0) continue;
        return it.product_id;
      }
      return null;
    }

    function fetchShopifyRecs(intent, anchorProductId) {
      // Shopify storefront recs API — public, no auth needed, returns same shape as /products.json.
      var url = '/recommendations/products.json?product_id=' + encodeURIComponent(anchorProductId) +
                '&limit=' + maxN + '&intent=' + intent;
      return fetch(url, { credentials: 'same-origin' })
        .then(function(r) { return r.ok ? r.json() : { products: [] }; })
        .then(function(data) {
          var prods = (data && data.products) || [];
          return prods.filter(function(p) {
            // Exclude items already in cart and excluded products tagged "_eliminai-hidden".
            var tags = (p.tags || []);
            if (Array.isArray(tags) ? tags.indexOf('_eliminai-hidden') >= 0 : String(tags).indexOf('_eliminai-hidden') >= 0) return false;
            var handle = String(p.handle || '').toLowerCase();
            if (handle.indexOf('gift-') === 0) return false;
            return true;
          });
        })
        .catch(function() { return []; });
    }

    function fetchManualProducts() {
      // Resolve each manual selection to live data (handle = stable identifier; variant id may rotate).
      // We re-fetch /products/{handle}.js for each to pick up current price + availability without
      // a backend round-trip. Falls back to the stored snapshot if the fetch fails or the product
      // was deleted on Shopify.
      if (manualProducts.length === 0) return Promise.resolve([]);
      var picks = manualProducts.slice(0, maxN);
      var fetches = picks.map(function(p) {
        var handle = p && p.handle;
        if (!handle) return Promise.resolve(p && p.title ? p : null);
        return fetch('/products/' + encodeURIComponent(handle) + '.js', { credentials: 'same-origin' })
          .then(function(r) { return r.ok ? r.json() : null; })
          .then(function(live) {
            if (!live) return p && p.title ? p : null;
            // Find the variant the merchant chose; fall back to the first available.
            var preferredVariantId = p && p.variantId;
            var variants = live.variants || [];
            var chosen = null;
            for (var v = 0; v < variants.length; v++) {
              if (preferredVariantId && variants[v].id === preferredVariantId) { chosen = variants[v]; break; }
            }
            if (!chosen) chosen = variants.find(function(x) { return x.available; }) || variants[0];
            if (!chosen) return null;
            return {
              id: live.id,
              handle: live.handle,
              title: live.title,
              price: chosen.price, // cents
              image: live.featured_image || (live.images && live.images[0]) || (p && p.image) || '',
              variantId: chosen.id,
              available: chosen.available !== false
            };
          })
          .catch(function() { return p && p.title ? p : null; });
      });
      return Promise.all(fetches).then(function(arr) {
        return arr.filter(function(x) { return x && x.title; });
      });
    }

    // Build a Shopify-shaped product object into the unified shape we render.
    function normalizeShopifyProduct(p) {
      var variants = p.variants || [];
      var v = variants.find(function(x) { return x.available; }) || variants[0] || {};
      var img = p.featured_image || (p.images && p.images[0]) || '';
      // Shopify storefront API returns price in dollars (string). Convert to cents-int for fmt.
      var priceNum = typeof v.price === 'number' ? v.price : parseFloat(v.price || p.price || 0);
      var priceCents = priceNum > 100 ? Math.round(priceNum) : Math.round(priceNum * 100);
      return {
        id: p.id,
        handle: p.handle,
        title: p.title,
        price: priceCents,
        image: img,
        variantId: v.id,
        available: v.available !== false
      };
    }

    function fmtPrice(cents) {
      // Use the cart drawer's money formatter if available (respects store currency), otherwise USD fallback.
      try { if (typeof CCD.formatMoney === 'function') return CCD.formatMoney(cents); } catch (e) {}
      var n = (Number(cents) || 0) / 100;
      return '$' + n.toFixed(2);
    }

    function buildCard(p) {
      var img = p.image || '';
      var imgHtml = img
        ? '<img src="' + img + '" style="width:100%;height:100%;object-fit:cover" alt="' + (p.title || '') + '">'
        : '<div style="width:100%;height:100%;background:#f5f5f5"></div>';
      var disabled = p.available === false;
      var btnLabel = disabled ? 'Sold out' : 'Add';
      var btnStyle = 'margin-top:6px;padding:6px 14px;font-size:11px;background:' +
        (disabled ? '#cbd5e1' : 'var(--ccd-primary, #7c3aed)') +
        ';color:#fff;border:none;border-radius:4px;cursor:' + (disabled ? 'not-allowed' : 'pointer') + ';font-weight:600';
      return '<div class="ccd-upsell-card" data-variant-id="' + (p.variantId || '') +
        '" data-product-handle="' + (p.handle || '') + '"' +
        ' style="min-width:120px;flex-shrink:0;text-align:center">' +
        '<div style="width:80px;height:80px;background:#f5f5f5;border-radius:8px;margin:0 auto 6px;overflow:hidden;display:flex;align-items:center;justify-content:center">' + imgHtml + '</div>' +
        '<div style="font-size:11px;font-weight:600;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px" title="' + (p.title || '') + '">' + (p.title || '') + '</div>' +
        '<div style="font-size:12px;color:#666">' + fmtPrice(p.price) + '</div>' +
        '<button class="ccd-upsell-add" ' + (disabled ? 'disabled' : '') + ' style="' + btnStyle + '">' + btnLabel + '</button>' +
        '</div>';
    }

    function render(products, anchorKey) {
      // Pull any prior version first so we replace cleanly on re-render.
      var existing = document.getElementById('ccd-upsells');
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      if (!products || products.length === 0) {
        CCD._upsellsAnchorKey = anchorKey || '';
        return; // Nothing to show — bail silently (no empty section visible to the customer).
      }

      var layoutStyle;
      if (layout === 'single-card') {
        layoutStyle = 'display:flex;justify-content:center;padding:4px 0 0 0';
      } else if (layout === 'stacked-list') {
        layoutStyle = 'display:flex;flex-direction:column;align-items:center;gap:10px;padding:4px 0 0 0';
      } else {
        // Horizontal scroll — center when items don't overflow; scroll normally when they do.
        layoutStyle = 'display:flex;justify-content:center;gap:12px;overflow-x:auto;padding:4px 0 0 0;scrollbar-width:thin';
      }

      var items = (layout === 'single-card' ? products.slice(0, 1) : products).map(buildCard).join('');
      var html = '<div id="ccd-upsells" class="ccd-upsells" style="padding:4px 0 8px 0">' +
        '<div class="ccd-upsell-headline" style="font-size:13px;margin-bottom:4px">' + headlineHtml + '</div>' +
        '<div class="ccd-upsell-list" style="' + layoutStyle + '">' + items + '</div>' +
        '</div>';

      var container = document.createElement('div');
      container.innerHTML = html;
      var node = container.firstChild;

      var inserted = false;
      if (position === 'above-footer') {
        var footer = document.querySelector('.ccd-sticky-footer');
        if (footer && footer.parentNode) { footer.parentNode.insertBefore(node, footer); inserted = true; }
      } else if (position === 'after-checkout') {
        var checkout = document.querySelector('.ccd-checkout-btn');
        if (checkout && checkout.parentNode) { checkout.parentNode.insertBefore(node, checkout.nextSibling); inserted = true; }
      } else {
        // below-items (default) — insert as a SIBLING immediately AFTER .ccd-items, not as a child.
        // Appending as a child caused the upsell to render ABOVE items when (a) injection raced ahead of
        // line-item paint, or (b) .ccd-items got innerHTML-rewritten on cart refresh.
        var itemsContainer = document.querySelector('.ccd-items');
        if (itemsContainer && itemsContainer.parentNode) {
          itemsContainer.parentNode.insertBefore(node, itemsContainer.nextSibling);
          inserted = true;
        }
      }
      if (!inserted) {
        // Last-resort fallback — place inside .ccd-inner. Still safer than nothing.
        var inner = document.querySelector('.ccd-inner');
        if (inner) inner.appendChild(node);
      }

      // Wire add-to-cart buttons. Event delegation so re-renders don't leak handlers.
      node.addEventListener('click', function(ev) {
        var btn = ev.target && ev.target.closest && ev.target.closest('.ccd-upsell-add');
        if (!btn || btn.disabled) return;
        var card = btn.closest('.ccd-upsell-card');
        if (!card) return;
        var variantId = card.getAttribute('data-variant-id');
        if (!variantId) return;
        btn.disabled = true;
        var prevLabel = btn.textContent;
        btn.textContent = 'Adding…';
        fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ id: Number(variantId), quantity: 1 })
        }).then(function(r) {
          return r.ok ? r.json() : Promise.reject(new Error('add failed'));
        }).then(function() {
          // Track conversion signal for the A/B engine — upsell click is a high-value event.
          try { if (CCD.track) CCD.track('UPSELL_ADDED', { variantId: Number(variantId), source: source }); } catch (e) {}
          // Refresh cart so progress bar, totals, and other addons update.
          if (CCD.refresh) CCD.refresh();
          btn.textContent = 'Added ✓';
          setTimeout(function() { btn.textContent = prevLabel; btn.disabled = false; }, 1500);
        }).catch(function() {
          btn.textContent = 'Try again';
          setTimeout(function() { btn.textContent = prevLabel; btn.disabled = false; }, 1500);
        });
      });

      CCD._upsellsAnchorKey = anchorKey || '';
    }

    // Resolve products based on source.
    CCD._upsellsInflight = true;
    var loadProducts;
    if (source === 'manual') {
      var key = 'manual:' + manualProducts.map(function(p) { return (p && (p.handle || p.variantId)) || ''; }).join(',') + ':n=' + maxN;
      if (key === CCD._upsellsAnchorKey && document.getElementById('ccd-upsells')) { CCD._upsellsInflight = false; return; }
      loadProducts = fetchManualProducts().then(function(list) { return { products: list, key: key }; });
    } else {
      var intent = (source === 'ai-selected') ? 'complementary' : 'related';
      loadProducts = fetch('/cart.js', { credentials: 'same-origin' })
        .then(function(r) { return r.ok ? r.json() : { items: [] }; })
        .then(function(cart) {
          var anchorId = pickAnchorProductId(cart);
          if (!anchorId) return { products: [], key: 'no-anchor' };
          var key = intent + ':' + anchorId + ':n=' + maxN;
          if (key === CCD._upsellsAnchorKey && document.getElementById('ccd-upsells')) return { products: null, key: key };
          return fetchShopifyRecs(intent, anchorId).then(function(prods) {
            var inCart = {};
            (cart.items || []).forEach(function(it) { if (it && it.product_id) inCart[it.product_id] = true; });
            var normalized = prods
              .filter(function(p) { return !inCart[p.id]; })
              .slice(0, maxN)
              .map(normalizeShopifyProduct);
            return { products: normalized, key: key };
          });
        })
        .catch(function() { return { products: [], key: 'error' }; });
    }

    loadProducts.then(function(result) {
      if (result && result.products !== null) {
        render(result.products || [], result.key);
      }
    }).catch(function() {}).then(function() {
      CCD._upsellsInflight = false;
    });
  };

  // ── Order Notes addon ──
  // Adds a <textarea> bound to cart.attributes.note. Position 'top' inserts as
  // first child of sticky-footer; 'bottom' inserts before .ccd-trust (or appended
  // if no trust row). Pre-fills from CCD._lastCart.note. Saves on blur via
  // /cart/update.js with 500ms debounce to avoid hammering the API on every
  // keystroke.
  CCD._notesDebounce = null;
  CCD.injectNotes = function(cfg) {
    cfg = cfg || {};
    var existing = document.getElementById('ccd-notes-row');
    if (existing) existing.remove();
    var footer = document.querySelector('.ccd-sticky-footer');
    if (!footer) return;

    var position = cfg.position === 'top' ? 'top' : (cfg.position === 'bottom' ? 'bottom' : 'above-checkout');
    var label = typeof cfg.label === 'string' ? cfg.label : 'Add a note to your order';
    var placeholder = typeof cfg.placeholder === 'string' ? cfg.placeholder : '';
    var maxChars = typeof cfg.maxChars === 'number' ? cfg.maxChars : 250;

    var row = document.createElement('div');
    row.id = 'ccd-notes-row';
    row.className = 'ccd-notes-row ccd-notes-row--' + position;

    var labelEl = document.createElement('label');
    labelEl.className = 'ccd-notes-row__label';
    labelEl.textContent = label;
    labelEl.htmlFor = 'ccd-notes-textarea';
    row.appendChild(labelEl);

    var ta = document.createElement('textarea');
    ta.id = 'ccd-notes-textarea';
    ta.className = 'ccd-notes-row__input';
    ta.name = 'note';
    ta.rows = 2;
    if (placeholder) ta.placeholder = placeholder;
    if (maxChars > 0) ta.maxLength = maxChars;
    var existingNote = (CCD._lastCart && typeof CCD._lastCart.note === 'string') ? CCD._lastCart.note : '';
    if (existingNote) ta.value = existingNote;
    row.appendChild(ta);

    function saveNote() {
      var val = ta.value || '';
      fetch('/cart/update.js', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ note: val })
      }).then(function(r) { return r.ok ? r.json() : null; })
        .then(function(cart) { if (cart) { CCD._lastCart = cart; } })
        .catch(function() {});
    }
    ta.addEventListener('blur', saveNote);
    ta.addEventListener('input', function() {
      if (CCD._notesDebounce) clearTimeout(CCD._notesDebounce);
      CCD._notesDebounce = setTimeout(saveNote, 500);
    });

    if (position === 'above-checkout') {
      var checkoutBtn = footer.querySelector('.ccd-checkout-btn');
      if (checkoutBtn) footer.insertBefore(row, checkoutBtn);
      else footer.appendChild(row);
    } else if (position === 'top') {
      footer.insertBefore(row, footer.firstChild);
    } else {
      var trustRow = footer.querySelector('.ccd-trust');
      if (trustRow) {
        footer.insertBefore(row, trustRow);
      } else {
        footer.appendChild(row);
      }
    }
  };

  // ── Custom HTML block addon ──
  // Injects merchant-authored HTML (e.g. a "30-Day Risk-Free Returns" badge)
  // at a chosen footer placement. Mirrors sanitizeCustomHtml + applyCustomCode
  // in backend addon-transforms.ts so the live storefront matches the preview.
  CCD.sanitizeCustomHtml = function(raw) {
    if (typeof raw !== 'string') return '';
    var s = raw.trim();
    if (!s) return '';
    s = s.replace(/<script[\s\S]*?<\/script\s*>/gi, '');
    s = s.replace(/<style[\s\S]*?<\/style\s*>/gi, '');
    s = s.replace(/<iframe[\s\S]*?<\/iframe\s*>/gi, '');
    s = s.replace(/<object[\s\S]*?<\/object\s*>/gi, '');
    s = s.replace(/<noscript[\s\S]*?<\/noscript\s*>/gi, '');
    s = s.replace(/<template[\s\S]*?<\/template\s*>/gi, '');
    s = s.replace(/<\/?(?:script|style|iframe|object|embed|noscript|template|link|meta|base)[^>]*>/gi, '');
    s = s.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
    s = s.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
    s = s.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');
    s = s.replace(/javascript:/gi, '');
    s = s.replace(/vbscript:/gi, '');
    s = s.replace(/data:text\/html/gi, '');
    return s.trim();
  };

  CCD._ccPos = function(p) { return p === 'top' ? 'top' : (p === 'bottom' ? 'bottom' : 'above-checkout'); };
  // Normalize cfg into an ordered list of blocks. Source of truth is cfg.blocks
  // (multi-instance); falls back to the LEGACY single { html, position } shape.
  CCD._customCodeBlocks = function(cfg) {
    if (cfg && Object.prototype.toString.call(cfg.blocks) === '[object Array]') {
      var out = [];
      for (var i = 0; i < cfg.blocks.length; i++) {
        var b = cfg.blocks[i];
        if (b && typeof b.html === 'string') out.push({ html: b.html, position: CCD._ccPos(b.position) });
      }
      return out;
    }
    if (cfg && typeof cfg.html === 'string' && cfg.html.replace(/^\s+|\s+$/g, '')) {
      return [{ html: cfg.html, position: CCD._ccPos(cfg.position) }];
    }
    return [];
  };
  CCD.injectCustomCode = function(cfg) {
    cfg = cfg || {};
    // When a merchant seeds their own returns badge here and toggles
    // hideBuiltInTrustLine, drop ONLY the built-in returns text line so it isn't
    // shown twice. The payment-badges row is nested in the same trust container
    // and must survive — so we never remove the whole container here.
    if (cfg.hideBuiltInTrustLine) {
      var builtInLine = document.querySelector('.ccd-trust__line');
      if (builtInLine) builtInLine.remove();
    }
    // Remove ALL previously injected blocks (multi-instance).
    var prev = document.querySelectorAll('.ccd-custom-code');
    for (var p = 0; p < prev.length; p++) prev[p].remove();
    var footer = document.querySelector('.ccd-sticky-footer');
    if (!footer) return;

    var blocks = CCD._customCodeBlocks(cfg);
    if (!blocks.length) return;

    // Group into per-position fragments so blocks keep their array order.
    var frags = { top: document.createDocumentFragment(), 'above-checkout': document.createDocumentFragment(), bottom: document.createDocumentFragment() };
    for (var i = 0; i < blocks.length; i++) {
      var inner = CCD.sanitizeCustomHtml(blocks[i].html);
      if (!inner) continue;
      var position = blocks[i].position;
      var block = document.createElement('div');
      block.id = i === 0 ? 'ccd-custom-code' : 'ccd-custom-code-' + i;
      block.className = 'ccd-custom-code ccd-custom-code--' + position;
      block.innerHTML = inner;
      frags[position].appendChild(block);
    }

    if (frags.top.childNodes.length) footer.insertBefore(frags.top, footer.firstChild);
    if (frags['above-checkout'].childNodes.length) {
      var checkoutBtn = footer.querySelector('.ccd-checkout-btn');
      if (checkoutBtn) footer.insertBefore(frags['above-checkout'], checkoutBtn);
      else footer.appendChild(frags['above-checkout']);
    }
    if (frags.bottom.childNodes.length) {
      var trustRow = footer.querySelector('.ccd-trust');
      if (trustRow) footer.insertBefore(frags.bottom, trustRow);
      else footer.appendChild(frags.bottom);
    }
  };

  // ── Discount Code addon ──
  // Inline discount-code input inside the sticky-footer. On apply, hits
  // /discount/<code>?redirect=/cart.js (Shopify auto-applies + redirects),
  // then refetches /cart.js and refreshes the drawer. Shows applied-code
  // badge from CCD._lastCart.cart_level_discount_applications when
  // cfg.showAppliedBadge is true.
  CCD.injectDiscountCode = function(cfg) {
    cfg = cfg || {};
    var existing = document.getElementById('ccd-discount-code-row');
    if (existing) existing.remove();
    var footer = document.querySelector('.ccd-sticky-footer');
    if (!footer) return;

    var position = cfg.position === 'top'
      ? 'top'
      : (cfg.position === 'bottom' ? 'bottom' : 'above-checkout');
    var placeholder = typeof cfg.placeholder === 'string' ? cfg.placeholder : 'Discount code';
    var applyLabel = typeof cfg.applyButtonLabel === 'string' ? cfg.applyButtonLabel : 'Apply';
    var applyColor = typeof cfg.applyButtonColor === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(cfg.applyButtonColor)
      ? cfg.applyButtonColor
      : '';
    var showBadge = cfg.showAppliedBadge !== false;

    var row = document.createElement('div');
    row.id = 'ccd-discount-code-row';
    row.className = 'ccd-discount-row ccd-discount-row--' + position;
    if (applyColor) row.style.setProperty('--ccd-da-bg', applyColor);

    var input = document.createElement('input');
    input.type = 'text';
    input.id = 'ccd-discount-code-input';
    input.className = 'ccd-discount-row__input';
    input.name = 'discount';
    input.placeholder = placeholder;
    input.autocomplete = 'off';
    row.appendChild(input);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'ccd-discount-code-apply';
    btn.className = 'ccd-discount-row__apply';
    btn.textContent = applyLabel;
    row.appendChild(btn);

    var status = document.createElement('div');
    status.id = 'ccd-discount-code-status';
    status.className = 'ccd-discount-row__status';
    row.appendChild(status);

    function renderAppliedBadge() {
      if (!showBadge) return;
      var apps = (CCD._lastCart && CCD._lastCart.cart_level_discount_applications) || [];
      if (!apps.length) { status.textContent = ''; status.classList.remove('ccd-discount-row__status--applied'); return; }
      var labels = [];
      for (var i = 0; i < apps.length; i++) {
        var a = apps[i] || {};
        if (a.title || a.code) labels.push(a.title || a.code);
      }
      if (labels.length) {
        status.textContent = '✓ Applied: ' + labels.join(', ');
        status.classList.add('ccd-discount-row__status--applied');
      }
    }

    function applyDiscount() {
      var code = (input.value || '').trim();
      if (!code) return;
      btn.disabled = true;
      var prevLabel = btn.textContent;
      btn.textContent = '…';
      fetch('/discount/' + encodeURIComponent(code) + '?redirect=/cart.js', { credentials: 'same-origin' })
        .then(function() { return fetch('/cart.js', { credentials: 'same-origin' }); })
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(cart) {
          if (cart) {
            CCD._lastCart = cart;
            if (typeof CCD.refresh === 'function') { CCD.refresh(); }
            renderAppliedBadge();
            input.value = '';
          }
        })
        .catch(function() {})
        .then(function() { btn.disabled = false; btn.textContent = prevLabel; });
    }
    btn.addEventListener('click', applyDiscount);
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); applyDiscount(); }
    });

    if (position === 'top') {
      footer.insertBefore(row, footer.firstChild);
    } else if (position === 'above-checkout') {
      var checkoutBtn = footer.querySelector('.ccd-checkout-btn');
      if (checkoutBtn && checkoutBtn.parentNode) {
        checkoutBtn.parentNode.insertBefore(row, checkoutBtn);
      } else {
        footer.appendChild(row);
      }
    } else {
      var trustRow = footer.querySelector('.ccd-trust');
      if (trustRow) {
        footer.insertBefore(row, trustRow);
      } else {
        footer.appendChild(row);
      }
    }
    renderAppliedBadge();
  };

  // ── Terms Checkbox addon ──
  // Renders a checkbox + label above .ccd-checkout-btn. labelHtml is
  // sanitized client-side to allow ONLY <a> with safe href/target/rel
  // (defense-in-depth — the editor already sanitizes on save).
  //
  // When blockCheckoutIfUnchecked is true and the box is unchecked,
  // a capture-phase document click listener targeting .ccd-checkout-btn
  // calls preventDefault + stopImmediatePropagation so the existing
  // checkout handler (window.location = '/checkout') never runs. The
  // error message renders inline and the row pulses red.
  CCD._termsBlock = null;
  CCD._termsClickGuard = null;
  function ccdSanitizeTermsHtml(html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = String(html || '');
    function walk(node) {
      var children = Array.prototype.slice.call(node.childNodes);
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (child.nodeType === 1) {
          if (child.tagName === 'A') {
            var attrs = Array.prototype.slice.call(child.attributes);
            for (var j = 0; j < attrs.length; j++) {
              var an = attrs[j].name.toLowerCase();
              var av = attrs[j].value || '';
              if (an === 'href') {
                if (/^\s*(javascript|data):/i.test(av)) child.removeAttribute('href');
              } else if (an !== 'target' && an !== 'rel') {
                child.removeAttribute(attrs[j].name);
              }
            }
            walk(child);
          } else {
            var text = document.createTextNode(child.textContent || '');
            node.replaceChild(text, child);
          }
        }
      }
    }
    walk(tmp);
    return tmp.innerHTML;
  }
  CCD.injectTermsCheckbox = function(cfg) {
    cfg = cfg || {};
    var existing = document.getElementById('ccd-terms-row');
    if (existing) existing.remove();
    var footer = document.querySelector('.ccd-sticky-footer');
    var checkoutBtn = footer && footer.querySelector('.ccd-checkout-btn');
    if (!footer || !checkoutBtn) return;

    var labelHtml = ccdSanitizeTermsHtml(typeof cfg.labelHtml === 'string' ? cfg.labelHtml : '');
    var errorMessage = typeof cfg.errorMessage === 'string' ? cfg.errorMessage : 'Please agree to the terms before continuing';
    var blockCheckout = cfg.blockCheckoutIfUnchecked !== false;

    var row = document.createElement('div');
    row.id = 'ccd-terms-row';
    row.className = 'ccd-terms-row';

    var label = document.createElement('label');
    label.className = 'ccd-terms-row__label';
    label.htmlFor = 'ccd-terms-checkbox';

    var box = document.createElement('input');
    box.type = 'checkbox';
    box.id = 'ccd-terms-checkbox';
    box.className = 'ccd-terms-row__checkbox';
    label.appendChild(box);

    var text = document.createElement('span');
    text.className = 'ccd-terms-row__text';
    text.innerHTML = labelHtml;
    label.appendChild(text);
    row.appendChild(label);

    var err = document.createElement('div');
    err.id = 'ccd-terms-error';
    err.className = 'ccd-terms-row__error';
    err.style.display = 'none';
    err.textContent = errorMessage;
    row.appendChild(err);

    footer.insertBefore(row, checkoutBtn);

    box.addEventListener('change', function() {
      if (box.checked) {
        err.style.display = 'none';
        row.classList.remove('ccd-terms-row--error');
      }
    });

    CCD._termsBlock = { required: blockCheckout, errorMessage: errorMessage };

    if (CCD._termsClickGuard) {
      document.removeEventListener('click', CCD._termsClickGuard, true);
      CCD._termsClickGuard = null;
    }
    CCD._termsClickGuard = function(e) {
      if (!CCD._termsBlock || !CCD._termsBlock.required) return;
      var t = e.target;
      var btn = t && (t.closest ? t.closest('.ccd-checkout-btn') : null);
      if (!btn) return;
      var cb = document.getElementById('ccd-terms-checkbox');
      if (cb && !cb.checked) {
        e.preventDefault();
        e.stopImmediatePropagation();
        var errEl = document.getElementById('ccd-terms-error');
        if (errEl) errEl.style.display = '';
        var rowEl = document.getElementById('ccd-terms-row');
        if (rowEl) rowEl.classList.add('ccd-terms-row--error');
      }
    };
    document.addEventListener('click', CCD._termsClickGuard, true);
  };

  // ── Express Payments addon (NATIVE Shopify wallets) ──
  // We do NOT render fake branded buttons anymore. Shopify's REAL dynamic-checkout
  // wallets are rendered server-side in app-embed.liquid inside a hidden host
  // (#ccd-native-express-host) via {{ form | payment_button }} (Shop Pay) and
  // {{ content_for_additional_checkout_buttons }} (PayPal/Apple Pay/Google Pay/
  // Amazon). Shopify only emits the wallets THIS shop + device actually support,
  // so a shop without Shop Pay never sees a Shop Pay button.
  //
  // This function RELOCATES that hydrated host into the cart-drawer footer,
  // below the checkout button by default (cfg.position 'above' supported),
  // with NO "or" separator. Legacy cfg fields (providers/layout/separatorLabel)
  // are ignored — availability is decided natively by Shopify.
  CCD.injectExpressPayments = function(cfg) {
    cfg = cfg || {};
    var footer = document.querySelector('.ccd-sticky-footer');
    var checkoutBtn = footer && footer.querySelector('.ccd-checkout-btn');
    if (!footer || !checkoutBtn) return;

    var position = cfg.position === 'above' ? 'above' : 'below';

    var wrap = document.getElementById('ccd-express-payments');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'ccd-express-payments';
    }
    wrap.className = 'ccd-express ccd-express--' + position + ' ccd-express--native';

    // Move the native host (rendered by Liquid) into our wrapper. If it isn't
    // present (e.g. dev/self-render path with no app-embed), the wrapper stays
    // empty and nothing is shown — exactly the desired behavior for shops with
    // no express wallets.
    var host = document.getElementById('ccd-native-express-host');
    if (host) {
      host.hidden = false;
      host.removeAttribute('aria-hidden');
      host.style.display = '';
      if (host.parentNode !== wrap) wrap.appendChild(host);
    }

    // Per-wallet hide toggles (cfg.hiddenWallets). The shop owner may use Stripe
    // (not Shopify Payments) and thus can't drop wallets server-side, so we hide
    // them client-side with display:none CSS scoped to the native host. These are
    // best-effort selectors — Shopify's wallet markup is not a stable contract.
    // CAVEAT: PayPal renders inside a cross-origin iframe; we can only hide its
    // container element (.paypal-buttons), not anything inside the iframe.
    var WALLET_SELECTORS = {
      shopPay:   ['shop-pay-button', '[aria-label*="Shop Pay" i]'],
      applePay:  ['[aria-label*="Apple Pay" i]', '.shopify-payment-button__button--apple-pay', '.apple-pay'],
      googlePay: ['[aria-label*="Google Pay" i]', 'google-pay-button', '.google-pay'],
      paypal:    ['[aria-label*="PayPal" i]', '.paypal-buttons', '[data-funding-source="paypal"]']
    };
    var hiddenWallets = Array.isArray(cfg.hiddenWallets) ? cfg.hiddenWallets : [];
    var hideCss = '';
    for (var hw = 0; hw < hiddenWallets.length; hw++) {
      var sels = WALLET_SELECTORS[hiddenWallets[hw]];
      if (!sels) continue;
      var scoped = [];
      for (var s = 0; s < sels.length; s++) scoped.push('#ccd-native-express-host ' + sels[s]);
      hideCss += scoped.join(',') + '{display:none !important;}';
    }
    // Base layout: normalize the native wallets to full-width, stacked, so that
    // when wallets are hidden the remaining buttons stretch to fill the cart width
    // instead of leaving a gap. Best-effort across Shopify dynamic-checkout markup.
    var baseCss =
      '#ccd-native-express-host{display:flex;flex-direction:column;gap:8px;width:100%;}'
      + '#ccd-native-express-host>*,'
      + '#ccd-native-express-host .shopify-payment-button,'
      + '#ccd-native-express-host .additional-checkout-buttons,'
      + '#ccd-native-express-host .additional-checkout-button,'
      + '#ccd-native-express-host [data-shopify="dynamic-checkout-cart"],'
      + '#ccd-native-express-host .dynamic-checkout__content'
      + '{width:100% !important;max-width:100% !important;margin-left:0 !important;margin-right:0 !important;}'
      + '#ccd-native-express-host .additional-checkout-buttons ul{display:flex !important;flex-direction:column !important;gap:8px !important;width:100% !important;margin:0 !important;padding:0 !important;list-style:none !important;}'
      + '#ccd-native-express-host .additional-checkout-buttons li{width:100% !important;}';
    var hideStyle = document.getElementById('ccd-express-hide-style');
    if (!hideStyle) { hideStyle = document.createElement('style'); hideStyle.id = 'ccd-express-hide-style'; }
    hideStyle.textContent = baseCss + hideCss;
    wrap.appendChild(hideStyle);

    if (position === 'above') {
      if (wrap.parentNode !== footer || wrap.nextSibling !== checkoutBtn) {
        footer.insertBefore(wrap, checkoutBtn);
      }
    } else {
      // directly below the checkout button (wallets sit immediately beneath it;
      // the .ccd-trust returns line, if any, stays below the wallets).
      var afterRef = checkoutBtn.nextSibling;
      if (afterRef) { if (afterRef !== wrap) footer.insertBefore(wrap, afterRef); }
      else footer.appendChild(wrap);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { CCD.init(); });
  } else {
    CCD.init();
  }

  // No MutationObserver needed — we control our own drawer open/close via openDrawer()/closeDrawer()
  // Protection is handled inside refreshOnOpen's loadExperiment callback

  window.CustomCartDrawer = CCD;
  window.CCD = CCD;
})();
