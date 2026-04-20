/**
 * SELF-RENDERED CART DRAWER — Remove ALL theme HTML dependencies
 *
 * Changes:
 * 1. Add buildCartItemHTML(item) — renders a single cart item from /cart.js JSON
 * 2. Add buildCartItemsContainer(cart) — renders full items container from JSON
 * 3. Change refresh() to use /cart.js JSON + buildCartItemsContainer instead of /cart?view=ajax HTML
 * 4. Change initDrawer() to create its own drawer shell if #CCD-Drawer doesn't exist (from Liquid)
 *    AND also if theme takeover is needed, still works
 * 5. Remove .cart__items fallback selectors (we now render our own .ccd-items always)
 */

const fs = require('fs');
const file = require('path').join(__dirname, 'v14-complete.js');
let code = fs.readFileSync(file, 'utf8');

// ═══════════════════════════════════════════════════════════════
// STEP 1: Add buildCartItemHTML and buildCartItemsContainer
// Insert before the morphDOM function
// ═══════════════════════════════════════════════════════════════

const buildFunctions = `
    /* ═══════════════════════════════════════════════════════════
       SELF-RENDERED CART ITEMS — zero theme HTML dependency
       Builds complete cart item DOM from /cart.js JSON data
       ═══════════════════════════════════════════════════════════ */

    buildCartItemHTML: function(item) {
      // Skip protection and gift items (handled separately)
      if (item.handle === PROT || (CFG.giftHandle && item.handle === CFG.giftHandle)) return '';

      var imgSrc = item.image ? item.image.replace(/\\.([a-z]+)\\?/, '_180x.$1?') : '';
      var imgSrcLarge = item.image ? item.image.replace(/\\.([a-z]+)\\?/, '_360x.$1?') : '';
      var productUrl = item.url || '/products/' + item.handle;
      var title = item.product_title || item.title || '';
      var escapedTitle = title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

      // Build variant text (skip "Default Title")
      var variantParts = [];
      if (item.variant_title && item.variant_title !== 'Default Title') {
        variantParts.push(item.variant_title);
      }
      // Properties (skip _ prefixed and blank)
      var propHTML = '';
      if (item.properties) {
        for (var pk in item.properties) {
          if (pk.charAt(0) === '_' || !item.properties[pk]) continue;
          var pv = item.properties[pk];
          if (typeof pv === 'string' && pv.indexOf('/uploads/') !== -1) {
            propHTML += '<div class="ccd-item__variant">' + pk + ': <a href="' + pv + '" style="color:#6BA4E8;">' + pv.split('/').pop() + '</a></div>';
          } else {
            propHTML += '<div class="ccd-item__variant">' + pk + ': ' + pv + '</div>';
          }
        }
      }

      // Price display
      var priceHTML = '';
      var origLinePrice = item.original_line_price || (item.original_price * item.quantity);
      var finalLinePrice = item.final_line_price || item.line_price || (item.price * item.quantity);

      if (origLinePrice !== finalLinePrice) {
        priceHTML += '<span class="ccd-item__compare-price">' + CCD.fmt(origLinePrice) + '</span>';
        if (finalLinePrice === 0) {
          priceHTML += '<span class="ccd-item__price ccd-item__price--free">Free</span>';
        } else {
          priceHTML += '<span class="ccd-item__price">' + CCD.fmt(finalLinePrice) + '</span>';
        }
      } else if (origLinePrice === 0) {
        priceHTML += '<span class="ccd-item__price ccd-item__price--free">Free</span>';
      } else {
        priceHTML += '<span class="ccd-item__price">' + CCD.fmt(origLinePrice) + '</span>';
      }

      // Discount badges
      var badgeHTML = '';
      if (item.line_level_discount_allocations && item.line_level_discount_allocations.length > 0) {
        item.line_level_discount_allocations.forEach(function(da) {
          badgeHTML += '<span class="ccd-badge"><svg viewBox="0 0 24 24"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/></svg> ' + da.discount_application.title + '</span>';
        });
      }

      return '<div class="ccd-item" data-key="' + item.key + '" data-handle="' + (item.handle || '') + '">' +
        '<div class="ccd-item__image">' +
          '<a href="' + productUrl + '">' +
            '<img src="' + imgSrc + '"' +
            ' srcset="' + imgSrc + ' 180w, ' + imgSrcLarge + ' 360w"' +
            ' sizes="120px" alt="' + escapedTitle + '" loading="lazy">' +
          '</a>' +
        '</div>' +
        '<div class="ccd-item__details">' +
          '<div class="ccd-item__title-row">' +
            '<a href="' + productUrl + '" class="ccd-item__name">' + title + '</a>' +
            '<button type="button" class="ccd-item__remove" data-key="' + item.key + '" aria-label="Remove ' + escapedTitle + '">' +
              '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>' +
            '</button>' +
          '</div>' +
          (variantParts.length > 0 ? '<div class="ccd-item__variant">' + variantParts.join(' &middot; ') + '</div>' : '') +
          propHTML +
          '<div class="ccd-item__bottom">' +
            '<div class="ccd-qty">' +
              '<button type="button" class="ccd-qty__btn ccd-qty__btn--minus" aria-label="Decrease quantity"><svg viewBox="0 0 20 20"><path d="M17.543 11.029H2.1A1.032 1.032 0 0 1 1.071 10c0-.566.463-1.029 1.029-1.029h15.443c.566 0 1.029.463 1.029 1.029 0 .566-.463 1.029-1.029 1.029z"/></svg></button>' +
              '<input type="text" class="ccd-qty__input" value="' + item.quantity + '" min="0" pattern="[0-9]*" data-id="' + item.key + '" aria-label="Quantity">' +
              '<button type="button" class="ccd-qty__btn ccd-qty__btn--plus" aria-label="Increase quantity"><svg viewBox="0 0 20 20"><path d="M17.409 8.929h-6.695V2.258c0-.566-.506-1.029-1.071-1.029s-1.071.463-1.071 1.029v6.671H1.967C1.401 8.929.938 9.435.938 10s.463 1.071 1.029 1.071h6.605V17.7c0 .566.506 1.029 1.071 1.029s1.071-.463 1.071-1.029v-6.629h6.695c.566 0 1.029-.506 1.029-1.071s-.463-1.071-1.029-1.071z"/></svg></button>' +
            '</div>' +
            '<div class="ccd-item__price-col">' +
              '<div class="ccd-item__price-row">' + priceHTML + '</div>' +
              badgeHTML +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    },

    buildGiftItemHTML: function(item) {
      var giftCprice = CFG.giftComparePrice || '$49.99';
      var giftLabel = CFG.giftLabel || 'Bonus gift';
      var imgSrc = item.image ? item.image.replace(/\\.([a-z]+)\\?/, '_180x.$1?') : '';
      var productUrl = item.url || '/products/' + item.handle;
      var title = item.product_title || item.title || '';
      var escapedTitle = title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

      return '<div class="ccd-gift-item" data-key="' + item.key + '" data-handle="' + (item.handle || '') + '">' +
        '<div class="ccd-gift-label">' +
          '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z"/></svg> ' +
          giftLabel +
          '<button type="button" class="ccd-gift-item__remove" data-key="' + item.key + '" aria-label="Remove gift"><svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>' +
        '</div>' +
        '<div class="ccd-gift-item__body">' +
          '<div class="ccd-item__image"><a href="' + productUrl + '"><img src="' + imgSrc + '" alt="' + escapedTitle + '"></a></div>' +
          '<div class="ccd-gift-item__info">' +
            '<a href="' + productUrl + '" class="ccd-item__name" style="font-size:13px">' + title + '</a>' +
            '<div class="ccd-gift-item__price-row">' +
              '<span class="ccd-item__compare-price">' + giftCprice + '</span>' +
              '<span class="ccd-item__price ccd-item__price--free">Free</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    },

    buildCartItemsContainer: function(cart) {
      var itemsHTML = '';
      var giftHTML = '';
      var realCount = 0;
      var uniqueVariants = {};
      var watchCount = 0;
      var watchHandles = [];
      var seenWatchPids = {};

      cart.items.forEach(function(item) {
        if (item.handle === PROT) return; // skip protection
        if (CFG.giftHandle && item.handle === CFG.giftHandle) {
          giftHTML += CCD.buildGiftItemHTML(item);
          return;
        }
        realCount += item.quantity;
        if (!uniqueVariants[item.variant_id]) {
          uniqueVariants[item.variant_id] = true;
        }
        // Detect watches by product type or tag
        if (item.product_type && item.product_type.toLowerCase().indexOf('watch') !== -1) {
          if (!seenWatchPids[item.product_id]) {
            watchCount++;
            seenWatchPids[item.product_id] = true;
          }
          if (watchHandles.indexOf(item.handle) === -1) watchHandles.push(item.handle);
        }
        itemsHTML += CCD.buildCartItemHTML(item);
      });

      var uniqueCount = Object.keys(uniqueVariants).length;

      // Build container div
      var container = document.createElement('div');
      container.className = 'ccd-items';
      container.setAttribute('data-count', cart.item_count);
      container.setAttribute('data-real-count', realCount);
      container.setAttribute('data-unique-count', uniqueCount);
      container.setAttribute('data-watch-count', watchCount);
      container.setAttribute('data-watch-handles', watchHandles.join(','));
      container.setAttribute('data-cart-subtotal', CCD.getAdjustedTotal(cart));
      container.innerHTML = itemsHTML + giftHTML;

      return container;
    },

    buildDrawerShell: function() {
      var checkoutText = (CFG.checkoutText || 'SECURE CHECKOUT');
      return '<form id="CCD-Form" action="/cart" method="post" novalidate class="ccd-contents">' +
        '<div class="ccd-fixed-header">' +
          '<div class="ccd-header">' +
            '<div class="ccd-title">Your Cart</div>' +
            '<div class="ccd-close"><button type="button" class="ccd-close-btn" data-ccd-close aria-label="Close cart"><svg aria-hidden="true" focusable="false" role="presentation" viewBox="0 0 64 64"><path d="M19 17.61l27.12 27.13m0-27.12L19 44.74" stroke="currentColor" stroke-width="3" fill="none"/></svg></button></div>' +
          '</div>' +
          '<div class="ccd-progress" data-ccd-progress style="display:none">' +
            '<div class="ccd-progress__message" data-ccd-progress-msg></div>' +
            '<div class="ccd-progress__bar-wrap"></div>' +
          '</div>' +
        '</div>' +
        '<div class="ccd-inner" data-ccd-inner style="display:none">' +
          '<div class="ccd-scrollable"><div data-products><div class="ccd-items"></div></div></div>' +
        '</div>' +
        '<div class="ccd-sticky-footer" data-ccd-footer style="display:none">' +
          '<div class="ccd-shipping-protection">' +
            '<div class="ccd-shipping-protection__icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg></div>' +
            '<div class="ccd-shipping-protection__info"><div class="ccd-shipping-protection__title">Shipping Protection</div><div class="ccd-shipping-protection__desc">against Damage, Loss &amp; Theft</div></div>' +
            '<div class="ccd-shipping-protection__right"><span class="ccd-shipping-protection__price">' + (CFG.protectionPrice || '$4.99') + '</span>' +
              '<label class="ccd-toggle"><input type="checkbox" id="ccd-shipping-toggle" checked><span class="ccd-toggle__slider ccd-toggle--instant"></span></label>' +
            '</div>' +
          '</div>' +
          '<div class="ccd-discount-row" data-ccd-discounts style="display:none"><div class="ccd-discount-row__left"><span class="ccd-discount-row__label">Discount</span></div><span class="ccd-discount-row__amount"></span></div>' +
          '<button type="submit" name="checkout" class="ccd-checkout-btn"><svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg> ' + checkoutText + ' &middot; <span class="ccd-checkout-total" data-subtotal>$0.00</span></button>' +
          '<div class="ccd-trust"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg><span><strong>30 day</strong> risk free returns</span></div>' +
        '</div>' +
        '<div class="ccd-empty" style="display:none"><div style="padding:32px 20px;text-align:center;">' +
          '<svg viewBox="0 0 24 24" width="40" height="40" fill="#bbb" style="margin-bottom:12px;"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>' +
          '<p style="color:#888;font-size:15px;margin-bottom:12px;">Your cart is empty</p>' +
          '<a href="/collections/all" style="display:inline-block;padding:12px 28px;background:#111;border:none;border-radius:6px;color:#fff;text-decoration:none;font-size:14px;letter-spacing:0.5px;">Continue Shopping</a>' +
        '</div></div>' +
      '</form>';
    },

`;

// Insert before morphDOM
code = code.replace(
  '    /* Smart DOM morph — updates items in-place, preserves images (no blink) */',
  buildFunctions + '    /* Smart DOM morph — updates items in-place, preserves images (no blink) */'
);

// ═══════════════════════════════════════════════════════════════
// STEP 2: Replace /cart?view=ajax with JSON-based rendering in refresh()
// ═══════════════════════════════════════════════════════════════

// Replace the entire fetch('/cart?view=ajax') block with JSON rendering
code = code.replace(
  `      fetch('/cart?view=ajax')
      .then(function(r) { return r.text(); })
      .then(function(html) {
        var pc = document.querySelector('#CCD-Drawer [data-products]');
        if (pc) {
          var parser = new DOMParser();
          var doc = parser.parseFromString(html, 'text/html');
          var ni = doc.querySelector('.ccd-items') || doc.querySelector('.cart__items');
          if (ni) {
            // Ensure the container has ccd-items class so CSS shows it
            ni.classList.add('ccd-items');
            // If defaultOn, pre-check the toggle in the incoming HTML so morphDOM doesn't flash it off
            if (shouldDefaultOn) {
              var incomingToggle = ni.querySelector('#ccd-shipping-toggle');
              if (incomingToggle) {
                incomingToggle.checked = true;
                // Also add instant class to slider so there's no slide animation
                var incomingSlider = incomingToggle.nextElementSibling;
                if (incomingSlider) incomingSlider.classList.add('ccd-toggle--instant');
              }
            }
            CCD.morphDOM(pc, ni);
          }
        }`,
  `      // Self-rendered: build items from JSON, no theme HTML dependency
      (function() {
        var pc = document.querySelector('#CCD-Drawer [data-products]');
        if (pc) {
          var ni = CCD.buildCartItemsContainer(cart);
          CCD.morphDOM(pc, ni);
        }`
);

// ═══════════════════════════════════════════════════════════════
// STEP 3: Update initDrawer to build its own shell when no Liquid-rendered drawer exists
// ═══════════════════════════════════════════════════════════════

// Modify the theme takeover fallback: if no CCD-Drawer AND no theme drawer, CREATE our own
code = code.replace(
  `      if (!el) {
        el = document.getElementById('CartDrawer') ||
             document.querySelector('cart-drawer') ||
             document.querySelector('.cart-drawer') ||
             document.querySelector('.drawer--cart') ||
             document.querySelector('[data-cart-drawer]');
        if (!el) { console.warn('[CCD] No cart drawer element found'); return; }`,
  `      if (!el) {
        // Try theme takeover first (for themes that render their own cart drawer)
        var themeDrawer = document.getElementById('CartDrawer') ||
             document.querySelector('cart-drawer') ||
             document.querySelector('.cart-drawer') ||
             document.querySelector('.drawer--cart') ||
             document.querySelector('[data-cart-drawer]');
        if (themeDrawer) {
          el = themeDrawer;
        } else {
          // NO theme drawer found — create our OWN from scratch
          el = document.createElement('div');
          el.id = 'CCD-Drawer';
          el.style.display = 'none';
          el.innerHTML = CCD.buildDrawerShell();
          document.body.appendChild(el);
          console.log('[CCD] Created self-rendered drawer (no theme dependency)');
          // Skip the theme mapping below — we have our own DOM
        }
        if (!el.id || el.id !== 'CCD-Drawer') {`
);

// Fix the closing brace to match the new if structure
code = code.replace(
  `        if (!el.id || el.id !== 'CCD-Drawer') {
        // Rename to CCD-Drawer so all our code works
        el.id = 'CCD-Drawer';`,
  `        // Rename to CCD-Drawer so all our code works
          el.id = 'CCD-Drawer';`
);

// ═══════════════════════════════════════════════════════════════
// STEP 4: Fix the initDrawer closing brace structure
// We need to close the if (themeDrawer) block properly
// ═══════════════════════════════════════════════════════════════

// The theme takeover section ends with:
// console.log('[CCD] Took over theme cart drawer → #CCD-Drawer');
// }
// We need to add an extra closing brace for the new if block
code = code.replace(
  "        console.log('[CCD] Took over theme cart drawer → #CCD-Drawer');\n      }",
  "        console.log('[CCD] Took over theme cart drawer → #CCD-Drawer');\n        }\n      }"
);

fs.writeFileSync(file, code, 'utf8');

// Verify
const result = fs.readFileSync(file, 'utf8');
console.log('=== VERIFICATION ===');
console.log('buildCartItemHTML:', result.includes('buildCartItemHTML: function(item)'));
console.log('buildGiftItemHTML:', result.includes('buildGiftItemHTML: function(item)'));
console.log('buildCartItemsContainer:', result.includes('buildCartItemsContainer: function(cart)'));
console.log('buildDrawerShell:', result.includes('buildDrawerShell: function()'));
console.log('JSON rendering in refresh:', result.includes('CCD.buildCartItemsContainer(cart)'));
console.log('Self-create drawer:', result.includes('Created self-rendered drawer'));
console.log('No cart?view=ajax in refresh:', !result.includes("fetch('/cart?view=ajax')"));
console.log('File size:', (result.length / 1024).toFixed(1), 'KB');

// Check for syntax issues — count braces
var opens = (result.match(/{/g) || []).length;
var closes = (result.match(/}/g) || []).length;
console.log('Brace balance: { = ' + opens + ', } = ' + closes + ' (diff: ' + (opens - closes) + ')');
