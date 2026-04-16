/**
 * Built-in SVG icons for shipping protection addon.
 * Each icon is a complete inline SVG string that can be rendered in the cart drawer.
 */

export interface ProtectionIcon {
  id: string;
  label: string;
  svg: string;
}

export const PROTECTION_ICONS: ProtectionIcon[] = [
  {
    id: 'box-shield',
    label: 'Box with Shield',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3"/><path d="M21 8v8a2 2 0 0 1-2 2h-3"/><path d="M3 8v8a2 2 0 0 0 2 2h3"/><path d="M12 8l4 2.5v5L12 18l-4-2.5v-5L12 8z"/><path d="M12 12v6"/><path d="M12 12l4-2.5"/><path d="M12 12l-4-2.5"/></svg>`,
  },
  {
    id: 'shield-check',
    label: 'Shield with Checkmark',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>`,
  },
  {
    id: 'shield-lock',
    label: 'Shield with Lock',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><rect x="9" y="10" width="6" height="5" rx="1"/><path d="M10 10V8a2 2 0 1 1 4 0v2"/></svg>`,
  },
  {
    id: 'umbrella',
    label: 'Umbrella',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 12a11.05 11.05 0 0 0-22 0"/><path d="M12 12v9a2 2 0 0 0 4 0"/><path d="M12 2v2"/></svg>`,
  },
  {
    id: 'hand-shield',
    label: 'Hand with Shield',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11V4a2 2 0 0 1 4 0v2"/><path d="M11 6V3a2 2 0 0 1 4 0v4"/><path d="M15 7V5a2 2 0 0 1 4 0v7c0 4-3 7-7 7H9c-2 0-4-1-5.5-3L2 14"/><path d="M7 11a2 2 0 0 0-4 0v1"/><path d="M13 14l2 1.5v3L13 20l-2-1.5v-3L13 14z"/></svg>`,
  },
];

/**
 * Get the SVG string for a built-in protection icon by ID.
 * Returns the shield-check icon as default if the ID is not found.
 */
export function getProtectionIconSvg(iconId: string): string {
  const icon = PROTECTION_ICONS.find((i) => i.id === iconId);
  return icon?.svg ?? PROTECTION_ICONS[1].svg; // default to shield-check
}
