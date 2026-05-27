'use client';

// Line item element editor — Chunk 5.4.3.

import React from 'react';
import { useDraftStore, readField } from '../draft-store';
import { Field, Radio, Section, Select, Slider, Toggle } from './_controls';

export default function LineItemEditor() {
  const { draft, setField } = useDraftStore();
  const get = <T,>(p: string) => readField<T>(draft, p);

  return (
    <div>
      <Section title="Product image">
        <Field label="Size">
          <Radio
            value={get<'S' | 'M' | 'L'>('lineItem.imageSize')}
            options={[
              { value: 'S', label: 'Small' },
              { value: 'M', label: 'Medium' },
              { value: 'L', label: 'Large' },
            ]}
            onChange={(v) => setField('lineItem.imageSize', v)}
          />
        </Field>
        <Field label="Shape">
          <Radio
            value={get<'square' | 'rounded' | 'circle'>('lineItem.imageShape')}
            options={[
              { value: 'square', label: 'Square' },
              { value: 'rounded', label: 'Rounded' },
              { value: 'circle', label: 'Circle' },
            ]}
            onChange={(v) => setField('lineItem.imageShape', v)}
          />
        </Field>
      </Section>

      <Section title="Details">
        <Field label="Show variant">
          <Toggle
            value={get<boolean>('lineItem.showVariant')}
            onChange={(v) => setField('lineItem.showVariant', v)}
            label="Display variant title (e.g., color / size)"
          />
        </Field>
        <Field label="Show SKU">
          <Toggle
            value={get<boolean>('lineItem.showSku')}
            onChange={(v) => setField('lineItem.showSku', v)}
            label="Display the product SKU"
          />
        </Field>
        <Field label="Show compare-at price">
          <Toggle
            value={get<boolean>('lineItem.showCompareAtPrice')}
            onChange={(v) => setField('lineItem.showCompareAtPrice', v)}
            label="Strike through the original price when on sale"
          />
        </Field>
        <Field label="Show savings badge">
          <Toggle
            value={get<boolean>('lineItem.showSavingsBadge')}
            onChange={(v) => setField('lineItem.showSavingsBadge', v)}
            label='Show a "saved $X" pill next to discounted items'
          />
        </Field>
      </Section>

      <Section title="Controls">
        <Field label="Quantity control style">
          <Select
            value={get<'minusPlus' | 'stepper' | 'dropdown'>('lineItem.qtyControl')}
            options={[
              { value: 'minusPlus', label: '− 1 +  (buttons)' },
              { value: 'stepper', label: 'Stepper (with input)' },
              { value: 'dropdown', label: 'Dropdown' },
            ]}
            onChange={(v) => setField('lineItem.qtyControl', v)}
          />
        </Field>
        <Field label="Remove button style">
          <Select
            value={get<'x' | 'trash' | 'text'>('lineItem.removeStyle')}
            options={[
              { value: 'x', label: '× icon' },
              { value: 'trash', label: 'Trash icon' },
              { value: 'text', label: 'Text "Remove"' },
            ]}
            onChange={(v) => setField('lineItem.removeStyle', v)}
          />
        </Field>
      </Section>

      <Section title="Layout">
        <Field label="Separator between items">
          <Radio
            value={get<'line' | 'spacing' | 'card'>('lineItem.separator')}
            options={[
              { value: 'line', label: 'Line' },
              { value: 'spacing', label: 'Spacing' },
              { value: 'card', label: 'Card' },
            ]}
            onChange={(v) => setField('lineItem.separator', v)}
          />
        </Field>
      </Section>

      <Section title="Title typography">
        <Field label="Title size">
          <Slider
            value={get<number>('lineItem.titleSize')}
            min={8}
            max={32}
            step={0.5}
            onChange={(v) => setField('lineItem.titleSize', v)}
            unit="px"
          />
        </Field>
        <Field label="Title weight">
          <Slider
            value={get<number>('lineItem.titleWeight')}
            min={100}
            max={900}
            step={100}
            onChange={(v) => setField('lineItem.titleWeight', v)}
          />
        </Field>
      </Section>
    </div>
  );
}
