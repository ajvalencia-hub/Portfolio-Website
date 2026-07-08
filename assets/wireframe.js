// Orange wireframe massing animation for the landing page.
// Loads the Sunnyvale massing GLB, merges its hard edges into one set of
// orange line segments, and slowly auto-rotates it inside the project card.
// The canvas is pointer-events:none so the surrounding <a> card stays clickable.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const ORANGE = 0xf47321;
const GREEN = 0x5d7048;

export function mountWire(el) {
  const url = el.getAttribute('data-model');
  if (!url) return;
  const color = el.getAttribute('data-color') === 'green' ? GREEN : ORANGE;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xb6b0a5, 16, 46);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 3.4, 17);
  camera.lookAt(0, 0, 0);

  const group = new THREE.Group();
  scene.add(group);

  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.92 });

  function size() {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }

  const loader = new GLTFLoader();
  loader.load(url, (gltf) => {
    const root = gltf.scene;
    root.updateMatrixWorld(true);

    // Merge every mesh's hard edges into one geometry. Drop thin floating
    // site/parking planes (flat, mid-air, wide) the same way the source does.
    const items = [];
    const modelBox = new THREE.Box3();
    root.traverse((obj) => {
      const mesh = obj;
      if (!mesh.isMesh || !mesh.geometry) return;
      const wb = new THREE.Box3().setFromObject(mesh);
      const s = new THREE.Vector3(), c = new THREE.Vector3();
      wb.getSize(s); wb.getCenter(c);
      items.push({ mesh, s, c });
      modelBox.union(wb);
    });
    const mSize = new THREE.Vector3();
    modelBox.getSize(mSize);
    const groundY = modelBox.min.y;
    const sizeY = Math.max(1, mSize.y);

    const positions = [];
    for (const { mesh, s, c } of items) {
      const cy = (c.y - groundY) / sizeY;
      const flat = s.y < 0.04 * sizeY;
      const floating = cy > 0.08 && cy < 0.92;
      const wide = Math.max(s.x, s.z) > 3 && Math.max(s.x, s.z) > 5 * s.y;
      if (flat && floating && wide) continue;
      const edges = new THREE.EdgesGeometry(mesh.geometry, 18);
      edges.applyMatrix4(mesh.matrixWorld);
      const p = edges.getAttribute('position');
      for (let i = 0; i < p.count; i++) positions.push(p.getX(i), p.getY(i), p.getZ(i));
      edges.dispose();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.computeBoundingBox();
    const box = geo.boundingBox;
    const gs = new THREE.Vector3(), gc = new THREE.Vector3();
    box.getSize(gs); box.getCenter(gc);
    const maxDim = Math.max(gs.x, gs.y, gs.z) || 1;
    const scale = 13 / maxDim;

    const seg = new THREE.LineSegments(geo, mat);
    seg.position.set(-gc.x, -gc.y, -gc.z);
    const inner = new THREE.Group();
    inner.scale.setScalar(scale);
    inner.add(seg);
    group.add(inner);
    group.rotation.x = 0.12;
    el.classList.add('wire-ready');
    size();
  }, undefined, (err) => console.error('wireframe load failed', err));

  // animation
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const azStart = Number(el.getAttribute('data-az')) || 124;
  let az = azStart * Math.PI / 180;
  function loop() {
    requestAnimationFrame(loop);
    if (!reduce) { az += 0.0042; group.rotation.y = az; }
    renderer.render(scene, camera);
  }
  size();
  loop();
  window.addEventListener('resize', size);

  // HUD: animate azimuth + frame counter
  const azEl = el.querySelector('.wh-az');
  const frEl = el.querySelector('.wh-fr');
  let fr = 0, deg = azStart;
  setInterval(() => {
    deg = (deg + 1.6) % 360; fr += 1;
    if (azEl) azEl.textContent = deg.toFixed(1).padStart(5, '0');
    if (frEl) frEl.textContent = String(fr).padStart(6, '0');
  }, 200);
}

export function mountAll() {
  document.querySelectorAll('[data-wire]').forEach((el) => {
    if (el.hasAttribute('data-wire-mounted')) return;
    el.setAttribute('data-wire-mounted', '');
    mountWire(el);
  });
}

// Eager auto-mount unless a lazy loader opted out via window.__wireLazy.
if (!window.__wireLazy) mountAll();
