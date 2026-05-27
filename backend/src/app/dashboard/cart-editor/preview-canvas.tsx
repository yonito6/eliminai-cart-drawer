'use client';

// Preview Canvas — mounts the rendered drawer HTML in a non-iframe container.
// Re-renders when draft or previewState changes. Overlays (hover halo + selection
// ring) attach to this container in Chunk 5.3.

import React, { useEffect, useRef, useState } from 'react';
import { useDraftStore } from './draft-store';
import { PreviewState, renderPreview, PREVIEW_CSS } from './preview-renderer';

type Viewport = 'desktop' | 'mobile';

export interface PreviewCanvasProps {
  previewState: PreviewState;
  viewport: Viewport;
  // Addon config — passed in by the page once it's wired to the addons store.
  // For now the page can pass {} and footer addon zones will be hidden.
  addons?: Record<string, any>;
}

export default function PreviewCanvas({ previewState, viewport, addons }: PreviewCanvasProps) {
  const { draft } = useDraftStore();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [html, setHtml] = useState<string>('');

  // Recompute HTML on every draft change. The render is pure + fast (no network),
  // so the < 500ms preview latency budget is easily met. Element editors that
  // need finer control (e.g., focus retention during text input) can use the
  // DOM patching hook in Chunk 5.4.
  useEffect(() => {
    setHtml(renderPreview({ overrides: draft, addons, previewState }));
  }, [draft, addons, previewState]);

  const width = viewport === 'mobile' ? 375 : 440;

  return (
    <div
      style={{
        flex: 1,
        background: '#f3f4f6',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '32px 16px',
        overflow: 'auto',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: PREVIEW_CSS }} />
      <div
        ref={hostRef}
        id="ce-preview-host"
        style={{ width, transition: 'width 0.2s' }}
        // Direct HTML mount mirrors how v14 renders into the storefront DOM.
        // Trusted source: renderPreview escapes all user-provided strings.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
