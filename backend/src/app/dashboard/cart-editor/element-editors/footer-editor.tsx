'use client';

// Footer element editor — Chunk 5.4.5.
// Controls totals visibility, the optional "Total outside button" layout,
// background style, border, and stickyFooter behavior.

import React from 'react';
import { useDraftStore, readField } from '../draft-store';
import { Field, Section, Select, Slider, TextInput, Toggle } from './_controls';

export default function FooterEditor() {
  const { draft, setField } = useDraftStore();
  const get = <T,>(p: string) => readField<T>(draft, p);

  return (
    <div>
      <Section title="Totals visibility">
        <Field label="Subtotal">
          <Toggle
            value={get<boolean>('footer.showSubtotal')}
            onChange={(v) => setField('footer.showSubtotal', v)}
            label="Show subtotal line"
          />
        </Field>
        <Field label="Crossed-out subtotal">
          <Toggle
            value={get<boolean>('footer.showCrossedOutSubtotal')}
            onChange={(v) => setField('footer.showCrossedOutSubtotal', v)}
            label="Show the original (pre-discount) subtotal struck through"
          />
        </Field>
        <Field label="You saved">
          <Toggle
            value={get<boolean>('footer.showYouSaved')}
            onChange={(v) => setField('footer.showYouSaved', v)}
            label="Show a savings line under the subtotal"
          />
        </Field>
        <Field label="Shipping note">
          <Toggle
            value={get<boolean>('footer.showShippingNote')}
            onChange={(v) => setField('footer.showShippingNote', v)}
            label="Display 'Shipping calculated at checkout'"
          />
        </Field>
        <Field label="Tax note">
          <Toggle
            value={get<boolean>('footer.showTaxNote')}
            onChange={(v) => setField('footer.showTaxNote', v)}
            label="Display 'Taxes calculated at checkout'"
          />
        </Field>
        <Field label="Gift note">
          <Toggle
            value={get<boolean>('footer.showGiftNote')}
            onChange={(v) => setField('footer.showGiftNote', v)}
            label="Show a gift note row in the totals area"
          />
        </Field>
      </Section>

      <Section title="Total display">
        <Field
          label="Total outside button"
          hint="When ON: total appears in its own row above the Checkout button. When OFF: total is appended inside the button label."
        >
          <Toggle
            value={get<boolean>('footer.totalOutsideButton')}
            onChange={(v) => setField('footer.totalOutsideButton', v)}
            label="Show total on its own row"
          />
        </Field>
        <Field label="Total label">
          <TextInput
            value={get<string>('footer.totalLabel')}
            onChange={(v) => setField('footer.totalLabel', v || undefined)}
            placeholder="Total"
            maxLength={200}
          />
        </Field>
        <Field label="Total size">
          <Slider
            value={get<number>('footer.totalSize')}
            min={8}
            max={48}
            step={0.5}
            onChange={(v) => setField('footer.totalSize', v)}
            unit="px"
          />
        </Field>
        <Field label="Total weight">
          <Slider
            value={get<number>('footer.totalWeight')}
            min={100}
            max={900}
            step={100}
            onChange={(v) => setField('footer.totalWeight', v)}
          />
        </Field>
      </Section>

      <Section title="Container">
        <Field label="Background style">
          <Select
            value={get<'transparent' | 'surface' | 'accent'>('footer.bgStyle')}
            options={[
              { value: 'transparent', label: 'Transparent' },
              { value: 'surface', label: 'Surface' },
              { value: 'accent', label: 'Accent' },
            ]}
            onChange={(v) => setField('footer.bgStyle', v)}
          />
        </Field>
        <Field label="Top border">
          <Select
            value={get<'none' | 'line' | 'shadow'>('footer.borderTop')}
            options={[
              { value: 'none', label: 'None' },
              { value: 'line', label: 'Line' },
              { value: 'shadow', label: 'Shadow' },
            ]}
            onChange={(v) => setField('footer.borderTop', v)}
          />
        </Field>
        <Field
          label="Sticky footer"
          hint="When ON: footer stays pinned at the bottom while items scroll. When OFF: footer scrolls with the items."
        >
          <Toggle
            value={get<boolean>('footer.stickyFooter')}
            onChange={(v) => setField('footer.stickyFooter', v)}
            label="Pin footer to bottom of drawer"
          />
        </Field>
      </Section>
    </div>
  );
}
