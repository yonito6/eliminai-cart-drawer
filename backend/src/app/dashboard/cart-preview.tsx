"use client";

import React, { useEffect, useState } from "react";
import { REAL_CART_CSS, CONTROL_HTML, TRUST_BADGES_HTML } from "./cart-constants";

interface CartPreviewProps {
  variant: string;
  label: string;
  features?: Record<string, any>;
  color?: string;
}

export default function CartPreview({ variant, label, features }: CartPreviewProps) {
  const [iframeHeight, setIframeHeight] = useState(680);

  let cartHtml = CONTROL_HTML;
  if (variant === "variant" && features?.showTrustBadges) {
    cartHtml = cartHtml.replace(
      "<!-- TRUST_BADGES_PLACEHOLDER -->",
      '<div class="ccd-experiment-highlight">' + TRUST_BADGES_HTML + "</div>"
    );
  }

  const srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'
    + REAL_CART_CSS
    + '</style></head><body style="margin:0;padding:0;overflow:hidden">'
    + cartHtml
    + '<scr' + 'ipt>function nh(){var h=document.body.scrollHeight;window.parent.postMessage({type:"cph",h:h},"*")}window.addEventListener("load",function(){setTimeout(nh,100)});new MutationObserver(nh).observe(document.body,{childList:true,subtree:true})</scr' + 'ipt></body></html>';

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "cph" && e.data.h) {
        setIframeHeight(Math.min(e.data.h + 10, 900));
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        textAlign: "center",
        padding: "8px 12px",
        background: variant === "control" ? "#f1f5f9" : "#eff6ff",
        borderRadius: "8px 8px 0 0",
        fontWeight: 600,
        fontSize: 13,
        color: variant === "control" ? "#64748b" : "#3b82f6",
        borderBottom: "1px solid #e2e8f0",
      }}>
        {label}
      </div>
      <div style={{
        border: "1px solid #e2e8f0",
        borderTop: "none",
        borderRadius: "0 0 8px 8px",
        overflow: "hidden",
        background: "#fff",
      }}>
        <iframe
          srcDoc={srcdoc}
          style={{
            width: "100%",
            height: iframeHeight,
            border: "none",
            display: "block",
          }}
          sandbox="allow-scripts"
          title={"Cart preview - " + label}
        />
      </div>
    </div>
  );
}