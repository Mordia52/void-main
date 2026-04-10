import { EditorView, keymap, lineNumbers, drawSelection,
         highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState, StateEffect, StateField }          from '@codemirror/state';
import { defaultKeymap, indentWithTab }                   from '@codemirror/commands';
import { StreamLanguage, syntaxHighlighting,
         defaultHighlightStyle, bracketMatching,
         indentOnInput }                                  from '@codemirror/language';
import { Decoration }                                     from '@codemirror/view';
import { c as cLike }                                     from '@codemirror/legacy-modes/mode/clike';

import { DEFAULT_FRAG, DEFAULT_VERT } from './presets.js';

// ── GLSL language ──────────────────────────────────────
const glslLang = StreamLanguage.define(cLike);

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

// ── Dark theme ─────────────────────────────────────────
const crucibleTheme = EditorView.theme({
  '&': {
    backgroundColor: '#111113',
    color: '#e0e0f0',
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
  '.cm-selectionBackground, ::selection': { backgroundColor: '#1a3040' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: '#1a3040' },
  '.cm-matchingBracket':  { color: '#00e5ff', fontWeight: 'bold', backgroundColor: 'transparent' },
  '.cm-error-line':        { backgroundColor: 'rgba(255,85,85,0.18) !important' },
}, { dark: true });

// ── Editor factory ─────────────────────────────────────
function makeEditor(doc, parent, fireOnChange = false) {
  const extensions = [
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    drawSelection(),
    bracketMatching(),
    indentOnInput(),
    glslLang,
    syntaxHighlighting(defaultHighlightStyle),
    crucibleTheme,
    errorLineField,
    keymap.of([...defaultKeymap, indentWithTab]),
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
  });
}

export function setVertexSource(src) {
  vertEditor.dispatch({
    changes: { from: 0, to: vertEditor.state.doc.length, insert: src },
  });
}

/**
 * Highlight error line in the fragment editor (1-based line number).
 * Pass null to clear.
 */
export function showError(lineNum) {
  fragEditor.dispatch({
    effects: setErrorLineEffect.of(lineNum ?? null),
  });
}

export function clearErrors() {
  fragEditor.dispatch({
    effects: setErrorLineEffect.of(null),
  });
}
