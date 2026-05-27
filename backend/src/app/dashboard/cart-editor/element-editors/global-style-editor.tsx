'use client';

// Global style element editor — Chunk 5.4.8.
// Edits overrides.global.* including the nested palette and behavior groups.

import React from 'react';
import { useDraftStore, readField } from '../draft-store';
import {
  ColorInput,
  Field,
  Radio,
  Section,
  Select,
  Slider,
  StringArrayInput,
  TextInput,
  Toggle,
} from './_controls';

const PALETTE_KEYS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'bg', label: 'Background' },
  { key: 'surface', label: 'Surface' },
  { key: 'text', label: 'Text' },
  { key: 'muted', label: 'Muted text' },
  { key: 'accent', label: 'Accent' },
  { key: 'border', label: 'Border' },
  { key: 'success', label: 'Success' },
  { key: 'danger', label: 'Danger' },
];

export default function GlobalStyleEditor() {
  const { draft, setField } = useDraftStore();
  const get = <T,>(p: string) => readField<T>(draft, p);

  return (
    <div>
      <Section title="Position & size">
        <Field label="Side">
          <Radio
            value={get<'left' | 'right'>('global.side')}
            options={[
              { value: 'left', label: 'Left' },
              { value: 'right', label: 'Right' },
            ]}
            onChange={(v) => setField('global.side', v)}
          />
        </Field>
        <Field label="Width (desktop)">
          <Slider
            value={get<number>('global.widthDesktop')}
            min={320}
            max={800}
            onChange={(v) => setField('global.widthDesktop', v)}
            unit="px"
          />
        </Field>
        <Field label="Width (mobile)" hint="Percentage of viewport width">
          <Slider
            value={get<number>('global.widthMobilePct')}
            min={50}
            max={100}
            onChange={(v) => setField('global.widthMobilePct', v)}
            unit="%"
          />
        </Field>
      </Section>

      <Section title="Backdrop">
        <Field label="Color">
          <ColorInput
            value={get<string>('global.backdropColor')}
            onChange={(v) => setField('global.backdropColor', v)}
          />
        </Field>
        <Field label="Opacity">
          <Slider
            value={get<number>('global.backdropOpacity')}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => setField('global.backdropOpacity', v)}
          />
        </Field>
      </Section>

      <Section title="Animation">
        <Field label="Open animation">
          <Select
            value={get<'slide' | 'fade' | 'scale'>('global.openAnim')}
            options={[
              { value: 'slide', label: 'Slide' },
              { value: 'fade', label: 'Fade' },
              { value: 'scale', label: 'Scale' },
            ]}
            onChange={(v) => setField('global.openAnim', v)}
          />
        </Field>
        <Field label="Duration">
          <Slider
            value={get<number>('global.openDurationMs')}
            min={100}
            max={600}
            step={10}
            onChange={(v) => setField('global.openDurationMs', v)}
            unit="ms"
          />
        </Field>
      </Section>

      <Section title="Color palette">
        {PALETTE_KEYS.map(({ key, label }) => (
          <Field key={key} label={label}>
            <ColorInput
              value={get<string>(`global.palette.${key}`)}
              onChange={(v) => setField(`global.palette.${key}`, v)}
            />
          </Field>
        ))}
      </Section>

      <Section title="Typography">
        <Field
          label="Font family"
          hint='Comma-separated list, e.g. "Inter, system-ui, sans-serif"'
        >
          <TextInput
            value={get<string>('global.fontFamily')}
            onChange={(v) => setField('global.fontFamily', v || undefined)}
            placeholder="Inter, system-ui, sans-serif"
            maxLength={100}
          />
        </Field>
        <Field label="Base font size">
          <Slider
            value={get<number>('global.baseFontSize')}
            min={10}
            max={24}
            onChange={(v) => setField('global.baseFontSize', v)}
            unit="px"
          />
        </Field>
        <Field label="Heading scale">
          <Slider
            value={get<number>('global.headingScale')}
            min={1}
            max={1.8}
            step={0.05}
            onChange={(v) => setField('global.headingScale', v)}
          />
        </Field>
      </Section>

      <Section title="Spacing & shape">
        <Field label="Spacing">
          <Radio
            value={get<'compact' | 'comfortable' | 'roomy'>('global.spacing')}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'roomy', label: 'Roomy' },
            ]}
            onChange={(v) => setField('global.spacing', v)}
          />
        </Field>
        <Field label="Corner radius">
          <Radio
            value={get<'sharp' | 'soft' | 'rounded'>('global.radius')}
            options={[
              { value: 'sharp', label: 'Sharp' },
              { value: 'soft', label: 'Soft' },
              { value: 'rounded', label: 'Rounded' },
            ]}
            onChange={(v) => setField('global.radius', v)}
          />
        </Field>
      </Section>

      <Section title="Behavior">
        <Field label="Open on add-to-cart">
          <Toggle
            value={get<boolean>('global.behavior.openOnAddToCart')}
            onChange={(v) => setField('global.behavior.openOnAddToCart', v)}
            label="Auto-open the drawer when a customer adds an item"
          />
        </Field>
        <Field label="Auto-close on checkout">
          <Toggle
            value={get<boolean>('global.behavior.autoCloseOnCheckout')}
            onChange={(v) => setField('global.behavior.autoCloseOnCheckout', v)}
            label="Close drawer when the customer clicks Checkout"
          />
        </Field>
        <Field label="Lock body scroll">
          <Toggle
            value={get<boolean>('global.behavior.bodyScrollLock')}
            onChange={(v) => setField('global.behavior.bodyScrollLock', v)}
            label="Prevent the page behind from scrolling while drawer is open"
          />
        </Field>
        <Field label="Mobile fullscreen">
          <Toggle
            value={get<boolean>('global.behavior.mobileFullscreen')}
            onChange={(v) => setField('global.behavior.mobileFullscreen', v)}
            label="Use the full viewport on mobile devices"
          />
        </Field>
        <Field
          label="Hide on pages"
          hint="One URL path per line, e.g. /checkout or /pages/landing"
        >
          <StringArrayInput
            value={get<string[]>('global.behavior.hideOnPages')}
            onChange={(v) => setField('global.behavior.hideOnPages', v.length ? v : undefined)}
            placeholder={'/checkout\n/pages/special-landing'}
          />
        </Field>
      </Section>
    </div>
  );
}
