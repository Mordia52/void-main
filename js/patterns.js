// patterns.js — Pattern Library: extract, store, insert, deps

const STORE_KEY = 'ds_patterns';

export const CATEGORIES = [
  'Math', 'SDF Primitives', 'SDF Operations',
  'Noise', 'Color', 'Lighting', 'Animation', 'Utilities',
];

// ── Built-in patterns (read-only) ──────────────────────

const BUILTIN = [
  {
    id: 'builtin_hash21', name: 'hash21', category: 'Math', builtIn: true,
    tags: ['hash', 'random'],
    description: 'Fast pseudo-random float from a vec2 input.',
    deps: [],
    code: `float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}`,
  },
  {
    id: 'builtin_hash22', name: 'hash22', category: 'Math', builtIn: true,
    tags: ['hash', 'random'],
    description: 'Fast pseudo-random vec2 from a vec2 input.',
    deps: [],
    code: `vec2 hash22(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
}`,
  },
  {
    id: 'builtin_rotate2d', name: 'rotate2D', category: 'Math', builtIn: true,
    tags: ['rotate', 'transform'],
    description: 'Rotate a vec2 by angle (radians).',
    deps: [],
    code: `vec2 rotate2D(vec2 p, float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c) * p;
}`,
  },
  {
    id: 'builtin_map', name: 'remap', category: 'Math', builtIn: true,
    tags: ['range', 'lerp'],
    description: 'Remap a value from one range to another.',
    deps: [],
    code: `float remap(float v, float inLo, float inHi, float outLo, float outHi) {
  return outLo + (v - inLo) / (inHi - inLo) * (outHi - outLo);
}`,
  },
  {
    id: 'builtin_smin', name: 'smin', category: 'SDF Operations', builtIn: true,
    tags: ['smooth', 'union', 'blend'],
    description: 'Smooth minimum — blends two SDF surfaces with a soft edge.',
    deps: [],
    code: `float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}`,
  },
  {
    id: 'builtin_opUnion', name: 'opUnion', category: 'SDF Operations', builtIn: true,
    tags: ['union', 'combine'],
    description: 'Hard union of two SDF distances.',
    deps: [],
    code: `float opUnion(float d1, float d2) { return min(d1, d2); }`,
  },
  {
    id: 'builtin_opSubtract', name: 'opSubtract', category: 'SDF Operations', builtIn: true,
    tags: ['subtract', 'cut'],
    description: 'Subtract one SDF shape from another.',
    deps: [],
    code: `float opSubtract(float d1, float d2) { return max(-d1, d2); }`,
  },
  {
    id: 'builtin_opIntersect', name: 'opIntersect', category: 'SDF Operations', builtIn: true,
    tags: ['intersect'],
    description: 'Intersection of two SDF shapes.',
    deps: [],
    code: `float opIntersect(float d1, float d2) { return max(d1, d2); }`,
  },
  {
    id: 'builtin_sdSphere', name: 'sdSphere', category: 'SDF Primitives', builtIn: true,
    tags: ['sphere', 'sdf'],
    description: 'Signed distance to a sphere of radius r centred at origin.',
    deps: [],
    code: `float sdSphere(vec3 p, float r) { return length(p) - r; }`,
  },
  {
    id: 'builtin_sdBox', name: 'sdBox', category: 'SDF Primitives', builtIn: true,
    tags: ['box', 'cube', 'sdf'],
    description: 'Signed distance to an axis-aligned box.',
    deps: [],
    code: `float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}`,
  },
  {
    id: 'builtin_sdTorus', name: 'sdTorus', category: 'SDF Primitives', builtIn: true,
    tags: ['torus', 'sdf'],
    description: 'Signed distance to a torus. t.x = major radius, t.y = minor radius.',
    deps: [],
    code: `float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}`,
  },
  {
    id: 'builtin_sdCylinder', name: 'sdCylinder', category: 'SDF Primitives', builtIn: true,
    tags: ['cylinder', 'sdf'],
    description: 'Signed distance to a vertical capped cylinder.',
    deps: [],
    code: `float sdCylinder(vec3 p, float r, float h) {
  vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}`,
  },
  {
    id: 'builtin_noise', name: 'noise', category: 'Noise', builtIn: true,
    tags: ['noise', 'value noise'],
    description: 'Smooth value noise in [−1, 1]. Requires hash22.',
    deps: ['hash22'],
    code: `float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash22(i + vec2(0,0)), f - vec2(0,0)),
        dot(hash22(i + vec2(1,0)), f - vec2(1,0)), u.x),
    mix(dot(hash22(i + vec2(0,1)), f - vec2(0,1)),
        dot(hash22(i + vec2(1,1)), f - vec2(1,1)), u.x), u.y);
}`,
  },
  {
    id: 'builtin_fbm', name: 'fbm', category: 'Noise', builtIn: true,
    tags: ['fbm', 'fractal', 'noise'],
    description: 'Fractal Brownian Motion — layered noise. Requires noise + hash22.',
    deps: ['noise', 'hash22'],
    code: `float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p  = p * 2.0 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}`,
  },
  {
    id: 'builtin_hsv2rgb', name: 'hsv2rgb', category: 'Color', builtIn: true,
    tags: ['color', 'hsv', 'rgb'],
    description: 'Convert HSV color (each component 0–1) to RGB.',
    deps: [],
    code: `vec3 hsv2rgb(vec3 c) {
  vec4  K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3  p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}`,
  },
  {
    id: 'builtin_cosPalette', name: 'cosPalette', category: 'Color', builtIn: true,
    tags: ['color', 'gradient', 'palette'],
    description: 'Inigo Quilez cosine-based color palette. a/b/c/d are vec3.',
    deps: [],
    code: `vec3 cosPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.28318 * (c * t + d));
}`,
  },
  {
    id: 'builtin_rayMarch', name: 'rayMarch', category: 'Utilities', builtIn: true,
    tags: ['raymarching', 'scaffold'],
    description: 'Bare-bones raymarcher. Assumes you define float map(vec3 p).',
    deps: [],
    code: `float rayMarch(vec3 ro, vec3 rd) {
  float t = 0.0;
  for (int i = 0; i < 96; i++) {
    float d = map(ro + rd * t);
    if (d < 0.001 || t > 100.0) break;
    t += d;
  }
  return t;
}`,
  },
];

// ── State ──────────────────────────────────────────────

let userPatterns = [];

// ── Bootstrap ──────────────────────────────────────────

export function initPatterns() {
  const raw = localStorage.getItem(STORE_KEY);
  userPatterns = raw ? JSON.parse(raw) : [];
}

// ── Queries ────────────────────────────────────────────

/** All patterns (built-ins first, then user, optionally filtered). */
export function getPatterns({ category = null, search = '' } = {}) {
  const all = [...BUILTIN, ...userPatterns];
  return all.filter(p => {
    if (category && p.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q)
          || p.description?.toLowerCase().includes(q)
          || p.tags?.some(t => t.includes(q));
    }
    return true;
  });
}

export function getPatternById(id) {
  return BUILTIN.find(p => p.id === id) ?? userPatterns.find(p => p.id === id) ?? null;
}

// ── Mutations ──────────────────────────────────────────

export function savePattern({ name, category, tags, description, code }) {
  const p = {
    id:          'user_' + Date.now().toString(36),
    name:        name.trim(),
    category:    category,
    tags:        tags ?? [],
    description: description ?? '',
    code:        code.trim(),
    deps:        detectDeps(code),
    builtIn:     false,
    createdAt:   Date.now(),
    usedCount:   0,
  };
  userPatterns.push(p);
  _persist();
  return p;
}

export function deletePattern(id) {
  userPatterns = userPatterns.filter(p => p.id !== id);
  _persist();
}

export function incrementUsed(id) {
  const p = userPatterns.find(p => p.id === id);
  if (p) { p.usedCount++; _persist(); }
}

// ── Dep detection ──────────────────────────────────────

/**
 * Scan code for calls to any known pattern name.
 * Returns array of dep names (not ids).
 */
export function detectDeps(code) {
  const knownNames = BUILTIN.map(p => p.name);
  return knownNames.filter(name => {
    const re = new RegExp(`\\b${name}\\s*\\(`, 'g');
    return re.test(code);
  });
}

/**
 * Given a list of dep names, return the ordered insert list of patterns
 * that are not already present in the current shader source.
 * Respects transitive deps (topological order).
 */
export function missingDeps(depNames, shaderSrc) {
  const visited = new Set();
  const ordered = [];

  function visit(name) {
    if (visited.has(name)) return;
    visited.add(name);
    const pat = BUILTIN.find(p => p.name === name);
    if (!pat) return;
    for (const d of pat.deps) visit(d);
    // Only include if not already in shader
    const re = new RegExp(`\\b${name}\\s*\\(`, 'g');
    if (!re.test(shaderSrc)) ordered.push(pat);
  }

  for (const name of depNames) visit(name);
  return ordered;
}

// ── Private ────────────────────────────────────────────

function _persist() {
  localStorage.setItem(STORE_KEY, JSON.stringify(userPatterns));
}
