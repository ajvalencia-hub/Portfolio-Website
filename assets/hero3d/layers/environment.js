// Soft studio sky used as the image-based lighting environment, so glazing
// picks up believable reflections (bright sky, warm horizon, darker ground)
// and a single highlight on the sun side. Built once into a small PMREM map.
import * as THREE from 'three';

export function createSkyEnvironment(renderer, palette) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const scene = new THREE.Scene();

  const skyGeo = new THREE.SphereGeometry(10, 48, 24);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color('#fbf9f4') },
      uHorizon: { value: new THREE.Color(palette.paper) },
      uGround: { value: new THREE.Color('#8f887b') },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uGround;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 c = h > 0.0 ? mix(uHorizon, uTop, pow(h, 0.55)) : mix(uHorizon, uGround, pow(-h, 0.4));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // soft key panel roughly where the directional sun sits
  const keyGeo = new THREE.PlaneGeometry(7, 4);
  const keyMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.05, 2.8), side: THREE.DoubleSide });
  const key = new THREE.Mesh(keyGeo, keyMat);
  key.position.set(-5.5, 6.5, 3.5);
  key.lookAt(0, 0, 0);
  scene.add(key);

  const target = pmrem.fromScene(scene, 0.03);
  pmrem.dispose();
  skyGeo.dispose(); skyMat.dispose(); keyGeo.dispose(); keyMat.dispose();
  return target;
}
