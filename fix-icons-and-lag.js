const fs = require('fs');

// ── 1. Replace ALL protection icons with filled (Material) style ──
const iconsContent = `/**
 * Built-in SVG icons for shipping protection addon.
 * All icons use Material Design filled style (fill="currentColor") for visual consistency.
 */

export interface ProtectionIcon {
  id: string;
  label: string;
  svg: string;
}

export const PROTECTION_ICONS: ProtectionIcon[] = [
  {
    id: 'shield-filled',
    label: 'Shield (Default)',
    // Material filled shield
    svg: \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"></path></svg>\`,
  },
  {
    id: 'shield-check',
    label: 'Shield with Checkmark',
    // Material verified-user (filled shield + check)
    svg: \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>\`,
  },
  {
    id: 'shield-lock',
    label: 'Shield with Lock',
    // Material security (filled shield + lock)
    svg: \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 6c1.4 0 2.8 1.1 2.8 2.5V11c.6 0 1.2.6 1.2 1.2v3.5c0 .7-.6 1.3-1.2 1.3H9.2c-.7 0-1.2-.6-1.2-1.2v-3.5c0-.7.5-1.3 1.2-1.3V9.5C9.2 8.1 10.6 7 12 7zm0 1.2c-.8 0-1.5.7-1.5 1.3V11h3V9.5c0-.6-.7-1.3-1.5-1.3z"/></svg>\`,
  },
  {
    id: 'box-shield',
    label: 'Package Protection',
    // Material inventory-2 (filled package box)
    svg: \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1 0-2 1-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1-1-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z"/></svg>\`,
  },
  {
    id: 'umbrella',
    label: 'Insurance Umbrella',
    // Material beach-access simplified (filled umbrella)
    svg: \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M13.127 14.56l1.43-1.43 6.44 6.443L19.57 21l-6.443-6.44zm-3.96.637l-1.37 1.36c-.78.78-.78 2.05 0 2.83l-.71.71c-1.17-1.17-1.17-3.07 0-4.24l1.37-1.36.71.7zM6.75 2.84c1.96-1.96 5.13-1.96 7.07 0l-3.54 3.54 5.66 5.66-3.54 3.54-5.66-5.66-3.54 3.54c-1.96-1.96-1.96-5.12.01-7.08l3.54-3.54z"/></svg>\`,
  },
  {
    id: 'shield-heart',
    label: 'Shield with Heart',
    // Material shield with heart (filled)
    svg: \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 5c1.1 0 2 .5 2.6 1.3.6-.8 1.5-1.3 2.6-1.3 1.8 0 2.8 1.4 2.8 3 0 3.2-5.4 6-5.4 6S9.2 14.2 9.2 10c0-1.6 1-3 2.8-3z"/></svg>\`,
  },
  {
    id: 'truck-shield',
    label: 'Shipping Shield',
    // Material local-shipping (filled delivery truck)
    svg: \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>\`,
  },
  {
    id: 'hand-shield',
    label: 'Safeguard Hand',
    // Material pan-tool (filled hand)
    svg: \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M23 5.5V20c0 2.2-1.8 4-4 4h-7.3c-1.08 0-2.1-.43-2.85-1.19L1 14.83s1.26-1.23 1.3-1.25c.22-.19.49-.29.79-.29.22 0 .42.06.6.16.04.01 4.31 2.46 4.31 2.46V4c0-.83.67-1.5 1.5-1.5S11 3.17 11 4v7h1V1.5c0-.83.67-1.5 1.5-1.5S15 .67 15 1.5V11h1V2.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V11h1V5.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5z"/></svg>\`,
  },
  {
    id: 'shield-star',
    label: 'Premium Protection',
    // Material shield with star (filled)
    svg: \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4l1.7 3.5 3.8.5-2.75 2.7.65 3.8L12 13.8 8.6 15.5l.65-3.8L6.5 9l3.8-.5L12 5z"/></svg>\`,
  },
];

/**
 * Get the SVG string for a built-in protection icon by ID.
 * Returns the shield-filled icon as default if the ID is not found.
 */
export function getProtectionIconSvg(iconId: string): string {
  const icon = PROTECTION_ICONS.find((i) => i.id === iconId);
  return icon?.svg ?? PROTECTION_ICONS[0].svg; // default to shield-filled
}
`;

fs.writeFileSync('C:/Projects/eliminai-cart-drawer/backend/src/lib/protection-icons.ts', iconsContent);
console.log('✓ protection-icons.ts updated — all icons now filled style');

// ── 2. Fix text description input lag in protection-editor.tsx ──
const editorPath = 'C:/Projects/eliminai-cart-drawer/backend/src/app/dashboard/addons/protection-editor.tsx';
let editor = fs.readFileSync(editorPath, 'utf8');

// The lag is caused by pushPreview() being called on every keystroke in onChange handlers.
// pushPreview sends a postMessage to the iframe which causes re-render.
// Fix: debounce pushPreview, and use local state for text inputs so they don't lag.

// Check if there's a pushPreview call in onChange for text inputs
const hasPushPreviewInOnChange = editor.includes('pushPreview');
console.log('pushPreview found in editor:', hasPushPreviewInOnChange);

// Find the pattern where description onChange calls pushPreview immediately
// We need to debounce it - only push preview after user stops typing for 300ms

// Add a debounced pushPreview ref at the top of the component
// Find the component function start
const useStateImport = editor.indexOf("'use client'");
console.log('use client at:', useStateImport);

// Let's check what the onChange for description looks like
const descIdx = editor.indexOf('description');
console.log('First "description" at char:', descIdx);

// Read a section around description input to understand the pattern
const lines = editor.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('description') && (lines[i].includes('onChange') || lines[i].includes('value='))) {
    console.log(`Line ${i+1}: ${lines[i].trim()}`);
  }
  if (lines[i].includes('pushPreview')) {
    console.log(`Line ${i+1} (pushPreview): ${lines[i].trim()}`);
  }
}

console.log('\n--- Done. Now check protection-editor.tsx for the lag pattern ---');
