// Cart Editor API client — typed wrappers around /api/cart-editor/[storeId]/config

import type { EditorOverrides } from '@/lib/cart-editor/schema';

export interface CartEditorConfig {
  editorOverrides: Partial<EditorOverrides>;
  editorOverridesVersion: number;
}

export class ConflictError extends Error {
  serverVersion: number;
  serverOverrides: Partial<EditorOverrides>;
  constructor(serverVersion: number, serverOverrides: Partial<EditorOverrides>) {
    super('Editor overrides version conflict');
    this.name = 'ConflictError';
    this.serverVersion = serverVersion;
    this.serverOverrides = serverOverrides;
  }
}

export async function getEditorOverrides(storeId: string): Promise<CartEditorConfig> {
  const res = await fetch(`/api/cart-editor/${encodeURIComponent(storeId)}/config`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`GET editor overrides failed: ${res.status}`);
  }
  return res.json();
}

/**
 * PUT editor overrides with optimistic concurrency.
 * Sends If-Match: "ce-<version>" header. Throws ConflictError on 409.
 */
export async function putEditorOverrides(
  storeId: string,
  overrides: Partial<EditorOverrides>,
  version: number,
): Promise<CartEditorConfig> {
  const res = await fetch(`/api/cart-editor/${encodeURIComponent(storeId)}/config`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'If-Match': `"ce-${version}"`,
    },
    body: JSON.stringify(overrides),
  });
  if (res.status === 409) {
    // Server returns current state in the body so caller can resolve conflict
    let body: any = {};
    try { body = await res.json(); } catch {}
    throw new ConflictError(body.editorOverridesVersion ?? 0, body.editorOverrides ?? {});
  }
  if (!res.ok) {
    throw new Error(`PUT editor overrides failed: ${res.status}`);
  }
  return res.json();
}
