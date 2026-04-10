import * as THREE from 'three';

let scene, camera, renderer, mesh;
let t0 = 0;
let frameCount = 0;

// Built-in uniforms — shared by reference with any active ShaderMaterial.
// Updating .value here is immediately visible to the GPU next frame.
let builtinUniforms;

const GEOMETRIES = {
  quad:   () => new THREE.PlaneGeometry(2, 2),
  sphere: () => new THREE.SphereGeometry(1, 48, 48),
  box:    () => new THREE.BoxGeometry(1.3, 1.3, 1.3),
  plane:  () => new THREE.PlaneGeometry(2, 2, 48, 48),
  torus:  () => new THREE.TorusGeometry(0.8, 0.28, 48, 80),
};

export function initRenderer(canvasEl) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0d0f);

  camera = new THREE.PerspectiveCamera(60, 1, 0.01, 100);
  camera.position.set(0, 0, 2.6);

  renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  builtinUniforms = {
    iTime:       { value: 0.0 },
    iResolution: { value: new THREE.Vector2(1, 1) },
    iMouse:      { value: new THREE.Vector2(0, 0) },
    iFrame:      { value: 0 },
  };

  resize();

  mesh = new THREE.Mesh(
    GEOMETRIES.box(),
    new THREE.MeshNormalMaterial(),
  );
  scene.add(mesh);

  t0 = performance.now();
  loop();
}

function loop() {
  requestAnimationFrame(loop);
  const t = (performance.now() - t0) * 0.001;

  if (mesh.material.isShaderMaterial) {
    const canvas = renderer.domElement;
    builtinUniforms.iTime.value       = t;
    builtinUniforms.iFrame.value      = frameCount;
    builtinUniforms.iResolution.value.set(canvas.clientWidth, canvas.clientHeight);
  } else {
    // Placeholder rotation
    mesh.rotation.x = t * 0.38;
    mesh.rotation.y = t * 0.65;
  }

  frameCount++;
  renderer.render(scene, camera);
}

// ── Public API ─────────────────────────────────────────

export function setMaterial(material) {
  if (mesh.material !== material) {
    if (mesh.material.isShaderMaterial) mesh.material.dispose();
    mesh.material = material;
  }
  // Reset rotation so vertex shaders get clean transforms
  mesh.rotation.set(0, 0, 0);
}

export function restorePlaceholder() {
  if (mesh.material.isShaderMaterial) mesh.material.dispose();
  mesh.material = new THREE.MeshNormalMaterial();
}

export function getBuiltinUniforms() { return builtinUniforms; }
export function getGLContext()       { return renderer.getContext(); }
export function getScene()           { return scene; }
export function getCamera()          { return camera; }

export function setMousePos(x, y) {
  if (builtinUniforms) builtinUniforms.iMouse.value.set(x, y);
}

export function resize() {
  if (!renderer) return;
  const canvas = renderer.domElement;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight || 1;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

export function resetCamera() {
  camera.position.set(0, 0, 2.6);
  camera.rotation.set(0, 0, 0);
}

export function setGeometry(type) {
  const factory = GEOMETRIES[type];
  if (!factory) return;
  mesh.geometry.dispose();
  mesh.geometry = factory();
}
