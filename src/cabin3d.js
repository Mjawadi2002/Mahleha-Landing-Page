// The cabin on the way home: a live three.js airliner interior seen from the aisle.
// Curved fuselage walls, oval windows with clouds streaming past outside, overhead bins that
// follow the curve, 3+3 seats with headrest covers and seatback screens, passengers' heads,
// warm cove lighting, floor path lights, and a camera that walks down the aisle with light turbulence.
// Units are metres; the nose of the aircraft is towards -z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const LEN = 30; // modelled cabin length
const ROWS = 30; const PITCH = 0.8; const FIRST = -0.6;

// right half of the cabin cross-section, floor edge to ceiling centre
const PROFILE = [[1.5, 0], [1.6, 0.2], [1.7, 0.55], [1.76, 0.9], [1.76, 1.25], [1.7, 1.55], [1.58, 1.74], [1.3, 2.0], [0.8, 2.13], [0, 2.18]];

function sweep(profile, z0, z1, segZ = 1) {
  // a surface made by sliding the (mirrored) profile along z
  // left floor edge, up over the ceiling, down to the right floor edge
  const pts = [...profile.map(([x, y]) => [-x, y]), ...profile.slice().reverse().slice(1).map(([x, y]) => [x, y])];
  const g = new THREE.BufferGeometry(); const pos = []; const idx = [];
  const nz = segZ + 1;
  for (let j = 0; j < nz; j++) { const z = z0 + ((z1 - z0) * j) / segZ; for (const [x, y] of pts) pos.push(x, y, z); }
  const n = pts.length;
  for (let j = 0; j < segZ; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i; const b = a + 1; const c = a + n; const d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function roundRect(w, h, r) {
  const s = new THREE.Shape(); const x = -w / 2; const y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function createCabin(canvas, { lite = false, reduced = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lite ? 1.25 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  const haze = new THREE.Color(0xe7dccb);
  scene.background = haze; scene.fog = new THREE.Fog(haze, 7, 26);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 60);

  scene.add(new THREE.HemisphereLight(0xfff4e4, 0xc9bda9, 1.35));
  const key = new THREE.DirectionalLight(0xfff1dc, 1.1); key.position.set(0, 4, 3); scene.add(key);
  const winL = new THREE.DirectionalLight(0xd9e8ff, 0.7); winL.position.set(-4, 1.5, 0); scene.add(winL);
  const winR = new THREE.DirectionalLight(0xd9e8ff, 0.45); winR.position.set(4, 1.5, -2); scene.add(winR);

  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o });
  const M = {
    wall: mat(0xeee8dc, { side: THREE.DoubleSide, roughness: 0.6, emissive: 0x24201a }),
    bin: mat(0xf4f0e8, { roughness: 0.35 }),
    seam: mat(0xb8b0a2),
    carpet: mat(0x3b4658, { roughness: 1 }),
    runner: mat(0x2b3446, { roughness: 1 }),
    seat: mat(0x24344f, { roughness: 0.85 }),
    seatSide: mat(0x1a2538, { roughness: 0.9 }),
    cover: mat(0xf1ebdf, { roughness: 0.9 }),
    accent: mat(0xd81e34, { roughness: 0.7 }),
    screen: new THREE.MeshStandardMaterial({ color: 0x0b1220, emissive: 0x2a4f78, emissiveIntensity: 0.35, roughness: 0.25 }),
    arm: mat(0x3a3f48, { roughness: 0.5, metalness: 0.2 }),
    cove: new THREE.MeshBasicMaterial({ color: 0xfff1d8 }),
    path: new THREE.MeshBasicMaterial({ color: 0xffe6b8 }),
    exit: new THREE.MeshBasicMaterial({ color: 0x2fa060 }),
    bezel: mat(0xf7f3ec, { roughness: 0.5 }),
    shade: mat(0xe9e2d5, { roughness: 0.8 }),
  };

  // ---- shell ----
  const shell = new THREE.Mesh(sweep(PROFILE, 3, -LEN, 1), M.wall); scene.add(shell);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(3.0, LEN + 3), M.carpet); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.002, -LEN / 2 + 1.5); scene.add(floor);
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(0.46, LEN + 3), M.runner); runner.rotation.x = -Math.PI / 2; runner.position.set(0, 0.004, -LEN / 2 + 1.5); scene.add(runner);
  // the ceiling: lit panels between the bins with a soft light strip down the middle
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(1.9, LEN), new THREE.MeshStandardMaterial({ color: 0xf6f1e7, emissive: 0xb8ae9c, emissiveIntensity: 0.55, roughness: 0.7 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 2.1, -LEN / 2 + 1); scene.add(ceil);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.16, LEN), new THREE.MeshBasicMaterial({ color: 0xfff6e6 }));
  strip.rotation.x = Math.PI / 2; strip.position.set(0, 2.095, -LEN / 2 + 1); scene.add(strip);
  const panelJoints = [];
  for (let z = 1; z > -LEN + 1; z -= 1.2) { const g = new THREE.BoxGeometry(1.9, 0.004, 0.012); g.translate(0, 2.096, z); panelJoints.push(g); }
  scene.add(new THREE.Mesh(mergeGeometries(panelJoints), mat(0xcfc6b6)));
  // far bulkhead with the galley curtain and an exit sign
  const bulk = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.3), M.wall); bulk.position.set(0, 1.1, -LEN + 0.5); scene.add(bulk);
  const curtain = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.9), mat(0x2b3a55)); curtain.position.set(0, 0.95, -LEN + 0.52); scene.add(curtain);
  const exit = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.12), M.exit); exit.position.set(0, 2.02, -LEN + 0.55); scene.add(exit);

  // ---- overhead bins, following the curve, with door seams and the cove light above ----
  const binShape = new THREE.Shape([[1.6, 1.72], [1.42, 1.99], [1.02, 2.0], [0.93, 1.86], [0.96, 1.66], [1.08, 1.58], [1.62, 1.6]].map(([x, y]) => new THREE.Vector2(x, y)));
  const binGeo = new THREE.ExtrudeGeometry(binShape, { depth: LEN - 0.5, bevelEnabled: false }); binGeo.translate(0, 0, -LEN + 0.5);
  for (const s of [1, -1]) { const b = new THREE.Mesh(binGeo, M.bin); b.scale.x = s; scene.add(b); }
  const seams = []; const covs = [];
  for (let z = 0; z > -LEN + 1; z -= 1.6) for (const s of [1, -1]) {
    const g = new THREE.BoxGeometry(0.008, 0.2, 0.012); g.translate(s * 0.95, 1.77, z); seams.push(g);
  }
  scene.add(new THREE.Mesh(mergeGeometries(seams), M.seam));
  for (const s of [1, -1]) { const g = new THREE.BoxGeometry(0.03, 0.02, LEN - 0.5); g.translate(s * 1.0, 2.035, -LEN / 2 + 0.25); covs.push(g); }
  scene.add(new THREE.Mesh(mergeGeometries(covs), M.cove));
  // passenger service units under the bins: a row of reading lights
  const psu = []; const lights = [];
  for (let r = 0; r < ROWS; r++) for (const s of [1, -1]) {
    const z = FIRST - r * PITCH;
    const g = new THREE.BoxGeometry(0.5, 0.025, 0.3); g.translate(s * 1.33, 1.585, z); psu.push(g);
    for (let k = 0; k < 3; k++) { const c = new THREE.CircleGeometry(0.018, 10); c.rotateX(Math.PI / 2); c.translate(s * (1.13 + k * 0.17), 1.571, z + 0.05); lights.push(c); }
  }
  scene.add(new THREE.Mesh(mergeGeometries(psu), mat(0xe4ded2)));
  scene.add(new THREE.Mesh(mergeGeometries(lights), M.cove));
  // floor path lighting along the aisle
  const path = [];
  for (let z = 1; z > -LEN + 1; z -= 0.5) for (const s of [1, -1]) { const g = new THREE.BoxGeometry(0.02, 0.01, 0.12); g.translate(s * 0.26, 0.01, z); path.push(g); }
  scene.add(new THREE.Mesh(mergeGeometries(path), M.path));

  // ---- windows: a pane with live sky and clouds, a bezel, and some shades pulled half down ----
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec2 vUv; varying vec3 vW; uniform float uTime;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++){ v += a * n(p); p *= 2.03; a *= 0.5; } return v; }
      void main(){
        float side = sign(vW.x);
        vec3 top = vec3(0.30, 0.55, 0.86); vec3 hor = vec3(0.80, 0.88, 0.95);
        vec3 col = mix(hor, top, smoothstep(0.35, 1.0, vUv.y));
        // a cloud deck below the wing line, streaming backwards as the aircraft flies
        vec2 q = vec2(vW.z * 0.9 + uTime * 0.55 + side * 13.0, vUv.y * 2.6);
        float c = fbm(q * vec2(1.4, 1.0));
        float deck = smoothstep(0.62, 0.15, vUv.y);
        col = mix(col, vec3(0.98), smoothstep(0.42, 0.7, c) * deck);
        // high wisps
        float w = fbm(vec2(vW.z * 0.5 + uTime * 0.25, vUv.y * 6.0 + 3.0));
        col = mix(col, vec3(0.97), smoothstep(0.6, 0.85, w) * smoothstep(0.55, 0.9, vUv.y) * 0.5);
        // sun glare on the left side
        col += vec3(1.0, 0.95, 0.85) * 0.25 * smoothstep(0.0, 1.0, -side) * smoothstep(0.9, 0.2, distance(vUv, vec2(0.7, 0.8)));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const pane = new THREE.ShapeGeometry(roundRect(0.24, 0.34, 0.1), 8);
  const bez = new THREE.ShapeGeometry((() => { const s = roundRect(0.4, 0.52, 0.17); s.holes.push(roundRect(0.25, 0.35, 0.105)); return s; })(), 8);
  const panes = []; const bezels = []; const shades = [];
  let wi = 0;
  for (let z = 0.6; z > -LEN + 1.5; z -= PITCH * 0.95) for (const s of [1, -1]) {
    const y = 1.12; const x = s * 1.74;
    const ry = -s * Math.PI / 2;
    const p = pane.clone(); p.rotateY(ry); p.translate(x + s * 0.012, y, z); panes.push(p);
    const b = bez.clone(); b.rotateY(ry); b.translate(x - s * 0.005, y, z); bezels.push(b);
    // shades: deterministic mix of open, half and closed
    const k = (wi * 7 + (s > 0 ? 3 : 0)) % 9; wi++;
    const drop = k === 0 ? 0.34 : k < 3 ? 0.17 : 0;
    if (drop) { const sh = new THREE.PlaneGeometry(0.25, drop); sh.rotateY(ry); sh.translate(x, y + 0.17 - drop / 2, z); shades.push(sh); }
  }
  scene.add(new THREE.Mesh(mergeGeometries(panes), skyMat));
  scene.add(new THREE.Mesh(mergeGeometries(bezels), M.bezel));
  if (shades.length) scene.add(new THREE.Mesh(mergeGeometries(shades), M.shade));

  // ---- seats: 3 + 3 per row, instanced ----
  const seatXs = [0.5, 0.95, 1.4];
  const N = ROWS * 6;
  const parts = {
    pan: new THREE.InstancedMesh(new THREE.BoxGeometry(0.43, 0.12, 0.46), M.seat, N),
    back: new THREE.InstancedMesh(new THREE.BoxGeometry(0.43, 0.72, 0.11), M.seat, N),
    shell: new THREE.InstancedMesh(new THREE.BoxGeometry(0.44, 0.6, 0.03), M.seatSide, N),
    cover: new THREE.InstancedMesh(new THREE.BoxGeometry(0.36, 0.17, 0.13), M.cover, N),
    stripe: new THREE.InstancedMesh(new THREE.BoxGeometry(0.36, 0.02, 0.135), M.accent, N),
    screen: new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.095, 0.01), M.screen, N),
    arm: new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.05, 0.42), M.arm, ROWS * 8),
  };
  const d = new THREE.Object3D(); let i = 0; let a = 0;
  const heads = []; const hairs = [0x1d1a17, 0x2c2420, 0x4a3a2c, 0x6b5a48, 0x8c8a86, 0x3a2e28];
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let r = 0; r < ROWS; r++) {
    const z = FIRST - r * PITCH;
    for (const s of [1, -1]) {
      for (const sx of seatXs) {
        const x = s * sx;
        const set = (m, px, py, pz, rx = 0) => { d.position.set(px, py, pz); d.rotation.set(rx, 0, 0); d.updateMatrix(); m.setMatrixAt(i, d.matrix); };
        set(parts.pan, x, 0.44, z - 0.04);
        set(parts.back, x, 0.82, z + 0.2, -0.12);
        set(parts.shell, x, 0.76, z + 0.27, -0.12);
        set(parts.cover, x, 1.12, z + 0.24, -0.12);
        set(parts.stripe, x, 1.04, z + 0.25, -0.12);
        set(parts.screen, x, 0.93, z + 0.29, -0.12);
        i++;
        if (rnd() < 0.55) heads.push({ x: x + (rnd() - 0.5) * 0.04, z: z + 0.06, c: hairs[Math.floor(rnd() * hairs.length)], ph: rnd() * 6.28 });
      }
      for (let k = 0; k < 4; k++) { d.position.set(s * (0.27 + k * 0.45), 0.62, z - 0.02); d.rotation.set(0, 0, 0); d.updateMatrix(); parts.arm.setMatrixAt(a++, d.matrix); }
    }
  }
  for (const m of Object.values(parts)) { m.instanceMatrix.needsUpdate = true; scene.add(m); }
  // passengers, seen from behind: heads above the seat backs
  const headMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.105, 16, 12), mat(0xffffff, { roughness: 0.95 }), heads.length);
  heads.forEach((hd, k) => { d.position.set(hd.x, 1.2, hd.z); d.rotation.set(0, 0, 0); d.scale.set(0.9, 1.08, 1); d.updateMatrix(); headMesh.setMatrixAt(k, d.matrix); headMesh.setColorAt(k, new THREE.Color(hd.c)); });
  d.scale.set(1, 1, 1);
  scene.add(headMesh);

  // ---- camera: standing in the aisle, walking forward with the scroll, rocking gently ----
  let open = 0; let walk = 0; let walkS = 0; let running = false; let raf = 0;
  const clock = new THREE.Clock();
  const look = new THREE.Vector3();
  let sw = 0; let shh = 0;
  function size() {
    const w = canvas.clientWidth; const h = canvas.clientHeight;
    if (!w || !h) return;
    if (w === sw && Math.abs(h - shh) < 160) return; // phones: ignore the address bar
    sw = w; shh = h;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w < 700 ? 72 : 60; camera.updateProjectionMatrix();
  }
  addEventListener('resize', size);
  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    size();
    const t = clock.getElapsedTime();
    skyMat.uniforms.uTime.value = reduced ? 0 : t;
    walkS += (walk - walkS) * (reduced ? 1 : 0.06);
    const z = 2.3 - walkS * 5.5;
    const tb = reduced ? 0 : 1;
    camera.position.set(Math.sin(t * 0.31) * 0.03 * tb, 1.58 + (Math.sin(t * 1.7) * 0.004 + Math.sin(t * 0.9) * 0.006) * tb, z);
    look.set(Math.sin(t * 0.23) * 0.06 * tb, (sw < 700 ? 0.75 : 1.1) + Math.sin(t * 0.8) * 0.01 * tb, z - 10);
    camera.lookAt(look);
    camera.rotateZ((Math.sin(t * 0.7) * 0.006 + Math.sin(t * 1.9) * 0.0025) * tb);
    // a few passengers shift a little
    if (!reduced) {
      for (let k = 0; k < heads.length; k += 5) {
        const hd = heads[k]; d.position.set(hd.x + Math.sin(t * 0.6 + hd.ph) * 0.012, 1.2 + Math.sin(t * 0.9 + hd.ph) * 0.006, hd.z);
        d.scale.set(0.9, 1.08, 1); d.updateMatrix(); headMesh.setMatrixAt(k, d.matrix);
      }
      d.scale.set(1, 1, 1);
      headMesh.instanceMatrix.needsUpdate = true;
    }
    renderer.render(scene, camera);
  }
  function update(vis, progress) {
    open = vis; walk = progress;
    const want = vis > 0.002 && !document.hidden;
    if (want && !running) { running = true; clock.getDelta(); raf = requestAnimationFrame(frame); }
    if (!want && running) { running = false; cancelAnimationFrame(raf); }
  }
  document.addEventListener('visibilitychange', () => update(open, walk));
  return { update };
}
