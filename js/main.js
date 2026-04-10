import { initRenderer, resize as rendererResize, resetCamera,
         setGeometry, setMaterial, setMousePos,
         getBuiltinUniforms, getGLContext }                      from './renderer.js';
import { initEditor, getFragmentSource, getVertexSource,
         setFragmentSource, setVertexSource,
         showError, clearErrors, setOnChange,
         getSelection, insertAtCursor, prependBeforeMain }       from './editor.js';
import { compile, extractUniforms }                              from './compiler.js';
import { buildThreeUniforms, buildControls }                     from './uniforms.js';
import { PRESETS, DEFAULT_FRAG, DEFAULT_VERT }                   from './presets.js';
import { initProjects, setDefaults, getActive, getAll,
         createProject, duplicateProject, renameProject,
         deleteProject, switchTo, autoSave, markDirty,
         projectColor, relativeTime }                            from './projects.js';
import { initPatterns, getPatterns, savePattern, deletePattern,
         incrementUsed, missingDeps, CATEGORIES }               from './patterns.js';

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
const patternList     = document.getElementById('pattern-list');
const patternSearch   = document.getElementById('pattern-search');
const patternCatFilter = document.getElementById('pattern-category-filter');
const extractModal    = document.getElementById('extract-modal');
const depModal        = document.getElementById('dep-modal');

// ── State ──────────────────────────────────────────────

let currentGeometry = 'box';

// ── Bootstrap ──────────────────────────────────────────

initRenderer(canvas);
initEditor({ fragContainer: fragHost, vertContainer: vertHost });

// Feed defaults so projects.js can init new projects with the right shader
setDefaults(DEFAULT_FRAG, DEFAULT_VERT);

// Init patterns
initPatterns();
initPatternSidebar();

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

// uniform sidebar toggle removed — now controlled by sidebar tabs

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
document.querySelectorAll('.modal-backdrop').forEach(el =>
  el.addEventListener('click', () => {
    closeProjectModal();
    closeExtractModal();
    closeDepModal();
  })
);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeProjectModal();
    closeExtractModal();
    closeDepModal();
  }
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

    const nameRow = document.createElement('div');
    nameRow.className = 'project-name-row';

    const nameEl = document.createElement('div');
    nameEl.className   = 'project-name';
    nameEl.textContent = p.name;

    const editBtn = document.createElement('button');
    editBtn.className   = 'project-action-btn project-rename-btn';
    editBtn.title       = 'Rename';
    editBtn.textContent = '✎';

    function startRename(e) {
      e.stopPropagation();
      const current = nameEl.textContent;
      const input = document.createElement('input');
      input.className = 'project-name-input';
      input.value     = current;
      nameEl.replaceWith(input);
      editBtn.style.display = 'none';
      input.focus();
      input.select();

      function commit() {
        const val = input.value.trim() || current;
        renameProject(p.id, val);
        input.replaceWith(nameEl);
        nameEl.textContent    = val;
        editBtn.style.display = '';
      }

      input.addEventListener('blur', commit);
      input.addEventListener('keydown', e2 => {
        if (e2.key === 'Enter')  { e2.preventDefault(); input.blur(); }
        if (e2.key === 'Escape') { input.value = current; input.blur(); }
      });
    }

    editBtn.addEventListener('click', startRename);

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

    nameRow.append(nameEl, editBtn);
    actions.append(dupBtn, delBtn);
    info.append(nameRow, meta);
    card.append(thumb, info, actions);

    card.addEventListener('click', () => {
      if (p.id !== getActive().id) switchTo(p.id);
      closeProjectModal();
    });

    projectGrid.appendChild(card);
  });
}

// ── Sidebar tabs ───────────────────────────────────────

document.querySelectorAll('.sidebar-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.sidebar;
    document.getElementById('uniform-sidebar').classList.toggle('hidden', target !== 'uniforms');
    document.getElementById('pattern-sidebar').classList.toggle('hidden', target !== 'patterns');
  });
});

// ── Pattern sidebar ────────────────────────────────────

function initPatternSidebar() {
  // Populate category filter
  CATEGORIES.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat; opt.textContent = cat;
    patternCatFilter.appendChild(opt);
  });

  patternSearch.addEventListener('input', renderPatternList);
  patternCatFilter.addEventListener('change', renderPatternList);
  renderPatternList();
}

function renderPatternList() {
  const search   = patternSearch.value;
  const category = patternCatFilter.value || null;
  const patterns = getPatterns({ category, search });

  patternList.innerHTML = '';

  if (patterns.length === 0) {
    patternList.innerHTML = '<p class="sidebar-hint" style="padding:10px 14px">No patterns found.</p>';
    return;
  }

  // Group by category
  const groups = {};
  patterns.forEach(p => {
    if (!groups[p.category]) groups[p.category] = [];
    groups[p.category].push(p);
  });

  Object.entries(groups).forEach(([cat, list]) => {
    const header = document.createElement('div');
    header.className   = 'pattern-category-header';
    header.textContent = cat;
    patternList.appendChild(header);

    list.forEach(p => {
      const card = document.createElement('div');
      card.className       = 'pattern-card';
      card.draggable       = true;
      card.dataset.id      = p.id;

      const top = document.createElement('div');
      top.className = 'pattern-card-top';

      const name = document.createElement('span');
      name.className   = 'pattern-name';
      name.textContent = p.name;

      const badge = document.createElement('span');
      badge.className   = 'pattern-badge';
      badge.textContent = p.builtIn ? 'built-in' : 'saved';

      const actions = document.createElement('div');
      actions.className = 'pattern-card-actions';

      const insertBtn = document.createElement('button');
      insertBtn.className   = 'pattern-action-btn';
      insertBtn.title       = 'Insert at cursor';
      insertBtn.textContent = '↳';
      insertBtn.addEventListener('click', e => { e.stopPropagation(); insertPattern(p); });

      if (!p.builtIn) {
        const delBtn = document.createElement('button');
        delBtn.className   = 'pattern-action-btn danger';
        delBtn.title       = 'Delete pattern';
        delBtn.textContent = '✕';
        delBtn.addEventListener('click', e => {
          e.stopPropagation();
          if (confirm(`Delete pattern "${p.name}"?`)) {
            deletePattern(p.id);
            renderPatternList();
          }
        });
        actions.appendChild(delBtn);
      }

      actions.prepend(insertBtn);

      if (p.description) {
        const desc = document.createElement('div');
        desc.className   = 'pattern-desc';
        desc.textContent = p.description;
        card.appendChild(desc);
      }

      top.append(name, badge);
      card.prepend(top);
      card.appendChild(actions);

      // Drag
      card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', p.id);
        e.dataTransfer.effectAllowed = 'copy';
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));

      patternList.appendChild(card);
    });
  });
}

// ── Insert pattern ─────────────────────────────────────

function insertPattern(p) {
  incrementUsed(p.id);
  const src     = getFragmentSource();
  const missing = missingDeps(p.deps, src);

  if (missing.length > 0) {
    openDepModal(missing, p);
  } else {
    prependBeforeMain(p.code);
  }
}

// ── Editor drag-drop receive ───────────────────────────

const editorContainer = document.getElementById('editor-container');
editorContainer.addEventListener('dragover', e => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});
editorContainer.addEventListener('drop', e => {
  e.preventDefault();
  const id = e.dataTransfer.getData('text/plain');
  if (!id) return;
  const { getPatternById } = { getPatternById: (i) => getPatterns().find(p => p.id === i) };
  const p = getPatterns().find(pt => pt.id === id);
  if (p) insertPattern(p);
});

// ── Extract pattern modal ──────────────────────────────

document.getElementById('extract-pattern-btn').addEventListener('click', openExtractModal);

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
    e.preventDefault();
    openExtractModal();
  }
});

function openExtractModal() {
  const sel = getSelection().trim();
  if (!sel) {
    document.getElementById('extract-preview').textContent = '← Select some GLSL code first, then click Extract.';
  } else {
    document.getElementById('extract-preview').textContent = sel.length > 400
      ? sel.slice(0, 400) + '…'
      : sel;
  }

  // Populate category select
  const catSel = document.getElementById('extract-category');
  catSel.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat; opt.textContent = cat;
    catSel.appendChild(opt);
  });

  document.getElementById('extract-name').value = '';
  document.getElementById('extract-desc').value = '';
  extractModal.classList.remove('hidden');
  setTimeout(() => document.getElementById('extract-name').focus(), 50);
}

function closeExtractModal() {
  extractModal.classList.add('hidden');
}

document.getElementById('extract-modal-close').addEventListener('click', closeExtractModal);
document.getElementById('extract-cancel-btn').addEventListener('click', closeExtractModal);

document.getElementById('extract-save-btn').addEventListener('click', () => {
  const name = document.getElementById('extract-name').value.trim();
  if (!name) { document.getElementById('extract-name').focus(); return; }
  const code = getSelection().trim();
  if (!code) { closeExtractModal(); return; }

  savePattern({
    name,
    category: document.getElementById('extract-category').value,
    description: document.getElementById('extract-desc').value.trim(),
    code,
  });

  closeExtractModal();
  renderPatternList();

  // Switch to patterns tab to show the new item
  document.querySelector('.sidebar-tab[data-sidebar="patterns"]').click();
});

// ── Dep modal ──────────────────────────────────────────

let _pendingInsert = null;

function openDepModal(missing, pattern) {
  _pendingInsert = { missing, pattern };
  const list = document.getElementById('dep-list');
  list.innerHTML = '';
  missing.forEach(dep => {
    const li = document.createElement('li');
    li.className   = 'dep-item';
    li.textContent = dep.name;
    list.appendChild(li);
  });
  depModal.classList.remove('hidden');
}

function closeDepModal() {
  depModal.classList.add('hidden');
  _pendingInsert = null;
}

document.getElementById('dep-modal-close').addEventListener('click', closeDepModal);

document.getElementById('dep-skip-btn').addEventListener('click', () => {
  if (_pendingInsert) prependBeforeMain(_pendingInsert.pattern.code);
  closeDepModal();
});

document.getElementById('dep-insert-btn').addEventListener('click', () => {
  if (!_pendingInsert) return;
  const { missing, pattern } = _pendingInsert;
  // Insert deps in dependency order, then the pattern itself
  const toInsert = [...missing, pattern];
  const block = toInsert.map(p => p.code).join('\n\n');
  prependBeforeMain(block);
  closeDepModal();
});
