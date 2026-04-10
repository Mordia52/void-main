# Deepsight Shader — Interactive GLSL Shader Playground

## Vision

Deepsight Shader is a code-first GLSL learning tool built around one idea:
**shader knowledge should accumulate**. Every technique you figure out, every
function you write, every trick you stumble across — save it. It becomes part
of your collection. Over time you build an inventory of patterns you can drop
into any shader instantly, like equipping a mod.

Three pillars:
- **Craft** — Write and compile shaders live. Tweak uniforms. Swap geometry.
- **Collect** — Extract interesting pieces as named Patterns. Build your library.
- **Learn** — Follow the Codex, complete Challenges, read inline docs as you type.

The name is a Destiny 2 reference: Deepsight Resonance lets Guardians see the
hidden pattern inside a weapon and extract it for crafting. Same idea here —
you're extracting patterns from shaders and building a crafting library.

---

## Stack

- **Three.js** (via CDN) — WebGL scaffolding, geometry, render loop
- **CodeMirror 6** (via CDN) — GLSL editor with syntax highlighting
- **Vanilla JS** — no framework, no build step
- **localStorage** — all persistence (projects, patterns, progress)
- **Plain HTML/CSS** — runs from index.html, no server needed

---

## File Structure

```
deepsight/
├── index.html              # App shell, layout
├── style.css               # All styles
├── js/
│   ├── main.js             # Entry point, wires everything together
│   ├── renderer.js         # Three.js setup, render loop, geometry
│   ├── editor.js           # CodeMirror, GLSL syntax, error gutter, hover docs
│   ├── compiler.js         # Shader compilation, error parsing, uniform extraction
│   ├── uniforms.js         # Uniform sidebar: auto-detect, generate controls
│   ├── presets.js          # Built-in starter shaders
│   ├── projects.js         # Project CRUD, localStorage, auto-save, thumbnails
│   ├── patterns.js         # Pattern library: extract, insert, drag-drop, deps
│   ├── codex.js            # GLSL reference data + guided walkthrough content
│   ├── challenges.js       # Challenge definitions + progress tracking
│   └── history.js          # Per-project compile history (undo states)
├── shaders/
│   ├── default.frag
│   └── default.vert
└── CLAUDE.md
```

---

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ ◈ Deepsight  [Projects ▾]  [Fragment|Vertex]  [Geometry ▾]       │
│              [Codex]  [Challenges]  [Compile ▶]  [Screenshot] [⋮]│
├──────────────────────────┬───────────────────────────────────────┤
│                          │                                       │
│    GLSL Editor           │    WebGL Canvas                       │
│    (CodeMirror)          │    (Three.js)                         │
│                          │                                       │
│                          ├───────────────────────────────────────┤
├──────────────────────────│  [Uniforms] [Patterns] [Codex]        │
│  Error Panel / History   │  → tabbed right sidebar               │
└──────────────────────────┴───────────────────────────────────────┘
```

The right sidebar is tabbed — switching between Uniforms, Pattern Library,
and the inline Codex reference. The bottom-left panel switches between the
error log and compile history.

---

## Feature Specs

### 1. Projects

Persistent named workspaces stored in localStorage.

Each project stores:
- Name, created/modified timestamps
- Fragment + vertex shader source
- Selected geometry
- Uniform values
- Thumbnail (JPEG snapshot of the canvas at compile time, 240×135)

UI:
- **Project bar** in toolbar: current project name, click → project picker modal
- Project picker: grid of thumbnailed project cards (or list view)
- New / Duplicate / Rename / Delete per project
- Auto-save on every successful compile
- "Unsaved changes" indicator (dot on project name) when editor differs from last save

localStorage keys: `ds_projects` (JSON array), `ds_active_project` (id string)

---

### 2. Pattern Library

The core "inventory" system. A Pattern is any named piece of GLSL — a function,
a technique, a constant, a helper. Patterns are the items in your collection.

**Extracting a Pattern:**
- Select code in the editor
- Right-click → "Extract as Pattern" (or Ctrl+E)
- Dialog: name, category, tags, description (optional), dependency hints
- Pattern saved to library, code stays in editor

**Pattern metadata:**
```
{
  id, name, category, tags[], description,
  code,           // the raw GLSL
  deps[],         // names of other patterns this one calls
  builtIn: bool,  // system patterns vs user-created
  createdAt, usedCount
}
```

**Categories:**
Math, SDF Primitives, SDF Operations, Noise, Color, Lighting, Animation, Utilities

**Inserting a Pattern:**
- Click pattern in sidebar → inserts at cursor
- Drag pattern card from sidebar into editor → drops at drag position
- If pattern has declared deps, scan the current shader for missing ones and
  offer to insert them above (one-click)

**Built-in patterns** (curated, read-only, available from day one):
- hash21, hash22 (fast hash functions)
- smoothMin / smin (smooth boolean union)
- sdBox, sdSphere, sdTorus, sdCylinder (SDF primitives)
- opUnion, opSubtract, opIntersect (SDF operations)
- noise (value noise), fbm (fractal brownian motion)
- hsv2rgb, rgb2hsv (color space conversion)
- cosPalette (cosine gradient palette generator)
- map (remap a value from one range to another)
- rotate2D (2×2 rotation matrix)
- rayMarch (bare-bones raymarcher scaffold)

**Pattern sidebar** (right panel, "Patterns" tab):
- Search / filter by category
- Each card: name, category badge, first line of code preview
- Drag handle on left side
- Star to favorite

localStorage key: `ds_patterns`

---

### 3. The Codex

A built-in reference and learning system. Two tabs:

**Reference tab:**
A searchable encyclopedia of GLSL built-in functions organized by category.
Each entry:
- Function signature (e.g. `float smoothstep(float edge0, float edge1, float x)`)
- One-line summary
- Full description with math where relevant
- Live mini-canvas showing the function's behavior (animates if useful)
- "Insert example" → loads a full minimal shader demonstrating it

Categories: Math, Trigonometry, Geometry, Vector, Texture, Derivative

**Walkthrough tab:**
A guided learning track. Lessons are sequential; each builds on the last.

Track: "Foundations → SDFs → Noise → Lighting → Raymarching"

| # | Lesson | Concept |
|---|--------|---------|
| 1 | UV Space | How gl_FragCoord maps to a 0→1 grid |
| 2 | Color Output | vec3/vec4, gamma, mixing colors |
| 3 | The Time Uniform | Animating with iTime and sin() |
| 4 | Distance Functions | What an SDF is and why it's useful |
| 5 | Combining SDFs | Union, subtract, intersect, smooth blend |
| 6 | Noise | Value noise, Perlin, FBM |
| 7 | Lighting Basics | Normals from SDFs, diffuse, Phong |
| 8 | Shadows & AO | Shadow rays, ambient occlusion tricks |
| 9 | Raymarching | Full raymarcher from scratch |
| 10 | Domain Repetition | Tile space, infinite geometry |

Each lesson:
- Short concept explanation (2-3 paragraphs, inline)
- Annotated starter shader (comments explain every line)
- "Your Turn" — a small edit to try yourself
- Progress saved per lesson

---

### 4. Challenges

Discrete exercises with a goal, hints, and a reference image.

Each challenge has:
- Title + short description
- Category and estimated difficulty (⬡ ⬡⬡ ⬡⬡⬡)
- Starter shader (may be blank or partially filled)
- A reference screenshot of the target result
- Up to 3 progressive hints (each reveals a bit more)
- "Reveal solution" — shows the full working shader after 3+ attempts

Progress: completed challenges are checked off. Streak tracking (how many you've
done without a break).

Example challenges:

| Title | Difficulty | Goal |
|-------|-----------|------|
| Draw a Circle | ⬡ | SDF for a centered circle |
| Pixel Grid | ⬡ | Checkerboard with fract() |
| Pulsing Ring | ⬡⬡ | Animating ring using SDF + sin() |
| Tile the Plane | ⬡⬡ | mod()-based domain repetition |
| Smooth Union | ⬡⬡ | Blend two circles with smin() |
| Noisy Terrain | ⬡⬡⬡ | FBM + normals for a heightmap |
| Soft Shadows | ⬡⬡⬡ | Penumbra shadows in a raymarcher |
| Metaballs | ⬡⬡⬡ | Multiple moving SDFs with smooth union |
| Voronoi | ⬡⬡⬡ | Cellular noise from scratch |
| Cornell Box | ⬡⬡⬡ | Full raytraced box with area lights |

---

### 5. Compile History

Each project keeps the last 20 successfully compiled shader states.

Each history entry: frag source, timestamp, canvas thumbnail.

UI: bottom-left panel "History" tab. Entries shown as a horizontal filmstrip
of thumbnails. Click any to preview (loads into a ghost editor, not the live
one). "Restore" button to bring it back as the current state.

Keyboard: Ctrl+Z / Ctrl+Shift+Z navigate compile history (not keystroke undo,
which CodeMirror handles separately).

---

### 6. Hover Documentation

When the cursor sits on a GLSL built-in function name in the editor, a tooltip
appears after 600ms showing:
- Function signature
- One-line description
- A "→ Codex" link to open the full entry

Powered by a static lookup table in codex.js. Uses CodeMirror's hoverTooltip
extension.

---

### 7. Timeline Scrubber

A thin scrub bar below the canvas (hidden by default, toggle with spacebar):
- Pause / play the render loop
- Drag the scrubber to set iTime manually
- Great for inspecting specific frames of an animation

---

### 8. Shader Inspector

Hold Alt and click anywhere on the canvas → a small overlay appears showing:
- The pixel coordinate (px and normalized)
- The RGB output at that pixel
- The UV value at that pixel

Useful for debugging — no more guessing what value your shader is producing at
a specific location.

---

### 9. Cosine Palette Editor

A floating panel (accessible from the toolbar) for designing cosine-based
color gradients (Inigo Quilez's technique — `a + b * cos(2π(c*t + d))`).

- Four vec3 sliders (a, b, c, d)
- Live gradient preview
- "Insert to shader" — pastes the `cosPalette()` function + your values into
  the active shader

---

### 10. Export & Share

**Screenshot**: Capture the canvas as a PNG. Button in toolbar.

**Export HTML**: Bundle the current shader into a self-contained HTML file
that runs in any browser, no dependencies. Download it.

**Share URL**: Encode the current frag shader into the URL hash (gzip + base64).
Opening the URL loads that shader directly. Long URLs but no server required.

---

### 11. Texture Channels (iChannel0-3)

Drag any image from your desktop onto the canvas → it becomes `iChannel0`
(a `uniform sampler2D`). Up to 4 channels.

Built-in textures: white noise, blue noise, gradient ramp.

The sidebar shows which channels are active and lets you remove them.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Ctrl+S | Compile |
| Ctrl+E | Extract selection as Pattern |
| Ctrl+Z | Undo (editor) |
| Ctrl+Shift+Z | Navigate compile history |
| Space | Pause/resume render loop |
| Alt+Click (canvas) | Shader inspector |
| Ctrl+P | Open project picker |
| Ctrl+K | Focus codex search |
| F11 | Fullscreen canvas |

---

## Coding Conventions

- Each JS file exports a single init function and an API object
- main.js is the only file that imports from all others — no circular deps
- Shader compilation lives entirely in compiler.js
- Uniform regex extraction: run on raw GLSL source string, not AST
- Three.js ShaderMaterial for all rendering
- Uniforms passed to Three.js as `{ value: ... }` objects, updated each frame
- iTime and iFrame updated in the render loop in renderer.js
- iMouse updated on canvas mousemove/mousedown events
- No external state management — each module owns its own state
- CSS custom properties for all colors/spacing — dark theme by default
- localStorage key prefix: `ds_` for all persisted data
- Drag-and-drop uses native HTML5 drag API, no library
- Thumbnails: canvas.toDataURL('image/jpeg', 0.6) at 240×135

---

## Visual Style

- Dark theme: near-black background (#0d0d0f), editor bg slightly lighter
- Monospace font for editor (JetBrains Mono or Fira Code via Google Fonts)
- UI font: IBM Plex Sans
- Accent: #00e5ff (cyan) — the Deepsight resonance color
- Pattern cards: subtle gradient border on hover, category color-coded
- Challenge difficulty shown as filled hexagons (⬡ ⬡⬡ ⬡⬡⬡)
- Minimal chrome — the canvas and code are the stars

---

## Built-in Uniforms (always available)

```glsl
uniform float iTime;        // seconds since start
uniform vec2  iResolution;  // canvas width, height in pixels
uniform vec2  iMouse;       // mouse position in pixels (when held)
uniform int   iFrame;       // frame counter
```

---

## v1 — Already Built

- Split-pane layout with draggable divider
- CodeMirror 6 editor with GLSL syntax highlighting + error line decoration
- Three.js render loop with rotating placeholder cube
- Raw WebGL fragment shader test-compile (accurate line numbers)
- ShaderMaterial swap on successful compile
- Auto-detected uniform sidebar (sliders, color pickers, toggles)
- 10 built-in presets across 5 categories
- Geometry switcher (quad, sphere, box, plane, torus)
- Error panel with red canvas flash on compile failure
- iMouse tracking

## Build Order (what to implement next)

1. **Projects** — persist work, switch between shaders, auto-save thumbnails
2. **Pattern Library** — extract, store, insert patterns; built-in pattern set
3. **Compile History** — filmstrip of past states per project
4. **Codex Reference** — GLSL function browser with live examples
5. **Hover Docs** — inline function tooltips in the editor
6. **Challenges** — exercises with hints and reference screenshots
7. **Codex Walkthrough** — guided lesson track
8. **Timeline Scrubber** — pause and scrub iTime
9. **Shader Inspector** — alt-click pixel color readout
10. **Cosine Palette Editor** — gradient designer
11. **Export / Share URL** — standalone HTML export, URL hash sharing
12. **Texture Channels** — iChannel0-3 with drag-to-load images

## How to Run

1. Open index.html in Chrome or Firefox
2. No build step, no server required (or `python -m http.server 8080`)
3. Edit the shader, hit Ctrl+S to compile
