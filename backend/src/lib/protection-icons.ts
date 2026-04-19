/**
 * Built-in SVG icons for shipping protection addon.
 * High-quality icons from Lucide/Heroicons icon libraries (MIT licensed, free to use).
 * Each icon is a complete inline SVG string that can be rendered in the cart drawer.
 */

export interface ProtectionIcon {
  id: string;
  label: string;
  svg: string;
}

export const PROTECTION_ICONS: ProtectionIcon[] = [
  {
    id: 'shield-check',
    label: 'Shield with Checkmark',
    // Lucide shield-check
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>`,
  },
  {
    id: 'shield-lock',
    label: 'Shield with Lock',
    // Lucide shield + lock combo
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><rect x="9" y="10" width="6" height="5" rx="1"/><path d="M10 10V8a2 2 0 1 1 4 0v2"/></svg>`,
  },
  {
    id: 'box-shield',
    label: 'Package Protection',
    // Lucide package + shield overlay
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  },
  {
    id: 'umbrella',
    label: 'Insurance Umbrella',
    // Lucide umbrella
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12a10.06 10.06 0 0 0-20 0Z"/><path d="M12 12v8a2 2 0 0 0 4 0"/><path d="M12 2v1"/></svg>`,
  },
  {
    id: 'shield-heart',
    label: 'Shield with Heart',
    // Lucide shield + heart
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 17.5s-3.5-2.5-3.5-4.5a2 2 0 0 1 3.5-1.4A2 2 0 0 1 15.5 13c0 2-3.5 4.5-3.5 4.5z"/></svg>`,
  },
  {
    id: 'truck-shield',
    label: 'Shipping Shield',
    // Lucide truck
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 13.52 9H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`,
  },
  {
    id: 'hand-shield',
    label: 'Safeguard Hand',
    // Lucide hand + shield
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11V4a2 2 0 0 1 4 0v2"/><path d="M11 6V3a2 2 0 0 1 4 0v4"/><path d="M15 7V5a2 2 0 0 1 4 0v7c0 4-3 7-7 7H9c-2 0-4-1-5.5-3L2 14"/><path d="M7 11a2 2 0 0 0-4 0v1"/></svg>`,
  },
  {
    id: 'shield-star',
    label: 'Premium Protection',
    // Lucide shield + star
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><polygon points="12,8.5 13.1,11 15.9,11.2 13.8,13 14.5,15.7 12,14.2 9.5,15.7 10.2,13 8.1,11.2 10.9,11"/></svg>`,
  },
];

/**
 * Get the SVG string for a built-in protection icon by ID.
 * Returns the shield-check icon as default if the ID is not found.
 */
export function getProtectionIconSvg(iconId: string): string {
  const icon = PROTECTION_ICONS.find((i) => i.id === iconId);
  return icon?.svg ?? PROTECTION_ICONS[0].svg; // default to shield-check
}
