import * as THREE from 'three';

let scene, camera, renderer, mesh;
let rafId;

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

  renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  resize();

  // Placeholder: rotating box with MeshNormalMaterial
  mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 1.3, 1.3),
    new THREE.MeshNormalMaterial(),
  );
  scene.add(mesh);

  const t0 = performance.now();
  function loop() {
    rafId = requestAnimationFrame(loop);
    const t = (performance.now() - t0) * 0.001;
    mesh.rotation.x = t * 0.38;
    mesh.rotation.y = t * 0.65;
    renderer.render(scene, camera);
  }
  loop();
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
  if (!factory || !mesh) return;
  mesh.geometry.dispose();
  mesh.geometry = factory();
}
