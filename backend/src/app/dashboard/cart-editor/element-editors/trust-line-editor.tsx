'use client';

// Trust line element editor — Chunk 5.4.7.
// Provider LIST is addon-owned (addons.trustLine.providers) — managed in the
// Addons tab. Per-provider VISIBILITY is editorOverrides-owned and lives in
// trustLine.paymentIcons as a record<providerKey, boolean>.
//
// Until the Addons store is wired into the cart editor, we expose toggles
// for the set of provider keys we find in the draft + a fallback list of
// common providers so users see something useful out of the box.

import React from 'react';
import { useDraftStore, readField } from '../draft-store';
import AddonDeepLink from '../addon-deep-link';
import { ColorInput, Field, Section, Select, Slider, TextInput, Toggle } from './_controls';

// Default providers shown when no per-provider visibility has been set yet.
// The Addons tab is the source of truth for which providers a store offers.
const DEFAULT_PROVIDERS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'visa', label: 'Visa' },
  { key: 'mastercard', label: 'Mastercard' },
  { key: 'amex', label: 'American Express' },
  { key: 'paypal', label: 'PayPal' },
  { key: 'applePay', label: 'Apple Pay' },
  { key: 'googlePay', label: 'Google Pay' },
  { key: 'shopPay', label: 'Shop Pay' },
];

export default function TrustLineEditor() {
  const { draft, setField } = useDraftStore();
  const get = <T,>(p: string) => readField<T>(draft, p);
  const paymentIcons = get<Record<string, boolean>>('trustLine.paymentIcons') ?? {};

  // Union the known providers with whatever the draft already has
  const providerKeys = Array.from(
    new Set([...DEFAULT_PROVIDERS.map((p) => p.key), ...Object.keys(paymentIcons)]),
  );

  function toggleProvider(key: string, value: boolean) {
    setField(`trustLine.paymentIcons.${key}`, value);
  }

  return (
    <div>
      <AddonDeepLink
        addonKey="trustLine"
        title="Add or remove providers in Addons →"
        description="The list of payment providers (Visa, PayPal, etc.) is managed in the Addons tab. Here you control which of them appear in the cart drawer."
      />

      <Section title="Message">
        <Field label="Text">
          <TextInput
            value={get<string>('trustLine.text')}
            onChange={(v) => setField('trustLine.text', v || undefined)}
            placeholder="Secure checkout"
            maxLength={200}
          />
        </Field>
        <Field label="Show lock icon">
          <Toggle
            value={get<boolean>('trustLine.showLockIcon')}
            onChange={(v) => setField('trustLine.showLockIcon', v)}
            label="Display a padlock icon before the text"
          />
        </Field>
        <Field label="Position">
          <Select
            value={get<'above' | 'below'>('trustLine.position')}
            options={[
              { value: 'above', label: 'Above checkout button' },
              { value: 'below', label: 'Below checkout button' },
            ]}
            onChange={(v) => setField('trustLine.position', v)}
          />
        </Field>
        <Field label="Text size">
          <Slider
            value={get<number>('trustLine.textSize')}
            min={8}
            max={24}
            step={0.5}
            onChange={(v) => setField('trustLine.textSize', v)}
            unit="px"
          />
        </Field>
        <Field label="Text color">
          <ColorInput
            value={get<string>('trustLine.textColor')}
            onChange={(v) => setField('trustLine.textColor', v)}
          />
        </Field>
      </Section>

      <Section title="Payment icons">
        {providerKeys.map((key) => {
          const def = DEFAULT_PROVIDERS.find((p) => p.key === key);
          const label = def ? def.label : key;
          return (
            <Field key={key} label={label}>
              <Toggle
                value={paymentIcons[key]}
                onChange={(v) => toggleProvider(key, v)}
                label={`Show ${label} icon`}
              />
            </Field>
          );
        })}
      </Section>
    </div>
  );
}
