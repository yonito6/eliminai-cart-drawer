/* ============================================
   CUSTOM CART DRAWER — JavaScript v14
   Smart DOM morph (no blink), watch case auto-add,
   scroll overflow indicator, trust icon, gift item
   ============================================ */
(function() {
  // === THEME CART OVERRIDE ===
  // Neutralize the theme's cart rebuild to prevent flicker during our animations.
  // Every major cart app (Rebuy, Slide Cart, EliteCart) does this.
  // We override buildCart + block cart events during our animations.
  (function() {
    // 1. Override theme.cart.buildCart when it becomes available
    var _checkTheme = setInterval(function() {
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
  var PROT = CFG.protectionHandle || 'shipping-protection-1';
  var PROT_VID = parseInt(CFG.protectionVariantId) || 47779174023419;
  // ── Dynamic reward tiers (from dashboard config) ──
  var REWARD_TIERS = CFG.tiers || [];
  var THRESHOLD_MODE = CFG.thresholdMode || 'items'; // 'items' or 'dollars'
  var HIGHEST_TIER_ONLY = !!CFG.highestTierOnly;
  var ALL_REWARDS_TEXT = CFG.allRewardsUnlockedText || '\uD83C\uDF89 You\u2019ve unlocked all rewards!';
  // Backwards compat: derive PROMO_GOAL from last tier's goal
  var PROMO_GOAL = REWARD_TIERS.length > 0 ? REWARD_TIERS[REWARD_TIERS.length - 1].goal : (CFG.promoGoal || 3);
  // Build a set of all gift handles across tiers
  var GIFT_HANDLES = {};
  var GIFT_TIERS = []; // tiers that have a gift product
  REWARD_TIERS.forEach(function(t) {
    if (t.giftProduct && t.giftProduct.handle) {
      GIFT_HANDLES[t.giftProduct.handle] = true;
      GIFT_TIERS.push(t);
    }
  });
  // Legacy single gift (backwards compat for stores not yet using tiers)
  var WATCH_CASE_HANDLE = CFG.giftHandle || (GIFT_TIERS.length > 0 ? GIFT_TIERS[GIFT_TIERS.length - 1].giftProduct.handle : 'eleganto-premium-watch-organizer');
  var WATCH_CASE_VID = parseInt(CFG.giftVariantId) || (GIFT_TIERS.length > 0 ? GIFT_TIERS[GIFT_TIERS.length - 1].giftProduct.variantId : 46941745742075);
  var WATCH_GOAL = CFG.giftGoal || (GIFT_TIERS.length > 0 ? GIFT_TIERS[GIFT_TIERS.length - 1].goal : 3);
  var busy = false;
  var _pendingOp = null; // queued operation when busy
  var protectionDone = false;
  var toggling = false;
  var watchCaseBusy = false;
  var scarcityVariantId = null;
  try { scarcityVariantId = sessionStorage.getItem('ccd_scarcity_vid'); } catch(e) {}
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

    fixMobileWidth: function() {
      var drawer = document.getElementById('CartDrawer');
      if (!drawer) return;
      var vw = window.innerWidth;
      if (vw > 0 && vw < 385) {
        // Only fix small Android screens (Galaxy ~360px). iPhones (390px+) untouched. — looks identical on iPhone and Galaxy
        drawer.style.setProperty('max-width', 'calc(100vw - 16px)', 'important');
      }
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
    init: function() {
      // VERSION STAMP — remove after debugging
      console.log('%c[CCD v14.15] Cart drawer loaded', 'background:#6b21a8;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold');
      window.__ccd_version = '14.8-debug';
      this.fixMobileWidth();
      this.bindEvents();
      this.interceptAddToCart();
      this.setupScrollIndicator();
      this.buildProgressBar();
      this.updateProgress();
      this.checkOverflow();
      // Pre-fetch experiment config on page load so cart opens instantly
      this.loadExperiment(function() {}, true);
      // Remove instant class only on first user interaction with the toggle
      var tglInput = document.getElementById("ccd-shipping-toggle");
      if (tglInput) {
        tglInput.addEventListener("change", function onFirstToggle() {
          var sl = tglInput.nextElementSibling;
          if (sl) sl.classList.remove("ccd-toggle--instant");
          tglInput.removeEventListener("change", onFirstToggle);
        });
      }
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

    bindEvents: function() {

      // Reset checkout button when returning via back button (bfcache)
      window.addEventListener("pageshow", function(e) {
        var btn = document.querySelector(".ccd-checkout-btn--loading");
        if (btn) {
          btn.classList.remove("ccd-checkout-btn--loading");
          /*<svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg> ' + lbl + ' · <span class="ccd-checkout-total" data-subtotal>' + tot + '</span>'; */
        }
      });

      // Checkout button loading — CSS-only, never touch innerHTML
      document.addEventListener('click', function(e) {
        var checkoutBtn = e.target.closest('.ccd-checkout-btn');
        if (checkoutBtn && !checkoutBtn.classList.contains('ccd-checkout-btn--loading')) {
          checkoutBtn.classList.add('ccd-checkout-btn--loading');
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
            item.classList.add('ccd-item--removing');

            var _h = item.offsetHeight;
            item.style.maxHeight = _h + 'px';
            item.style.overflow = 'hidden';
            item.offsetHeight;
            item.style.transition = 'max-height 0.22s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.12s ease, padding 0.22s cubic-bezier(0.4, 0, 0.2, 1), margin 0.22s cubic-bezier(0.4, 0, 0.2, 1), border-width 0.22s ease';
            item.style.opacity = '0';
            item.style.maxHeight = '0';
            item.style.paddingTop = '0';
            item.style.paddingBottom = '0';
            item.style.marginTop = '0';
            item.style.marginBottom = '0';
            item.style.borderWidth = '0';
            setTimeout(function() { if (item.parentNode) item.remove(); }, 240);
          }
          var rmKey = removeBtn.dataset.key;
          if (CCD._caseKey && rmKey === CCD._caseKey) {
            caseDismissed = true;
            try { sessionStorage.setItem('ccd_case_dismissed', '1'); } catch(ex) {}
          }
          // If removing a watch might drop below gift goal, hide gift instantly
          var curWatchCount = parseInt((document.querySelector(".cart__items") || {}).dataset && document.querySelector(".cart__items").dataset.watchCount || "0");
          if (curWatchCount <= WATCH_GOAL) {
            var gEl = document.querySelector('#CartDrawer .ccd-item[data-gift="1"]');
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
            var gh = giftItem.offsetHeight;
            giftItem.style.maxHeight = gh + 'px';
            giftItem.style.overflow = 'hidden';
            giftItem.offsetHeight;
            giftItem.style.transition = 'max-height 0.15s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.1s ease, padding 0.15s cubic-bezier(0.4, 0, 0.2, 1), margin 0.15s cubic-bezier(0.4, 0, 0.2, 1)';
            giftItem.style.opacity = '0';
            giftItem.style.maxHeight = '0';
            giftItem.style.paddingTop = '0';
            giftItem.style.paddingBottom = '0';
            giftItem.style.marginTop = '0';
            giftItem.style.marginBottom = '0';
          }
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
      // Block increasing scarcity item above 1
      if (scarcityVariantId && qty > 1) {
        var keyVid = String(key).split(':')[0];
        if (keyVid === scarcityVariantId) {
          CCD.showScarcityToast(CFG.scarcityToastMsg || CFG.scarcityText || 'Only 1 left!');
          return;
        }
      }
      busy = true;
      if (btnEl) btnEl.classList.add('ccd-qty__btn--loading');
      var item = btnEl ? btnEl.closest('.ccd-item') : null;
      if (item && qty === 0) item.classList.add('ccd-item--removing');

      fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: key, quantity: qty })
      })
      .then(function(r) { return r.json(); })
      .then(function(cart) {
        window.__ccd_last_cart = cart;
        busy = false;
        if (btnEl) btnEl.classList.remove('ccd-qty__btn--loading');
        // Execute queued operation if any
        if (_pendingOp) {
          var p = _pendingOp;
          _pendingOp = null;
          // Start collapse animation for queued removes
          if (p.qty === 0) {
            var qItem = p.btnEl ? p.btnEl.closest('.ccd-item') : document.querySelector('.ccd-item[data-key="' + p.key + '"]');
            if (qItem && !qItem.classList.contains('ccd-item--removing')) {
              qItem.classList.add('ccd-item--removing');
              var _qh = qItem.offsetHeight;
              qItem.style.maxHeight = _qh + 'px';
              qItem.style.overflow = 'hidden';
              qItem.offsetHeight;
              qItem.style.transition = 'max-height 0.22s cubic-bezier(0.4,0,0.2,1), opacity 0.12s ease, padding 0.22s cubic-bezier(0.4,0,0.2,1), margin 0.22s cubic-bezier(0.4,0,0.2,1), border-width 0.22s ease';
              qItem.style.opacity = '0';
              qItem.style.maxHeight = '0';
              qItem.style.paddingTop = '0';
              qItem.style.paddingBottom = '0';
              qItem.style.marginTop = '0';
              qItem.style.marginBottom = '0';
              qItem.style.borderWidth = '0';
              setTimeout(function() { if (qItem.parentNode) qItem.remove(); }, 240);
            }
          }
          CCD.changeQty(p.key, p.qty, p.btnEl);
          return; // skip the rest — the queued changeQty will handle it
        }
        var _isRemoving = window.__ccd_is_removing;
        window.__ccd_is_removing = false;
        if (_isRemoving) {
          // Item removed — lightweight update (skip morphDOM to avoid flicker)
          // Minimal update: only bubble + totals, zero DOM ops on items
          var _b = document.querySelector('.cart-link__bubble');
          if (_b) _b.classList.toggle('cart-link__bubble--visible', cart.item_count > 0);
          var _bn = document.querySelector('.cart-link__bubble-num');
          if (_bn) _bn.textContent = CCD.getRealCount(cart);
          var _ct = document.querySelector('.ccd-checkout-total');
          if (_ct) _ct.textContent = CCD.fmt(cart.total_price);
          var _st = document.querySelector('#CartDrawer [data-subtotal]');
          if (_st) _st.textContent = CCD.fmt(cart.total_price);
          // Update progress with real cart data
          CCD.updateProgress(cart);

          var _rc = CCD.getRealCount(cart);
          if (_rc === 0) {
            setTimeout(function() { window.__ccd_block_rebuild = false; CCD.refresh(cart); }, 50);
          } else {
            // After removing items, always do a full refresh from server.
            // Shopify discount engine (Buy X Get Y) recalculates line items
            // after removes — /cart/change.js can return stale allocations.
            // Delayed /cart.js + full server HTML re-render ensures correct prices.
            window.__ccd_block_rebuild = false;
            setTimeout(function() {
              fetch("/cart.js").then(function(r) { return r.json(); }).then(function(freshCart) {
                CCD.refresh(freshCart);
              });
            }, 350);
          }
        } else {
          CCD.refresh(cart);
        }
      })
      .catch(function() {
        window.__ccd_block_rebuild = false;
        busy = false;
        if (btnEl) btnEl.classList.remove('ccd-qty__btn--loading');
        if (item) item.classList.remove('ccd-item--removing');
        // Execute queued operation if any
        if (_pendingOp) {
          var p = _pendingOp;
          _pendingOp = null;
          CCD.changeQty(p.key, p.qty, p.btnEl);
        }
      });
    },

    toggleProtection: function(isChecked) {
      if (toggling) return; // block rapid clicks
      toggling = true;
      var cb = document.getElementById('ccd-shipping-toggle');
      if (cb) cb.disabled = true; // disable checkbox during API call

      var ct = document.querySelector('.ccd-checkout-total');
      var st = document.querySelector('#CartDrawer [data-subtotal]');
      var cie = document.querySelector('#CartDrawer .cart__items');
      var currentTotal = cie ? parseInt(cie.getAttribute('data-cart-subtotal') || '0', 10) : 0;
      if (isNaN(currentTotal) || currentTotal < 0) currentTotal = 0;
      var newTotal = isChecked ? currentTotal + 499 : Math.max(0, currentTotal - 499);
      if (isNaN(newTotal) || newTotal < 0) newTotal = 0;
      if (ct) ct.textContent = CCD.fmt(newTotal);
      if (st) st.textContent = CCD.fmt(newTotal);

      var unlock = function() { toggling = false; if (cb) cb.disabled = false; };

      if (isChecked) {
        fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [{ id: PROT_VID, quantity: 1 }] })
        })
        .then(function() { return fetch('/cart.js'); })
        .then(function(r) { return r.json(); })
        .then(function(cart) { unlock(); CCD.refresh(cart); })
        .catch(function() { unlock(); });
      } else {
        if (CCD._protKey) {
          fetch('/cart/change.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: CCD._protKey, quantity: 0 })
          })
          .then(function(r) { return r.json(); })
          .then(function(c) { CCD._protKey = null; unlock(); CCD.refresh(c); })
          .catch(function() { unlock(); });
        } else {
          fetch('/cart.js')
          .then(function(r) { return r.json(); })
          .then(function(cart) {
            var item = cart.items.find(function(i) { return i.handle === PROT; });
            if (item) {
              fetch('/cart/change.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: item.key, quantity: 0 })
              })
              .then(function(r) { return r.json(); })
              .then(function(c) { CCD._protKey = null; unlock(); CCD.refresh(c); })
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
      if (protectionDone || toggling) return;
      protectionDone = true;
      fetch('/cart.js')
      .then(function(r) { return r.json(); })
      .then(function(cart) {
        var rc = CCD.getRealCount(cart);
        if (rc === 0) return;
        var has = cart.items.some(function(i) { return i.handle === PROT; });
        if (!has) {
          fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: [{ id: PROT_VID, quantity: 1 }] })
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
        if (CFG.scarcityEnabled === false) return;
        // Read fresh from sessionStorage every time (not stale closure)
        var sVid = null;
        try { sVid = sessionStorage.getItem("ccd_scarcity_vid"); } catch(ex) {}
        if (!sVid) return;
        // Extract variant ID from form
        var vidInput = form.querySelector("input[name=id], select[name=id]");
        var formVid = vidInput ? String(vidInput.value) : null;
        if (!formVid) return;
        if (formVid === sVid) {
          e.preventDefault();
          e.stopImmediatePropagation();
          CCD.showScarcityToast(CFG.scarcityToastMsg || CFG.scarcityText || "Only 1 left — already in your cart!");
          return;
        }
      }, true); // useCapture=true to fire BEFORE theme handlers

      var origFetch = window.fetch;
      window.fetch = function(url, opts) {
        if (typeof url === 'string' && url.indexOf('/cart/add') !== -1 && opts && opts.method && opts.method.toUpperCase() === 'POST') {
          try {
            var body = JSON.parse(opts.body);
            if (body && body.items && Array.isArray(body.items)) {
              var hasProt = body.items.some(function(it) { return it.id === PROT_VID || it.id === String(PROT_VID); });
              if (!hasProt && !protectionDone) {
                body.items.push({ id: PROT_VID, quantity: 1 });
                opts.body = JSON.stringify(body);
                protectionDone = true;
              }
            }
          } catch(ex) {}

          // Scarcity check: block adding more of the locked item
          // Read fresh from sessionStorage (not stale closure variable)
          try { scarcityVariantId = sessionStorage.getItem("ccd_scarcity_vid"); } catch(svEx) {}
          if (CFG.scarcityEnabled !== false && scarcityVariantId) {
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
              CCD.showScarcityToast(CFG.scarcityToastMsg || CFG.scarcityText || 'Only 1 left — already in your cart!');
              return Promise.resolve(new Response(JSON.stringify({status:422, message:"Cart Error", description:"Only 1 left"}), {status: 422, statusText: "Unprocessable Entity", headers: {"Content-Type": "application/json"}}));
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

          return origFetch.call(this, url, opts).then(function(resp) {
            var clone = resp.clone();
            clone.json().then(function() {
              origFetch('/cart.js').then(function(r) { return r.json(); }).then(function(cart) {
                CCD.refresh(cart);
                var d = document.getElementById('CartDrawer');
                if (d && !d.classList.contains('drawer--is-open')) {
                  d.classList.add('drawer--is-open');
                  d.style.display = 'flex';
                }
              });
            }).catch(function(){});
            return resp;
          });
        }
        return origFetch.apply(this, arguments);
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
          if (CFG.scarcityEnabled !== false && scarcityVariantId && body) {
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
            CCD.showScarcityToast(CFG.scarcityToastMsg || CFG.scarcityText || 'Only 1 left — already in your cart!');
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
      var dr = document.querySelector('[data-ccd-discounts]');
      if (!dr) return;

      if (!cart || cart.total_discount <= 0) {
        dr.style.display = 'none';
        return;
      }

      var discounts = [];
      var seenTitles = {};

      if (cart.cart_level_discount_applications) {
        cart.cart_level_discount_applications.forEach(function(d) {
          if (d.title && !seenTitles[d.title]) {
            discounts.push(d.title);
            seenTitles[d.title] = true;
          }
        });
      }

      if (cart.items) {
        cart.items.forEach(function(item) {
          if (item.line_level_discount_allocations) {
            item.line_level_discount_allocations.forEach(function(a) {
              var title = a.discount_application ? a.discount_application.title : '';
              if (title && !seenTitles[title]) {
                discounts.push(title);
                seenTitles[title] = true;
              }
            });
          }
        });
      }

      if (discounts.length > 0) {
        dr.style.display = 'flex';
        var badgesHtml = discounts.map(function(title) {
          return '<span class="ccd-discount-row__promo-name">' + TAG_SVG + ' ' + title + '</span>';
        }).join(' ');
        dr.innerHTML = '<div class="ccd-discount-row__left">' +
          '<span class="ccd-discount-row__label">Discount</span> ' +
          badgesHtml +
          '</div>' +
          '<span class="ccd-discount-row__amount">-' + CCD.fmt(cart.total_discount) + '</span>';
      } else {
        dr.style.display = 'none';
      }
    },

    checkWatchCase: function(cart) {
      if (watchCaseBusy) return;
      if (!cart || !cart.items) return;

      var score = THRESHOLD_MODE === 'dollars'
        ? (cart.total_price / 100)
        : CCD.getRealCount(cart);

      // Build map of gift handles currently in cart
      var giftInCart = {}; // handle → { key, qty }
      cart.items.forEach(function(i) {
        if (GIFT_HANDLES[i.handle]) {
          giftInCart[i.handle] = { key: i.key, qty: i.quantity };
        }
        // Legacy single gift compat
        if (i.handle === WATCH_CASE_HANDLE) {
          giftInCart[i.handle] = { key: i.key, qty: i.quantity };
        }
      });

      // Determine which gifts SHOULD be in cart
      var shouldHave = {}; // handle → variantId
      if (GIFT_TIERS.length > 0) {
        // New tier-based gifts
        var eligibleGifts = [];
        GIFT_TIERS.forEach(function(t) {
          if (t.giftProduct && t.giftProduct.handle && score >= t.goal) {
            eligibleGifts.push(t);
          }
        });
        if (HIGHEST_TIER_ONLY && eligibleGifts.length > 0) {
          // Only keep the highest tier gift
          var highest = eligibleGifts[eligibleGifts.length - 1];
          shouldHave[highest.giftProduct.handle] = highest.giftProduct.variantId;
        } else {
          eligibleGifts.forEach(function(t) {
            shouldHave[t.giftProduct.handle] = t.giftProduct.variantId;
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
        fetch('/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: fixKey, quantity: 1 })
        })
        .then(function(r) { return r.json(); })
        .then(function(c) { watchCaseBusy = false; CCD.refresh(c); })
        .catch(function() { watchCaseBusy = false; });
        return;
      }

      // ADD gifts that should be in cart but aren't
      var toAdd = [];
      Object.keys(shouldHave).forEach(function(h) {
        if (!giftInCart[h] && !caseDismissed) {
          toAdd.push({ id: shouldHave[h], quantity: 1, properties: { _eliminai_gift: 'true' } });
        }
      });

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

      // Execute removals first, then adds
      if (toRemove.length > 0) {
        watchCaseBusy = true;
        // Instantly hide from DOM
        document.querySelectorAll('#CartDrawer .ccd-item[data-gift="1"]').forEach(function(el) { el.remove(); });
        var removeChain = Promise.resolve();
        toRemove.forEach(function(key) {
          removeChain = removeChain.then(function() {
            return fetch('/cart/change.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: key, quantity: 0 })
            });
          });
        });
        removeChain.then(function() {
          if (toAdd.length > 0) {
            return fetch('/cart/add.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items: toAdd })
            });
          }
        })
        .then(function() { return fetch('/cart.js'); })
        .then(function(r) { return r.json(); })
        .then(function(c) { watchCaseBusy = false; CCD.refresh(c); })
        .catch(function() { watchCaseBusy = false; });
      } else if (toAdd.length > 0) {
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
      }

      // Update _caseKey for dismiss tracking (use first gift found)
      CCD._caseKey = null;
      Object.keys(giftInCart).forEach(function(h) {
        if (!CCD._caseKey) CCD._caseKey = giftInCart[h].key;
      });
    },

    /* Smart DOM morph — updates items in-place, preserves images (no blink) */
    morphDOM: function(container, newCartItems) {
      var existing = container.querySelector('.cart__items');
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
            if (el.classList.contains('ccd-item--removing')) { return; } // already collapsing — let CSS animation finish
          el.classList.add('ccd-item--removing');
          var h = el.offsetHeight;
          el.style.maxHeight = h + 'px';
          el.style.overflow = 'hidden';
          el.offsetHeight; /* force reflow */
          el.style.transition = 'max-height 0.15s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.1s ease, padding 0.15s cubic-bezier(0.4, 0, 0.2, 1), margin 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-width 0.15s ease';
          el.style.opacity = '0';
          el.style.maxHeight = '0';
          el.style.paddingTop = '0';
          el.style.paddingBottom = '0';
          el.style.marginTop = '0';
          el.style.marginBottom = '0';
          el.style.borderWidth = '0';
          setTimeout(function() { el.remove(); }, 180);
        }
      });

      var giftEl = existing.querySelector('.ccd-gift-item');
      // Smooth reflow: only when items are being removed
      var hasRemovals = Object.keys(existMap).some(function(k) { return !newList.some(function(n) { return n.key === k; }); });
      if (hasRemovals) Object.keys(existMap).forEach(function(k) {
        var rl = existMap[k];
        if (!rl.classList.contains('ccd-item--removing')) {
          rl.style.transition = 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)';
          var cl = function() { rl.style.transition = ''; rl.removeEventListener('transitionend', cl); };
          rl.addEventListener('transitionend', cl);
        }
      });

      newList.forEach(function(n) {
        if (existMap[n.key]) {
          var ex = existMap[n.key];
          var exInp = ex.querySelector('.ccd-qty__input');
          var nInp = n.el.querySelector('.ccd-qty__input');
          if (exInp && nInp && exInp.value !== nInp.value) {
            exInp.value = nInp.value;

          } else if (exInp && nInp && exInp.value !== nInp.value) {
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
      var container = document.querySelector("#CartDrawer .cart__items");
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

        // Find the gift rendered as a regular .ccd-item
        var giftEl = null;
        container.querySelectorAll('.ccd-item').forEach(function(el) {
          var rmBtn = el.querySelector('.ccd-item__remove');
          if (rmBtn && rmBtn.dataset.key === giftKey) giftEl = el;
        });
        if (!giftEl) return;

        // 1. Move to bottom
        if (giftEl.nextElementSibling) container.appendChild(giftEl);

        // 2. Hide qty buttons
        var qtyWrap = giftEl.querySelector('.ccd-qty');
        if (qtyWrap) qtyWrap.style.display = 'none';
        var priceColEl = giftEl.querySelector('.ccd-item__price-col');
        if (priceColEl) priceColEl.style.marginLeft = 'auto';

        // 3. Add "Bonus gift" badge
        if (!giftEl.querySelector('.ccd-gift-badge')) {
          var badge = document.createElement('span');
          badge.className = 'ccd-gift-badge';
          badge.innerHTML = GIFT_SVG + ' Bonus gift';
          var priceCol = giftEl.querySelector('.ccd-item__price-col');
          if (priceCol) priceCol.appendChild(badge);
        }

        // 4. Set price to "Free" with compare price
        var priceEl = giftEl.querySelector('.ccd-item__price');
        if (priceEl) {
          priceEl.textContent = 'Free';
          priceEl.classList.add('ccd-item__price--free');
        }
        var origPrice = giftCartItem.original_price || giftCartItem.price || 0;
        var priceRow = giftEl.querySelector('.ccd-item__price-row') || (priceEl ? priceEl.parentElement : null);
        if (priceRow && !priceRow.querySelector('.ccd-item__compare-price') && origPrice > 0) {
          var cp = document.createElement('span');
          cp.className = 'ccd-item__compare-price';
          cp.textContent = CCD.fmt(origPrice);
          priceRow.insertBefore(cp, priceRow.firstChild);
        }

        // 5. Mark gift for dismiss tracking
        giftEl.setAttribute('data-gift', '1');
      });
    },
    // Lightweight refresh: update totals, progress, empty state — NO morphDOM
    refreshLight: function(cart) {
      var bubble = document.querySelector('.cart-link__bubble');
      if (bubble) bubble.classList.toggle('cart-link__bubble--visible', cart.item_count > 0);
      var bubbleNum = document.querySelector('.cart-link__bubble-num');
      if (bubbleNum) bubbleNum.textContent = CCD.getRealCount(cart);
      CCD.enforceGiftItem(cart);
      var ct = document.querySelector('.ccd-checkout-total');
      if (ct) ct.textContent = CCD.fmt(cart.total_price);
      var st = document.querySelector('#CartDrawer [data-subtotal]');
      if (st) st.textContent = CCD.fmt(cart.total_price);
      CCD.rebuildDiscountRow(cart);
      var protItem = cart.items.find(function(i) { return i.handle === PROT; });
      CCD._protKey = protItem ? protItem.key : null;
      CCD.setToggleNoTransition(!!protItem);
      var cie = document.querySelector('#CartDrawer .cart__items');
      if (cie) {
        cie.setAttribute('data-real-count', CCD.getRealCount(cart));
        cie.setAttribute('data-unique-count', CCD.getUniqueVariants(cart));
        cie.setAttribute('data-cart-subtotal', cart.total_price);
      }
      CCD.updateProgress(cart);
      CCD.applyScarcity(cart);
      CCD.lockScarcityQty();
      var rc = CCD.getRealCount(cart);
      var es = document.querySelector('#CartDrawer .drawer__cart-empty');
      var id = document.querySelector('#CartDrawer [data-ccd-inner]');
      var pb = document.querySelector('[data-ccd-progress]');
      var ft = document.querySelector('[data-ccd-footer]');
      if (rc === 0) {
        if (cart.item_count > 0) {
          cart.items.filter(function(i) { return CCD._isExcludedHandle(i.handle); }).forEach(function(pi) {
            fetch('/cart/change.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: pi.key, quantity: 0 }) });
          });
        }
        if (es) es.style.display = 'block';
        if (id) id.style.display = 'none';
        if (pb) pb.style.display = 'none';
        if (ft) ft.style.display = 'none';
      } else {
        if (es) es.style.display = 'none';
        if (id) id.style.display = '';
        if (pb) pb.style.display = '';
        if (ft) ft.style.display = '';
      }
    },
    refresh: function(cart) {
      console.log('[CCD] refresh() called', new Error().stack.split('\n')[2]);
      var bubble = document.querySelector('.cart-link__bubble');
      if (bubble) bubble.classList.toggle('cart-link__bubble--visible', cart.item_count > 0);
      var bubbleNum = document.querySelector('.cart-link__bubble-num');
      if (bubbleNum) bubbleNum.textContent = CCD.getRealCount(cart);

      fetch('/cart?view=ajax')
      .then(function(r) { return r.text(); })
      .then(function(html) {
        var pc = document.querySelector('#CartDrawer [data-products]');
        if (pc) {
          var parser = new DOMParser();
          var doc = parser.parseFromString(html, 'text/html');
          var ni = doc.querySelector('.cart__items');
          if (ni) {
            CCD.morphDOM(pc, ni);
          }
        }

        CCD.enforceGiftItem(cart);

        var ct = document.querySelector('.ccd-checkout-total');
        if (ct) ct.textContent = CCD.fmt(cart.total_price);
        var st = document.querySelector('#CartDrawer [data-subtotal]');
        if (st) st.textContent = CCD.fmt(cart.total_price);

        CCD.rebuildDiscountRow(cart);

        var protItem = cart.items.find(function(i) { return i.handle === PROT; });
        CCD._protKey = protItem ? protItem.key : null;
        CCD.setToggleNoTransition(!!protItem);

        var cie = document.querySelector('#CartDrawer .cart__items');
        if (cie) {
          var whs = (cie.getAttribute('data-watch-handles') || '').split(',').filter(Boolean);
          if (whs.length > 0) CCD._watchHandles = whs;
        }

        if (cie) {
          cie.setAttribute('data-real-count', CCD.getRealCount(cart));
          cie.setAttribute('data-unique-count', CCD.getUniqueVariants(cart));
          cie.setAttribute('data-cart-subtotal', cart.total_price);
        }

        CCD.updateProgress(cart);
        CCD.applyScarcity(cart);
        CCD.lockScarcityQty();

        var rc = CCD.getRealCount(cart);
        var es = document.querySelector('#CartDrawer .drawer__cart-empty');
        var id = document.querySelector('#CartDrawer [data-ccd-inner]');
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
          if (es) es.style.display = 'block';
          if (id) id.style.display = 'none';
          if (pb) pb.style.display = 'none';
          if (ft) ft.style.display = 'none';
          protectionDone = false;
        } else {
          if (es) es.style.display = 'none';
          if (id) id.style.display = 'flex';
          if (pb) pb.style.display = 'block';
          if (ft) ft.style.display = 'block';
        }

        CCD.checkWatchCase(cart);
        CCD.checkOverflow();
      });
    },

    getScarcitySvg: function() {
      var icon = CFG.scarcityIcon || 'fire';
      if (icon === 'fire') return FIRE_SVG;
      if (icon === 'clock') return CLOCK_SVG;
      if (icon === 'warning') return WARN_SVG;
      return '';
    },

    applyScarcity: function(cart) {
      if (CFG.scarcityEnabled === false) return;
      if (!cart || !cart.items) return;

      var realItems = cart.items.filter(function(it) {
        return !CCD._isExcludedHandle(it.handle);
      });
      var targetVid = null;
      var target = CFG.scarcityTarget || '2';

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
          // Pick the variant with LOWEST total qty (the one just added)
          var tNum = parseInt(target) || 1;
          var qtyByVid = {};
          var firstIdx = {};
          for (var i = 0; i < realItems.length; i++) {
            var vid = realItems[i].variant_id;
            if (!qtyByVid[vid]) {
              qtyByVid[vid] = 0;
              firstIdx[vid] = i;
            }
            qtyByVid[vid] += realItems[i].quantity;
          }
          var uniqueVids = Object.keys(qtyByVid);
          if (uniqueVids.length >= tNum) {
            // Find the variant with lowest total qty; ties broken by last in array (newest)
            var bestVid = null;
            var bestQty = Infinity;
            var bestIdx = -1;
            for (var v = 0; v < uniqueVids.length; v++) {
              var thisVid = uniqueVids[v];
              var thisQty = qtyByVid[thisVid];
              var thisIdx = firstIdx[thisVid];
              if (thisQty < bestQty || (thisQty === bestQty && thisIdx > bestIdx)) {
                bestQty = thisQty;
                bestVid = thisVid;
                bestIdx = thisIdx;
              }
            }
            if (bestVid) idx = firstIdx[bestVid];
          }
        }

        if (idx >= 0) {
          targetVid = String(realItems[idx].variant_id);
          // Force qty to 1 if target has more than 1
          if (realItems[idx].quantity > 1) {
            fetch('/cart/change.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: realItems[idx].key, quantity: 1 })
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
      var items = document.querySelectorAll('#CartDrawer .ccd-item');
      items.forEach(function(el) {
        var inp = el.querySelector('.ccd-qty__input');
        var existingBadge = el.querySelector('.ccd-scarcity-badge');
        var itemVid = inp ? String(inp.dataset.id).split(':')[0] : '';

        if (targetVid && inp && itemVid === targetVid) {
          if (!existingBadge) {
            var badge = document.createElement('span');
            badge.className = 'ccd-scarcity-badge';
            badge.innerHTML = CCD.getScarcitySvg() + ' ' + (CFG.scarcityText || 'Only 1 left!');
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
      if (CFG.scarcityEnabled === false || !scarcityVariantId) return;
      var items = document.querySelectorAll('#CartDrawer .ccd-item');
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
        cartTotal = (cart.total_price || 0) / 100;
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

      // Legacy fallback when no dynamic tiers configured
      if (!tiers || tiers.length === 0) {
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
        if (allReached) {
          msgEl.innerHTML = ALL_REWARDS_TEXT;
          msgEl.classList.add('ccd-progress__message--done');
        } else {
          var nextTier = null;
          for (var ti = 0; ti < tiers.length; ti++) { if (currentValue < tiers[ti].goal) { nextTier = tiers[ti]; break; } }
          if (nextTier && nextTier.beforeText) {
            var tierRem = Math.max(0, nextTier.goal - currentValue);
            var unit = THRESHOLD_MODE === 'dollars' ? '$' + tierRem.toFixed(0) : tierRem;
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

      // Sync all milestone pulse animations to same cycle (skip on reopen to avoid blink)
      if (!skipAnim) {
        var reachedEls = document.querySelectorAll('.ccd-progress__icon--reached');
        if (reachedEls.length > 0) {
          reachedEls.forEach(function(el) { el.style.animation = 'none'; });
          void document.body.offsetHeight;
          reachedEls.forEach(function(el) { el.style.animation = ''; });
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
      var self = this;
      this.loadExperiment(function(config) {
        if (config) self.applyExperimentFeatures(config);
        // Track CART_OPENED on first actual cart open (not on pre-fetch)
        if (!self._cartOpenTracked) {
          self._cartOpenTracked = true;
          self.sendEvent('CART_OPENED', { source: 'client-open' });
        }
      });
      CCD.fixMobileWidth();
      fetch('/cart.js')
      .then(function(r) { return r.json(); })
      .then(function(cart) {
        CCD.refresh(cart);
      })
      .catch(function() {});
    },

    setupScrollIndicator: function() {
      var scrollable = document.querySelector('#CartDrawer .drawer__scrollable');
      var inner = document.querySelector('#CartDrawer .drawer__inner');
      if (scrollable && inner) {
        scrollable.addEventListener('scroll', function() {
          var atBottom = scrollable.scrollHeight - scrollable.scrollTop - scrollable.clientHeight < 8;
          inner.classList.toggle('scrolled-bottom', atBottom);
        });
      }
    },

    checkOverflow: function() {
      var scrollable = document.querySelector('#CartDrawer .drawer__scrollable');
      var inner = document.querySelector('#CartDrawer .drawer__inner');
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
      var token = null;
      try { token = sessionStorage.getItem(STORAGE_KEY); } catch(e) {}
      if (token) return { token: token, isReturning: false };
      var isReturning = false;
      try {
        var prev = localStorage.getItem(STORAGE_KEY);
        if (prev) isReturning = true;
      } catch(e) {}
      token = 'ecart_' + Math.random().toString(36).substr(2) + Date.now().toString(36);
      try {
        sessionStorage.setItem(STORAGE_KEY, token);
        localStorage.setItem(STORAGE_KEY, token);
      } catch(e) {}
      return { token: token, isReturning: isReturning };
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
      scarcityTimer:        { inject: function(c) { CCD.injectScarcityTimer(c); },  remove: function() { var e = document.getElementById('ccd-scarcity-timer'); if (e) e.remove(); } },
      freeShippingBar:      { inject: function(c) { CCD.injectFreeShippingBar(c); },remove: function() { var e = document.getElementById('ccd-free-shipping-bar'); if (e) e.remove(); } },
      socialProof:          { inject: function(c) { CCD.injectSocialProof(c); },    remove: function() { var e = document.getElementById('ccd-social-proof'); if (e) e.remove(); } },
      upsellRecommendations:{ inject: function(c) { CCD.injectUpsells(c); },        remove: function() { var e = document.getElementById('ccd-upsells'); if (e) e.remove(); } }
    },

    applyExperimentFeatures: function(config) {
      if (!config) return;
      var addons = config.cartConfig && config.cartConfig.addons ? config.cartConfig.addons : {};
      var self = this;
      var show = {};

      // 1. Always-on addons (enabled + NOT being A/B tested)
      for (var k in addons) {
        if (addons[k] && addons[k].enabled && addons[k].mode !== 'locked') {
          show[k] = addons[k].config || {};
        }
      }

      // 2. A/B tested addons (mode === 'locked') — show ONLY if experiment says _enabled: true
      if (config.experiment && config.experiment.features) {
        var feat = config.experiment.features;
        for (var ak in addons) {
          if (addons[ak] && addons[ak].mode === 'locked') {
            if (feat._enabled) { show[ak] = addons[ak].config || {}; }
            else { delete show[ak]; }
          }
        }
        // Legacy feature flags
        if (feat.showTrustBadges) show.trustBadges = {};
        if (feat.showScarcityTimer) show.scarcityTimer = {};
        if (feat.showProgressBar) show.freeShippingBar = {};
        if (feat.showUpsells) show.upsellRecommendations = {};
        if (feat.showSocialProof) show.socialProof = {};
      }

      // 3. Inject shown addons, remove hidden ones
      for (var hk in self._addonHandlers) {
        if (show[hk]) { self._addonHandlers[hk].inject(show[hk]); }
        else { self._addonHandlers[hk].remove(); }
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
      if (document.getElementById('ccd-trust-badges')) return;
      cfg = cfg || {};
      var icons = cfg.icons || ['visa', 'mastercard', 'amex', 'paypal'];
      var text = cfg.text || '';
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
        textHtml = '<div class="ccd-trust-text"><svg viewBox="0 0 16 16" width="12" height="12" style="vertical-align:-1px"><path fill="#22c55e" d="M8 1a5 5 0 0 0-5 5v3a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6a5 5 0 0 0-5-5zm0 2a3 3 0 0 1 3 3v3H5V6a3 3 0 0 1 3-3z"/></svg> ' + text + '</div>';
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
  CCD.injectScarcityTimer = function(cfg) {
    if (document.getElementById('ccd-scarcity-timer')) return;
    // TODO: implement scarcity countdown timer
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
      PROMO_GOAL = REWARD_TIERS[REWARD_TIERS.length - 1].goal;
      // Rebuild gift handles map
      GIFT_HANDLES = {};
      GIFT_TIERS = [];
      REWARD_TIERS.forEach(function(t) {
        if (t.giftProduct && t.giftProduct.handle) {
          GIFT_HANDLES[t.giftProduct.handle] = true;
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
  CCD.injectUpsells = function(cfg) {
    if (document.getElementById('ccd-upsells')) return;
    // TODO: implement upsell recommendations
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { CCD.init(); });
  } else {
    CCD.init();
  }

  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      if (m.target.id === 'CartDrawer' && m.target.classList.contains('drawer--is-open')) {
        // Store the page URL the user was on when opening the cart
        if (!window._ccdReturnUrl) {
          window._ccdReturnUrl = window.location.href;
        }
        CCD.refreshOnOpen();
        CCD.ensureProtection();
      } else if (m.target.id === 'CartDrawer' && !m.target.classList.contains('drawer--is-open')) {
        // Clear when drawer closes so next open captures fresh URL
        window._ccdReturnUrl = null;
      }
    });
  });

  var drawerEl = document.getElementById('CartDrawer');
  if (drawerEl) {
    observer.observe(drawerEl, { attributes: true, attributeFilter: ['class'] });
    if (drawerEl.classList.contains('drawer--is-open')) {
      CCD.refreshOnOpen();
      CCD.ensureProtection();
    }
  }

  setTimeout(function() {
    var d = document.getElementById('CartDrawer');
    if (d && d.classList.contains('drawer--is-open')) {
      CCD.ensureProtection();
    }
  }, 1000);

  window.CustomCartDrawer = CCD;
})();
