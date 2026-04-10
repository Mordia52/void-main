// history.js — Per-project compile history (last MAX_ENTRIES successful compiles).
// main.js is the only consumer.

const STORE_PREFIX = 'ds_history_';
const MAX_ENTRIES  = 20;

/**
 * Record a successful compile for a project.
 * Skips if the frag source is identical to the most recent entry (no-op recompile).
 */
export function pushHistory(projectId, { frag, vert, thumbnail }) {
  const entries = getHistory(projectId);

  // Deduplicate: skip if top entry has identical source
  if (entries.length > 0 && entries[0].frag === frag) return;

  const entry = { frag, vert, thumbnail: thumbnail ?? null, timestamp: Date.now() };
  const updated = [entry, ...entries].slice(0, MAX_ENTRIES);
  _persist(projectId, updated);
}

/** Returns entries for a project, newest-first. */
export function getHistory(projectId) {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + projectId);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** Remove all history for a project (call when the project is deleted). */
export function clearHistory(projectId) {
  localStorage.removeItem(STORE_PREFIX + projectId);
}

function _persist(projectId, entries) {
  try {
    localStorage.setItem(STORE_PREFIX + projectId, JSON.stringify(entries));
  } catch {
    // Storage quota exceeded — strip thumbnails from older entries and retry once
    const slim = entries.map((e, i) => i >= 3 ? { ...e, thumbnail: null } : e);
    try {
      localStorage.setItem(STORE_PREFIX + projectId, JSON.stringify(slim));
    } catch { /* Storage truly full — silently give up */ }
  }
}
