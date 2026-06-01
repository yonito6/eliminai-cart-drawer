'use client';

// Line-item Product Name editor — title typography for .ccd-item__name.

import React from 'react';
import { useDraftStore, readField } from '../draft-store';
import { Field, Section, Slider, Toggle } from './_controls';

export default function LineItemNameEditor() {
  const { draft, setField } = useDraftStore();
  const get = <T,>(p: string) => readField<T>(draft, p);

  return (
    <div>
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

      <Section title="Subtitle details">
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
      </Section>
    </div>
  );
}
