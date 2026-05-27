'use client';

// Empty state element editor — Chunk 5.4.4.
// Validates ctaLink locally to match the server-side Zod rule: must be a
// relative path starting with /<not-/> or an https:// URL.

import React, { useMemo } from 'react';
import { useDraftStore, readField } from '../draft-store';
import { Field, Section, TextInput, Textarea, Toggle } from './_controls';

function validateCtaLink(v: string): string | null {
  if (!v) return null;
  if (/^\/[^/]/.test(v) || v === '/') return null;
  if (/^https:\/\//.test(v)) return null;
  return 'Use a path starting with / or an https:// URL';
}

export default function EmptyStateEditor() {
  const { draft, setField } = useDraftStore();
  const get = <T,>(p: string) => readField<T>(draft, p);

  const ctaLink = get<string>('emptyState.ctaLink') ?? '';
  const ctaError = useMemo(() => validateCtaLink(ctaLink), [ctaLink]);

  return (
    <div>
      <Section title="Empty cart message">
        <Field label="Heading">
          <TextInput
            value={get<string>('emptyState.heading')}
            onChange={(v) => setField('emptyState.heading', v || undefined)}
            placeholder="Your cart is empty"
            maxLength={200}
          />
        </Field>
        <Field label="Subtext">
          <Textarea
            value={get<string>('emptyState.subtext')}
            onChange={(v) => setField('emptyState.subtext', v || undefined)}
            placeholder="Looks like you haven't added anything yet."
            maxLength={200}
            rows={2}
          />
        </Field>
        <Field
          label="Icon"
          hint="Emoji, short character, or URL of an image"
        >
          <TextInput
            value={get<string>('emptyState.icon')}
            onChange={(v) => setField('emptyState.icon', v || undefined)}
            placeholder="🛒"
            maxLength={200}
          />
        </Field>
      </Section>

      <Section title="Call to action">
        <Field label="Button label">
          <TextInput
            value={get<string>('emptyState.ctaLabel')}
            onChange={(v) => setField('emptyState.ctaLabel', v || undefined)}
            placeholder="Continue shopping"
            maxLength={200}
          />
        </Field>
        <Field
          label="Button link"
          hint={ctaError ?? 'Relative path (e.g. /collections/all) or full https:// URL'}
        >
          <TextInput
            value={ctaLink}
            onChange={(v) => setField('emptyState.ctaLink', v || undefined)}
            placeholder="/collections/all"
          />
        </Field>
        {ctaError && (
          <div style={{ fontSize: 12, color: '#b91c1c', marginTop: -6 }}>
            {ctaError}
          </div>
        )}
        <Field label="Inherit checkout button style">
          <Toggle
            value={get<boolean>('emptyState.ctaInheritsCheckoutStyle')}
            onChange={(v) => setField('emptyState.ctaInheritsCheckoutStyle', v)}
            label="Match colors and radius of the Checkout button"
          />
        </Field>
      </Section>
    </div>
  );
}
