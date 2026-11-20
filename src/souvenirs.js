// What travellers carry home from Tunisia, modelled from primitives.
// Each builder returns a Group about 0.16 units tall, centred on its base.
import * as THREE from 'three';

const lathe = (pts, seg = 36) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, envMapIntensity: 0.8, ...o });
const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, clearcoat: 0.8, envMapIntensity: 1, ...o });

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// 1. Chechia: the red felt cap of the Tunis medina, with its black silk tassel
function chechia() {
  const g = new THREE.Group();
  const felt = std(0xb3122e, { roughness: 0.95 });
  const cap = new THREE.Mesh(lathe([[0.0, 0.11], [0.06, 0.11], [0.072, 0.105], [0.08, 0.08], [0.085, 0.03], [0.087, 0.0], [0.082, 0.0]], 48), felt);
  felt.side = THREE.DoubleSide; g.add(cap);
  const silk = std(0x111318, { roughness: 0.35, metalness: 0.2 });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2; const len = 0.07 + Math.random() * 0.015;
    const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0018, len, 5), silk);
    strand.position.set(Math.cos(a) * 0.01, 0.11 - len / 2 + 0.004, Math.sin(a) * 0.01);
    strand.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
    strand.position.x += 0.035; strand.rotation.z -= 0.6; g.add(strand);
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), silk); knot.position.set(0, 0.112, 0); g.add(knot);
  return g;
}

// 2. Harissa: a tin with a red label
function harissa() {
  const g = new THREE.Group();
  const label = canvasTex(1024, 200, (c, w, h) => {
    c.fillStyle = '#c8102e'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f7efe3'; c.fillRect(0, 18, w, 6); c.fillRect(0, h - 24, w, 6);
    c.font = '700 54px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    // centred on u = 0 (the front of the tin) and u = 0.5 (the back); the front copy wraps across the seam
    for (const x of [w * 0.25, w * 0.75]) { c.font = '700 70px Georgia, serif'; c.fillText('HARISSA', x, h / 2 - 8); c.font = '600 26px Arial'; c.fillText('TUNISIE', x, h / 2 + 48); }
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.1, 40, 1, true), std(0xffffff, { map: label, roughness: 0.4, metalness: 0.3 }));
  body.position.y = 0.05; g.add(body);
  const steel = std(0xc9ced6, { roughness: 0.25, metalness: 0.9 });
  for (const y of [0, 0.1]) { const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.057, 0.057, 0.008, 40), steel); lid.position.y = y; g.add(lid); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.003, 8, 24), steel); ring.rotation.x = Math.PI / 2; ring.position.set(0.02, 0.106, 0); g.add(ring);
  return g;
}

// 3. Olive oil: a green glass bottle with a cork
function oliveOil() {
  const g = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x5e7d2c, roughness: 0.08, transmission: 0.0, transparent: true, opacity: 0.82, clearcoat: 1, envMapIntensity: 1.4 });
  const bottle = new THREE.Mesh(lathe([[0.0, 0.0], [0.045, 0.0], [0.048, 0.01], [0.048, 0.1], [0.04, 0.13], [0.018, 0.15], [0.016, 0.19], [0.0, 0.19]], 40), glass);
  g.add(bottle);
  const oil = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.09, 32), std(0xb5a227, { roughness: 0.2, transparent: true, opacity: 0.55 }));
  oil.position.y = 0.05; g.add(oil);
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.025, 16), std(0xa0764a, { roughness: 0.9 }));
  cork.position.y = 0.2; g.add(cork);
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.002), std(0xf5f1ea)); tag.position.set(0, 0.07, 0.049); g.add(tag);
  return g;
}

// 4. Deglet Nour dates in a small open box
function dates() {
  const g = new THREE.Group();
  const box = std(0x7c5a3a, { roughness: 0.8 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.1), box); base.position.y = 0.006; g.add(base);
  for (const [x, z, w, d] of [[0, 0.05, 0.16, 0.006], [0, -0.05, 0.16, 0.006], [0.08, 0, 0.006, 0.1], [-0.08, 0, 0.006, 0.1]]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(w, 0.022, d), box); side.position.set(x, 0.016, z); g.add(side);
  }
  const date = phys(0x7a3a14, { roughness: 0.3, clearcoat: 0.8 });
  const geo = new THREE.SphereGeometry(0.016, 16, 12); geo.scale(1, 0.9, 2.0);
  for (let i = 0; i < 10; i++) {
    const d = new THREE.Mesh(geo, date);
    d.position.set(-0.056 + (i % 5) * 0.028, 0.034 + Math.random() * 0.006, i < 5 ? -0.021 : 0.021);
    d.rotation.set(Math.random() * 0.4, Math.random() * 0.6, Math.random() * 0.3); g.add(d);
  }
  // a branch of dates on top, the way they are sold in the Djerid
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.13, 6), std(0xc9a36a)); stem.rotation.z = Math.PI / 2.4; stem.position.set(0, 0.07, 0); g.add(stem);
  return g;
}

// 5. Sidi Bou Said birdcage: white wire dome with blue details
function birdcage() {
  const g = new THREE.Group();
  const white = std(0xf6f7fb, { roughness: 0.35, metalness: 0.3 });
  const blue = std(0x1f5fbf, { roughness: 0.35, metalness: 0.2 });
  for (let i = 0; i < 10; i++) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.0022, 6, 40, Math.PI), white);
    arc.rotation.y = (i / 10) * Math.PI; arc.position.y = 0.05; g.add(arc);
  }
  for (const [y, r] of [[0.05, 0.07], [0.09, 0.06], [0.11, 0.045]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0028, 6, 48), y === 0.05 ? blue : white); ring.rotation.x = Math.PI / 2; ring.position.y = y; g.add(ring);
  }
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.05, 40), blue); base.position.y = 0.025; g.add(base);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.01, 12, 10), blue); finial.position.y = 0.128; g.add(finial);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.002, 6, 20), white); hook.position.y = 0.145; g.add(hook);
  return g;
}

// 6. Desert rose: gypsum and sand crystals grown into petals
function desertRose() {
  const g = new THREE.Group();
  const sand = std(0xc9a27e, { roughness: 0.95 });
  let seed = 3; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 0; i < 22; i++) {
    const r = 0.025 + rnd() * 0.03;
    const petal = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, 0.004, 18), sand);
    const a = rnd() * Math.PI * 2; const rad = rnd() * 0.04;
    petal.position.set(Math.cos(a) * rad, 0.02 + rnd() * 0.07, Math.sin(a) * rad);
    petal.rotation.set((rnd() - 0.5) * 2.4, rnd() * Math.PI, (rnd() - 0.5) * 2.4); g.add(petal);
  }
  return g;
}

// 7. Nabeul ceramics: a hand-painted plate on a small stand
function nabeulPlate() {
  const g = new THREE.Group();
  const paint = canvasTex(512, 512, (c, w) => {
    const r = w / 2; c.fillStyle = '#f7f3ea'; c.fillRect(0, 0, w, w);
    c.translate(r, r);
    c.strokeStyle = '#1a5fa8'; c.lineWidth = 14; c.beginPath(); c.arc(0, 0, r - 14, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 6; c.beginPath(); c.arc(0, 0, r - 40, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 12; i++) {
      c.save(); c.rotate((i / 12) * Math.PI * 2);
      c.fillStyle = i % 2 ? '#1f8a6e' : '#1a5fa8';
      c.beginPath(); c.ellipse(0, -r * 0.55, 22, 62, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#c3263f'; c.beginPath(); c.arc(0, -r * 0.82, 9, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    c.fillStyle = '#1a5fa8'; c.beginPath(); c.arc(0, 0, 54, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f7f3ea'; c.beginPath(); c.arc(0, 0, 30, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1f8a6e'; c.beginPath(); c.arc(0, 0, 14, 0, Math.PI * 2); c.fill();
  });
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.06, 0.012, 48), [phys(0xf7f3ea), phys(0xffffff, { map: paint }), phys(0xf7f3ea)]);
  plate.rotation.x = Math.PI / 2 - 0.25; plate.position.y = 0.09; g.add(plate);
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.006, 0.05), std(0x2b2f36, { metalness: 0.6, roughness: 0.4 })); stand.position.y = 0.003; g.add(stand);
  return g;
}

// 8. Jasmine mashmoum: a small bouquet of buds tied on a stem
function jasmine() {
  const g = new THREE.Group();
  const bud = phys(0xfdfdfb, { roughness: 0.5, clearcoat: 0.2 });
  const green = std(0x3f7d3a);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.11, 8), green); stem.position.y = 0.055; g.add(stem);
  let seed = 11; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const geo = new THREE.SphereGeometry(0.009, 10, 8); geo.scale(1, 1.5, 1);
  for (let i = 0; i < 46; i++) {
    const u = rnd() * Math.PI * 2; const v = rnd() * Math.PI * 0.5;
    const b = new THREE.Mesh(geo, bud);
    b.position.set(Math.cos(u) * Math.sin(v) * 0.045, 0.12 + Math.cos(v) * 0.035, Math.sin(u) * Math.sin(v) * 0.045);
    b.lookAt(0, 0.08, 0); g.add(b);
  }
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0025, 6, 16), std(0xc93460)); tie.rotation.x = Math.PI / 2; tie.position.y = 0.09; g.add(tie);
  return g;
}

export const SOUVENIRS = [chechia, harissa, oliveOil, dates, birdcage, desertRose, nabeulPlate, jasmine];

export function buildSouvenirs() {
  return SOUVENIRS.map((make) => {
    const holder = new THREE.Group();
    const item = make();
    const box = new THREE.Box3().setFromObject(item); const c = box.getCenter(new THREE.Vector3());
    item.position.sub(c); // spin around its own centre
    holder.add(item);
    holder.userData.item = item;
    return holder;
  });
}
