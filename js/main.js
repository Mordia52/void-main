import { initRenderer, resize as rendererResize, resetCamera, setGeometry } from './renderer.js';
import { initEditor, getFragmentSource, getVertexSource,
         setFragmentSource, setVertexSource }                                from './editor.js';
import { PRESETS }                                                           from './presets.js';

// ── Bootstrap ──────────────────────────────────────

const canvas      = document.getElementById('gl-canvas');
const fragHost    = document.getElementById('cm-fragment');
const vertHost    = document.getElementById('cm-vertex');

initRenderer(canvas);
initEditor({ fragContainer: fragHost, vertContainer: vertHost });

// ── Tabs ───────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    fragHost.classList.toggle('hidden', tab !== 'fragment');
    vertHost.classList.toggle('hidden', tab !== 'vertex');
  });
});

// ── Geometry switcher ──────────────────────────────

document.getElementById('geometry-select').addEventListener('change', e => {
  setGeometry(e.target.value);
});

// ── Preset dropdown ────────────────────────────────

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
  setFragmentSource(preset.frag);
  if (preset.vert) setVertexSource(preset.vert);
  presetSelect.value = ''; // reset so same preset can be re-selected
});

// ── Compile ────────────────────────────────────────

function compile() {
  // TODO: wire compiler.js — for now just log source lengths
  const frag = getFragmentSource();
  const vert = getVertexSource();
  console.log(`[Crucible] compile — frag: ${frag.length} chars, vert: ${vert.length} chars`);
}

document.getElementById('compile-btn').addEventListener('click', compile);

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    compile();
  }
});

// ── Reset camera ───────────────────────────────────

document.getElementById('reset-camera-btn').addEventListener('click', resetCamera);

// ── Toggle uniform sidebar ─────────────────────────

document.getElementById('toggle-uniforms-btn').addEventListener('click', () => {
  document.getElementById('uniform-sidebar').classList.toggle('hidden');
  rendererResize();
});

// ── Error panel ────────────────────────────────────

document.getElementById('close-error-btn').addEventListener('click', () => {
  document.getElementById('error-panel').classList.add('hidden');
});

// ── Split-pane drag ────────────────────────────────

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

// ── Canvas resize observer ─────────────────────────

new ResizeObserver(rendererResize).observe(canvas);
