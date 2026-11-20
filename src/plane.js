// A small airliner built from primitives: lathed fuselage with a painted livery,
// swept wings with winglets, two engines on pylons, tailplane, fin and navigation lights.
// The nose points to -z (the scene turns it to face the route).
import * as THREE from 'three';

const W = 1024; const H = 256; // livery canvas: x = around the fuselage, y = nose (top) to tail (bottom)

function drawLivery(ctx, accent) {
  const g = ctx;
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#f7f9fc'; g.fillRect(0, 0, W, H);
  // belly in light grey (u = 0.5 is the underside)
  const belly = g.createLinearGradient(W * 0.3, 0, W * 0.7, 0);
  belly.addColorStop(0, 'rgba(206,214,226,0)'); belly.addColorStop(0.3, '#d3dae5'); belly.addColorStop(0.7, '#d3dae5'); belly.addColorStop(1, 'rgba(206,214,226,0)');
  g.fillStyle = belly; g.fillRect(W * 0.3, 0, W * 0.4, H);
  // cheatline in the accent colour, sweeping up towards the tail on both sides
  g.fillStyle = accent;
  for (const side of [0.262, 0.738]) {
    g.beginPath();
    g.moveTo(W * side - 6, H * 0.1); g.lineTo(W * side + 6, H * 0.1);
    g.lineTo(W * side + 6, H * 0.74); g.quadraticCurveTo(W * side + 6, H * 0.9, W * (side < 0.5 ? side - 0.07 : side + 0.07), H * 0.98);
    g.lineTo(W * (side < 0.5 ? side - 0.1 : side + 0.1), H * 0.98); g.quadraticCurveTo(W * side - 6, H * 0.88, W * side - 6, H * 0.74);
    g.closePath(); g.fill();
  }
  // cabin windows: a row on each side, just above the cheatline
  g.fillStyle = '#1b2433';
  for (const side of [0.232, 0.768]) {
    for (let y = H * 0.24; y < H * 0.78; y += 7.2) {
      g.beginPath(); g.roundRect(W * side - 3, y, 6, 4.2, 2); g.fill();
    }
  }
  // doors
  g.strokeStyle = 'rgba(27,36,51,0.35)'; g.lineWidth = 1.2;
  for (const side of [0.232, 0.768]) for (const y of [H * 0.18, H * 0.8]) { g.strokeRect(W * side - 5, y, 10, 12); }
  // cockpit windows wrap around the nose
  g.fillStyle = '#121a26';
  for (const [x0, x1] of [[0.1, 0.2], [0.8, 0.9]]) { g.beginPath(); g.roundRect(W * x0, H * 0.035, W * (x1 - x0), H * 0.035, 3); g.fill(); }
  g.beginPath(); g.roundRect(W * 0.94, H * 0.04, W * 0.12, H * 0.03, 3); g.fill();
  g.beginPath(); g.roundRect(-W * 0.06, H * 0.04, W * 0.12, H * 0.03, 3); g.fill();
  // name above the windows
  g.fillStyle = accent; g.font = '600 15px Georgia, serif'; g.textBaseline = 'middle';
  for (const [side, rot] of [[0.205, Math.PI / 2], [0.795, -Math.PI / 2]]) {
    g.save(); g.translate(W * side, H * 0.5); g.rotate(rot); g.textAlign = 'center'; g.fillText('MAHLEHA', 0, 0); g.restore();
  }
}

function sweptShape(root, tip, span, sweep) {
  // planform in (x = span, y = chord direction, nose towards +y)
  const s = new THREE.Shape();
  s.moveTo(0, root / 2);
  s.lineTo(span, root / 2 - sweep);
  s.lineTo(span, root / 2 - sweep - tip);
  s.lineTo(0, -root / 2);
  s.closePath();
  return s;
}

function lathe(profile, seg = 40) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

export function buildAirliner({ shadows = false } = {}) {
  const g = new THREE.Group();
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  drawLivery(ctx, '#c93460');
  const livery = new THREE.CanvasTexture(canvas); livery.colorSpace = THREE.SRGBColorSpace; livery.anisotropy = 4;

  const paint = new THREE.MeshPhysicalMaterial({ map: livery, roughness: 0.32, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.18, envMapIntensity: 1.1 });
  const wingMat = new THREE.MeshPhysicalMaterial({ color: 0xd6dde7, roughness: 0.38, metalness: 0.35, clearcoat: 0.4, envMapIntensity: 1.0, side: THREE.DoubleSide });
  const accent = new THREE.MeshPhysicalMaterial({ color: 0xc93460, roughness: 0.3, metalness: 0.05, clearcoat: 0.9, envMapIntensity: 1.0, side: THREE.DoubleSide });
  const engineMat = new THREE.MeshPhysicalMaterial({ color: 0xe9eef5, roughness: 0.28, metalness: 0.2, clearcoat: 0.7, envMapIntensity: 1.1 });
  const intakeMat = new THREE.MeshStandardMaterial({ color: 0x151b24, roughness: 0.5, metalness: 0.7 });

  // fuselage: profile from tail (y < 0) to nose (y > 0), then laid along -z
  const L = 0.31;
  const body = new THREE.Mesh(lathe([
    [0.004, -L], [0.016, -L + 0.012], [0.03, -L + 0.04], [0.045, -L + 0.09], [0.056, -L + 0.15], [0.06, -0.08],
    [0.06, 0.12], [0.058, 0.19], [0.052, 0.235], [0.042, 0.268], [0.028, 0.29], [0.012, 0.305], [0, L],
  ], 48), paint);
  body.geometry.rotateX(-Math.PI / 2);
  // lift the tail cone a little, like a real airliner
  const pos = body.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) { const z = pos.getZ(i); if (z > 0.12) pos.setY(i, pos.getY(i) + (z - 0.12) * 0.12); }
  body.geometry.computeVertexNormals();
  g.add(body);

  // wings (right side built, left side mirrored)
  const wingGeo = new THREE.ExtrudeGeometry(sweptShape(0.15, 0.045, 0.4, 0.17), { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 });
  wingGeo.rotateX(-Math.PI / 2); // planform onto the xz plane, leading edge towards -z
  for (const side of [1, -1]) {
    const w = new THREE.Mesh(wingGeo, wingMat);
    w.scale.x = side; w.position.set(0.035 * side, -0.026, 0.02); w.rotation.z = side * 0.07; // dihedral
    g.add(w);
    // winglet: a small swept plate standing up at the tip
    const wl = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.05, 0.034), accent);
    wl.position.set(0.437 * side, 0.026, 0.145); wl.rotation.set(0.35, 0, -side * 0.22);
    g.add(wl);
    // engine nacelle on a pylon
    const nac = new THREE.Mesh(lathe([[0.0, -0.075], [0.022, -0.07], [0.028, -0.04], [0.029, 0.02], [0.027, 0.055], [0.024, 0.07], [0.02, 0.075]], 28), engineMat);
    nac.geometry.rotateX(-Math.PI / 2);
    nac.position.set(0.14 * side, -0.06, -0.035); g.add(nac);
    const fan = new THREE.Mesh(new THREE.CircleGeometry(0.021, 24), intakeMat);
    fan.position.set(0.14 * side, -0.06, -0.1085); fan.rotation.y = Math.PI; g.add(fan);
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.03, 0.07), wingMat);
    pylon.position.set(0.14 * side, -0.04, -0.01); g.add(pylon);
  }

  // horizontal tailplane
  const tailGeo = new THREE.ExtrudeGeometry(sweptShape(0.07, 0.03, 0.14, 0.07), { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
  tailGeo.rotateX(-Math.PI / 2);
  for (const side of [1, -1]) { const tp = new THREE.Mesh(tailGeo, wingMat); tp.scale.x = side; tp.position.set(0.01 * side, 0.03, 0.255); tp.rotation.z = side * 0.1; g.add(tp); }
  // vertical fin in the accent colour
  const finGeo = new THREE.ExtrudeGeometry(sweptShape(0.1, 0.045, 0.13, 0.07), { depth: 0.005, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
  finGeo.rotateX(-Math.PI / 2); finGeo.rotateZ(Math.PI / 2);
  const fin = new THREE.Mesh(finGeo, accent); fin.position.set(0.0025, 0.04, 0.235); g.add(fin);

  // navigation lights: red left, green right, white strobe on the tail
  const lights = {};
  const dot = (color, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), new THREE.MeshBasicMaterial({ color })); m.position.set(x, y, z); g.add(m); return m; };
  lights.left = dot(0xff3b4a, -0.438, 0.006, 0.13);
  lights.right = dot(0x36f59a, 0.438, 0.006, 0.13);
  lights.strobe = dot(0xffffff, 0, 0.172, 0.285);
  lights.belly = dot(0xff5a5a, 0, -0.062, 0.02);

  g.traverse((o) => { if (o.isMesh && !(o.material instanceof THREE.MeshBasicMaterial)) o.castShadow = shadows; });
  g.scale.setScalar(0.78);

  let lastAccent = '';
  g.userData = {
    accent,
    lights,
    engines: [new THREE.Vector3(0.14, -0.06, 0.05), new THREE.Vector3(-0.14, -0.06, 0.05)],
    setAccent(color) {
      const hex = `#${color.getHexString()}`;
      accent.color.copy(color);
      if (hex !== lastAccent) { lastAccent = hex; drawLivery(ctx, hex); livery.needsUpdate = true; }
    },
  };
  return g;
}
