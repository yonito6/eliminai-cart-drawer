'use client';

// Deep-link banner that points to a specific addon editor inside the Addons tab.
// Used in two places:
//   1. Milestone editor (5.4.2) and trust-line editor (5.4.7) — shows
//      "Edit tiers/providers in Addons →" above the visual controls.
//   2. Footer hotspots that are entirely addon-owned (notes, discountCode,
//      termsCheckbox, expressPayments) — Chunk 5.5 replaces their inline
//      panel with just this banner.
//
// The link goes to `/dashboard/addons?expand=<addonKey>` so the Addons page
// can auto-open the matching card (Chunk 5.5 implements the `?expand=` reader).

import React from 'react';
import Link from 'next/link';

const PURPLE = '#7c3aed';

export interface AddonDeepLinkProps {
  addonKey: string;
  // Friendly description used as a heading on the deep-link banner
  title: string;
  // Short explanation of what the user will see in the Addons tab
  description?: string;
}

export default function AddonDeepLink({ addonKey, title, description }: AddonDeepLinkProps) {
  return (
    <Link
      href={`/dashboard/addons?expand=${encodeURIComponent(addonKey)}`}
      style={{
        display: 'block',
        textDecoration: 'none',
        background: '#faf5ff',
        border: `1px solid #e9d5ff`,
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: PURPLE, marginBottom: description ? 4 : 0 }}>
            {title}
          </div>
          {description && (
            <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>{description}</div>
          )}
        </div>
        <span style={{ fontSize: 16, color: PURPLE, flexShrink: 0 }}>→</span>
      </div>
    </Link>
  );
}
