/* ============================================
   CUSTOM CART DRAWER — JavaScript v14
   Smart DOM morph (no blink), watch case auto-add,
   scroll overflow indicator, trust icon, gift item
   ============================================ */
(function() {
  // === INJECT EMBEDDED CSS (standalone — no external stylesheet needed) ===
  (function() {
    if (document.getElementById('ccd-embedded-css')) return;
    var s = document.createElement('style');
    s.id = 'ccd-embedded-css';
    s.textContent = '#CartDrawer, cart-drawer, .cart-drawer, [data-drawer=cart-drawer], .js-cart-drawer { display: none !important; visibility: hidden !important; }' +
      '/* Cart Drawer v15 — Theme-Independent. Standalone embedded CSS. */\n' +
      '#CCD-Drawer, #CCD-Drawer *, #CCD-Drawer *::before, #CCD-Drawer *::after { box-sizing: border-box !important; }\n' +
      '#CCD-Drawer .drawer__nav, #CCD-Drawer .drawer__cart-items-wrapper, #CCD-Drawer .cart__footer:not(.ccd-sticky-footer), #CCD-Drawer .cart__item-row, #CCD-Drawer .cart__item-sub, #CCD-Drawer .cart__discounts, #CCD-Drawer .cart__items:not(.ccd-items), #CCD-Drawer .drawer__footer, #CCD-Drawer .drawer__header:not(.ccd-header), #CCD-Drawer .drawer__scrollable:not(.ccd-scrollable), #CCD-Drawer .drawer__inner:not(.ccd-inner), #CCD-Drawer .drawer__fixed-header:not(.ccd-fixed-header), #CCD-Drawer .drawer__contents:not(.ccd-contents), #CCD-Drawer .drawer__cart-empty:not(.ccd-empty), #CCD-Drawer cart-drawer-items, #CCD-Drawer cart-items, #CCD-Drawer .cart-drawer__overlay { display: none !important; }\n' +
      '#CCD-Drawer .appear-animation { opacity: 1 !important; transform: none !important; animation: none !important; transition: none !important; }\n' +
      '#CCD-Drawer { position: fixed !important; top: 0 !important; right: 0 !important; bottom: 0 !important; background: var(--ccd-bg, #fff) !important; color: #111 !important; max-width: 380px !important; width: 100% !important; z-index: 9999 !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; height: 100vh !important; height: 100dvh !important; max-height: 100vh !important; max-height: 100dvh !important; transform: translateX(100%) !important; transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1) !important; will-change: transform !important; overflow: hidden !important; }\n' +
      '#CCD-Drawer.ccd-open { display: flex !important; flex-direction: column !important; transform: translateX(0) !important; box-shadow: -12px 0 45px rgba(0,0,0,0.25) !important; }\n' +
      '#CCD-Drawer .ccd-fixed-header { background: var(--ccd-bg, #fff) !important; padding: 0 !important; flex-shrink: 0 !important; position: relative !important; z-index: 2 !important; height: auto !important; max-height: none !important; min-height: 0 !important; overflow: visible !important; border-bottom: none !important; }\n' +
      '#CCD-Drawer .ccd-fixed-header::after { display: none !important; }\n' +
      '#CCD-Drawer .ccd-header { display: flex !important; justify-content: space-between !important; align-items: center !important; padding: 20px 20px 8px 20px !important; width: 100% !important; overflow: visible !important; border-bottom: none !important; }\n' +
      '#CCD-Drawer .ccd-title { font-size: 22px !important; font-weight: 700 !important; color: #111 !important; letter-spacing: 0 !important; text-transform: none !important; margin: 0 !important; line-height: 1 !important; }\n' +
      '#CCD-Drawer .ccd-close { display: block !important; position: static !important; flex-shrink: 0 !important; width: auto !important; vertical-align: initial !important; text-align: right !important; }\n' +
      '#CCD-Drawer .ccd-close-btn { background: none !important; border: none !important; color: #111 !important; cursor: pointer !important; padding: 8px !important; margin-right: 0 !important; line-height: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; position: static !important; right: auto !important; left: auto !important; height: auto !important; }\n' +
      '#CCD-Drawer .ccd-close-btn svg { width: 22px !important; height: 22px !important; stroke: #111 !important; stroke-width: 2.5 !important; }\n' +
      '#CCD-Drawer .ccd-sr-only { position: absolute !important; overflow: hidden !important; clip: rect(0 0 0 0) !important; height: 1px !important; width: 1px !important; margin: -1px !important; padding: 0 !important; border: 0 !important; }\n' +
      '.ccd-progress { padding: 10px 24px 14px !important; background: #f9f9f9 !important; border-bottom: none !important; }\n' +
      '.ccd-progress__message { text-align: center !important; font-size: 15px !important; margin-bottom: 10px !important; line-height: 1.4 !important; }\n' +
      '.ccd-progress__message strong { font-weight: 700 !important; }\n' +
      '.ccd-progress__bar-wrap { display: flex !important; align-items: flex-start !important; gap: 0 !important; position: relative !important; }\n' +
      '.ccd-progress__line { flex: 1 !important; height: 3px !important; background: var(--ccd-progress-bg, #ddd) !important; margin-top: 21px !important; border-radius: 0 !important; transition: background 0.4s !important; margin-left: -3px !important; margin-right: -3px !important; position: relative !important; z-index: 0 !important; }\n' +
      '.ccd-progress__line--filled { background: #ddd !important; }\n' +
      '.ccd-progress__line::after { content: "" !important; position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; background: var(--ccd-primary, #111) !important; border-radius: 0 !important; transform: scaleX(0) !important; transform-origin: left !important; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1) !important; }\n' +
      '.ccd-progress__line--filled::after { transform: scaleX(1) !important; }\n' +
      '.ccd-progress__line--half::after { transform: scaleX(0.5) !important; }\n' +
      '.ccd-progress--instant .ccd-progress__line::after { transition: none !important; }\n' +
      '.ccd-progress--instant .ccd-progress__icon { transition: none !important; animation: none !important; }\n' +
      '.ccd-progress--instant .ccd-progress__line { transition: none !important; }\n' +
      '.ccd-progress__milestone { display: flex !important; flex-direction: column !important; align-items: center !important; gap: 6px !important; z-index: 1 !important; flex-shrink: 0 !important; width: 44px !important; overflow: visible !important; }\n' +
      '.ccd-progress__icon { width: 44px !important; height: 44px !important; border-radius: 50% !important; display: flex !important; align-items: center !important; justify-content: center !important; background: var(--ccd-progress-bg, #ddd) !important; transition: all 0.4s !important; }\n' +
      '.ccd-progress__icon--reached { background: #111 !important; }\n' +
      '.ccd-progress__icon svg { width: 22px !important; height: 22px !important; fill: #999 !important; transition: fill 0.4s !important; }\n' +
      '.ccd-progress__icon--reached svg { fill: #fff !important; }\n' +
      '.ccd-progress__label { font-size: 11px !important; color: #888 !important; text-align: center !important; white-space: nowrap !important; letter-spacing: 0.3px !important; line-height: 1.3 !important; font-weight: 500 !important; }\n' +
      '.ccd-progress__milestone--reached .ccd-progress__label { color: #111 !important; font-weight: 600 !important; }\n' +
      '@keyframes ccdMilestonePulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); box-shadow: 0 0 0 6px rgba(17,17,17,0.08); } }\n' +
      '@keyframes ccdMilestoneBounce { 0%, 100% { transform: translateY(0) scale(1); } 30% { transform: translateY(-5px) scale(1.05); } 50% { transform: translateY(-2px) scale(1.02); } 70% { transform: translateY(-4px) scale(1.04); } }\n' +
      '@keyframes ccdMilestoneHeartbeat { 0%, 100% { transform: scale(1); } 14% { transform: scale(1.15); } 28% { transform: scale(1); } 42% { transform: scale(1.1); } 56% { transform: scale(1); } }\n' +
      '@keyframes ccdMilestoneShake { 0%, 100% { transform: rotate(0); } 15% { transform: rotate(-10deg); } 30% { transform: rotate(10deg); } 45% { transform: rotate(-6deg); } 60% { transform: rotate(6deg); } 75% { transform: rotate(-2deg); } }\n' +
      '.ccd-progress__icon--reached { animation: ccdMilestonePulse 1.8s ease-in-out infinite; }\n' +
      '#CCD-Drawer .ccd-contents { display: flex !important; flex-direction: column !important; height: 100% !important; background: #fff !important; overflow: hidden !important; }\n' +
      '#CCD-Drawer .ccd-inner { background: var(--ccd-bg, #fff) !important; display: flex !important; flex-direction: column !important; flex: 1 1 0% !important; min-height: 0 !important; overflow: hidden !important; position: relative !important; }\n' +
      '#CCD-Drawer .ccd-scrollable { flex: 1 1 0% !important; overflow-y: auto !important; padding: 0 20px !important; -webkit-overflow-scrolling: touch !important; min-height: 0 !important; }\n' +
      '#CCD-Drawer .ccd-scrollable::-webkit-scrollbar { width: 6px; }\n' +
      '#CCD-Drawer .ccd-scrollable::-webkit-scrollbar-track { background: #f0f0f0; border-radius: 6px; }\n' +
      '#CCD-Drawer .ccd-scrollable::-webkit-scrollbar-thumb { background: #bbb; border-radius: 6px; }\n' +
      '#CCD-Drawer .ccd-scrollable::-webkit-scrollbar-thumb:hover { background: #999; }\n' +
      '#CCD-Drawer .ccd-inner::after { content: "" !important; position: absolute !important; bottom: 0 !important; left: 0 !important; right: 0 !important; height: 50px !important; background: linear-gradient(transparent 0%, rgba(255,255,255,0.6) 35%, rgba(255,255,255,0.95) 100%) !important; pointer-events: none !important; z-index: 3 !important; transition: opacity 0.3s !important; }\n' +
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
      '.ccd-item__remove { background: none !important; border: none !important; color: #bbb !important; cursor: pointer !important; padding: 2px !important; flex-shrink: 0 !important; transition: color 0.2s !important; line-height: 0 !important; }\n' +
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
      '.ccd-shipping-protection__icon svg { width: 24px !important; height: 24px !important; fill: #555 !important; }\n' +
      '.ccd-shipping-protection__info { flex: 1 !important; min-width: 0 !important; }\n' +
      '.ccd-shipping-protection__title { font-size: 13px !important; font-weight: 600 !important; color: #111 !important; }\n' +
      '.ccd-shipping-protection__desc { font-size: 10px !important; color: #888 !important; margin-top: 1px !important; }\n' +
      '.ccd-shipping-protection__right { display: flex !important; flex-direction: column !important; align-items: flex-end !important; gap: 4px !important; flex-shrink: 0 !important; }\n' +
      '.ccd-shipping-protection__price { font-size: 13px !important; font-weight: 600 !important; color: #111 !important; }\n' +
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
      '.ccd-discount-row__amount { font-size: 13px !important; font-weight: 600 !important; color: #111 !important; }\n' +
      '.ccd-discount-row__promo-name { display: inline-flex !important; align-items: center !important; gap: 4px !important; font-size: 12px !important; font-weight: 600 !important; color: #111 !important; }\n' +
      '.ccd-discount-row__promo-name svg { width: 14px !important; height: 14px !important; fill: #111 !important; flex-shrink: 0 !important; }\n' +
      '.ccd-checkout-btn { display: flex !important; align-items: center !important; justify-content: center !important; gap: 8px !important; width: 100% !important; padding: 14px 24px !important; background: #111 !important; color: #fff !important; border: 1px solid #222 !important; border-radius: 8px !important; font-size: 15px !important; font-weight: 700 !important; letter-spacing: 1px !important; text-transform: uppercase !important; cursor: pointer !important; transition: all 0.15s !important; margin-top: 6px !important; }\n' +
      '.ccd-checkout-btn:hover { background: #222 !important; }\n' +
      '.ccd-checkout-btn:active { background: #000 !important; }\n' +
      '.ccd-checkout-btn svg { width: 16px !important; height: 16px !important; fill: #fff !important; }\n' +
      '.ccd-trust { display: flex !important; align-items: center !important; justify-content: center !important; gap: 8px !important; padding: 4px 0 2px !important; font-size: 14px !important; color: #777 !important; }\n' +
      '.ccd-trust svg { width: 18px !important; height: 18px !important; fill: #6BA4E8 !important; }\n' +
      '.ccd-trust strong { color: #111 !important; font-weight: 700 !important; }\n' +
      '#CCD-Drawer .ccd-cart-empty, #CCD-Drawer .ccd-empty { color: #fff !important; text-align: center !important; flex: 1 !important; display: none !important; align-items: center !important; justify-content: flex-start !important; padding-top: 80px !important; }\n' +
      '#CCD-Drawer .ccd-cart-empty.ccd-show, #CCD-Drawer .ccd-empty.ccd-show { display: flex !important; flex-direction: column !important; gap: 16px !important; padding: 20px 20px 60px !important; }\n' +
      '.ccd-continue-btn { background: #111 !important; color: #fff !important; border: none !important; padding: 12px 24px !important; border-radius: 6px !important; cursor: pointer !important; font-size: 14px !important; font-weight: 600 !important; }\n' +
      '@media (min-width: 769px) { #CCD-Drawer { max-width: 520px !important; } }\n' +
      '@media (max-width: 768px) { #CCD-Drawer { max-width: var(--ccd-mobile-width, 78%) !important; } #CCD-Drawer.ccd-open { transform: translateX(0) !important; } #CCD-Drawer .ccd-close { display: flex !important; position: static !important; flex-shrink: 0 !important; margin: 0 !important; padding: 0 !important; width: auto !important; } #CCD-Drawer .ccd-close-btn { position: static !important; right: auto !important; left: auto !important; margin: 0 !important; padding: 12px !important; display: flex !important; height: auto !important; } .ccd-item__image { width: 100px !important; min-width: 100px !important; } .ccd-item { padding: 14px 0 !important; gap: 12px !important; } .ccd-progress { padding: 6px 16px 10px !important; } .ccd-progress__icon { width: 36px !important; height: 36px !important; } .ccd-progress__icon svg { width: 18px !important; height: 18px !important; } .ccd-progress__milestone { width: 36px !important; } .ccd-progress__line { margin-top: 18px !important; } .ccd-progress__message { font-size: 14px !important; margin-bottom: 8px !important; } .ccd-progress__label { font-size: 10px !important; } #CCD-Drawer .ccd-header { padding: 16px 16px 6px 16px !important; } .ccd-sticky-footer { padding: 0 16px 8px !important; } .ccd-checkout-btn { padding: 13px 20px !important; font-size: 14px !important; } .ccd-gift-item__body .ccd-item__image { width: 60px !important; min-width: 60px !important; } }\n' +
      '@keyframes ccdSpin { to { transform: rotate(360deg); } }\n' +
      '.ccd-spinner { display: inline-block !important; width: 16px !important; height: 16px !important; border: 2px solid rgba(255,255,255,0.3) !important; border-top-color: #fff !important; border-radius: 50% !important; animation: ccdSpin 0.6s linear infinite !important; }\n' +
      '.ccd-item--loading { opacity: 0.5 !important; pointer-events: none !important; }\n' +
      '.ccd-qty__btn--loading svg { display: none !important; }\n' +
      '.ccd-qty__btn--loading::after { content: "" !important; display: block !important; width: 12px !important; height: 12px !important; border: 1.5px solid rgba(0,0,0,0.15) !important; border-top-color: #333 !important; border-radius: 50% !important; animation: ccdSpin 0.6s linear infinite !important; }\n' +
      '.ccd-checkout-btn--loading { pointer-events: none !important; }\n' +
      '.ccd-checkout-btn--loading > svg { display: none !important; }\n' +
      '.ccd-checkout-btn--loading::before { content: "" !important; display: inline-block !important; width: 16px !important; height: 16px !important; border: 2px solid rgba(255,255,255,0.3) !important; border-top-color: #fff !important; border-radius: 50% !important; animation: ccdSpin 0.7s linear infinite !important; vertical-align: middle !important; flex-shrink: 0 !important; }\n' +
      '.ccd-gift-badge { width: fit-content !important; display: inline-flex !important; white-space: nowrap !important; align-self: flex-end !important; align-items: center !important; gap: 4px !important; font-size: 11px !important; font-weight: 600 !important; color: #1a7a1a !important; background: #edf7ed !important; border-radius: 4px !important; padding: 2px 8px !important; margin-top: 4px !important; line-height: 1.4 !important; }\n' +
      '.ccd-gift-badge svg { width: 14px !important; height: 14px !important; flex-shrink: 0 !important; }\n' +
      '.ccd-trust-badges { text-align: center !important; padding: 8px 0 4px !important; opacity: 1 !important; }\n' +
      '.ccd-trust-icons { display: flex !important; align-items: center !important; justify-content: center !important; gap: 6px !important; margin-bottom: 4px !important; }\n' +
      '.ccd-trust-label { font-size: 9px !important; color: var(--ccd-text-muted, #999) !important; margin-right: 4px !important; }\n' +
      '.ccd-trust-text { font-size: 11px !important; color: var(--ccd-text-muted, #999) !important; letter-spacing: 0.02em !important; }\n' +
      '.ccd-overlay { position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; background: rgba(0,0,0,0.4) !important; z-index: 9998 !important; opacity: 0 !important; transition: opacity 0.35s !important; pointer-events: none !important; }\n' +
      '.ccd-overlay--visible { opacity: 1 !important; pointer-events: auto !important; }';
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
  GIFT_TIERS.forEach(function(t) {
    tierGifts(t).forEach(function(g) { if (g.variantId) GIFT_VIDS[String(g.variantId)] = true; });
  });
  if (WATCH_CASE_VID) GIFT_VIDS[String(WATCH_CASE_VID)] = true;
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
  var toggling = false;
  var _userToggledOff = false;
  var watchCaseBusy = false;
    var _giftAddFails = {}; // handle → fail count, prevents infinite retry
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
      var drawer = document.getElementById('CCD-Drawer');
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
          '<div class="ccd-shipping-protection__icon">' + (_spCfg.iconUrl ? '<img src="' + _spCfg.iconUrl + '" style="width:20px;height:20px" alt="" />' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>') + '</div>' +
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
            '<div class="ccd-close">' +
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
          '<svg viewBox="0 0 24 24" width="48" height="48" fill="#fff" style="margin-bottom:8px"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>' +
          '<p>' + (CFG.emptyCartText || 'Your cart is empty') + '</p>' +
          '<button class="ccd-continue-btn" onclick="CCD.close()">' + (CFG.continueShoppingText || 'Continue Shopping') + '</button>' +
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
              '<svg class="ccd-trust__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg> ' +
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
      drawer.style.cssText = 'position:fixed;top:0;right:0;';
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
      var hasDiscount = item.discounts && item.discounts.length > 0;
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
      } else {
        // First open ever (_lastRealCount is -1) — hide everything, let fetch decide
        if (_pb) _pb.style.display = 'none';
        if (_ft) _ft.style.display = 'none';
        if (_id) _id.style.display = 'none';
      }
      d.classList.add('ccd-open');
      d.style.display = 'flex';
      var ov = document.getElementById('CCD-Overlay');
      if (ov) ov.classList.add('ccd-overlay--visible');
      document.body.style.overflow = 'hidden';
      CCD.refreshOnOpen();
    },

    closeDrawer: function() {
      var d = document.getElementById('CCD-Drawer');
      if (!d) return;
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
      var _themeDrawerSelectors = '#CartDrawer, cart-drawer, .cart-drawer, [data-drawer=cart-drawer], .js-cart-drawer, .drawer--cart';
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

    init: function() {
      // Set free price color from config
      document.documentElement.style.setProperty('--ccd-free-color', FREE_PRICE_COLOR);
      // VERSION STAMP
      console.log('%c[CCD v15.9] Theme-independent cart drawer loaded', 'background:#6b21a8;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold');
      window.__ccd_version = '15.0';
      window.__eliminai_cart_loaded = true;

      // Build our own drawer DOM (theme-independent)
      this.renderDrawerShell();
      this.fixMobileWidth();
      this.bindEvents();
      this.interceptAddToCart();
      this.interceptCartOpens();
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
    },


    _mergeTiersFromConfig: function(config) {
      if (!config || !config.cartConfig || !config.cartConfig.addons) return;
      var fsb = config.cartConfig.addons.freeShippingBar;
      if (!fsb || !fsb.config || !fsb.config.tiers || fsb.config.tiers.length === 0) return;
      REWARD_TIERS = fsb.config.tiers;
      THRESHOLD_MODE = fsb.config.thresholdMode || 'items';
      HIGHEST_TIER_ONLY = !!fsb.config.highestTierOnly;
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

    // Get the total to display = cart.total_price minus any gift costs Shopify didn't discount
    getAdjustedTotal: function(cart) {
      if (!cart) return 0;
      var giftCost = CCD.getGiftSavings(cart);
      var total = cart.total_price - giftCost;
      return total < 0 ? 0 : total;
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

      // Checkout button — validate gift eligibility, then redirect
      document.addEventListener('click', function(e) {
        var checkoutBtn = e.target.closest('.ccd-checkout-btn');
        if (checkoutBtn && !checkoutBtn.classList.contains('ccd-checkout-btn--loading')) {
          checkoutBtn.classList.add('ccd-checkout-btn--loading');
          e.preventDefault();
          e.stopPropagation();

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
          // Reset remove flags so the queued op gets a proper refresh path
          window.__ccd_is_removing = false;
          window.__ccd_block_rebuild = false;
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
          CCD.updateCartBubble(cart);
          var _ct = document.querySelector('.ccd-checkout-total');
          if (_ct) _ct.textContent = CCD.fmt(CCD.getAdjustedTotal(cart));
          var _st = document.querySelector('#CCD-Drawer [data-subtotal]');
          if (_st) _st.textContent = CCD.fmt(CCD.getAdjustedTotal(cart));
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
            var _rmGen = ++_refreshGen; // claim a generation for this refresh
            setTimeout(function() {
              var _oF = CCD._origFetch || fetch;
              _oF("/cart.js").then(function(r) { return r.json(); }).then(function(freshCart) {
                CCD.refresh(freshCart, _rmGen);
              }).catch(function(err) {
                console.warn("[CCD] post-remove /cart.js fetch failed:", err);
              });
            }, 150);
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

      var origFetch = window.fetch;
      CCD._origFetch = origFetch;
      window.fetch = function(url, opts) {
        if (typeof url === 'string' && url.indexOf('/cart/add') !== -1 && opts && opts.method && opts.method.toUpperCase() === 'POST') {
          try {
            var body = JSON.parse(opts.body);
            if (body && body.items && Array.isArray(body.items)) {
              var hasProt = body.items.some(function(it) { return PROT_TIERS.some(function(t){return t.vid === it.id || String(t.vid) === String(it.id);}); });
              var cartAlreadyHasProt = window.__ccd_last_cart && window.__ccd_last_cart.items && window.__ccd_last_cart.items.some(function(ci) { return ci.handle === PROT; });
              if (!hasProt && !cartAlreadyHasProt && !protectionDone && !_userToggledOff && PROT_ENABLED && PROT_VID && CFG.protectionDefaultOn !== false && CFG.protectionAutoAdd !== false) {
                body.items.push({ id: (getProtTier(0) || {vid:PROT_VID}).vid, quantity: 1 });
                opts.body = JSON.stringify(body);
                protectionDone = true;
              }
            }
          } catch(ex) {
            // Body is form-encoded — convert to JSON and inject protection into same request
            var _cartAlreadyHasProt = window.__ccd_last_cart && window.__ccd_last_cart.items && window.__ccd_last_cart.items.some(function(ci) { return ci.handle === PROT; });
            if (!_cartAlreadyHasProt && !protectionDone && !_userToggledOff && PROT_ENABLED && PROT_VID && CFG.protectionDefaultOn !== false && CFG.protectionAutoAdd !== false) {
              try {
                var formParams = new URLSearchParams(opts.body);
                var formId = formParams.get('id');
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
                  if (!_hasProt && !_userToggledOff && _shouldAdd && CCD.getRealCount(cart) > 0) {
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
                    .then(function(fullCart) { CCD.refresh(fullCart, _interceptGen); })
                    .catch(function() { CCD.refresh(cart, _interceptGen); });
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
                      .then(function(fixedCart) { CCD.refresh(fixedCart, _interceptGen); })
                      .catch(function() { CCD.refresh(cart, _interceptGen); });
                    } else {
                      CCD.refresh(cart, _interceptGen);
                    }
                  }
                  CCD.openDrawer();
                });
              });
            }).catch(function(){});
            return resp;
          });
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
      Object.keys(shouldHave).forEach(function(h) {
        if (!giftInCart[h] && !caseDismissed) {
          if ((_giftAddFails[h] || 0) >= 3) {
            console.warn('[CCD GIFT] Skipping ' + h + ' — failed ' + _giftAddFails[h] + ' times');
            return;
          }
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
              if (h) _giftAddFails[h] = (_giftAddFails[h] || 0) + 1;
            });
          }
          console.log('[CCD GIFT] added id=' + item.id);
          var h = Object.keys(shouldHave).find(function(k) { return shouldHave[k] == item.id; });
          if (h) _giftAddFails[h] = 0;
        });
      }

      // Execute removals first, then adds
      if (toRemove.length > 0) {
        watchCaseBusy = true;
        // Instantly hide from DOM
        document.querySelectorAll('#CCD-Drawer .ccd-item[data-gift="1"]').forEach(function(el) { el.remove(); });
        var _oF2 = CCD._origFetch || fetch;
        var removeChain = Promise.resolve();
        toRemove.forEach(function(key) {
          removeChain = removeChain.then(function() {
            return _oF2('/cart/change.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: key, quantity: 0 })
            });
          });
        });
        removeChain.then(function() {
          var addChain = Promise.resolve();
          toAdd.forEach(function(item) {
            addChain = addChain.then(function() { return _addOneGift(item); });
          });
          return addChain;
        })
        .then(function() { var _oF3 = CCD._origFetch || fetch; return _oF3('/cart.js'); })
        .then(function(r) { return r.json(); })
        .then(function(c) { watchCaseBusy = false; ++_refreshGen; CCD.refresh(c); })
        .catch(function(err) { console.error('[CCD GIFT] remove+add catch:', err); watchCaseBusy = false; });
      } else if (toAdd.length > 0) {
        watchCaseBusy = true;
        console.log('[CCD GIFT] Adding items:', JSON.stringify(toAdd));
        var addChain = Promise.resolve();
        toAdd.forEach(function(item) {
          addChain = addChain.then(function() { return _addOneGift(item); });
        });
        addChain
        .then(function() { var _oF4 = CCD._origFetch || fetch; return _oF4('/cart.js'); })
        .then(function(r) { return r.json(); })
        .then(function(c) { watchCaseBusy = false; ++_refreshGen; CCD.refresh(c); })
        .catch(function(err) { console.error('[CCD GIFT] add catch:', err); watchCaseBusy = false; });
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

        // 4. Set price to "Free" with compare price
        var priceEl = giftEl.querySelector('.ccd-item__price');
        if (priceEl) {
          priceEl.textContent = 'Free';
          priceEl.classList.add('ccd-item__price--free');
        }
        var origPrice = giftCartItem.original_price || giftCartItem.price || 0;
        var priceRow = giftEl.querySelector('.ccd-item__price-row') || (priceEl ? priceEl.parentElement : null);
        if (GIFT_SHOW_COMPARE_PRICE && priceRow && !priceRow.querySelector('.ccd-item__compare-price') && origPrice > 0) {
          var cp = document.createElement('span');
          cp.className = 'ccd-item__compare-price';
          cp.textContent = CCD.fmt(origPrice);
          priceRow.insertBefore(cp, priceRow.firstChild);
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
    // Lightweight refresh: update totals, progress, empty state — NO morphDOM
    refreshLight: function(cart) {
      CCD.updateCartBubble(cart);
      CCD.enforceGiftItem(cart);
      var ct = document.querySelector('.ccd-checkout-total');
      if (ct) ct.textContent = CCD.fmt(CCD.getAdjustedTotal(cart));
      var st = document.querySelector('#CCD-Drawer [data-subtotal]');
      if (st) st.textContent = CCD.fmt(CCD.getAdjustedTotal(cart));
      CCD.rebuildDiscountRow(cart);
      var protItem = cart.items.find(function(i) { return i.handle === PROT; });
      CCD._protKey = protItem ? protItem.key : null;
      if (protItem && protItem.quantity > 1) {
        var _oFP = CCD._origFetch || fetch;
        _oFP('/cart/change.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: protItem.key, quantity: 1 }) });
      }
      // Silent tier swap in refreshLight
      if (protItem && PROT_TIERS.length > 1) {
        var cartValExProtL = CCD.getAdjustedTotal(cart);
        var correctTierL = getProtTier(cartValExProtL);
        if (correctTierL && protItem.variant_id !== correctTierL.vid) {
          var _oSwapL = CCD._origFetch || fetch;
          _oSwapL('/cart/change.js', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: protItem.key, quantity: 0 }) })
          .then(function() { return _oSwapL('/cart/add.js', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ items: [{ id: correctTierL.vid, quantity: 1 }] }) }); })
          .then(function() { return _oSwapL('/cart.js'); })
          .then(function(r) { return r.json(); })
          .then(function(swappedCart) { CCD.refreshLight(swappedCart); });
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
        if (id) id.style.display = '';
        if (pb) pb.style.display = '';
        if (ft) ft.style.display = '';
      }
    },
    refresh: function(cart, _gen) {
      // Generation guard: if a newer refresh was requested, skip this stale one
      if (_gen !== undefined && _gen < _refreshGen) {
        console.log("[CCD] refresh() skipped — stale gen " + _gen + " < " + _refreshGen);
        return;
      }
      console.log("[CCD] refresh() called gen=" + (_gen || 'direct'));
      CCD.updateCartBubble(cart);

      // Pre-set toggle to ON before morphDOM can flash it off
      var shouldDefaultOn = CFG.protectionDefaultOn !== false && CFG.protectionAutoAdd !== false;
      if (shouldDefaultOn && CCD.getRealCount(cart) > 0) {
        CCD.setToggleNoTransition(true);
      }

      // Theme-independent: render items from cart JSON (no /cart?view=ajax)
      var pc = document.querySelector("#CCD-Drawer [data-products]");
      if (pc) {
        var ni = CCD.renderCartItems(cart);
        if (ni) {
          CCD.morphDOM(pc, ni);
        }
      }

      CCD.enforceGiftItem(cart);

      var ct = document.querySelector('.ccd-checkout-total');
      if (ct) ct.textContent = CCD.fmt(CCD.getAdjustedTotal(cart));
      var st = document.querySelector('#CCD-Drawer [data-subtotal]');
      if (st) st.textContent = CCD.fmt(CCD.getAdjustedTotal(cart));

      CCD.rebuildDiscountRow(cart);

      var protItem = cart.items.find(function(i) { return i.handle === PROT; });
      CCD._protKey = protItem ? protItem.key : null;
      if (protItem && protItem.quantity > 1) {
        var _oFP = CCD._origFetch || fetch;
        _oFP('/cart/change.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: protItem.key, quantity: 1 }) });
      }
      // Silent tier swap — if cart value changed, swap to correct tier
      if (protItem && PROT_TIERS.length > 1) {
        var cartValExProt = CCD.getAdjustedTotal(cart);
        var correctTier = getProtTier(cartValExProt);
        if (correctTier && protItem.variant_id !== correctTier.vid) {
          var _oSwap = CCD._origFetch || fetch;
          _oSwap('/cart/change.js', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: protItem.key, quantity: 0 }) })
          .then(function() { return _oSwap('/cart/add.js', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ items: [{ id: correctTier.vid, quantity: 1 }] }) }); })
          .then(function() { return _oSwap('/cart.js'); })
          .then(function(r) { return r.json(); })
          .then(function(swappedCart) { ++_refreshGen; CCD.refresh(swappedCart); });
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
      window.__ccd_last_cart = cart;

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
      } else {
        if (es) es.classList.remove('ccd-show');
        if (id) id.style.display = 'flex';
        if (pb) pb.style.display = 'block';
        if (ft) ft.style.display = 'block';
      }

      CCD.checkWatchCase(cart);
      CCD.checkOverflow();
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
      var items = document.querySelectorAll('#CCD-Drawer .ccd-item');
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
            msgEl.innerHTML = nextTier.beforeText.replace('{remaining}', unit);
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
      var self = this;
      this.loadExperiment(function(config) {
        if (config) {
          self.applyExperimentFeatures(config);
          // Merge backend addon config into CFG so all stores get the right settings
          // (not just stores using Liquid theme settings)
          if (config.cartConfig && config.cartConfig.addons) {
            var sp = config.cartConfig.addons.shippingProtection;
            if (sp && sp.config) {
              if ('defaultOn' in sp.config) CFG.protectionDefaultOn = sp.config.defaultOn;
              if ('price' in sp.config) CFG.protectionPrice = sp.config.price;
            }
            // ── Merge reward tiers from backend config ──
            CCD._mergeTiersFromConfig(config);
            
          }
        }
        // Track CART_OPENED on first actual cart open (not on pre-fetch)
        if (!self._cartOpenTracked) {
          self._cartOpenTracked = true;
          self.sendEvent('CART_OPENED', { source: 'client-open' });
        }
        // Single cart fetch — no race between ensureProtection and refresh
        fetch('/cart.js')
        .then(function(r) { return r.json(); })
        .then(function(cart) {
          var rc = CCD.getRealCount(cart); CCD._lastRealCount = rc;
          // Add protection if needed (inline instead of separate ensureProtection to avoid double fetch)
          var shouldAutoAdd = PROT_ENABLED && PROT_VID && CFG.protectionDefaultOn !== false && CFG.protectionAutoAdd !== false;
          var hasProt = cart.items.some(function(i) { return i.handle === PROT; });
          if (!protectionDone && !toggling && !_userToggledOff && shouldAutoAdd && rc > 0 && !hasProt) {
            // Nobody added protection yet — add via /cart/update.js (returns full cart in one call)
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
          } else if (protectionDone && !hasProt && !_userToggledOff && shouldAutoAdd && rc > 0) {
            // Interceptor already injected protection into the add request — just wait for it to land
            CCD.setToggleNoTransition(true);
            setTimeout(function() {
              var _oF2 = CCD._origFetch || fetch;
              _oF2('/cart.js')
                .then(function(r) { return r.json(); })
                .then(function(freshCart) { CCD.refresh(freshCart); })
                .catch(function() { CCD.refresh(cart); });
            }, 300);
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
      if (scrollable && inner) {
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
  CCD.injectUpsells = function(cfg) {
    if (document.getElementById('ccd-upsells')) return;
    // TODO: implement upsell recommendations
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
