'use client';

// Header element editor — Chunk 5.4.1.
// Edits overrides.header.* and overrides.header.closeButton.*

import React from 'react';
import { useDraftStore, readField } from '../draft-store';
import { CART_DEFAULTS } from '@/lib/cart-editor/defaults';
import { ColorInput, Field, Radio, Section, Select, Slider, TextInput, Toggle } from './_controls';

export default function HeaderEditor() {
  const { draft, setField } = useDraftStore();
  const get = <T,>(p: string) => readField<T>(draft, p);

  return (
    <div>
      <Section title="Title">
        <Field label="Title text">
          <TextInput
            value={get<string>('header.title') ?? CART_DEFAULTS.header.title}
            onChange={(v) => setField('header.title', v || undefined)}
            placeholder="Your cart"
            maxLength={200}
          />
        </Field>
        <Field label="Heading level">
          <Radio
            value={get<'h2' | 'h3' | 'h4'>('header.headingLevel') ?? CART_DEFAULTS.header.headingLevel}
            options={[
              { value: 'h2', label: 'H2' },
              { value: 'h3', label: 'H3' },
              { value: 'h4', label: 'H4' },
            ]}
            onChange={(v) => setField('header.headingLevel', v)}
          />
        </Field>
        <Field label="Alignment">
          <Radio
            value={get<'side' | 'center'>('header.titleAlignment') ?? CART_DEFAULTS.header.titleAlignment}
            options={[
              { value: 'side', label: 'Side' },
              { value: 'center', label: 'Center' },
            ]}
            onChange={(v) => setField('header.titleAlignment', v)}
          />
        </Field>
        <Field label="Font size">
          <Slider
            value={get<number>('header.titleFontSize') ?? CART_DEFAULTS.header.titleFontSize}
            min={14}
            max={48}
            onChange={(v) => setField('header.titleFontSize', v)}
            unit="px"
          />
        </Field>
        <Field label="Font weight">
          <Select
            value={get<'normal' | 'semibold' | 'bold'>('header.titleFontWeight') ?? CART_DEFAULTS.header.titleFontWeight}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'semibold', label: 'Semibold' },
              { value: 'bold', label: 'Bold' },
            ]}
            onChange={(v) => setField('header.titleFontWeight', v)}
          />
        </Field>
        <Field label="Title color">
          <ColorInput
            value={get<string>('header.titleColor') ?? CART_DEFAULTS.header.titleColor}
            onChange={(v) => setField('header.titleColor', v)}
          />
        </Field>
      </Section>

      <Section title="Container">
        <Field label="Background color">
          <ColorInput
            value={get<string>('header.bgColor') ?? CART_DEFAULTS.header.bgColor}
            onChange={(v) => setField('header.bgColor', v)}
          />
        </Field>
        <Field label="Border style">
          <Select
            value={get<'none' | 'line' | 'shadow'>('header.borderStyle') ?? CART_DEFAULTS.header.borderStyle}
            options={[
              { value: 'none', label: 'None' },
              { value: 'line', label: 'Line' },
              { value: 'shadow', label: 'Shadow' },
            ]}
            onChange={(v) => setField('header.borderStyle', v)}
          />
        </Field>
        <Field label="Padding">
          <Select
            value={get<'compact' | 'comfortable' | 'roomy'>('header.padding') ?? CART_DEFAULTS.header.padding}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'roomy', label: 'Roomy' },
            ]}
            onChange={(v) => setField('header.padding', v)}
          />
        </Field>
        <Field label="Height">
          <Radio
            value={get<'slim' | 'tall'>('header.heightPreset') ?? CART_DEFAULTS.header.heightPreset}
            options={[
              { value: 'slim', label: 'Slim' },
              { value: 'tall', label: 'Tall' },
            ]}
            onChange={(v) => setField('header.heightPreset', v)}
          />
        </Field>
      </Section>

      <Section title="Item count badge">
        <Field label="Show badge">
          <Toggle
            value={get<boolean>('header.showItemCountBadge') ?? CART_DEFAULTS.header.showItemCountBadge}
            onChange={(v) => setField('header.showItemCountBadge', v)}
            label="Display item count badge next to title"
          />
        </Field>
        <Field label="Badge color">
          <ColorInput
            value={get<string>('header.badgeColor') ?? CART_DEFAULTS.header.badgeColor}
            onChange={(v) => setField('header.badgeColor', v)}
          />
        </Field>
      </Section>

      <Section title="Close button">
        <Field label="Position">
          <Radio
            value={get<'left' | 'right'>('header.closeButton.position') ?? CART_DEFAULTS.header.closeButton.position}
            options={[
              { value: 'left', label: 'Left' },
              { value: 'right', label: 'Right' },
            ]}
            onChange={(v) => setField('header.closeButton.position', v)}
          />
        </Field>
        <Field label="Icon">
          <Select
            value={get<'x' | 'chevron' | 'arrow'>('header.closeIcon') ?? CART_DEFAULTS.header.closeIcon}
            options={[
              { value: 'x', label: '× (cross)' },
              { value: 'chevron', label: '› (chevron)' },
              { value: 'arrow', label: '→ (arrow)' },
            ]}
            onChange={(v) => setField('header.closeIcon', v)}
          />
        </Field>
        <Field label="Icon size">
          <Radio
            value={get<'S' | 'M' | 'L'>('header.closeButton.iconSize') ?? CART_DEFAULTS.header.closeButton.iconSize}
            options={[
              { value: 'S', label: 'Small' },
              { value: 'M', label: 'Medium' },
              { value: 'L', label: 'Large' },
            ]}
            onChange={(v) => setField('header.closeButton.iconSize', v)}
          />
        </Field>
        <Field label="Stroke weight">
          <Radio
            value={get<'normal' | 'thick'>('header.closeButton.strokeWeight') ?? CART_DEFAULTS.header.closeButton.strokeWeight}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'thick', label: 'Thick' },
            ]}
            onChange={(v) => setField('header.closeButton.strokeWeight', v)}
          />
        </Field>
        <Field label="Border">
          <Select
            value={get<'none' | 'thin' | 'normal' | 'thick'>('header.closeButton.border') ?? CART_DEFAULTS.header.closeButton.border}
            options={[
              { value: 'none', label: 'None' },
              { value: 'thin', label: 'Thin' },
              { value: 'normal', label: 'Normal' },
              { value: 'thick', label: 'Thick' },
            ]}
            onChange={(v) => setField('header.closeButton.border', v)}
          />
        </Field>
        <Field label="Background color">
          <ColorInput
            value={get<string>('header.closeButton.bgColor') ?? CART_DEFAULTS.header.closeButton.bgColor}
            onChange={(v) => setField('header.closeButton.bgColor', v)}
          />
        </Field>
        <Field label="Background (hover)">
          <ColorInput
            value={get<string>('header.closeButton.bgHoverColor') ?? CART_DEFAULTS.header.closeButton.bgHoverColor}
            onChange={(v) => setField('header.closeButton.bgHoverColor', v)}
          />
        </Field>
        <Field label="Icon color">
          <ColorInput
            value={get<string>('header.closeButton.iconColor') ?? CART_DEFAULTS.header.closeButton.iconColor}
            onChange={(v) => setField('header.closeButton.iconColor', v)}
          />
        </Field>
        <Field label="Border color">
          <ColorInput
            value={get<string>('header.closeButton.borderColor') ?? CART_DEFAULTS.header.closeButton.borderColor}
            onChange={(v) => setField('header.closeButton.borderColor', v)}
          />
        </Field>
        <Field label="Border color (hover)">
          <ColorInput
            value={get<string>('header.closeButton.borderHoverColor') ?? CART_DEFAULTS.header.closeButton.borderHoverColor}
            onChange={(v) => setField('header.closeButton.borderHoverColor', v)}
          />
        </Field>
      </Section>
    </div>
  );
}
