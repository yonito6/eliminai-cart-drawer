'use client';

// Cart Editor Draft Store — React Context for the in-progress editor draft.
// Holds the unsaved editorOverrides + selection state + dirty flag.
// Persists draft to sessionStorage keyed by storeId so navigation/refresh
// doesn't lose user edits.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { EditorOverrides } from '@/lib/cart-editor/schema';
import { ConflictError, getEditorOverrides, putEditorOverrides } from './api-client';

type Overrides = Partial<EditorOverrides>;

type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

interface DraftContextValue {
  storeId: string;
  draft: Overrides;
  savedConfig: Overrides;
  version: number;
  isDirty: boolean;
  loading: boolean;
  saveState: SaveState;
  saveError: string | null;
  selectedElementId: string | null;
  // mutations
  setField: (path: string, value: unknown) => void;
  selectElement: (id: string | null) => void;
  discard: () => void;
  save: () => Promise<void>;
  // conflict resolution
  conflictServerOverrides: Overrides | null;
  conflictServerVersion: number | null;
  resolveConflictKeepMine: () => Promise<void>;
  resolveConflictTakeServer: () => void;
}

const DraftContext = createContext<DraftContextValue | null>(null);

const SS_KEY = (storeId: string) => `ce-draft:${storeId}`;

// Recursive deep setter — sets `obj[path]` where path is dotted like "header.title"
// Creates intermediate objects as needed. Setting value=undefined deletes the key.
function setDeep<T extends Record<string, any>>(obj: T, path: string, value: unknown): T {
  const parts = path.split('.');
  // Clone the top object so React sees a new reference
  const root: any = Array.isArray(obj) ? [...obj] : { ...obj };
  let cur: any = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (cur[key] == null || typeof cur[key] !== 'object') {
      cur[key] = {};
    } else {
      cur[key] = Array.isArray(cur[key]) ? [...cur[key]] : { ...cur[key] };
    }
    cur = cur[key];
  }
  const lastKey = parts[parts.length - 1];
  if (value === undefined) {
    delete cur[lastKey];
  } else {
    cur[lastKey] = value;
  }
  return root;
}

function stableStringify(v: unknown): string {
  // For dirty detection — sort object keys so reorder doesn't show as dirty.
  return JSON.stringify(v, function replacer(_, val) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {};
      Object.keys(val).sort().forEach((k) => { sorted[k] = val[k]; });
      return sorted;
    }
    return val;
  });
}

export function DraftStoreProvider({
  storeId,
  children,
}: {
  storeId: string;
  children: React.ReactNode;
}) {
  const [draft, setDraft] = useState<Overrides>({});
  const [savedConfig, setSavedConfig] = useState<Overrides>({});
  const [version, setVersion] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [conflictServerOverrides, setConflictServerOverrides] = useState<Overrides | null>(null);
  const [conflictServerVersion, setConflictServerVersion] = useState<number | null>(null);

  // Initial fetch + restore any sessionStorage draft
  const didInit = useRef(false);
  useEffect(() => {
    if (!storeId || didInit.current) return;
    didInit.current = true;
    (async () => {
      try {
        const cfg = await getEditorOverrides(storeId);
        setSavedConfig(cfg.editorOverrides ?? {});
        setVersion(cfg.editorOverridesVersion ?? 0);

        // Restore unsaved draft if it matches this store's version
        try {
          const raw = sessionStorage.getItem(SS_KEY(storeId));
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.version === (cfg.editorOverridesVersion ?? 0) && parsed.draft) {
              setDraft(parsed.draft);
            } else {
              setDraft(cfg.editorOverrides ?? {});
            }
          } else {
            setDraft(cfg.editorOverrides ?? {});
          }
        } catch {
          setDraft(cfg.editorOverrides ?? {});
        }
      } catch (e: any) {
        setSaveError(e?.message ?? 'Failed to load editor overrides');
      } finally {
        setLoading(false);
      }
    })();
  }, [storeId]);

  // Persist draft to sessionStorage on every change (debounced via microtask)
  useEffect(() => {
    if (loading || !storeId) return;
    try {
      sessionStorage.setItem(SS_KEY(storeId), JSON.stringify({ version, draft }));
    } catch {}
  }, [draft, version, loading, storeId]);

  const isDirty = useMemo(() => stableStringify(draft) !== stableStringify(savedConfig), [draft, savedConfig]);

  const setField = useCallback((path: string, value: unknown) => {
    setDraft((prev) => setDeep(prev, path, value));
  }, []);

  const selectElement = useCallback((id: string | null) => {
    setSelectedElementId(id);
  }, []);

  const discard = useCallback(() => {
    setDraft(savedConfig);
    setSaveState('idle');
    setSaveError(null);
    try { sessionStorage.removeItem(SS_KEY(storeId)); } catch {}
  }, [savedConfig, storeId]);

  const save = useCallback(async () => {
    setSaveState('saving');
    setSaveError(null);
    try {
      const res = await putEditorOverrides(storeId, draft, version);
      setSavedConfig(res.editorOverrides ?? {});
      setVersion(res.editorOverridesVersion ?? version + 1);
      setSaveState('saved');
      try { sessionStorage.removeItem(SS_KEY(storeId)); } catch {}
      // Notify other tabs of this store
      try {
        const ch = new BroadcastChannel(`cart-editor:${storeId}`);
        ch.postMessage({ kind: 'saved', version: res.editorOverridesVersion, overrides: res.editorOverrides });
        ch.close();
      } catch {}
      // Auto-revert UI badge after 2s
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 2000);
    } catch (e: any) {
      if (e instanceof ConflictError) {
        setConflictServerOverrides(e.serverOverrides);
        setConflictServerVersion(e.serverVersion);
        setSaveState('conflict');
      } else {
        setSaveError(e?.message ?? 'Save failed');
        setSaveState('error');
      }
    }
  }, [storeId, draft, version]);

  const resolveConflictKeepMine = useCallback(async () => {
    if (conflictServerVersion == null) return;
    // Adopt the server's version number but keep my draft, then retry
    setVersion(conflictServerVersion);
    setSavedConfig(conflictServerOverrides ?? {});
    setConflictServerOverrides(null);
    setConflictServerVersion(null);
    setSaveState('idle');
    // Caller can press Save again — we don't auto-retry to keep behavior explicit
  }, [conflictServerVersion, conflictServerOverrides]);

  const resolveConflictTakeServer = useCallback(() => {
    if (!conflictServerOverrides || conflictServerVersion == null) return;
    setDraft(conflictServerOverrides);
    setSavedConfig(conflictServerOverrides);
    setVersion(conflictServerVersion);
    setConflictServerOverrides(null);
    setConflictServerVersion(null);
    setSaveState('idle');
    try { sessionStorage.removeItem(SS_KEY(storeId)); } catch {}
  }, [conflictServerOverrides, conflictServerVersion, storeId]);

  // beforeunload guard
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Cross-tab sync — listen for saves from other tabs
  useEffect(() => {
    if (!storeId) return;
    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel(`cart-editor:${storeId}`);
      ch.onmessage = (ev) => {
        if (!ev?.data || ev.data.kind !== 'saved') return;
        const newVersion = ev.data.version as number;
        const newOverrides = ev.data.overrides as Overrides;
        if (typeof newVersion !== 'number') return;
        setSavedConfig(newOverrides ?? {});
        setVersion(newVersion);
        // If not dirty, also update draft so preview reflects new server state
        setDraft((cur) => (stableStringify(cur) === stableStringify(savedConfig) ? newOverrides ?? {} : cur));
      };
    } catch {}
    return () => { try { ch?.close(); } catch {} };
  }, [storeId, savedConfig]);

  const value: DraftContextValue = {
    storeId,
    draft,
    savedConfig,
    version,
    isDirty,
    loading,
    saveState,
    saveError,
    selectedElementId,
    setField,
    selectElement,
    discard,
    save,
    conflictServerOverrides,
    conflictServerVersion,
    resolveConflictKeepMine,
    resolveConflictTakeServer,
  };

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraftStore(): DraftContextValue {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error('useDraftStore must be used inside <DraftStoreProvider>');
  return ctx;
}

// Helper: read a value from the draft by dotted path
export function readField<T = unknown>(obj: Overrides, path: string): T | undefined {
  const parts = path.split('.');
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur as T | undefined;
}
