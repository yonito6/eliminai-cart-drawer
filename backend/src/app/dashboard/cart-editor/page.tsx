'use client';

// Cart Editor — main tab page.
// Two-column layout: live preview on the left, configuration panel on the right.
// Chunk 5.1 — skeleton only. Preview canvas (5.2), overlays (5.3), and
// element editors (5.4) will mount into the placeholder zones below.

import React, { useRef, useState } from 'react';
import { useStore } from '@/lib/hooks/use-store';
import { DraftStoreProvider, useDraftStore } from './draft-store';
import PreviewCanvas from './preview-canvas';
import type { PreviewState } from './preview-renderer';
import Overlay from './overlay/overlay';
import HeaderEditor from './element-editors/header-editor';
import MilestoneEditor from './element-editors/milestone-editor';
import LineItemEditor from './element-editors/line-item-editor';
import EmptyStateEditor from './element-editors/empty-state-editor';
import FooterEditor from './element-editors/footer-editor';
import CheckoutButtonEditor from './element-editors/checkout-button-editor';

type Viewport = 'desktop' | 'mobile';

const PURPLE = '#7c3aed';
const GRAY_TEXT = '#374151';

function HeaderBar() {
  const { isDirty, saveState, saveError, save, discard, loading } = useDraftStore();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid #e5e7eb',
        background: '#fff',
        position: 'sticky',
        top: 0,
        zIndex: 5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Cart Editor</h2>
        {loading ? (
          <span style={{ fontSize: 11, color: '#9ca3af' }}>Loading…</span>
        ) : isDirty ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#92400e',
              background: '#fef3c7',
              padding: '3px 8px',
              borderRadius: 999,
            }}
          >
            Unsaved
          </span>
        ) : saveState === 'saved' ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#065f46',
              background: '#d1fae5',
              padding: '3px 8px',
              borderRadius: 999,
            }}
          >
            Saved
          </span>
        ) : null}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {isDirty && (
          <button
            onClick={discard}
            disabled={saveState === 'saving'}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: '#fff',
              color: GRAY_TEXT,
              cursor: saveState === 'saving' ? 'default' : 'pointer',
            }}
          >
            Discard
          </button>
        )}
        <button
          onClick={save}
          disabled={!isDirty || saveState === 'saving'}
          style={{
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 6,
            border: 'none',
            background: !isDirty ? '#d1d5db' : saveState === 'saving' ? '#a78bfa' : PURPLE,
            color: '#fff',
            cursor: !isDirty || saveState === 'saving' ? 'default' : 'pointer',
          }}
        >
          {saveState === 'saving' ? 'Saving…' : 'Save'}
        </button>
      </div>
      {saveError && (
        <span style={{ fontSize: 11, color: '#b91c1c' }}>{saveError}</span>
      )}
    </div>
  );
}

function ConflictModal() {
  const {
    saveState,
    conflictServerVersion,
    resolveConflictKeepMine,
    resolveConflictTakeServer,
  } = useDraftStore();
  if (saveState !== 'conflict') return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: '#1f2937',
          color: '#fff',
          padding: 24,
          borderRadius: 12,
          maxWidth: 440,
          width: '90%',
          border: `1px solid ${PURPLE}`,
        }}
      >
        <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 700 }}>Editor was updated elsewhere</h3>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: '#d1d5db' }}>
          Someone else (or another tab) saved version {conflictServerVersion} while you were editing.
          Choose how to resolve it.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button
            onClick={resolveConflictTakeServer}
            style={{
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 6,
              border: '1px solid #4b5563',
              background: 'transparent',
              color: '#e5e7eb',
              cursor: 'pointer',
            }}
          >
            Take server version
          </button>
          <button
            onClick={resolveConflictKeepMine}
            style={{
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: 'none',
              background: PURPLE,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Keep my edits
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewControls({
  previewState,
  setPreviewState,
  viewport,
  setViewport,
}: {
  previewState: PreviewState;
  setPreviewState: (v: PreviewState) => void;
  viewport: Viewport;
  setViewport: (v: Viewport) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '8px 16px',
        background: '#f9fafb',
        borderBottom: '1px solid #e5e7eb',
        fontSize: 12,
      }}
    >
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: GRAY_TEXT }}>
        State:
        <select
          value={previewState}
          onChange={(e) => setPreviewState(e.target.value as PreviewState)}
          style={{
            padding: '4px 8px',
            border: '1px solid #d1d5db',
            borderRadius: 4,
            background: '#fff',
            fontSize: 12,
          }}
        >
          <option value="items">With items</option>
          <option value="empty">Empty</option>
          <option value="unlocked">All unlocked</option>
          <option value="loading">Loading</option>
        </select>
      </label>
      <div style={{ display: 'flex', gap: 4 }}>
        {(['desktop', 'mobile'] as Viewport[]).map((vp) => (
          <button
            key={vp}
            onClick={() => setViewport(vp)}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: viewport === vp ? 600 : 400,
              borderRadius: 4,
              border: '1px solid #d1d5db',
              background: viewport === vp ? PURPLE : '#fff',
              color: viewport === vp ? '#fff' : GRAY_TEXT,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {vp}
          </button>
        ))}
      </div>
    </div>
  );
}

// Element-editor dispatch table. Maps hotspot id → human label + editor component.
// As each Chunk 5.4.x editor lands, add its row here.
const ELEMENT_EDITORS: Record<string, { label: string; Component: React.ComponentType }> = {
  header: { label: 'Header', Component: HeaderEditor },
  milestoneBar: { label: 'Milestone Bar', Component: MilestoneEditor },
  lineItem: { label: 'Line Item', Component: LineItemEditor },
  emptyState: { label: 'Empty State', Component: EmptyStateEditor },
  footer: { label: 'Footer', Component: FooterEditor },
  checkoutButton: { label: 'Checkout Button', Component: CheckoutButtonEditor },
};

function ElementPanel() {
  const { selectedElementId } = useDraftStore();

  if (!selectedElementId) {
    return (
      <div
        style={{
          width: 360,
          flexShrink: 0,
          background: '#fff',
          borderLeft: '1px solid #e5e7eb',
          padding: 16,
          overflow: 'auto',
        }}
      >
        <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
          Select an element in the preview to edit it.
        </div>
      </div>
    );
  }

  const entry = ELEMENT_EDITORS[selectedElementId];

  return (
    <div
      style={{
        width: 360,
        flexShrink: 0,
        background: '#fff',
        borderLeft: '1px solid #e5e7eb',
        padding: 16,
        overflow: 'auto',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: '#9ca3af',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 4,
        }}
      >
        Selected
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 16 }}>
        {entry?.label ?? selectedElementId}
      </div>
      {entry ? (
        <entry.Component />
      ) : (
        <p style={{ fontSize: 13, color: '#6b7280' }}>
          Editor for <code>{selectedElementId}</code> not implemented yet.
        </p>
      )}
    </div>
  );
}

function CartEditorInner() {
  const [previewState, setPreviewState] = useState<PreviewState>('items');
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const overlayHostRef = useRef<HTMLDivElement | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 0px)', background: '#fafafa' }}>
      <HeaderBar />
      <PreviewControls
        previewState={previewState}
        setPreviewState={setPreviewState}
        viewport={viewport}
        setViewport={setViewport}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div
          ref={overlayHostRef}
          style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
        >
          <PreviewCanvas previewState={previewState} viewport={viewport} addons={{}} />
          <Overlay hostRef={overlayHostRef} />
        </div>
        <ElementPanel />
      </div>
      <ConflictModal />
    </div>
  );
}

export default function CartEditorPage() {
  const { storeId, loading, error } = useStore();

  if (loading) {
    return (
      <div style={{ padding: 32, color: '#6b7280', fontSize: 13 }}>Loading store…</div>
    );
  }

  if (error || !storeId) {
    return (
      <div style={{ padding: 32, color: '#b91c1c', fontSize: 13 }}>
        {error ?? 'No store found. Please reinstall the app.'}
      </div>
    );
  }

  return (
    <DraftStoreProvider storeId={storeId}>
      <CartEditorInner />
    </DraftStoreProvider>
  );
}
