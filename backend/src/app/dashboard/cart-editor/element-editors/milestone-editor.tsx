'use client';

// Milestone bar element editor — Chunk 5.4.2.
// Visual fields only — tier data lives in Addons (addon-owned path).

import React from 'react';
import { useDraftStore, readField } from '../draft-store';
import AddonDeepLink from '../addon-deep-link';
import { ColorInput, Field, Section, Select, Slider, TextInput, Toggle } from './_controls';

export default function MilestoneEditor() {
  const { draft, setField } = useDraftStore();
  const get = <T,>(p: string) => readField<T>(draft, p);

  return (
    <div>
      <AddonDeepLink
        addonKey="milestone"
        title="Edit tiers in Addons →"
        description="Tier thresholds, rewards, and copy live in the Addons tab. The fields below control the bar's look."
      />

      <Section title="Templates">
        <Field
          label="Pre-unlock template"
          hint="Variables: {{amount}}, {{tierName}}"
        >
          <TextInput
            value={get<string>('milestoneBar.preUnlockTemplate')}
            onChange={(v) => setField('milestoneBar.preUnlockTemplate', v || undefined)}
            placeholder="Spend {{amount}} more for {{tierName}}"
            maxLength={200}
          />
        </Field>
        <Field
          label="Unlocked template"
          hint="Shown when the highest tier is reached"
        >
          <TextInput
            value={get<string>('milestoneBar.unlockedTemplate')}
            onChange={(v) => setField('milestoneBar.unlockedTemplate', v || undefined)}
            placeholder="🎉 You've unlocked {{tierName}}!"
            maxLength={200}
          />
        </Field>
        <Field label="Celebration animation">
          <Toggle
            value={get<boolean>('milestoneBar.celebrationAnim')}
            onChange={(v) => setField('milestoneBar.celebrationAnim', v)}
            label="Play a brief animation when a tier unlocks"
          />
        </Field>
      </Section>

      <Section title="Bar appearance">
        <Field label="Fill color">
          <ColorInput
            value={get<string>('milestoneBar.fillColor')}
            onChange={(v) => setField('milestoneBar.fillColor', v)}
          />
        </Field>
        <Field label="Track color">
          <ColorInput
            value={get<string>('milestoneBar.trackColor')}
            onChange={(v) => setField('milestoneBar.trackColor', v)}
          />
        </Field>
        <Field label="Bar height">
          <Slider
            value={get<number>('milestoneBar.height')}
            min={2}
            max={40}
            onChange={(v) => setField('milestoneBar.height', v)}
            unit="px"
          />
        </Field>
        <Field label="Position">
          <Select
            value={get<'top' | 'underHeader' | 'aboveCheckout'>('milestoneBar.position')}
            options={[
              { value: 'top', label: 'Top of drawer' },
              { value: 'underHeader', label: 'Under header' },
              { value: 'aboveCheckout', label: 'Above checkout' },
            ]}
            onChange={(v) => setField('milestoneBar.position', v)}
          />
        </Field>
      </Section>

      <Section title="Text">
        <Field label="Text size">
          <Slider
            value={get<number>('milestoneBar.textSize')}
            min={8}
            max={32}
            step={0.5}
            onChange={(v) => setField('milestoneBar.textSize', v)}
            unit="px"
          />
        </Field>
        <Field label="Text weight">
          <Slider
            value={get<number>('milestoneBar.textWeight')}
            min={100}
            max={900}
            step={100}
            onChange={(v) => setField('milestoneBar.textWeight', v)}
          />
        </Field>
      </Section>
    </div>
  );
}
