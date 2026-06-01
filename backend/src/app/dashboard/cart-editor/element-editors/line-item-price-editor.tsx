'use client';

// Line-item Price editor — surface for .ccd-item__price-col.

import React from 'react';
import { useDraftStore, readField } from '../draft-store';
import { Field, Section, Toggle } from './_controls';

export default function LineItemPriceEditor() {
  const { draft, setField } = useDraftStore();
  const get = <T,>(p: string) => readField<T>(draft, p);

  return (
    <div>
      <Section title="Price display">
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
    </div>
  );
}
