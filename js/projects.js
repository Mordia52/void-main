// projects.js — Named workspaces persisted to localStorage.
// main.js is the only consumer; no imports from other local modules.

const STORE_KEY  = 'ds_projects';
const ACTIVE_KEY = 'ds_active_project';

let projects  = [];   // full project list
let activeId  = null; // currently open project id
let dirty     = false;
let onSwitch  = null; // callback(project) fired when active project changes

// Defaults injected by main.js so projects.js stays import-free
let DEFAULT_FRAG = '';
let DEFAULT_VERT = '';

export function setDefaults(frag, vert) {
  DEFAULT_FRAG = frag;
  DEFAULT_VERT = vert;
}

// ── Bootstrap ──────────────────────────────────────────

/**
 * Call once at startup. onSwitchCallback(project) fires whenever the
 * active project changes (including on init).
 * Returns the active project so main.js can load it into the editor.
 */
export function initProjects(onSwitchCallback) {
  onSwitch = onSwitchCallback;

  const raw = localStorage.getItem(STORE_KEY);
  projects  = raw ? JSON.parse(raw) : [];

  if (projects.length === 0) {
    const p = _create('Default Project', {}, true);
    activeId = p.id;
  } else {
    const saved = localStorage.getItem(ACTIVE_KEY);
    activeId = (saved && projects.find(p => p.id === saved))
      ? saved
      : projects[0].id;
  }

  _persist();
  return getActive();
}

// ── Queries ────────────────────────────────────────────

export function getActive() {
  return projects.find(p => p.id === activeId) ?? projects[0];
}

/** Returns a sorted copy — most-recently modified first. */
export function getAll() {
  return [...projects].sort((a, b) => b.modifiedAt - a.modifiedAt);
}

// ── Mutations ──────────────────────────────────────────

export function createProject(name) {
  return _create(name ?? 'Untitled Shader');
}

export function duplicateProject(id) {
  const src = projects.find(p => p.id === id);
  if (!src) return null;
  return _create(`${src.name} (copy)`, {
    frag: src.frag, vert: src.vert, geometry: src.geometry,
  });
}

export function renameProject(id, name) {
  const p = projects.find(p => p.id === id);
  if (!p || !name.trim()) return;
  p.name       = name.trim();
  p.modifiedAt = Date.now();
  _persist();
  if (id === activeId) _syncNameDisplay();
}

/** Always keeps at least one project alive. */
export function deleteProject(id) {
  if (projects.length <= 1) return;
  projects = projects.filter(p => p.id !== id);
  _persist();
  if (id === activeId) switchTo(projects[0].id);
}

export function switchTo(id) {
  const p = projects.find(p => p.id === id);
  if (!p || id === activeId) return;
  activeId = id;
  dirty    = false;
  _persist();
  _syncNameDisplay();
  _syncDirtyDot();
  onSwitch?.(p);
}

/**
 * Called by main.js after every successful compile.
 * Persists frag, vert, geometry, and an optional JPEG thumbnail.
 */
export function autoSave({ frag, vert, geometry, thumbnail }) {
  const p = getActive();
  if (!p) return;
  p.frag       = frag;
  p.vert       = vert;
  p.geometry   = geometry;
  if (thumbnail) p.thumbnail = thumbnail;
  p.modifiedAt = Date.now();
  dirty        = false;
  _persist();
  _syncNameDisplay();
  _syncDirtyDot();
}

export function markDirty() {
  if (dirty) return;
  dirty = true;
  _syncDirtyDot();
}

// ── Private ────────────────────────────────────────────

function _create(name, overrides = {}, skipSwitch = false) {
  const p = {
    id:         _genId(),
    name:       name,
    frag:       overrides.frag      ?? DEFAULT_FRAG,
    vert:       overrides.vert      ?? DEFAULT_VERT,
    geometry:   overrides.geometry  ?? 'box',
    thumbnail:  null,
    createdAt:  Date.now(),
    modifiedAt: Date.now(),
  };
  projects.push(p);
  _persist();
  if (!skipSwitch) {
    activeId = p.id;
    dirty    = false;
    _persist();
    _syncNameDisplay();
    _syncDirtyDot();
    onSwitch?.(p);
  }
  return p;
}

function _persist() {
  localStorage.setItem(STORE_KEY,  JSON.stringify(projects));
  localStorage.setItem(ACTIVE_KEY, activeId);
}

function _syncNameDisplay() {
  const el = document.getElementById('project-name-display');
  if (el) el.textContent = getActive()?.name ?? '—';
}

function _syncDirtyDot() {
  const el = document.getElementById('project-dirty-dot');
  if (el) el.classList.toggle('hidden', !dirty);
}

function _genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Utilities ──────────────────────────────────────────

/** Gradient placeholder for cards with no thumbnail yet. */
export function projectColor(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  h = h % 360;
  return `linear-gradient(135deg, hsl(${h},55%,18%), hsl(${(h + 40) % 360},55%,12%))`;
}

/** Human-readable relative timestamp. */
export function relativeTime(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60)   return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
