import { initRenderer, resize as rendererResize, resetCamera,
         setGeometry, setMaterial, setMousePos,
         getBuiltinUniforms, getGLContext }             from './renderer.js';
import { initEditor, getFragmentSource, getVertexSource,
         setFragmentSource, setVertexSource,
         showError, clearErrors }                        from './editor.js';
import { compile, extractUniforms }                     from './compiler.js';
import { buildThreeUniforms, buildControls }            from './uniforms.js';
import { PRESETS }                                      from './presets.js';

// ── Bootstrap ──────────────────────────────────────────

const canvas         = document.getElementById('gl-canvas');
const fragHost       = document.getElementById('cm-fragment');
const vertHost       = document.getElementById('cm-vertex');
const errorPanel     = document.getElementById('error-panel');
const errorContent   = document.getElementById('error-content');
const uniformControls = document.getElementById('uniform-controls');

initRenderer(canvas);
initEditor({ fragContainer: fragHost, vertContainer: vertHost });

// ── Compile pipeline ───────────────────────────────────

function doCompile() {
  clearErrors();

  const fragSrc = getFragmentSource();
  const vertSrc = getVertexSource();

  // Extract and build Three.js uniform objects for custom uniforms
  const detected    = extractUniforms(fragSrc);
  const userUniforms = buildThreeUniforms(detected);

  const result = compile({
    fragSrc,
    vertSrc,
    builtinUniforms: getBuiltinUniforms(),
    userUniforms,
    gl: getGLContext(),
  });

  if (!result.ok) {
    showError(result.errorLine);
    errorContent.textContent = result.error;
    errorPanel.classList.remove('hidden');
    flashCanvas();
    return;
  }

  // Success
  errorPanel.classList.add('hidden');
  setMaterial(result.material);

  // Build sidebar controls, wired live to material.uniforms
  buildControls(detected, result.material.uniforms, uniformControls);
}

document.getElementById('compile-btn').addEventListener('click', doCompile);

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    doCompile();
  }
});

// ── Canvas error flash ─────────────────────────────────

function flashCanvas() {
  canvas.classList.remove('flash');
  requestAnimationFrame(() => canvas.classList.add('flash'));
  canvas.addEventListener('animationend', () => canvas.classList.remove('flash'), { once: true });
}

// ── iMouse ─────────────────────────────────────────────

canvas.addEventListener('mousemove', e => {
  if (e.buttons === 0) return;
  const rect = canvas.getBoundingClientRect();
  // Flip Y so origin is bottom-left (matches GLSL convention)
  setMousePos(
    e.clientX - rect.left,
    canvas.clientHeight - (e.clientY - rect.top),
  );
});

// ── Tabs ───────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    fragHost.classList.toggle('hidden', tab !== 'fragment');
    vertHost.classList.toggle('hidden', tab !== 'vertex');
  });
});

// ── Geometry switcher ──────────────────────────────────

document.getElementById('geometry-select').addEventListener('change', e => {
  setGeometry(e.target.value);
});

// ── Preset dropdown ────────────────────────────────────

const presetSelect = document.getElementById('preset-select');
PRESETS.forEach(p => {
  const opt = document.createElement('option');
  opt.value = p.name;
  opt.textContent = `[${p.category}] ${p.name}`;
  presetSelect.appendChild(opt);
});

presetSelect.addEventListener('change', e => {
  const preset = PRESETS.find(p => p.name === e.target.value);
  if (!preset) return;
  clearErrors();
  errorPanel.classList.add('hidden');
  setFragmentSource(preset.frag);
  if (preset.vert) setVertexSource(preset.vert);
  presetSelect.value = '';
  doCompile();
});

// ── Reset camera ───────────────────────────────────────

document.getElementById('reset-camera-btn').addEventListener('click', resetCamera);

// ── Toggle uniform sidebar ─────────────────────────────

document.getElementById('toggle-uniforms-btn').addEventListener('click', () => {
  document.getElementById('uniform-sidebar').classList.toggle('hidden');
  rendererResize();
});

// ── Error panel close ──────────────────────────────────

document.getElementById('close-error-btn').addEventListener('click', () => {
  errorPanel.classList.add('hidden');
});

// ── Split-pane drag ────────────────────────────────────

(function initSplitPane() {
  const divider    = document.getElementById('divider');
  const editorPane = document.getElementById('editor-pane');
  const workspace  = document.getElementById('workspace');

  let dragging = false, startX = 0, startW = 0;

  divider.addEventListener('mousedown', e => {
    dragging = true;
    startX   = e.clientX;
    startW   = editorPane.offsetWidth;
    divider.classList.add('dragging');
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const total = workspace.offsetWidth;
    const newW  = Math.max(220, Math.min(total - 220, startW + e.clientX - startX));
    editorPane.style.width = newW + 'px';
    editorPane.style.flex  = 'none';
    rendererResize();
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    divider.classList.remove('dragging');
    document.body.style.cursor     = '';
    document.body.style.userSelect = '';
    rendererResize();
  });
})();

// ── Canvas resize observer ─────────────────────────────

new ResizeObserver(rendererResize).observe(canvas);
