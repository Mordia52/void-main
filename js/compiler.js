import * as THREE from 'three';

// Lines we prepend before the user's fragment source for raw WebGL test-compile.
// Kept minimal so error line numbers stay accurate (offset = FRAG_PREFIX_LINES).
const FRAG_PREFIX =
  'precision highp float;\nprecision highp int;\n';
const FRAG_PREFIX_LINES = 2;

/**
 * Compile fragment + vertex source.
 * - Fragment shader is test-compiled with raw WebGL for accurate error lines.
 * - Vertex shader is left to Three.js (it needs Three's built-in declarations).
 *
 * Returns { ok, material, error, errorLine }
 *   ok:        true on success
 *   material:  THREE.ShaderMaterial on success, null on failure
 *   error:     human-readable error string on failure
 *   errorLine: 1-based line number in the user's frag source, or null
 */
export function compile({ fragSrc, vertSrc, builtinUniforms, userUniforms, gl }) {
  // ── 1. Raw WebGL fragment shader test ─────────────
  const fragCheck = testFragShader(gl, fragSrc);
  if (!fragCheck.ok) {
    return { ok: false, material: null, error: fragCheck.error, errorLine: fragCheck.errorLine };
  }

  // ── 2. Build Three.js ShaderMaterial ──────────────
  const material = new THREE.ShaderMaterial({
    uniforms:         { ...builtinUniforms, ...userUniforms },
    vertexShader:     vertSrc,
    fragmentShader:   fragSrc,
    glslVersion:      THREE.GLSL1,
  });

  return { ok: true, material, error: null, errorLine: null };
}

// ── Raw WebGL fragment shader compile ─────────────────

function testFragShader(gl, fragSrc) {
  const shader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(shader, FRAG_PREFIX + fragSrc);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const raw = gl.getShaderInfoLog(shader) ?? 'Unknown compile error.';
    gl.deleteShader(shader);
    return {
      ok:        false,
      error:     formatError(raw),
      errorLine: parseErrorLine(raw),
    };
  }

  gl.deleteShader(shader);
  return { ok: true };
}

function parseErrorLine(log) {
  // Standard format: "ERROR: 0:LINE: ..."
  const m = log.match(/ERROR:\s*\d+:(\d+):/);
  if (!m) return null;
  const raw = parseInt(m[1], 10);
  return Math.max(1, raw - FRAG_PREFIX_LINES);
}

function formatError(raw) {
  // Strip driver noise; keep the ERROR: lines and immediately following context.
  return raw
    .split('\n')
    .filter(l => l.trim())
    .join('\n')
    .trim();
}

// ── Uniform extraction ─────────────────────────────────

const BUILTIN_NAMES = new Set(['iTime', 'iResolution', 'iMouse', 'iFrame']);

/**
 * Scan raw GLSL fragment source for custom uniform declarations.
 * Returns [{ type, name }] — built-in uniforms are excluded.
 * Supported types: float | vec2 | vec3 | vec4 | bool | int
 */
export function extractUniforms(fragSrc) {
  const RE = /^\s*uniform\s+(float|vec[234]|bool|int)\s+(\w+)\s*;/gm;
  const results = [];
  let m;
  while ((m = RE.exec(fragSrc)) !== null) {
    if (!BUILTIN_NAMES.has(m[2])) {
      results.push({ type: m[1], name: m[2] });
    }
  }
  return results;
}
