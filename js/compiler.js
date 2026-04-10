// compiler.js — shader compilation, error parsing, uniform extraction
// Wired up in a later milestone.

/**
 * Compile fragment + vertex source into a Three.js ShaderMaterial.
 * Returns { material, errors } where errors is [] on success.
 */
export function compile({ fragSrc, vertSrc }) {
  // TODO: create THREE.ShaderMaterial, inject built-in uniforms,
  //       test-compile via a hidden WebGL context, return errors.
  void fragSrc; void vertSrc;
  return { material: null, errors: [] };
}

/**
 * Scan raw GLSL source for uniform declarations.
 * Returns an array of { type, name } objects.
 * Supported types: float, vec2, vec3, vec4, bool, int.
 */
export function extractUniforms(fragSrc) {
  const RE = /^\s*uniform\s+(float|vec[234]|bool|int)\s+(\w+)\s*;/gm;
  const results = [];
  let m;
  while ((m = RE.exec(fragSrc)) !== null) {
    results.push({ type: m[1], name: m[2] });
  }
  return results;
}
