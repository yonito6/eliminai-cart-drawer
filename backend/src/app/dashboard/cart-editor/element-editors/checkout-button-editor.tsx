'use client';

// Checkout button element editor — Chunk 5.4.6.

import React from 'react';
import { useDraftStore, readField } from '../draft-store';
import { ColorInput, Field, Section, Select, Slider, TextInput, Toggle } from './_controls';

export default function CheckoutButtonEditor() {
  const { draft, setField } = useDraftStore();
  const get = <T,>(p: string) => readField<T>(draft, p);

  return (
    <div>
      <Section title="Label">
        <Field label="Button label">
          <TextInput
            value={get<string>('checkoutButton.label')}
            onChange={(v) => setField('checkoutButton.label', v || undefined)}
            placeholder="Checkout"
            maxLength={200}
          />
        </Field>
        <Field label="Icon">
          <Select
            value={get<'none' | 'arrow' | 'lock' | 'cart'>('checkoutButton.icon')}
            options={[
              { value: 'none', label: 'No icon' },
              { value: 'arrow', label: '→ Arrow' },
              { value: 'lock', label: '🔒 Lock' },
              { value: 'cart', label: '🛒 Cart' },
            ]}
            onChange={(v) => setField('checkoutButton.icon', v)}
          />
        </Field>
      </Section>

      <Section title="Colors">
        <Field label="Background">
          <ColorInput
            value={get<string>('checkoutButton.bgColor')}
            onChange={(v) => setField('checkoutButton.bgColor', v)}
          />
        </Field>
        <Field label="Background (hover)">
          <ColorInput
            value={get<string>('checkoutButton.bgHoverColor')}
            onChange={(v) => setField('checkoutButton.bgHoverColor', v)}
          />
        </Field>
        <Field label="Text color">
          <ColorInput
            value={get<string>('checkoutButton.textColor')}
            onChange={(v) => setField('checkoutButton.textColor', v)}
          />
        </Field>
      </Section>

      <Section title="Shape & size">
        <Field label="Corner radius">
          <Select
            value={get<'sharp' | 'soft' | 'rounded' | 'pill'>('checkoutButton.radius')}
            options={[
              { value: 'sharp', label: 'Sharp' },
              { value: 'soft', label: 'Soft' },
              { value: 'rounded', label: 'Rounded' },
              { value: 'pill', label: 'Pill' },
            ]}
            onChange={(v) => setField('checkoutButton.radius', v)}
          />
        </Field>
        <Field label="Height">
          <Select
            value={get<'S' | 'M' | 'L' | 'XL'>('checkoutButton.height')}
            options={[
              { value: 'S', label: 'Small' },
              { value: 'M', label: 'Medium' },
              { value: 'L', label: 'Large' },
              { value: 'XL', label: 'Extra large' },
            ]}
            onChange={(v) => setField('checkoutButton.height', v)}
          />
        </Field>
        <Field label="Full width">
          <Toggle
            value={get<boolean>('checkoutButton.fullWidth')}
            onChange={(v) => setField('checkoutButton.fullWidth', v)}
            label="Stretch button to the drawer width"
          />
        </Field>
      </Section>

      <Section title="Typography">
        <Field label="Font weight">
          <Slider
            value={get<number>('checkoutButton.fontWeight')}
            min={100}
            max={900}
            step={100}
            onChange={(v) => setField('checkoutButton.fontWeight', v)}
          />
        </Field>
        <Field label="Letter spacing">
          <Slider
            value={get<number>('checkoutButton.letterSpacing')}
            min={-2}
            max={10}
            step={0.1}
            onChange={(v) => setField('checkoutButton.letterSpacing', v)}
            unit="px"
          />
        </Field>
      </Section>

      <Section title="Loading state">
        <Field
          label="Animation while submitting"
          hint="Shown after the customer clicks Checkout, while the page is loading"
        >
          <Select
            value={get<'spinner' | 'dots' | 'shimmer'>('checkoutButton.loadingAnim')}
            options={[
              { value: 'spinner', label: 'Spinner' },
              { value: 'dots', label: 'Bouncing dots' },
              { value: 'shimmer', label: 'Shimmer' },
            ]}
            onChange={(v) => setField('checkoutButton.loadingAnim', v)}
          />
        </Field>
      </Section>
    </div>
  );
}
