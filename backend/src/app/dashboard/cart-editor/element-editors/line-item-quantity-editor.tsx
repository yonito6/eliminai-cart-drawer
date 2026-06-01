'use client';

// Line-item Quantity Control editor — surface for .ccd-qty stepper.

import React from 'react';
import { useDraftStore, readField } from '../draft-store';
import { Field, Section, Select } from './_controls';

export default function LineItemQuantityEditor() {
  const { draft, setField } = useDraftStore();
  const get = <T,>(p: string) => readField<T>(draft, p);

  return (
    <div>
      <Section title="Quantity control">
        <Field label="Style">
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
      </Section>
    </div>
  );
}
