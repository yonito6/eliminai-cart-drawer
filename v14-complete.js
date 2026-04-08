/* ============================================
   CUSTOM CART DRAWER — JavaScript v14
   Smart DOM morph (no blink), watch case auto-add,
   scroll overflow indicator, trust icon, gift item
   ============================================ */
(function() {
  'use strict';

  var CFG = window.CCD_CONFIG || {};
  var PROT = CFG.protectionHandle || 'shipping-protection-1';
  var PROT_VID = parseInt(CFG.protectionVariantId) || 47779174023419;
  var PROMO_GOAL = CFG.promoGoal || 3;
  var WATCH_CASE_HANDLE = CFG.giftHandle || 'eleganto-premium-watch-organizer';
  var WATCH_CASE_VID = parseInt(CFG.giftVariantId) || 46941745742075;
  var WATCH_GOAL = CFG.giftGoal || 3;
  var busy = false;
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
    init: function() {
      this.fixMobileWidth();
      this.bindEvents();
      this.interceptAddToCart();
      this.setupScrollIndicator();
      this.updateProgress();
      this.checkOverflow();
      // Remove instant class after first paint so toggle animates on user interaction
      setTimeout(function() {
        var sl = document.querySelector(".ccd-toggle--instant");
        if (sl) sl.classList.remove("ccd-toggle--instant");
      }, 500);
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
          var input = minusBtn.closest('.ccd-qty').querySelector('.ccd-qty__input');
          var newVal = Math.max(0, parseInt(input.value) - 1);
          CCD.changeQty(input.dataset.id, newVal, minusBtn);
        }

        if (plusBtn) {
          e.preventDefault();
          var input = plusBtn.closest('.ccd-qty').querySelector('.ccd-qty__input');
          var newVal = parseInt(input.value) + 1;
          CCD.changeQty(input.dataset.id, newVal, plusBtn);
        }

        if (removeBtn) {
          e.preventDefault();
          var item = removeBtn.closest('.ccd-item');
          if (item) item.classList.add('ccd-item--removing');
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
          CCD.changeQty(rmKey, 0);
        }

        var giftRemoveBtn = e.target.closest('.ccd-gift-item__remove');
        if (giftRemoveBtn) {
          e.preventDefault();
          caseDismissed = true;
          try { sessionStorage.setItem('ccd_case_dismissed', '1'); } catch(ex) {}
          var giftItem = giftRemoveBtn.closest('.ccd-gift-item');
          if (giftItem) {
            giftItem.classList.add('ccd-item--removing');
            giftItem.style.maxHeight = giftItem.offsetHeight + 'px';
            giftItem.offsetHeight;
            giftItem.style.maxHeight = '0';
            giftItem.style.padding = '0';
            giftItem.style.margin = '0';
            giftItem.style.overflow = 'hidden';
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
    },

    changeQty: function(key, qty, btnEl) {
      if (busy) return;
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
        busy = false;
        if (btnEl) btnEl.classList.remove('ccd-qty__btn--loading');
        CCD.refresh(cart);
      })
      .catch(function() {
        busy = false;
        if (btnEl) btnEl.classList.remove('ccd-qty__btn--loading');
        if (item) item.classList.remove('ccd-item--removing');
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
              return Promise.resolve(new Response(JSON.stringify({items:[]}), {status: 200}));
            }
          }
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
      var caseKey = CCD._caseKey || null;

      if (cart && cart.items) {
        cart.items.forEach(function(i) {
          if (i.handle === WATCH_CASE_HANDLE) {
            hasCase = true;
            caseKey = i.key;
            CCD._caseKey = i.key;
          }
        });
        if (!hasCase) CCD._caseKey = null;
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
          el.classList.add('ccd-item--removing');
          el.style.maxHeight = el.offsetHeight + 'px';
          el.offsetHeight; /* force reflow */
          el.style.maxHeight = '0';
          el.style.padding = '0';
          el.style.margin = '0';
          el.style.borderWidth = '0';
          el.style.overflow = 'hidden';
          setTimeout(function() { el.remove(); }, 150);
        }
      });

      var giftEl = existing.querySelector('.ccd-gift-item');
      newList.forEach(function(n) {
        if (existMap[n.key]) {
          var ex = existMap[n.key];
          var exInp = ex.querySelector('.ccd-qty__input');
          var nInp = n.el.querySelector('.ccd-qty__input');
          if (exInp && nInp) exInp.value = nInp.value;
          var exPrice = ex.querySelector('.ccd-item__price');
          var nPrice = n.el.querySelector('.ccd-item__price');
          if (exPrice && nPrice) exPrice.textContent = nPrice.textContent;
          var exComp = ex.querySelector('.ccd-item__compare-price');
          var nComp = n.el.querySelector('.ccd-item__compare-price');
          if (nComp && !exComp) {
            var pr = ex.querySelector('.ccd-item__price-row');
            if (pr) pr.insertBefore(nComp, pr.firstChild);
          } else if (!nComp && exComp) {
            exComp.remove();
          } else if (exComp && nComp) {
            exComp.textContent = nComp.textContent;
          }
          var exBdg = ex.querySelector('.ccd-badge');
          var nBdg = n.el.querySelector('.ccd-badge');
          var exPC = ex.querySelector('.ccd-item__price-col');
          if (nBdg && !exBdg && exPC) { exPC.appendChild(nBdg); }
          else if (!nBdg && exBdg) { exBdg.remove(); }
          else if (exBdg && nBdg) { exBdg.innerHTML = nBdg.innerHTML; }
        } else {
          n.el.classList.add('ccd-item--adding');
          if (giftEl) { existing.insertBefore(n.el, giftEl); }
          else { existing.appendChild(n.el); }
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
    refresh: function(cart) {
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
            if (!seenH[realItems[i].handle]) {
              seenH[realItems[i].handle] = true;
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
      if (cart) {
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

    refreshOnOpen: function() {
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
    }
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
