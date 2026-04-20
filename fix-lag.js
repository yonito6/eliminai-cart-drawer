const fs = require('fs');
const path = 'C:/Projects/eliminai-cart-drawer/backend/src/app/dashboard/addons/protection-editor.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add useCallback import if not present
if (!code.includes('useCallback')) {
  code = code.replace(
    "import React, { useState, useEffect, useRef } from 'react';",
    "import React, { useState, useEffect, useRef, useCallback } from 'react';"
  );
}

// 2. Add debounced preview ref after the didMount ref setup (after line ~146)
// Find the closing of the didMount useEffect and add debounce ref after it
const debounceCode = `
  // ── Debounced preview for text inputs (prevents cursor jumping) ──
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function pushPreviewDebounced(overrides: Record<string, any>) {
    setIsDirty(true); // mark dirty immediately
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      pushPreview(overrides);
    }, 200);
  }
`;

// Insert after the didMount useEffect block
code = code.replace(
  '  // ── Create Shopify product ──',
  debounceCode + '\n  // ── Create Shopify product ──'
);

// 3. Replace productName onChange to use debounced version
code = code.replace(
  `onChange={(e) => {
            setProductName(e.target.value);
            pushPreview({ productName: e.target.value });
          }}
          placeholder="Shipping Protection"`,
  `onChange={(e) => {
            setProductName(e.target.value);
            pushPreviewDebounced({ productName: e.target.value });
          }}
          placeholder="Shipping Protection"`
);

// 4. Replace description onChange to use debounced version
code = code.replace(
  `onChange={(e) => {
            setDescription(e.target.value);
            pushPreview({ description: e.target.value });
          }}
          placeholder="Covers lost, stolen, or damaged packages"`,
  `onChange={(e) => {
            setDescription(e.target.value);
            pushPreviewDebounced({ description: e.target.value });
          }}
          placeholder="Covers lost, stolen, or damaged packages"`
);

fs.writeFileSync(path, code);
console.log('✓ protection-editor.tsx updated — text inputs now use debounced preview (200ms)');

// Verify
const updated = fs.readFileSync(path, 'utf8');
console.log('pushPreviewDebounced count:', (updated.match(/pushPreviewDebounced/g) || []).length);
console.log('Has useCallback import:', updated.includes('useCallback'));
console.log('Has previewTimerRef:', updated.includes('previewTimerRef'));
