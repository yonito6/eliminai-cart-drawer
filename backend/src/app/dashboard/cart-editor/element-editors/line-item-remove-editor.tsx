'use client';

// Line-item Remove button editor — surface for .ccd-item__remove.

import React from 'react';
import { useDraftStore, readField } from '../draft-store';
import { Field, Section, Select } from './_controls';

export default function LineItemRemoveEditor() {
  const { draft, setField } = useDraftStore();
  const get = <T,>(p: string) => readField<T>(draft, p);

  return (
    <div>
      <Section title="Remove button">
        <Field label="Style">
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
    </div>
  );
}
