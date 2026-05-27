/**
 * Structural-equivalence helper for cart-drawer blast-radius tests.
 *
 * Walks a DOM-like JSON snapshot (or HTML string) and compares two trees
 * IGNORING:
 *   - text content within text nodes
 *   - inline style attribute values
 *   - dynamic class fragments (whitespace, order)
 *   - data-* attribute values
 * but PRESERVING:
 *   - tag structure (element names + parent/child order)
 *   - presence of class names (set equality)
 *   - presence of the elements that addons own (e.g., .ccd-footer-notes-zone)
 *
 * Returns { equal: boolean, diff: string | null } so tests can assert and
 * also print a readable diff on failure.
 *
 * Intentionally small + dependency-free so it can run in `node` without npm
 * installs.
 */

'use strict';

function normaliseClassList(cls) {
  if (!cls) return [];
  return String(cls).trim().split(/\s+/).filter(Boolean).sort();
}

function tagStructure(html) {
  // Extract just the opening tags with their class lists; ignore text and attrs.
  // Lightweight regex — not a full parser, but enough for our drawer snapshots.
  const out = [];
  const re = /<([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[1].toLowerCase();
    if (tag === 'br' || tag === 'meta' || tag === 'link') continue;
    const attrs = m[2] || '';
    const classMatch = /\bclass\s*=\s*"([^"]*)"/.exec(attrs);
    const classes = classMatch ? normaliseClassList(classMatch[1]) : [];
    out.push({ tag, classes });
  }
  return out;
}

function structurallyEqual(htmlA, htmlB) {
  const a = tagStructure(htmlA);
  const b = tagStructure(htmlB);

  if (a.length !== b.length) {
    return {
      equal: false,
      diff: `tag count differs: A=${a.length}, B=${b.length}`,
    };
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i].tag !== b[i].tag) {
      return {
        equal: false,
        diff: `tag #${i} differs: A=<${a[i].tag}> B=<${b[i].tag}>`,
      };
    }
    const ac = a[i].classes.join(' ');
    const bc = b[i].classes.join(' ');
    if (ac !== bc) {
      return {
        equal: false,
        diff: `class set on <${a[i].tag}> #${i} differs: A=[${ac}] B=[${bc}]`,
      };
    }
  }

  return { equal: true, diff: null };
}

module.exports = { structurallyEqual, tagStructure };
