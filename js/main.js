import { initRenderer, resize as rendererResize, resetCamera,
         setGeometry, setMaterial, setMousePos,
         getBuiltinUniforms, getGLContext }                      from './renderer.js';
import { initEditor, getFragmentSource, getVertexSource,
         setFragmentSource, setVertexSource,
         showError, clearErrors, setOnChange,
         getSelection, insertAtCursor, prependBeforeMain,
         insertAtLine, setDropLine, lineAtCoords }               from './editor.js';
import { compile, extractUniforms }                              from './compiler.js';
import { buildThreeUniforms, buildControls }                     from './uniforms.js';
import { PRESETS, DEFAULT_FRAG, DEFAULT_VERT }                   from './presets.js';
import { initProjects, setDefaults, getActive, getAll,
         createProject, duplicateProject, renameProject,
         deleteProject, switchTo, autoSave, markDirty,
         projectColor, relativeTime }                            from './projects.js';
import { initPatterns, getPatterns, savePattern, deletePattern,
         incrementUsed, missingDeps, CATEGORIES }               from './patterns.js';
import { pushHistory, getHistory, clearHistory }                 from './history.js';

// ── DOM refs ───────────────────────────────────────────

const canvas          = document.getElementById('gl-canvas');
const fragHost        = document.getElementById('cm-fragment');
const vertHost        = document.getElementById('cm-vertex');
const uniformControls = document.getElementById('uniform-controls');
const projectModal    = document.getElementById('project-modal');
const projectGrid     = document.getElementById('project-grid');
const geoSelect       = document.getElementById('geometry-select');
const patternList      = document.getElementById('pattern-list');
const patternSearch    = document.getElementById('pattern-search');
const patternCatFilter = document.getElementById('pattern-category-filter');
const patternDrawer    = document.getElementById('pattern-drawer');
const extractModal     = document.getElementById('extract-modal');
const depModal         = document.getElementById('dep-modal');

// Bottom panel
const bottomPanel        = document.getElementById('bottom-panel');
const errorContent       = document.getElementById('error-content');
const errorsBody         = document.getElementById('errors-panel-body');
const historyBody        = document.getElementById('history-panel-body');
const historyFilmstrip   = document.getElementById('history-filmstrip');
const historyEmpty       = document.getElementById('history-empty');

// History ghost overlay
const historyGhost       = document.getElementById('history-ghost');
const ghostTimestamp     = document.getElementById('ghost-timestamp');
const ghostSource        = document.getElementById('ghost-source');
const ghostRestoreBtn    = document.getElementById('ghost-restore-btn');
const ghostCloseBtn      = document.getElementById('ghost-close-btn');

// ── State ──────────────────────────────────────────────

let currentGeometry    = 'box';
let activeGhostIndex   = -1;

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
  // Close ghost and error panel on project switch
  hideHistoryGhost();
  closeBottomPanel();
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
    openBottomPanel('errors');
    flashCanvas();
    return;
  }

  // Close errors tab if it was open for errors; leave panel open if user is on history tab
  if (bottomPanel.dataset.activeTab === 'errors') closeBottomPanel();

  setMaterial(result.material);
  buildControls(detected, result.material.uniforms, uniformControls);

  // Capture thumbnail after two frames so the new shader has rendered
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const thumb = captureThumb();
    autoSave({ frag: fragSrc, vert: vertSrc, geometry: currentGeometry, thumbnail: thumb });
    pushHistory(getActive().id, { frag: fragSrc, vert: vertSrc, thumbnail: thumb });
    renderProjectGrid();
    renderHistoryFilmstrip(); // refresh if panel is open
  }));
}

document.getElementById('compile-btn').addEventListener('click', doCompile);
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); doCompile(); }

  // Ctrl+Shift+Z — step backward through compile history
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') {
    e.preventDefault();
    const entries = getHistory(getActive().id);
    if (entries.length === 0) return;
    const next = activeGhostIndex < entries.length - 1 ? activeGhostIndex + 1 : 0;
    openBottomPanel('history');
    showHistoryGhost(entries[next], next);
  }
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
  closeBottomPanel();
  setFragmentSource(preset.frag);
  if (preset.vert) setVertexSource(preset.vert);
  presetSelect.value = '';
  doCompile();
});

// ── Reset camera ───────────────────────────────────────

document.getElementById('reset-camera-btn').addEventListener('click', resetCamera);

// ── Toggle uniform sidebar ─────────────────────────────

// uniform sidebar toggle removed — now controlled by sidebar tabs

// ── Bottom panel ───────────────────────────────────────

function openBottomPanel(tab = 'errors') {
  bottomPanel.classList.remove('hidden');
  switchBottomTab(tab);
}

function closeBottomPanel() {
  bottomPanel.classList.add('hidden');
  bottomPanel.dataset.activeTab = '';
}

function switchBottomTab(tab) {
  bottomPanel.dataset.activeTab = tab;
  document.querySelectorAll('.bottom-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.panel === tab);
  });
  errorsBody.classList.toggle('hidden', tab !== 'errors');
  historyBody.classList.toggle('hidden', tab !== 'history');
  if (tab === 'history') renderHistoryFilmstrip();
}

document.getElementById('close-bottom-panel').addEventListener('click', closeBottomPanel);

document.querySelectorAll('.bottom-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchBottomTab(btn.dataset.panel));
});

// ── History toolbar button ──────────────────────────────

document.getElementById('history-btn').addEventListener('click', () => {
  if (!bottomPanel.classList.contains('hidden') && bottomPanel.dataset.activeTab === 'history') {
    closeBottomPanel();
  } else {
    openBottomPanel('history');
  }
});

// ── History filmstrip ───────────────────────────────────

function renderHistoryFilmstrip() {
  const entries = getHistory(getActive().id);
  historyFilmstrip.innerHTML = '';

  if (entries.length === 0) {
    historyEmpty.classList.remove('hidden');
    return;
  }
  historyEmpty.classList.add('hidden');

  entries.forEach((entry, i) => {
    const card = document.createElement('div');
    card.className = 'history-card' + (i === activeGhostIndex ? ' ghost-active' : '');
    card.title = new Date(entry.timestamp).toLocaleString();

    const index = document.createElement('span');
    index.className   = 'history-card-index';
    index.textContent = i === 0 ? 'latest' : `−${i}`;

    if (entry.thumbnail) {
      const img = document.createElement('img');
      img.className = 'history-thumb';
      img.src = entry.thumbnail;
      img.alt = '';
      card.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'history-thumb-placeholder';
      card.appendChild(ph);
    }

    const label = document.createElement('div');
    label.className   = 'history-card-label';
    label.textContent = relativeTime(entry.timestamp);

    card.append(index, label);
    card.addEventListener('click', () => showHistoryGhost(entry, i));
    historyFilmstrip.appendChild(card);
  });
}

// ── History ghost overlay ───────────────────────────────

function showHistoryGhost(entry, index) {
  activeGhostIndex = index;
  ghostTimestamp.textContent = new Date(entry.timestamp).toLocaleString();
  ghostSource.textContent = entry.frag;
  historyGhost.classList.remove('hidden');
  renderHistoryFilmstrip(); // update active card highlight
}

function hideHistoryGhost() {
  historyGhost.classList.add('hidden');
  activeGhostIndex = -1;
  renderHistoryFilmstrip();
}

ghostCloseBtn.addEventListener('click', hideHistoryGhost);

ghostRestoreBtn.addEventListener('click', () => {
  const entries = getHistory(getActive().id);
  const entry   = entries[activeGhostIndex];
  if (!entry) return;
  hideHistoryGhost();
  setFragmentSource(entry.frag);
  setVertexSource(entry.vert);
  doCompile();
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
        clearHistory(p.id);
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

// ── Pattern drawer toggle ──────────────────────────────

function openDrawer() {
  patternDrawer.classList.remove('closed');
  document.getElementById('workspace').classList.add('drawer-open');
  document.getElementById('patterns-btn').classList.add('active');
  rendererResize();
}
function closeDrawer() {
  patternDrawer.classList.add('closed');
  document.getElementById('workspace').classList.remove('drawer-open');
  document.getElementById('patterns-btn').classList.remove('active');
  rendererResize();
}

document.getElementById('patterns-btn').addEventListener('click', () => {
  patternDrawer.classList.contains('closed') ? openDrawer() : closeDrawer();
});
document.getElementById('pattern-drawer-close').addEventListener('click', closeDrawer);

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'l') { e.preventDefault(); openDrawer(); }
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

      // Drag — custom ghost, overlay intercepts so CM can't handle the drop
      card.addEventListener('dragstart', e => {
        activeDragPattern = p;
        // Use a non-text type so CM doesn't insert anything on drop
        e.dataTransfer.setData('application/x-deepsight-pattern', p.id);
        e.dataTransfer.effectAllowed = 'copy';
        card.classList.add('dragging');

        dragOverlay.classList.add('active');

        const ghost = document.createElement('div');
        ghost.className = 'drag-ghost';
        ghost.innerHTML =
          `<span class="drag-ghost-name">${p.name}</span>` +
          `<span class="drag-ghost-cat">${p.category}</span>`;
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 24, 24);
        requestAnimationFrame(() => ghost.remove());
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        activeDragPattern = null;
        dragOverlay.classList.remove('active');
        setDropLine(null);
      });

      patternList.appendChild(card);
    });
  });
}

// ── Insert pattern ─────────────────────────────────────

let _pendingDropLine = null;

function insertPattern(p, line = null) {
  incrementUsed(p.id);
  const src     = getFragmentSource();
  const missing = missingDeps(p.deps, src);

  if (missing.length > 0) {
    _pendingDropLine = line;
    openDepModal(missing, p);
  } else {
    line ? insertAtLine(line, p.code) : prependBeforeMain(p.code);
  }
}

// ── Drag state + overlay ───────────────────────────────
// The overlay sits on top of CodeMirror so CM never sees the drop event,
// preventing it from inserting the drag data as plain text.

let activeDragPattern = null;
let dropLineNum       = null;

const dragOverlay = document.createElement('div');
dragOverlay.id = 'pattern-drag-overlay';
document.getElementById('editor-container').appendChild(dragOverlay);

dragOverlay.addEventListener('dragover', e => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  const line = lineAtCoords(e.clientX, e.clientY);
  dropLineNum = line;
  setDropLine(line);
});

dragOverlay.addEventListener('dragleave', e => {
  if (!dragOverlay.contains(e.relatedTarget)) {
    setDropLine(null);
    dropLineNum = null;
  }
});

dragOverlay.addEventListener('drop', e => {
  e.preventDefault();
  dragOverlay.classList.remove('active');
  setDropLine(null);

  const p = activeDragPattern;
  activeDragPattern = null;
  if (!p) return;

  const line = dropLineNum;
  dropLineNum = null;

  const src     = getFragmentSource();
  const missing = missingDeps(p.deps, src);

  if (missing.length > 0) {
    // Store drop line so dep modal can use it
    _pendingDropLine = line;
    openDepModal(missing, p);
  } else {
    line ? insertAtLine(line, p.code) : prependBeforeMain(p.code);
  }
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

  // Open the patterns drawer to show the newly saved pattern
  openDrawer();
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
  if (_pendingInsert) {
    const line = _pendingDropLine;
    _pendingDropLine = null;
    line ? insertAtLine(line, _pendingInsert.pattern.code)
         : prependBeforeMain(_pendingInsert.pattern.code);
  }
  closeDepModal();
});

document.getElementById('dep-insert-btn').addEventListener('click', () => {
  if (!_pendingInsert) return;
  const { missing, pattern } = _pendingInsert;
  const block = [...missing, pattern].map(p => p.code).join('\n\n');
  const line  = _pendingDropLine;
  _pendingDropLine = null;
  line ? insertAtLine(line, block) : prependBeforeMain(block);
  closeDepModal();
});
