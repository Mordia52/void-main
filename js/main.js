import { initRenderer, resize as rendererResize, resetCamera,
         setGeometry, setMaterial, setMousePos,
         getBuiltinUniforms, getGLContext }                      from './renderer.js';
import { initEditor, getFragmentSource, getVertexSource,
         setFragmentSource, setVertexSource,
         showError, clearErrors, setOnChange }                   from './editor.js';
import { compile, extractUniforms }                              from './compiler.js';
import { buildThreeUniforms, buildControls }                     from './uniforms.js';
import { PRESETS, DEFAULT_FRAG, DEFAULT_VERT }                   from './presets.js';
import { initProjects, setDefaults, getActive, getAll,
         createProject, duplicateProject, renameProject,
         deleteProject, switchTo, autoSave, markDirty,
         projectColor, relativeTime }                            from './projects.js';

// ── DOM refs ───────────────────────────────────────────

const canvas          = document.getElementById('gl-canvas');
const fragHost        = document.getElementById('cm-fragment');
const vertHost        = document.getElementById('cm-vertex');
const errorPanel      = document.getElementById('error-panel');
const errorContent    = document.getElementById('error-content');
const uniformControls = document.getElementById('uniform-controls');
const projectModal    = document.getElementById('project-modal');
const projectGrid     = document.getElementById('project-grid');
const geoSelect       = document.getElementById('geometry-select');

// ── State ──────────────────────────────────────────────

let currentGeometry = 'box';

// ── Bootstrap ──────────────────────────────────────────

initRenderer(canvas);
initEditor({ fragContainer: fragHost, vertContainer: vertHost });

// Feed defaults so projects.js can init new projects with the right shader
setDefaults(DEFAULT_FRAG, DEFAULT_VERT);

// Mark dirty whenever the editor content changes
setOnChange(markDirty);

// Init projects — fires onSwitch immediately with the active project
const activeOnLoad = initProjects(loadProject);

// Load active project into editor (overrides initEditor defaults if needed)
loadProject(activeOnLoad);

// ── Project loading ────────────────────────────────────

function loadProject(p) {
  setFragmentSource(p.frag);
  setVertexSource(p.vert);
  currentGeometry = p.geometry ?? 'box';
  geoSelect.value = currentGeometry;
  setGeometry(currentGeometry);
  clearErrors();
  errorPanel.classList.add('hidden');
  doCompile();
}

// ── Compile pipeline ───────────────────────────────────

function doCompile() {
  clearErrors();

  const fragSrc = getFragmentSource();
  const vertSrc = getVertexSource();

  const detected     = extractUniforms(fragSrc);
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

  errorPanel.classList.add('hidden');
  setMaterial(result.material);
  buildControls(detected, result.material.uniforms, uniformControls);

  // Capture thumbnail after two frames so the new shader has rendered
  requestAnimationFrame(() => requestAnimationFrame(() => {
    autoSave({
      frag:      fragSrc,
      vert:      vertSrc,
      geometry:  currentGeometry,
      thumbnail: captureThumb(),
    });
    renderProjectGrid(); // refresh cards if modal is open
  }));
}

document.getElementById('compile-btn').addEventListener('click', doCompile);
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); doCompile(); }
});

// ── Thumbnail ──────────────────────────────────────────

function captureThumb() {
  try {
    const tmp = document.createElement('canvas');
    tmp.width  = 240;
    tmp.height = 135;
    tmp.getContext('2d').drawImage(canvas, 0, 0, 240, 135);
    return tmp.toDataURL('image/jpeg', 0.65);
  } catch { return null; }
}

// ── Canvas flash ───────────────────────────────────────

function flashCanvas() {
  canvas.classList.remove('flash');
  requestAnimationFrame(() => canvas.classList.add('flash'));
  canvas.addEventListener('animationend', () => canvas.classList.remove('flash'), { once: true });
}

// ── iMouse ─────────────────────────────────────────────

canvas.addEventListener('mousemove', e => {
  if (e.buttons === 0) return;
  const rect = canvas.getBoundingClientRect();
  setMousePos(e.clientX - rect.left, canvas.clientHeight - (e.clientY - rect.top));
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

geoSelect.addEventListener('change', e => {
  currentGeometry = e.target.value;
  setGeometry(currentGeometry);
  markDirty();
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
    dragging = true; startX = e.clientX; startW = editorPane.offsetWidth;
    divider.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const newW = Math.max(220, Math.min(workspace.offsetWidth - 220, startW + e.clientX - startX));
    editorPane.style.width = newW + 'px';
    editorPane.style.flex  = 'none';
    rendererResize();
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    divider.classList.remove('dragging');
    document.body.style.cursor = document.body.style.userSelect = '';
    rendererResize();
  });
})();

// ── Canvas resize observer ─────────────────────────────

new ResizeObserver(rendererResize).observe(canvas);

// ── Project modal ──────────────────────────────────────

function openProjectModal() {
  renderProjectGrid();
  projectModal.classList.remove('hidden');
}

function closeProjectModal() {
  projectModal.classList.add('hidden');
}

document.getElementById('project-btn').addEventListener('click', openProjectModal);
document.getElementById('project-modal-close').addEventListener('click', closeProjectModal);
document.querySelector('.modal-backdrop').addEventListener('click', closeProjectModal);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeProjectModal();
});

document.getElementById('new-project-btn').addEventListener('click', () => {
  createProject('Untitled Shader');
  closeProjectModal();
});

function renderProjectGrid() {
  const all    = getAll();
  const active = getActive();
  projectGrid.innerHTML = '';

  all.forEach(p => {
    const card = document.createElement('div');
    card.className = 'project-card' + (p.id === active.id ? ' active' : '');
    card.dataset.id = p.id;

    const thumb = document.createElement('div');
    thumb.className = 'project-thumb';
    thumb.style.background = p.thumbnail
      ? `url(${p.thumbnail}) center/cover`
      : projectColor(p.id);

    const info = document.createElement('div');
    info.className = 'project-info';

    const nameEl = document.createElement('div');
    nameEl.className     = 'project-name';
    nameEl.textContent   = p.name;
    nameEl.title         = 'Double-click to rename';
    nameEl.addEventListener('dblclick', e => {
      e.stopPropagation();
      nameEl.contentEditable = 'true';
      nameEl.focus();
      document.execCommand('selectAll', false, null);
    });
    nameEl.addEventListener('blur', () => {
      nameEl.contentEditable = 'false';
      renameProject(p.id, nameEl.textContent || p.name);
    });
    nameEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
      if (e.key === 'Escape') { nameEl.textContent = p.name; nameEl.blur(); }
    });

    const meta = document.createElement('div');
    meta.className   = 'project-meta';
    meta.textContent = relativeTime(p.modifiedAt);

    const actions = document.createElement('div');
    actions.className = 'project-actions';

    const dupBtn = document.createElement('button');
    dupBtn.className   = 'project-action-btn';
    dupBtn.title       = 'Duplicate';
    dupBtn.textContent = '⎘';
    dupBtn.addEventListener('click', e => {
      e.stopPropagation();
      duplicateProject(p.id);
      renderProjectGrid();
    });

    const delBtn = document.createElement('button');
    delBtn.className   = 'project-action-btn danger';
    delBtn.title       = 'Delete';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (all.length <= 1) return;
      if (confirm(`Delete "${p.name}"?`)) {
        deleteProject(p.id);
        renderProjectGrid();
      }
    });

    actions.append(dupBtn, delBtn);
    info.append(nameEl, meta);
    card.append(thumb, info, actions);

    card.addEventListener('click', () => {
      if (p.id !== getActive().id) switchTo(p.id);
      closeProjectModal();
    });

    projectGrid.appendChild(card);
  });
}
