import { EditorView, keymap, lineNumbers, drawSelection,
         highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState }                                    from '@codemirror/state';
import { defaultKeymap, indentWithTab }                   from '@codemirror/commands';
import { StreamLanguage, syntaxHighlighting,
         defaultHighlightStyle, bracketMatching,
         indentOnInput }                                  from '@codemirror/language';
import { c as cLike }                                     from '@codemirror/legacy-modes/mode/clike';

import { DEFAULT_FRAG, DEFAULT_VERT } from './presets.js';

// ── GLSL language (C-like) ─────────────────────────
const glslLang = StreamLanguage.define(cLike);

// ── Dark theme matching app palette ───────────────
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
  '.cm-matchingBracket': { color: '#00e5ff', fontWeight: 'bold', backgroundColor: 'transparent' },
}, { dark: true });

// ── Editor factory ─────────────────────────────────
function makeEditor(doc, parent) {
  return new EditorView({
    state: EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        drawSelection(),
        bracketMatching(),
        indentOnInput(),
        glslLang,
        syntaxHighlighting(defaultHighlightStyle),
        crucibleTheme,
        keymap.of([...defaultKeymap, indentWithTab]),
      ],
    }),
    parent,
  });
}

let fragEditor, vertEditor;

export function initEditor({ fragContainer, vertContainer }) {
  fragEditor = makeEditor(DEFAULT_FRAG, fragContainer);
  vertEditor = makeEditor(DEFAULT_VERT, vertContainer);
}

export function getFragmentSource() {
  return fragEditor.state.doc.toString();
}

export function getVertexSource() {
  return vertEditor.state.doc.toString();
}

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

// Stubs — wired up when compiler.js is integrated
export function showError(_message) {}
export function clearErrors() {}
