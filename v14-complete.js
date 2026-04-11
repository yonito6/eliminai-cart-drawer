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
  var PROMO_GOAL = CFG.promoGoal || 3;
  var WATCH_CASE_HANDLE = CFG.giftHandle || 'eleganto-premium-watch-organizer';
  var WATCH_CASE_VID = parseInt(CFG.giftVariantId) || 46941745742075;
  var WATCH_GOAL = CFG.giftGoal || 3;
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

    getRealCount: function(cart) {
      var c = 0;
      if (cart && cart.items) {
        cart.items.forEach(function(i) {
          if (i.handle !== PROT && i.handle !== WATCH_CASE_HANDLE) c += i.quantity;
        });
      }
      return c;
    },

    getUniqueVariants: function(cart) {
      var seen = {}, count = 0;
      if (cart && cart.items) {
        cart.items.forEach(function(i) {
          if (i.handle !== PROT && i.handle !== WATCH_CASE_HANDLE && !seen[i.variant_id]) {
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
          if (i.handle !== PROT && i.handle !== WATCH_CASE_HANDLE) {
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

      var watchCount = CCD.getWatchCount(cart);
      var hasCase = false;
      var caseKey = null;
      var caseQty = 0;

      if (cart && cart.items) {
        cart.items.forEach(function(i) {
          if (i.handle === WATCH_CASE_HANDLE) {
            hasCase = true;
            caseKey = i.key;
            caseQty = i.quantity;
            CCD._caseKey = i.key;
          }
        });
        if (!hasCase) CCD._caseKey = null;
      }

      // GUARD: If someone got qty > 1 (manual add, race condition), force back to 1
      if (hasCase && caseQty > 1 && caseKey) {
        watchCaseBusy = true;
        fetch('/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: caseKey, quantity: 1 })
        })
        .then(function(r) { return r.json(); })
        .then(function(c) { watchCaseBusy = false; CCD.refresh(c); })
        .catch(function() { watchCaseBusy = false; });
        return;
      }

      if (watchCount >= WATCH_GOAL && !hasCase && !caseDismissed) {
        watchCaseBusy = true;
        fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [{ id: WATCH_CASE_VID, quantity: 1 }] })
        })
        .then(function() { return fetch('/cart.js'); })
        .then(function(r) { return r.json(); })
        .then(function(c) { watchCaseBusy = false; CCD.refresh(c); })
        .catch(function() { watchCaseBusy = false; });
      } else if (watchCount < WATCH_GOAL && !hasCase) {
        // Reset dismiss when below goal so it re-adds if user adds watches again
        caseDismissed = false;
        try { sessionStorage.removeItem('ccd_case_dismissed'); } catch(e) {}
      } else if (watchCount < WATCH_GOAL && hasCase && caseKey) {
        watchCaseBusy = true;
        // Instantly hide gift from DOM (old template or new format)
        var giftEl = document.querySelector('#CartDrawer .ccd-gift-item');
        if (giftEl) giftEl.remove();
        var giftEl2 = document.querySelector('#CartDrawer .ccd-item[data-gift="1"]');
        if (giftEl2) giftEl2.remove();
        fetch('/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: caseKey, quantity: 0 })
        })
        .then(function(r) { return r.json(); })
        .then(function(c) { CCD._caseKey = null; watchCaseBusy = false; CCD.refresh(c); })
        .catch(function() { watchCaseBusy = false; });
      }
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
      var giftCartItem = null;
      if (cart && cart.items) {
        giftCartItem = cart.items.find(function(i) { return i.handle === WATCH_CASE_HANDLE; });
      }
      if (!giftCartItem) return;
      var giftKey = giftCartItem.key;

      // If already a .ccd-gift-item (old template), convert to regular format
      var oldGift = container.querySelector('.ccd-gift-item');
      if (oldGift) oldGift.remove();

      // Find the gift rendered as a regular .ccd-item
      var giftEl = null;
      container.querySelectorAll('.ccd-item').forEach(function(el) {
        var rmBtn = el.querySelector('.ccd-item__remove');
        if (rmBtn && rmBtn.dataset.key === giftKey) giftEl = el;
      });
      if (!giftEl) return;

      // 1. Move to bottom
      if (giftEl.nextElementSibling) container.appendChild(giftEl);

      // 2. Hide qty buttons, show locked qty of 1
      var qtyWrap = giftEl.querySelector('.ccd-qty');
      if (qtyWrap) qtyWrap.style.display = 'none';
      // Make price col float right when qty is hidden
      var priceColEl = giftEl.querySelector('.ccd-item__price-col');
      if (priceColEl) priceColEl.style.marginLeft = 'auto';

      // 3. Add "Bonus gift" badge below the price (like discount badges on regular items)
      if (!giftEl.querySelector('.ccd-gift-badge')) {
        var badge = document.createElement('span');
        badge.className = 'ccd-gift-badge';
        badge.innerHTML = GIFT_SVG + ' Bonus gift';
        var priceCol = giftEl.querySelector('.ccd-item__price-col');
        if (priceCol) {
          priceCol.appendChild(badge);
        }
      }

      // 4. Set price to "Free" with compare price
      var priceEl = giftEl.querySelector('.ccd-item__price');
      if (priceEl) {
        priceEl.textContent = 'Free';
        priceEl.classList.add('ccd-item__price--free');
      }
      var priceRow = giftEl.querySelector('.ccd-item__price-row') || (priceEl ? priceEl.parentElement : null);
      if (priceRow && !priceRow.querySelector('.ccd-item__compare-price')) {
        var cp = document.createElement('span');
        cp.className = 'ccd-item__compare-price';
        cp.textContent = String.fromCharCode(36) + '49.99';
        priceRow.insertBefore(cp, priceRow.firstChild);
      }

      // 5. Mark gift for dismiss tracking
      giftEl.setAttribute('data-gift', '1');
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
          cart.items.filter(function(i) { return i.handle === PROT || i.handle === WATCH_CASE_HANDLE; }).forEach(function(pi) {
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
              return i.handle === PROT || i.handle === WATCH_CASE_HANDLE;
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
        return it.handle !== PROT && it.handle !== WATCH_CASE_HANDLE;
      });
      var targetVid = null;
      var target = CFG.scarcityTarget || '2';

      // STICKY LOGIC: if we already assigned scarcity to a variant,
      // keep it as long as that variant is still in the cart with qty 1
      var stickyVid = null;
      try { stickyVid = sessionStorage.getItem('ccd_scarcity_vid'); } catch(e) {}

      if (stickyVid && realItems.length > 0) {
        var stillInCart = false;
        for (var s = 0; s < realItems.length; s++) {
          if (String(realItems[s].variant_id) === stickyVid && realItems[s].quantity === 1) {
            stillInCart = true;
            break;
          }
        }
        if (stillInCart) {
          targetVid = stickyVid;
        }
        // else: scarcity item was removed or qty changed — recompute below
      }

      // Only recompute if no sticky assignment or sticky item was removed
      if (!targetVid && realItems.length > 0) {
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
          var tNum = parseInt(target) || 1;
          var seenH = {};
          var uniq = [];
          for (var i = 0; i < realItems.length; i++) {
            if (!seenH[realItems[i].variant_id]) {
              seenH[realItems[i].variant_id] = true;
              uniq.push(i);
            }
          }
          if (uniq.length >= tNum) {
            var pickIdx = uniq[tNum - 1];
            if (realItems[pickIdx].quantity === 1) {
              idx = pickIdx;
            }
          }
        }

        if (idx >= 0) {
          targetVid = String(realItems[idx].variant_id);
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

    updateProgress: function(cart) {
      var rc, uv;
      if (cart && cart._optimisticCount !== undefined) {
        rc = cart._optimisticCount;
        uv = rc; // approximate
      } else if (cart) {
        rc = CCD.getRealCount(cart);
        uv = CCD.getUniqueVariants(cart);
      } else {
        var a = document.querySelector('[data-real-count]');
        rc = a ? parseInt(a.getAttribute('data-real-count') || '0') : 0;
        uv = a ? parseInt(a.getAttribute('data-unique-count') || '0') : 0;
        if (!a || !a.getAttribute('data-unique-count')) uv = rc;
      }

      var shippingOK = rc >= 1;
      var promoOK = rc >= PROMO_GOAL;
      var remaining = Math.max(0, PROMO_GOAL - rc);

      var msgEl = document.querySelector('[data-ccd-progress-msg]');
      if (msgEl) {
        if (promoOK) {
          msgEl.innerHTML = '\uD83C\uDF89 You\u2019ve unlocked all rewards <strong>(expires soon)</strong>';
          msgEl.classList.add('ccd-progress__message--done');
        } else {
          msgEl.innerHTML = 'Add <strong>' + remaining + '</strong> more for <strong>FREE</strong>';
          msgEl.classList.remove('ccd-progress__message--done');
        }
      }

      var sm = document.querySelector('.ccd-progress__milestone--shipping');
      var sl = document.querySelector('.ccd-progress__line--first');
      if (sm) {
        var si = sm.querySelector('.ccd-progress__icon');
        if (shippingOK) {
          sm.classList.add('ccd-progress__milestone--reached');
          if (si) si.classList.add('ccd-progress__icon--reached');
          if (sl) sl.classList.add('ccd-progress__line--filled');
        } else {
          sm.classList.remove('ccd-progress__milestone--reached');
          if (si) si.classList.remove('ccd-progress__icon--reached');
          if (sl) sl.classList.remove('ccd-progress__line--filled');
        }
      }

      var pm = document.querySelector('.ccd-progress__milestone--promo');
      var pl = document.querySelector('.ccd-progress__line--second');
      if (pm) {
        var pi2 = pm.querySelector('.ccd-progress__icon');
        if (promoOK) {
          pm.classList.add('ccd-progress__milestone--reached');
          if (pi2) pi2.classList.add('ccd-progress__icon--reached');
          if (pl) { pl.classList.add('ccd-progress__line--filled'); pl.classList.remove('ccd-progress__line--half'); }
        } else {
          pm.classList.remove('ccd-progress__milestone--reached');
          if (pi2) pi2.classList.remove('ccd-progress__icon--reached');
          if (pl) {
            pl.classList.remove('ccd-progress__line--filled');
            if (remaining === 1) { pl.classList.add('ccd-progress__line--half'); } else { pl.classList.remove('ccd-progress__line--half'); }
          }
        }
      }

      // Sync all milestone pulse animations to same cycle
      var reached = document.querySelectorAll('.ccd-progress__icon--reached');
      if (reached.length > 0) {
        reached.forEach(function(el) { el.style.animation = 'none'; });
        // Force reflow then restart all at same instant
        void document.body.offsetHeight;
        reached.forEach(function(el) { el.style.animation = ''; });
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
      try { cached = JSON.parse(sessionStorage.getItem('ecart_config')); } catch(e) {}

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
          prefetch: !!prefetch
        })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        try { sessionStorage.setItem('ecart_config', JSON.stringify(data)); } catch(e) {}
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
      'paypal': '<svg viewBox="0 0 780 500" width="38" height="24"><rect width="780" height="500" rx="40" fill="#fff" stroke="#ddd" stroke-width="2"/><path d="M168.4 169.9c-8.4-5.8-19.4-8.7-32.9-8.7H83.2c-4.1 0-6.4 2.1-6.9 6.2L55 300.9c-.2 1.3.1 2.5 1 3.6s2 1.6 3.3 1.6h24.9c4.4 0 6.8-2.1 7.2-6.2l5.9-36c.2-1.7 1-3.2 2.3-4.3 1.3-1.1 2.9-1.8 4.9-2.1 2-.3 3.8-.5 5.6-.5s3.8.1 6.2.3c2.4.2 3.9.3 4.6.3 18.8 0 33.5-5.3 44.2-15.9 10.7-10.6 16-25.2 16-44 0-12.9-4.2-22.2-12.6-28z" fill="#003087"/><path d="M540 169.9c-8.4-5.8-19.4-8.7-32.9-8.7h-52c-4.4 0-6.8 2.1-7.2 6.2l-21.3 133.5c-.2 1.3.1 2.5 1 3.6s2 1.6 3.3 1.6h26.8c2.6 0 4.4-1.4 5.2-4.3l5.9-37.9c.2-1.7 1-3.2 2.3-4.3 1.3-1.1 2.9-1.8 4.9-2.1 2-.3 3.8-.5 5.6-.5s3.8.1 6.2.3c2.4.2 3.9.3 4.6.3 18.8 0 33.5-5.3 44.2-15.9 10.7-10.6 16-25.2 16-44 0-12.9-4.2-22.2-12.6-28z" fill="#009CDE"/></svg>',
      'apple-pay': '<svg viewBox="0 0 780 500" width="38" height="24"><rect width="780" height="500" rx="40" fill="#000"/><g transform="translate(55,82) scale(14)"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" fill="white"/></g><text x="400" y="250" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-weight="300" font-size="180" dominant-baseline="central" fill="white">Pay</text></svg>',
      'google-pay': '<svg viewBox="0 0 780 500" width="38" height="24"><rect width="780" height="500" rx="40" fill="#fff" stroke="#ddd" stroke-width="2"/><text x="390" y="290" text-anchor="middle" font-family="Arial" font-weight="600" font-size="120" fill="#5f6368">GPay</text></svg>',
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

      // Position: below-checkout (default), above-checkout, below-items
      if (position === 'above-checkout') {
        var checkout = document.querySelector('.ccd-checkout-btn');
        if (checkout && checkout.parentNode) checkout.parentNode.insertBefore(row, checkout);
      } else if (position === 'below-items') {
        var footer = document.querySelector('.ccd-sticky-footer');
        if (footer) footer.insertBefore(row, footer.firstChild);
      } else {
        var checkout2 = document.querySelector('.ccd-checkout-btn');
        if (checkout2 && checkout2.parentNode) checkout2.parentNode.insertBefore(row, checkout2.nextSibling);
      }
    }
  };

  // ── Future addon stubs — implement visuals when ready ──
  CCD.injectScarcityTimer = function(cfg) {
    if (document.getElementById('ccd-scarcity-timer')) return;
    // TODO: implement scarcity countdown timer
  };
  CCD.injectFreeShippingBar = function(cfg) {
    if (document.getElementById('ccd-free-shipping-bar')) return;
    // TODO: implement free shipping progress bar
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
        CCD.refreshOnOpen();
        CCD.ensureProtection();
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
