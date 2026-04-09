'use client';

import React, { useState, useEffect } from 'react';
import { REAL_CART_CSS, CONTROL_HTML, TRUST_BADGES_HTML } from '../cart-constants';

const FOCUS_AREAS: Record<string, { scrollTo: string; height: number }> = {
  trustBadges: { scrollTo: 'ccd-trust-badges', height: 220 },
  shippingProtection: { scrollTo: 'ccd-shipping-protection', height: 160 },
  scarcityTimer: { scrollTo: 'ccd-scarcity-badge', height: 180 },
  freeShippingBar: { scrollTo: 'ccd-progress', height: 180 },
  upsellRecommendations: { scrollTo: 'cart__items', height: 200 },
  socialProof: { scrollTo: 'ccd-trust', height: 160 },
};

interface AddonPreviewProps {
  addonKey: string;
  addonConfig: Record<string, any>;
  mode: 'focused' | 'full';
}

export default function AddonPreview({ addonKey, addonConfig, mode }: AddonPreviewProps) {
  const [iframeHeight, setIframeHeight] = useState(mode === 'full' ? 680 : (FOCUS_AREAS[addonKey]?.height || 200));

  let cartHtml = CONTROL_HTML;

  if (addonKey === 'trustBadges') {
    cartHtml = cartHtml.replace('<!-- TRUST_BADGES_PLACEHOLDER -->', TRUST_BADGES_HTML);
  }

  const focusArea = FOCUS_AREAS[addonKey];
  const scrollScript = mode === 'focused' && focusArea
    ? '<scr' + 'ipt>window.addEventListener("load",function(){setTimeout(function(){var el=document.querySelector(".' + focusArea.scrollTo + '")||document.getElementById("' + focusArea.scrollTo + '");if(el){el.scrollIntoView({block:"center"});el.style.background="rgba(59,130,246,0.05)";el.style.borderRadius="8px";el.style.transition="background 0.5s"}},150)})</scr' + 'ipt>'
    : '';

  const heightScript = mode === 'full'
    ? '<scr' + 'ipt>function nh(){var h=document.body.scrollHeight;window.parent.postMessage({type:"aph",h:h},"*")}window.addEventListener("load",function(){setTimeout(nh,100)});new MutationObserver(nh).observe(document.body,{childList:true,subtree:true})</scr' + 'ipt>'
    : '';

  const srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'
    + REAL_CART_CSS
    + '</style></head><body style="margin:0;padding:0;' + (mode === 'focused' ? 'overflow:hidden' : '') + '">'
    + cartHtml
    + scrollScript
    + heightScript
    + '</body></html>';

  useEffect(() => {
    if (mode !== 'full') return;
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'aph' && e.data.h) {
        setIframeHeight(Math.min(e.data.h + 10, 900));
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [mode]);

  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb', background: '#fff' }}>
      <iframe
        srcDoc={srcdoc}
        style={{
          width: '100%',
          height: mode === 'focused' ? (FOCUS_AREAS[addonKey]?.height || 200) : iframeHeight,
          border: 'none',
          display: 'block',
        }}
        sandbox="allow-scripts"
        title={'Addon preview - ' + addonKey}
      />
    </div>
  );
}
