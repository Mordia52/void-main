# Deepsight Shader — Interactive GLSL Shader Playground

## Project Overview
Deepsight Shader is a code-first, browser-based GLSL shader learning tool.
The philosophy: force users to write real shader code, but make it
rewarding and interactive. No node graphs — the user learns GLSL directly.
Every feature should serve either understanding or experimentation.

## Stack
- **Three.js** (via CDN) — WebGL scaffolding, geometry, render loop
- **CodeMirror 6** (via CDN) — GLSL editor with syntax highlighting
- **Vanilla JS** — no framework, no build step
- **Plain HTML/CSS** — open index.html directly in browser, no server needed

## File Structure
```
crucible/
├── index.html          # App shell, layout
├── style.css           # All styles
├── js/
│   ├── main.js         # Entry point, wires everything together
│   ├── renderer.js     # Three.js setup, render loop, geometry management
│   ├── editor.js       # CodeMirror setup, GLSL syntax, error gutter
│   ├── compiler.js     # Shader compilation, error parsing, uniform extraction
│   ├── uniforms.js     # Uniform sidebar: auto-detect, generate controls
│   └── presets.js      # Built-in shader presets with descriptions
├── shaders/
│   ├── default.frag    # Default fragment shader shown on load
│   └── default.vert    # Default vertex shader
└── CLAUDE.md           # This file
```

## Layout
Split-pane: editor on the left, live canvas on the right.
Below the canvas: uniform sidebar (auto-populates from shader source).
Below the editor: error panel (hidden when no errors).

```
┌──────────────────────┬──────────────────────┐
│                      │                      │
│    GLSL Editor       │    WebGL Canvas      │
│    (CodeMirror)      │    (Three.js)        │
│                      │                      │
│──────────────────────│──────────────────────│
│  Error Panel         │  Uniform Controls    │
│  (collapsible)       │  (auto-detected)     │
└──────────────────────┴──────────────────────┘
```

## Core Features (v1)

### 1. Live GLSL Editor
- CodeMirror 6 with GLSL syntax highlighting
- Recompile on Ctrl+S (manual trigger — not on every keystroke)
- Error gutter: red marker on the line that caused the compile error
- Vertex + Fragment shader tabs (fragment is default focused)

### 2. WebGL Canvas
- Three.js renders into a canvas filling the right pane
- Render loop runs continuously (requestAnimationFrame)
- Canvas resizes responsively with the pane

### 3. Built-in Uniforms (always available, no declaration needed in sidebar)
```glsl
uniform float iTime;        // seconds since start
uniform vec2  iResolution;  // canvas width, height in pixels
uniform vec2  iMouse;       // mouse position in pixels (when held)
uniform int   iFrame;       // frame counter
```
These are injected automatically before the user's shader code compiles.

### 4. Auto-Detected Custom Uniforms
- On compile, scan the fragment shader source with regex for uniform declarations
- Supported types: `float`, `vec2`, `vec3`, `vec4`, `bool`, `int`
- Generate appropriate UI controls in the sidebar:
  - `float` → labeled slider (range 0.0–1.0 default, adjustable)
  - `vec2` → two sliders or XY drag pad
  - `vec3` → color picker if name contains "color/colour/col/rgb", else 3 sliders
  - `vec4` → color picker + alpha slider if name contains color hint, else 4 sliders
  - `bool` → toggle switch
  - `int` → integer slider
- Controls persist their values across recompiles unless the uniform is removed

### 5. Geometry Switcher
Dropdown to swap the mesh the shader renders on:
- Fullscreen Quad (default — classic Shadertoy style)
- Sphere
- Cube / Box
- Plane (subdivided, good for vertex shader work)
- Torus

### 6. Error Panel
- Hidden when no errors
- Shows raw GLSL compiler error message
- Parses line number from error string, highlights that line in the editor
- Red border flash on the canvas when a compile fails

### 7. Preset Library
Dropdown of categorized starter shaders. Each preset includes:
- The shader code
- A short description of the concept it demonstrates
- Which uniforms it uses

Initial presets:
| Name | Category | Teaches |
|------|----------|---------|
| UV Gradient | Basics | How UV coordinates map to color |
| Solid Color | Basics | Uniform usage, vec3 output |
| Sine Wave | Animation | iTime, sin(), color animation |
| Checkerboard | Patterns | floor(), mod(), UV math |
| Circle SDF | SDFs | Signed distance fields intro |
| Smooth Blob | SDFs | SDF combination, smoothstep |
| Perlin Noise | Noise | Classic noise function, fbm |
| Phong Lighting | Lighting | Normal reconstruction, diffuse+specular |
| Cel Shading | Lighting | Toon shading, step() function |
| Rainbow | Fun | hue rotation, hsv2rgb |

### 8. Toolbar
Top bar with:
- Deepsight Shader logo/wordmark
- Preset dropdown
- Geometry dropdown
- Compile button (also triggered by Ctrl+S)
- Reset camera button
- Toggle: show/hide uniform sidebar

## Coding Conventions
- Each JS file exports a single init function and an API object
- main.js is the only file that imports from all others — no circular deps
- Shader compilation lives entirely in compiler.js
- Uniform regex extraction: run on raw GLSL source string, not AST
- Three.js ShaderMaterial for all rendering — no MeshStandardMaterial etc.
- Uniforms passed to Three.js as `{ value: ... }` objects, updated each frame
- iTime and iFrame updated in the render loop in renderer.js
- iMouse updated on canvas mousemove/mousedown events
- No external state management — each module owns its own state
- CSS custom properties for all colors/spacing — dark theme by default

## Visual Style
- Dark theme: near-black background (#0d0d0f), editor bg slightly lighter
- Monospace font for editor (JetBrains Mono or Fira Code via Google Fonts)
- UI font: clean sans-serif (e.g. IBM Plex Sans)
- Accent: a single electric color (e.g. #00e5ff cyan or #7c3aed purple)
- Minimal chrome — the canvas and code are the stars
- Pane divider is draggable (resizable split)

## Future Features (do not implement in v1)
- Texture input slots (drag image → iChannel0 sampler2D)
- Multi-pass / ping-pong buffers
- Node graph view that compiles to GLSL
- Annotation mode (hover variable → explanation tooltip)
- Export as standalone HTML
- Shareable URL (encode shader in URL hash)
- Audio uniform (iAudio FFT array)
- Vertex shader editor with attribute access

## How to Run
1. Open index.html in a browser (Chrome or Firefox recommended)
2. No build step, no server required
3. Edit the shader, hit Ctrl+S to compile

## First Task for Claude Code
Scaffold the full project structure. Create all files listed above.
Start with a working skeleton:
- index.html with layout and CDN imports
- style.css with dark theme and split-pane layout
- renderer.js with Three.js init and a rotating cube as placeholder
- editor.js with CodeMirror basic setup
- main.js wiring them together
The app should open in a browser and show a split pane with a live
Three.js scene on the right and a code editor on the left before any
shader logic is wired up.