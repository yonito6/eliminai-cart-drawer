'use client';

// Line-item Product Image editor — narrow surface for the .ccd-item__image zone.

import React from 'react';
import { useDraftStore, readField } from '../draft-store';
import { Field, Radio, Section } from './_controls';

export default function LineItemImageEditor() {
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
    </div>
  );
}
