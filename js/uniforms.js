import * as THREE from 'three';

// Persists control values across recompiles (keyed by uniform name)
const saved = new Map();

const COLOR_HINT = /col(?:or|our)?|rgb/i;

// ── Public API ─────────────────────────────────────────

/**
 * Build Three.js uniform objects for the detected custom uniforms.
 * Re-uses persisted values if available.
 * Returns { name: { value: <THREE type> } }
 */
export function buildThreeUniforms(uniforms) {
  const out = {};
  for (const { type, name } of uniforms) {
    out[name] = { value: toThreeValue(type, name, saved.get(name)) };
  }
  return out;
}

/**
 * Render sidebar controls into container.
 * Each control directly updates the corresponding Three.js uniform value live.
 *
 * @param {Array<{type:string, name:string}>} uniforms
 * @param {Object} threeUniforms  — the material.uniforms object (or {} if none)
 * @param {HTMLElement} container
 */
export function buildControls(uniforms, threeUniforms, container) {
  container.innerHTML = '';

  if (uniforms.length === 0) {
    container.innerHTML = '<p class="sidebar-hint">No custom uniforms detected.</p>';
    return;
  }

  for (const { type, name } of uniforms) {
    const row = document.createElement('div');
    row.className = 'uniform-row';

    const label = document.createElement('div');
    label.className = 'uniform-label';
    label.textContent = name;
    label.title = type;

    const control = makeControl(type, name, threeUniforms[name]);

    row.appendChild(label);
    row.appendChild(control);
    container.appendChild(row);
  }
}

// ── Control builders ───────────────────────────────────

function makeControl(type, name, threeUniform) {
  if (type === 'bool')  return makeBool(name, threeUniform);
  if (type === 'float') return makeFloat(name, threeUniform, 0, 1, 0.001);
  if (type === 'int')   return makeInt(name, threeUniform);
  if (type === 'vec2')  return makeVec(name, threeUniform, 2);
  if (type === 'vec3' && COLOR_HINT.test(name)) return makeColor(name, threeUniform);
  if (type === 'vec3')  return makeVec(name, threeUniform, 3);
  if (type === 'vec4')  return makeVec(name, threeUniform, 4);
  return document.createTextNode('—');
}

function makeFloat(name, uni, min, max, step) {
  const val = saved.get(name) ?? 0.5;
  const wrap = el('div', 'slider-wrap');
  const slider = el('input');
  slider.type = 'range'; slider.min = min; slider.max = max;
  slider.step = step; slider.value = val; slider.className = 'uniform-slider';
  const disp = el('span', 'uniform-value');
  disp.textContent = val.toFixed(3);

  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value);
    saved.set(name, v);
    disp.textContent = v.toFixed(3);
    if (uni) uni.value = v;
  });

  wrap.append(slider, disp);
  return wrap;
}

function makeInt(name, uni) {
  const val = saved.get(name) ?? 0;
  const wrap = el('div', 'slider-wrap');
  const slider = el('input');
  slider.type = 'range'; slider.min = 0; slider.max = 100;
  slider.step = 1; slider.value = val; slider.className = 'uniform-slider';
  const disp = el('span', 'uniform-value');
  disp.textContent = String(val);

  slider.addEventListener('input', () => {
    const v = parseInt(slider.value, 10);
    saved.set(name, v);
    disp.textContent = String(v);
    if (uni) uni.value = v;
  });

  wrap.append(slider, disp);
  return wrap;
}

function makeBool(name, uni) {
  const val = saved.get(name) ?? false;
  const label = el('label', 'toggle-label');
  const input = el('input');
  input.type = 'checkbox'; input.checked = val; input.className = 'uniform-toggle';

  input.addEventListener('change', () => {
    saved.set(name, input.checked);
    if (uni) uni.value = input.checked;
  });

  const knob = el('span', 'toggle-knob');
  label.append(input, knob);
  return label;
}

function makeColor(name, uni) {
  const raw = saved.get(name);
  const val = typeof raw === 'string' ? raw : '#ff6600';
  const wrap = el('div', 'color-wrap');
  const input = el('input');
  input.type = 'color'; input.value = val; input.className = 'uniform-color';

  input.addEventListener('input', () => {
    saved.set(name, input.value);
    if (uni) {
      uni.value.set(
        parseInt(input.value.slice(1, 3), 16) / 255,
        parseInt(input.value.slice(3, 5), 16) / 255,
        parseInt(input.value.slice(5, 7), 16) / 255,
      );
    }
  });

  wrap.append(input);
  return wrap;
}

function makeVec(name, uni, n) {
  const AXES = ['x', 'y', 'z', 'w'];
  const vals = saved.get(name) ?? Array(n).fill(0).map((_, i) => i === 3 ? 1 : 0);
  const wrap = el('div', 'vec-sliders');

  for (let i = 0; i < n; i++) {
    const row = el('div', 'vec-sub');
    const axisLabel = el('span', 'vec-label');
    axisLabel.textContent = AXES[i];
    const slider = el('input');
    slider.type = 'range'; slider.min = 0; slider.max = 1;
    slider.step = 0.001; slider.value = vals[i]; slider.className = 'uniform-slider';

    const idx = i;
    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      const current = saved.get(name) ?? Array(n).fill(0);
      current[idx] = v;
      saved.set(name, [...current]);
      if (uni) uni.value.setComponent(idx, v);
    });

    row.append(axisLabel, slider);
    wrap.append(row);
  }

  return wrap;
}

// ── Helpers ────────────────────────────────────────────

function el(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function toThreeValue(type, name, val) {
  if (type === 'float') return val ?? 0.5;
  if (type === 'bool')  return val ?? false;
  if (type === 'int')   return val ?? 0;

  if (type === 'vec3' && COLOR_HINT.test(name)) {
    if (typeof val === 'string') {
      return new THREE.Vector3(
        parseInt(val.slice(1, 3), 16) / 255,
        parseInt(val.slice(3, 5), 16) / 255,
        parseInt(val.slice(5, 7), 16) / 255,
      );
    }
    return new THREE.Vector3(1, 0.4, 0);
  }

  const arr = Array.isArray(val) ? val : null;
  if (type === 'vec2') return new THREE.Vector2(arr?.[0] ?? 0, arr?.[1] ?? 0);
  if (type === 'vec3') return new THREE.Vector3(arr?.[0] ?? 0, arr?.[1] ?? 0, arr?.[2] ?? 0);
  if (type === 'vec4') return new THREE.Vector4(arr?.[0] ?? 0, arr?.[1] ?? 0, arr?.[2] ?? 0, arr?.[3] ?? 1);

  return 0;
}
