import { EditorView, keymap, lineNumbers, drawSelection,
         highlightActiveLine, highlightActiveLineGutter,
         highlightSpecialChars, dropCursor,
         rectangularSelection, crosshairCursor,
         Decoration }                                     from '@codemirror/view';
import { EditorState, StateEffect, StateField, Transaction } from '@codemirror/state';
import { defaultKeymap, indentWithTab, history, undo, redo } from '@codemirror/commands';
import { StreamLanguage, syntaxHighlighting,
         bracketMatching, indentOnInput,
         foldGutter }                                     from '@codemirror/language';
import { closeBrackets }                                  from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches,
         selectNextOccurrence }                           from '@codemirror/search';
import { oneDarkHighlightStyle }                          from '@codemirror/theme-one-dark';
import { c as cLike }                                     from '@codemirror/legacy-modes/mode/clike';

import { DEFAULT_FRAG, DEFAULT_VERT } from './presets.js';

// ── GLSL language ──────────────────────────────────────
const glslLang = StreamLanguage.define(cLike);

// ── Drop-line indicator decoration ────────────────────
const setDropLineEffect = StateEffect.define();

const dropLineField = StateField.define({
  create: () => Decoration.none,
  update(decs, tr) {
    decs = decs.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setDropLineEffect)) continue;
      if (e.value === null) {
        decs = Decoration.none;
      } else {
        try {
          const line = tr.state.doc.line(e.value);
          decs = Decoration.set([
            Decoration.line({ class: 'cm-drop-line' }).range(line.from),
          ]);
        } catch { decs = Decoration.none; }
      }
    }
    return decs;
  },
  provide: f => EditorView.decorations.from(f),
});

// ── Error line decoration ──────────────────────────────
const setErrorLineEffect = StateEffect.define();

const errorLineField = StateField.define({
  create: () => Decoration.none,
  update(decs, tr) {
    decs = decs.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setErrorLineEffect)) continue;
      if (e.value === null) {
        decs = Decoration.none;
      } else {
        try {
          const line = tr.state.doc.line(e.value);
          decs = Decoration.set([
            Decoration.line({ class: 'cm-error-line' }).range(line.from),
          ]);
        } catch {
          decs = Decoration.none;
        }
      }
    }
    return decs;
  },
  provide: f => EditorView.decorations.from(f),
});

// ── Dark theme (editor chrome only — syntax colors come from oneDarkHighlightStyle) ──
const crucibleTheme = EditorView.theme({
  '&': {
    backgroundColor: '#111113',
    color: '#abb2bf',
    height: '100%',
    fontSize: '13px',
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  },
  '.cm-scroller': { overflow: 'auto', height: '100%', lineHeight: '1.65' },
  '.cm-content':  { caretColor: '#00e5ff', padding: '6px 0' },
  '.cm-cursor':   { borderLeftColor: '#00e5ff', borderLeftWidth: '2px' },
  '.cm-gutters':  {
    backgroundColor: '#0d0d0f',
    color: '#444458',
    border: 'none',
    borderRight: '1px solid #2a2a35',
    minWidth: '44px',
  },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 14px 0 8px' },
  '.cm-activeLineGutter': { backgroundColor: '#161619', color: '#6a6a80' },
  '.cm-activeLine':        { backgroundColor: '#161619' },
  '.cm-selectionBackground':           { backgroundColor: '#1a3040' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: '#264f78' },
  '::selection':           { backgroundColor: '#264f78' },
  '.cm-matchingBracket':  { color: '#00e5ff', fontWeight: 'bold', backgroundColor: 'rgba(0,229,255,0.15)' },
  '.cm-error-line':        { backgroundColor: 'rgba(255,85,85,0.18) !important' },
  '.cm-drop-line':         { backgroundColor: 'rgba(0,229,255,0.07) !important', borderTop: '2px solid #00e5ff' },
  // fold gutter
  '.cm-foldGutter .cm-gutterElement': { cursor: 'pointer', padding: '0 4px' },
  '.cm-foldPlaceholder': {
    backgroundColor: 'transparent',
    border: '1px solid #3a3a50',
    color: '#6a6a80',
    borderRadius: '3px',
    padding: '0 4px',
    cursor: 'pointer',
  },
  // search panel
  '.cm-searchMatch':         { backgroundColor: 'rgba(0,229,255,0.15)', outline: '1px solid rgba(0,229,255,0.4)' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'rgba(0,229,255,0.35)' },
  '.cm-panels':              { backgroundColor: '#111113', borderTop: '1px solid #2a2a35' },
  '.cm-panels.cm-panels-top':{ borderBottom: '1px solid #2a2a35', borderTop: 'none' },
  '.cm-panel.cm-search':     { padding: '6px 10px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' },
  '.cm-panel.cm-search input[type="text"]': {
    backgroundColor: '#1e1e24',
    color: '#e0e0f0',
    border: '1px solid #2a2a35',
    borderRadius: '4px',
    padding: '2px 7px',
    fontSize: '12px',
    outline: 'none',
    fontFamily: '"JetBrains Mono", monospace',
  },
  '.cm-panel.cm-search input[type="text"]:focus': { borderColor: '#00e5ff' },
  '.cm-panel.cm-search button': {
    backgroundColor: '#1e1e24',
    color: '#a0a0c0',
    border: '1px solid #2a2a35',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '11px',
    cursor: 'pointer',
  },
  '.cm-panel.cm-search button:hover': { color: '#00e5ff', borderColor: '#00e5ff' },
  '.cm-panel.cm-search label': { color: '#6a6a80', fontSize: '11px' },
  // highlight selection matches
  '.cm-selectionMatch': { backgroundColor: 'rgba(0,229,255,0.08)' },
  // drop cursor
  '.cm-dropCursor': { borderLeft: '2px solid #00e5ff' },
}, { dark: true });

// ── Editor factory ─────────────────────────────────────
function makeEditor(doc, parent, fireOnChange = false) {
  const extensions = [
    lineNumbers(),
    highlightSpecialChars(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    drawSelection(),
    dropCursor(),
    rectangularSelection(),
    crosshairCursor(),
    bracketMatching(),
    closeBrackets(),
    indentOnInput(),
    foldGutter(),
    glslLang,
    syntaxHighlighting(oneDarkHighlightStyle),
    highlightSelectionMatches(),
    crucibleTheme,
    errorLineField,
    dropLineField,
    EditorView.lineWrapping,
    history(),
    keymap.of([
      { key: 'Mod-z', run: undo, preventDefault: true },
      { key: 'Mod-y', run: redo, preventDefault: true },
      { key: 'Mod-d', run: selectNextOccurrence, preventDefault: true },
      ...defaultKeymap,
      ...searchKeymap,
      indentWithTab,
    ]),
  ];

  if (fireOnChange) {
    extensions.push(EditorView.updateListener.of(update => {
      if (update.docChanged && _onChange) _onChange();
    }));
  }

  return new EditorView({
    state: EditorState.create({ doc, extensions }),
    parent,
  });
}

let fragEditor, vertEditor;
let _onChange = null;

/** Register a callback fired whenever the fragment editor content changes. */
export function setOnChange(cb) { _onChange = cb; }

export function initEditor({ fragContainer, vertContainer }) {
  fragEditor = makeEditor(DEFAULT_FRAG, fragContainer, true);
  vertEditor = makeEditor(DEFAULT_VERT, vertContainer, false);
}

export function getFragmentSource() { return fragEditor.state.doc.toString(); }
export function getVertexSource()   { return vertEditor.state.doc.toString(); }

export function setFragmentSource(src) {
  fragEditor.dispatch({
    changes: { from: 0, to: fragEditor.state.doc.length, insert: src },
    annotations: Transaction.addToHistory.of(false),
  });
}

export function setVertexSource(src) {
  vertEditor.dispatch({
    changes: { from: 0, to: vertEditor.state.doc.length, insert: src },
    annotations: Transaction.addToHistory.of(false),
  });
}

/**
 * Highlight error line in the fragment editor (1-based line number).
 * Pass null to clear.
 */
export function showError(lineNum) {
  fragEditor.dispatch({
    effects: setErrorLineEffect.of(lineNum ?? null),
    annotations: Transaction.addToHistory.of(false),
  });
}

export function clearErrors() {
  fragEditor.dispatch({
    effects: setErrorLineEffect.of(null),
    annotations: Transaction.addToHistory.of(false),
  });
}

/** Return the currently selected text in the fragment editor, or '' if nothing selected. */
export function getSelection() {
  const { state } = fragEditor;
  const sel = state.selection.main;
  return sel.empty ? '' : state.sliceDoc(sel.from, sel.to);
}

/**
 * Show or hide the drop-line indicator (1-based line number, or null to clear).
 */
export function setDropLine(lineNum) {
  fragEditor.dispatch({
    effects: setDropLineEffect.of(lineNum ?? null),
    annotations: Transaction.addToHistory.of(false),
  });
}

/**
 * Return the 1-based line number in the fragment editor at the given
 * document coordinates (e.g. from a dragover event). Returns null if
 * the coordinates are outside the editor.
 */
export function lineAtCoords(x, y) {
  const pos = fragEditor.posAtCoords({ x, y }, false);
  if (pos === null) return null;
  return fragEditor.state.doc.lineAt(pos).number;
}

/**
 * Insert text at the current cursor position in the fragment editor.
 */
export function insertAtCursor(text, prependNewline = true) {
  const { state } = fragEditor;
  const pos  = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const atLineStart = line.text.trim() === '' || pos === line.from;

  const insert = prependNewline && !atLineStart ? '\n' + text : text;

  fragEditor.dispatch({
    changes: { from: pos, insert },
    selection: { anchor: pos + insert.length },
  });
  fragEditor.focus();
}

/**
 * Insert text at a specific 1-based line number.
 * Ensures a blank line above and below the inserted block.
 */
export function insertAtLine(lineNum, text) {
  const { state } = fragEditor;
  let pos;
  try {
    pos = state.doc.line(Math.max(1, lineNum)).from;
  } catch {
    pos = state.doc.length;
  }

  // Ensure a blank line above: check the two chars before insertion point
  const twoBefore = pos >= 2 ? state.sliceDoc(pos - 2, pos) : state.sliceDoc(0, pos);
  let lead;
  if (pos === 0 || twoBefore === '\n\n') {
    lead = '';       // already a blank line above
  } else if (twoBefore.endsWith('\n')) {
    lead = '\n';     // one newline exists → add one more
  } else {
    lead = '\n\n';   // no newline → add two
  }

  // Ensure a blank line below: check the two chars after insertion point
  const twoAfter = state.sliceDoc(pos, Math.min(pos + 2, state.doc.length));
  let trail;
  if (twoAfter.startsWith('\n\n')) {
    trail = '';
  } else if (twoAfter.startsWith('\n')) {
    trail = '\n';
  } else {
    trail = '\n\n';
  }

  const insert = lead + text.trim() + trail;
  fragEditor.dispatch({ changes: { from: pos, insert } });
  fragEditor.focus();
}

/**
 * Prepend text just before void main().
 * Ensures a blank line above and below the inserted block.
 */
export function prependBeforeMain(text) {
  const src    = fragEditor.state.doc.toString();
  const mainRe = /^void\s+main\s*\(/m;
  const match  = mainRe.exec(src);
  const pos    = match ? match.index : src.length;

  // Ensure a blank line above
  const twoBefore = pos >= 2 ? src.slice(pos - 2, pos) : src.slice(0, pos);
  let lead;
  if (pos === 0 || twoBefore === '\n\n') {
    lead = '';
  } else if (twoBefore.endsWith('\n')) {
    lead = '\n';
  } else {
    lead = '\n\n';
  }

  // Ensure a blank line below
  const twoAfter = src.slice(pos, pos + 2);
  let trail;
  if (twoAfter.startsWith('\n\n')) {
    trail = '';
  } else if (twoAfter.startsWith('\n')) {
    trail = '\n';
  } else {
    trail = '\n\n';
  }

  const insert = lead + text.trim() + trail;
  fragEditor.dispatch({ changes: { from: pos, insert } });
  fragEditor.focus();
}
