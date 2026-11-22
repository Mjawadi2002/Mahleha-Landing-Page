// Landmark miniatures on the map, modelled from primitives after the real monuments.
// They are scaled up (a map diorama, not to scale with the coastline) but keep each site's
// real layout: El Jem's elliptical three-tier arcades and the western breach of 1695,
// the Kairouan mosque's square minaret on the north wall and its two ribbed domes on the
// prayer hall axis, Dougga's Capitol with its portico of four front and two side columns,
// the Antonine Baths by the sea with their single re-erected column and the round Punic
// port, Matmata's pit dwellings (the Hotel Sidi Driss pit was the Lars homestead in
// Star Wars, 1977), a fishing boat off Houmt Souk in Djerba, and in Greece the Parthenon
// on the Acropolis rock, the Temple of Poseidon at Sounion and the theatre of Epidaurus.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

let M;
const SHARED = { uTime: { value: 0 } };
// Stone that looks worn: two octaves of value noise on the object-space position break up the flat
// colour, optional horizontal joints mark the courses of blocks, both fading out with distance.
function weather(mat, { grain = 0.22, scale = 60, course = 0, sparkle = false } = {}) {
  mat.vertexColors = true;
  mat.customProgramCacheKey = () => `lm-${grain}-${scale}-${course}-${sparkle}`;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = SHARED.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLmPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLmPos = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vLmPos; uniform float uTime;
      float lmHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float lmNoise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(lmHash(i), lmHash(i + vec3(1,0,0)), f.x), mix(lmHash(i + vec3(0,1,0)), lmHash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(lmHash(i + vec3(0,0,1)), lmHash(i + vec3(1,0,1)), f.x), mix(lmHash(i + vec3(0,1,1)), lmHash(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec3 q = vLmPos * ${scale.toFixed(1)};
        float n = lmNoise(q) * 0.62 + lmNoise(q * 3.7) * 0.38;
        float fade = 1.0 - smoothstep(0.2, 1.2, length(fwidth(q)));
        diffuseColor.rgb *= 1.0 + (n - 0.5) * ${grain.toFixed(2)} * fade;
        ${course > 0 ? `float cy = vLmPos.y / ${course.toFixed(4)}; float cw = fwidth(cy);
        float joint = 1.0 - smoothstep(0.0, max(cw * 1.2, 0.07), min(fract(cy), 1.0 - fract(cy)));
        diffuseColor.rgb *= 1.0 - joint * 0.22 * (1.0 - smoothstep(0.25, 0.6, cw));` : ''}
      }`);
    if (sparkle) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float w = sin(vLmPos.x * 90.0 + uTime * 1.6) * sin(vLmPos.z * 76.0 - uTime * 1.3) + sin((vLmPos.x + vLmPos.z) * 140.0 + uTime * 2.4) * 0.5;
          totalEmissiveRadiance += vec3(0.85, 0.92, 1.0) * pow(max(w, 0.0) / 1.5, 6.0) * 0.9; }`);
    }
  };
  return mat;
}
const std = (color, o = {}, w = {}) => weather(new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true, envMapIntensity: 0.18, ...o }), w);
const STONE = { grain: 0.3, scale: 70, course: 0.012 };
function mats() {
  if (M) return M;
  M = {
    // limestone of Carthage and Dougga
    stone: std(0xcabb9c, { emissive: 0x1a160f }, STONE), stoneDk: std(0x9a8769, { emissive: 0x0e0b07 }, STONE),
    // El Jem's honey sandstone
    sandstone: std(0xcfb187, { emissive: 0x1c140a }, STONE), sandstoneDk: std(0xa38660, { emissive: 0x100b05 }, STONE),
    // Kairouan's ochre walls and pale domes
    ochre: std(0xc6a27a, { emissive: 0x1a1209 }, STONE), ochreDk: std(0x977654, { emissive: 0x0e0905 }, STONE),
    dome: std(0xe6dccb, { emissive: 0x1c1913 }, { grain: 0.12, scale: 80 }),
    // Pentelic marble with its warm patina
    marble: std(0xe2d8c4, { roughness: 0.62, emissive: 0x1c1913 }, { grain: 0.26, scale: 55 }),
    rock: std(0x8a7e6b, {}, { grain: 0.4, scale: 30 }),
    earth: std(0xab8763, { side: THREE.DoubleSide, emissive: 0x100a05 }, { grain: 0.35, scale: 35 }),
    sand: std(0xc8b693, { emissive: 0x141109 }, { grain: 0.18, scale: 40 }), dune: std(0xc9a77a, { emissive: 0x140e06 }, { grain: 0.14, scale: 30 }),
    hill: std(0x4c5f36, { side: THREE.DoubleSide, emissive: 0x060a03 }, { grain: 0.35, scale: 28 }), grass: std(0x587a3f, { emissive: 0x060c04 }, { grain: 0.3, scale: 45 }),
    hollow: std(0x1b1814, { roughness: 1 }, { grain: 0 }),
    olive: std(0x6b7c50, { emissive: 0x070a04 }, { grain: 0.3, scale: 90 }), palm: std(0x4a7b37, { side: THREE.DoubleSide, emissive: 0x061004 }, { grain: 0.2 }),
    trunk: std(0x6a5440, {}, { grain: 0.3, scale: 120 }),
    water: std(0x2a7aa6, { roughness: 0.12, flatShading: false, envMapIntensity: 1.0 }, { grain: 0.06, scale: 20, sparkle: true }),
    hull: std(0xf2eee6, { roughness: 0.55 }, { grain: 0.06 }), blue: std(0x2b74c9, { roughness: 0.45 }, { grain: 0.08 }), wood: std(0x6d5a47, {}, { grain: 0.3, scale: 120 }),
    sail: std(0xf3ede0, { side: THREE.DoubleSide, roughness: 0.85 }, { grain: 0.08 }),
    white: std(0xefebe2, { emissive: 0x201e1a }, { grain: 0.08, scale: 60 }), roof: std(0x9b4136, { emissive: 0x120504 }, { grain: 0.25, scale: 90, course: 0.008 }),
    snow: std(0xf4f6f9, { side: THREE.DoubleSide, emissive: 0x2a2c30 }, { grain: 0.05 }),
    road: std(0x6a645b, {}, { grain: 0.2, scale: 120 }), boatRed: std(0xb3352f, { roughness: 0.45 }, { grain: 0.08 }),
    forest: std(0x3c5a33, { emissive: 0x050c05 }, { grain: 0.35, scale: 90 }), brick: std(0xb39270, { emissive: 0x100c07 }, { grain: 0.3, scale: 90, course: 0.006 }),
    // windows that light up on the night map
    lamp: new THREE.MeshStandardMaterial({ color: 0x2a2620, emissive: 0xfff0d2, emissiveIntensity: 0, roughness: 1 }),
  };
  return M;
}

class Kit {
  constructor() { this.parts = {}; }
  put(mat, geo, { x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0 } = {}) {
    if (rx) geo.rotateX(rx); if (rz) geo.rotateZ(rz); if (ry) geo.rotateY(ry);
    geo.translate(x, y, z);
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.clearGroups();
    const pos = g.attributes.position; const col = new Float32Array(pos.count * 3);
    const tint = 1 + (Math.random() - 0.5) * 0.12; const warm = (Math.random() - 0.5) * 0.04;
    for (let i = 0; i < pos.count; i++) {
      const ao = 0.66 + 0.34 * THREE.MathUtils.smoothstep(pos.getY(i), 0, 0.06);
      col[i * 3] = tint * ao * (1 + warm); col[i * 3 + 1] = tint * ao; col[i * 3 + 2] = tint * ao * (1 - warm);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    (this.parts[mat] ||= []).push(g);
    return this;
  }
  // boxes and cylinders sit on y (their base), not on their centre
  box(mat, w, h, d, x, y, z, ry = 0) { return this.put(mat, new THREE.BoxGeometry(w, h, d), { x, y: y + h / 2, z, ry }); }
  cyl(mat, rt, rb, h, x, y, z, seg = 12, ry = 0) { return this.put(mat, new THREE.CylinderGeometry(rt, rb, h, seg), { x, y: y + h / 2, z, ry }); }
  // remap lets a site swap the generic stone for its own (El Jem's sandstone, Kairouan's ochre)
  build(remap = {}) {
    const g = new THREE.Group(); const m = mats();
    for (const [k, list] of Object.entries(this.parts)) g.add(new THREE.Mesh(mergeGeometries(list), m[remap[k] || k]));
    return g;
  }
}

// a small deterministic random, so the ruins look the same on every visit
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function doric(k, mat, r, h, x, y, z) {
  k.cyl(mat, r * 0.8, r, h * 0.9, x, y, z, 12);
  k.cyl(mat, r * 1.25, r * 0.82, h * 0.05, x, y + h * 0.9, z, 12);
  k.box(mat, r * 2.6, h * 0.05, r * 2.6, x, y + h * 0.95, z);
}
function corinthian(k, mat, r, h, x, y, z) {
  k.box(mat, r * 2.3, h * 0.04, r * 2.3, x, y, z);
  k.cyl(mat, r * 0.86, r, h * 0.84, x, y + h * 0.04, z, 12);
  k.cyl(mat, r * 1.55, r * 0.9, h * 0.09, x, y + h * 0.88, z, 10);
  k.box(mat, r * 3, h * 0.03, r * 3, x, y + h * 0.97, z);
}
// a wall piece with a round-headed opening, lying along x
function archGeo(w, h, d, aw, spring, sill = 0.04) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.closePath();
  const a = aw / 2; const b = h * sill;
  const hole = new THREE.Path();
  hole.moveTo(-a, b); hole.lineTo(a, b); hole.lineTo(a, spring); hole.absarc(0, spring, a, 0, Math.PI, false); hole.lineTo(-a, b);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 5 });
  g.translate(0, 0, -d / 2);
  return g;
}
// a row of arches from (x0,z0) to (x1,z1)
function arcade(k, mat, x0, z0, x1, z1, n, h, d, y = 0) {
  const len = Math.hypot(x1 - x0, z1 - z0); const seg = len / n; const ry = Math.atan2(-(z1 - z0), x1 - x0);
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    k.put(mat, archGeo(seg * 1.01, h, d, seg * 0.62, h * 0.52), { x: x0 + (x1 - x0) * u, y, z: z0 + (z1 - z0) * u, ry });
  }
}
// flat triangle gable, facing along x
function pediment(k, mat, width, h, depth, x, y, z) {
  const s = new THREE.Shape(); s.moveTo(-width / 2, 0); s.lineTo(width / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2);
  k.put(mat, g, { x, y, z, ry: Math.PI / 2 });
}
function ellipseSlab(a1, b1, a0, b0, h, seg = 48) {
  const s = new THREE.Shape(); s.absellipse(0, 0, a1, b1, 0, Math.PI * 2, false, 0);
  if (a0 > 0) { const p = new THREE.Path(); p.absellipse(0, 0, a0, b0, 0, Math.PI * 2, true, 0); s.holes.push(p); }
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: seg });
  g.rotateX(-Math.PI / 2);
  return g;
}
function mound(k, mat, pts, seg = 28, x = 0, z = 0) {
  k.put(mat, new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), { x, z });
}
function tree(k, x, z, s = 1, y = 0) {
  k.cyl('trunk', 0.004 * s, 0.006 * s, 0.022 * s, x, y, z, 5);
  k.put('olive', new THREE.IcosahedronGeometry(0.02 * s, 0), { x, y: y + 0.032 * s, z });
}
function palm(k, x, z, s = 1, y = 0) {
  const h = 0.07 * s;
  k.put('trunk', new THREE.CylinderGeometry(0.003 * s, 0.005 * s, h, 5), { x, y: y + h / 2, z, rz: 0.08 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const leaf = new THREE.PlaneGeometry(0.04 * s, 0.009 * s); leaf.translate(0.02 * s, 0, 0);
    k.put('palm', leaf, { x: x + 0.006 * s, y: y + h, z, rx: -Math.PI / 2, rz: -0.45, ry: a });
  }
}
// a peripteral Greek temple: nl columns on the long sides (x), ns on the ends (z)
function temple(k, { nl, ns, sp, r, h, y = 0, x = 0, z = 0, mat = 'marble', stand = () => true, ends = true }) {
  const L = (nl - 1) * sp; const W = (ns - 1) * sp;
  for (let s = 0; s < 3; s++) k.box(mat, L + sp * (1.5 - s * 0.25), h * 0.05, W + sp * (1.5 - s * 0.25), x, y + s * h * 0.05, z);
  const top = y + h * 0.15;
  const ring = [];
  for (let i = 0; i < nl; i++) ring.push([i, 0, 'S'], [i, ns - 1, 'N']);
  for (let j = 1; j < ns - 1; j++) ring.push([0, j, 'W'], [nl - 1, j, 'E']);
  const up = new Set();
  for (const [i, j, side] of ring) {
    const px = x - L / 2 + i * sp; const pz = z + W / 2 - j * sp;
    if (stand(i, j, side)) { doric(k, mat, r, h, px, top, pz); up.add(`${i},${j}`); } else k.cyl(mat, r * 0.95, r, h * 0.18, px, top, pz, 12);
  }
  // architrave and frieze only where both supporting columns still stand
  const beam = (i0, j0, i1, j1) => {
    if (!up.has(`${i0},${j0}`) || !up.has(`${i1},${j1}`)) return;
    const ax = x - L / 2 + ((i0 + i1) / 2) * sp; const az = z + W / 2 - ((j0 + j1) / 2) * sp;
    const along = j0 === j1;
    k.box(mat, along ? sp + r * 2.4 : r * 2.6, h * 0.17, along ? r * 2.6 : sp + r * 2.4, ax, top + h, az);
  };
  for (let i = 0; i < nl - 1; i++) { beam(i, 0, i + 1, 0); beam(i, ns - 1, i + 1, ns - 1); }
  for (let j = 0; j < ns - 1; j++) { beam(0, j, 0, j + 1); beam(nl - 1, j, nl - 1, j + 1); }
  if (ends) for (const ex of [x - L / 2, x + L / 2]) {
    let whole = true; for (let j = 0; j < ns; j++) if (!up.has(`${ex < x ? 0 : nl - 1},${j}`)) whole = false;
    if (whole) pediment(k, mat, W + r * 2.6, h * 0.26, r * 2.4, ex, top + h * 1.17, z);
  }
  return { L, W, top };
}

// ---------------- Tunisia ----------------
function elJem() {
  // 148 x 122 m ellipse, three arcaded storeys (the fourth, a solid attic, is gone);
  // a stretch of the west side has been open since the breach of 1695
  const k = new Kit(); const rand = rng(5); const A = 0.5; const B = 0.41; const D = 0.05; const H = 0.08; const N = 44;
  const breach = [0, 0.3, 0.42];
  for (let tier = 0; tier < 3; tier++) for (let i = 0; i < N; i++) {
    const t0 = (i / N) * Math.PI * 2; const t1 = ((i + 1) / N) * Math.PI * 2; const tm = (t0 + t1) / 2;
    const west = Math.abs(Math.atan2(Math.sin(tm - Math.PI), Math.cos(tm - Math.PI)));
    const x0 = A * Math.cos(t0); const z0 = B * Math.sin(t0); const x1 = A * Math.cos(t1); const z1 = B * Math.sin(t1);
    const len = Math.hypot(x1 - x0, z1 - z0); const ry = Math.atan2(-(z1 - z0), x1 - x0);
    const mx = (x0 + x1) / 2; const mz = (z0 + z1) / 2;
    if (west < breach[tier]) {
      // the breach: broken piers and the radial vault walls behind them
      const hh = H * (0.15 + rand() * 0.75);
      k.put('stoneDk', new THREE.BoxGeometry(len * 0.32, hh, D), { x: x0, y: tier * H + hh / 2, z: z0, ry });
      if (rand() < 0.6) k.put('stoneDk', new THREE.BoxGeometry(D * 2.2, hh * 0.8, len * 0.25), { x: x0 * 0.93, y: tier * H + hh * 0.4, z: z0 * 0.93, ry });
      continue;
    }
    k.put('stone', archGeo(len * 1.03, H, D, len * 0.58, H * 0.5, tier ? 0.12 : 0.03), { x: mx, y: tier * H, z: mz, ry });
    k.put('stoneDk', new THREE.BoxGeometry(len * 1.04, 0.007, D * 1.3), { x: mx, y: (tier + 1) * H, z: mz, ry });
  }
  k.put('hollow', ellipseSlab(A - D * 0.55, B - D * 0.55, A - D * 0.8, B - D * 0.8, H * 2.9));
  // the cavea: seating stepping down from the outer wall to the arena wall
  const steps = 7;
  for (let j = 0; j < steps; j++) {
    const u = j / steps;
    const a = A - D * 0.5 - u * (A - D * 0.5 - 0.23); const b = B - D * 0.5 - u * (B - D * 0.5 - 0.17);
    k.put(j % 2 ? 'stone' : 'stoneDk', ellipseSlab(a, b, 0.22, 0.16, H * 2.5 * (1 - u) + 0.02));
  }
  k.put('sand', ellipseSlab(0.22, 0.16, 0, 0, 0.012));
  for (let i = 0; i < 14; i++) { const a = rand() * Math.PI * 2; const d = 1.18 + rand() * 0.25; tree(k, Math.cos(a) * A * d, Math.sin(a) * B * d, 1.3); }
  return k.build({ stone: 'sandstone', stoneDk: 'sandstoneDk' });
}

function kairouan() {
  // the Great Mosque (Uqba ibn Nafi): about 135 x 80 m; minaret in the middle of the north wall,
  // courtyard with porticoes, prayer hall to the south with domes over the central nave
  const k = new Kit(); const W = 0.6; const L = 1; const T = 0.025; const WH = 0.075;
  k.box('stone', W, WH, T, 0, 0, -L / 2 + T / 2); k.box('stone', W, WH, T, 0, 0, L / 2 - T / 2);
  k.box('stone', T, WH, L, -W / 2 + T / 2, 0, 0); k.box('stone', T, WH, L, W / 2 - T / 2, 0, 0);
  // the heavy buttresses along the outer walls
  for (let z = -L / 2 + 0.07; z < L / 2 - 0.03; z += 0.09) for (const sx of [-1, 1]) k.box('stoneDk', 0.026, WH * 0.92, 0.034, sx * (W / 2 + 0.011), 0, z);
  for (let x = -W / 2 + 0.07; x < W / 2 - 0.03; x += 0.1) {
    k.box('stoneDk', 0.034, WH * 0.92, 0.026, x, 0, L / 2 + 0.011);
    if (Math.abs(x) > 0.1) k.box('stoneDk', 0.034, WH * 0.92, 0.026, x, 0, -L / 2 - 0.011);
  }
  const hallZ = 0.1; const inner = W / 2 - T; const pd = 0.065;
  k.box('stoneDk', W - 2 * T, 0.006, hallZ + L / 2 - T, 0, 0, (hallZ - L / 2 + T) / 2);
  // porticoes around the courtyard
  for (const sx of [-1, 1]) {
    k.box('stone', pd, 0.008, hallZ + L / 2 - T - pd, sx * (inner - pd / 2), WH * 0.78, (hallZ - L / 2 + T + pd) / 2);
    arcade(k, 'stone', sx * (inner - pd), -L / 2 + T + pd, sx * (inner - pd), hallZ, 8, WH * 0.78, 0.012);
    k.box('hollow', 0.004, WH * 0.7, hallZ + L / 2 - T - pd, sx * (inner - pd * 0.5), 0.006, (hallZ - L / 2 + T + pd) / 2);
  }
  k.box('stone', W - 2 * T, 0.008, pd, 0, WH * 0.78, -L / 2 + T + pd / 2);
  arcade(k, 'stone', -inner + pd, -L / 2 + T + pd, inner - pd, -L / 2 + T + pd, 7, WH * 0.78, 0.012);
  k.box('hollow', W - 2 * T - 2 * pd, WH * 0.7, 0.004, 0, 0.006, -L / 2 + T + pd * 0.5);
  // prayer hall, its courtyard facade and the raised central nave
  const hallL = L / 2 - T - hallZ;
  k.box('stone', W - 2 * T, WH * 1.05, hallL, 0, 0, hallZ + hallL / 2);
  k.box('hollow', W - 2 * T, WH * 0.9, 0.004, 0, 0, hallZ + 0.004);
  arcade(k, 'stone', -inner, hallZ - 0.006, inner, hallZ - 0.006, 11, WH * 1.0, 0.01);
  k.box('stone', 0.09, WH * 1.35, hallL, 0, 0, hallZ + hallL / 2);
  for (const [dz, r] of [[0.045, 0.045], [hallL - 0.05, 0.05]]) {
    const y = WH * 1.35;
    k.box('stone', r * 2.1, 0.012, r * 2.1, 0, y, hallZ + dz);
    k.cyl('stone', r, r, 0.02, 0, y + 0.012, hallZ + dz, 16);
    k.put('dome', new THREE.SphereGeometry(r, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), { y: y + 0.032, z: hallZ + dz });
  }
  // the minaret: three square storeys, each a little narrower, crowned by a small dome
  const mz = -L / 2 + 0.065; let y = 0;
  for (const [rb, rt, h] of [[0.1, 0.09, 0.15], [0.075, 0.07, 0.05], [0.054, 0.05, 0.04]]) {
    k.cyl('stone', rt, rb, h, 0, y, mz, 4, Math.PI / 4);
    k.cyl('stoneDk', rt * 1.06, rt * 1.06, 0.006, 0, y + h - 0.006, mz, 4, Math.PI / 4);
    y += h;
  }
  k.put('dome', new THREE.SphereGeometry(0.03, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), { y, z: mz });
  // the town's olive groves around the walls
  { const rand = rng(17); for (let i = 0; i < 16; i++) { const a = rand() * Math.PI * 2; const d = 0.62 + rand() * 0.18; tree(k, Math.cos(a) * d * 0.75, Math.sin(a) * d, 1.3); } }
  for (const fy of [0.05, 0.1, 0.17]) k.box('lamp', 0.014, 0.02, 0.004, 0, fy, mz + (fy > 0.15 ? 0.048 : 0.066));
  return k.build({ stone: 'ochre', stoneDk: 'ochreDk' });
}

function dougga() {
  // the Capitol (AD 166-167) on its hill among olive trees: podium, cella walls,
  // a portico of four front and two side Corinthian columns, and the pediment over it
  const k = new Kit(); const rand = rng(7);
  mound(k, 'hill', [[0, 0.07], [0.3, 0.065], [0.45, 0.04], [0.55, 0]], 24);
  const y0 = 0.067;
  k.box('stone', 0.28, 0.05, 0.42, 0, y0, -0.01);
  for (let s = 0; s < 5; s++) k.box('stoneDk', 0.2, 0.01 * (s + 1), 0.016, 0, y0, 0.25 - s * 0.016);
  const yt = y0 + 0.05; const ch = 0.16; const r = 0.011;
  k.box('stone', 0.24, ch, 0.016, 0, yt, -0.2);
  for (const sx of [-1, 1]) k.box('stone', 0.016, ch, 0.24, sx * 0.112, yt, -0.088);
  k.box('stone', 0.24, ch, 0.016, 0, yt, 0.032);
  k.box('hollow', 0.06, 0.1, 0.018, 0, yt, 0.033);
  for (const x of [-0.09, -0.03, 0.03, 0.09]) corinthian(k, 'stone', r, ch, x, yt, 0.17);
  for (const sx of [-1, 1]) corinthian(k, 'stone', r, ch, sx * 0.09, yt, 0.1);
  k.box('stone', 0.22, 0.022, 0.03, 0, yt + ch, 0.17);
  for (const sx of [-1, 1]) k.box('stone', 0.03, 0.022, 0.15, sx * 0.09, yt + ch, 0.105);
  const pg = new THREE.Shape(); pg.moveTo(-0.12, 0); pg.lineTo(0.12, 0); pg.lineTo(0, 0.055); pg.closePath();
  const pgeo = new THREE.ExtrudeGeometry(pg, { depth: 0.024, bevelEnabled: false }); pgeo.translate(0, 0, -0.012);
  k.put('stone', pgeo, { y: yt + ch + 0.022, z: 0.17 });
  // the town's broken walls on the slope, and the olive groves
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2; const d = 0.3 + rand() * 0.15;
    k.box('stoneDk', 0.04 + rand() * 0.05, 0.01 + rand() * 0.025, 0.012, Math.cos(a) * d, 0.04 * (1 - (d - 0.3) / 0.25), Math.sin(a) * d, rand() * 3);
  }
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2; const d = 0.34 + rand() * 0.2;
    tree(k, Math.cos(a) * d, Math.sin(a) * d, 1.1, Math.max(0, 0.065 - (d - 0.3) * 0.25));
  }
  return k.build();
}

function carthage() {
  // the Antonine Baths on the shore (east = sea) with the one column raised again to full
  // height, and further south-west the round Punic war harbour with its central island
  const k = new Kit(); const rand = rng(3);
  k.box('grass', 0.7, 0.012, 0.5, 0, 0, 0);
  k.box('sand', 0.6, 0.016, 0.4, 0, 0, 0);
  { const pr = rng(23); for (let i = 0; i < 9; i++) palm(k, -0.33 + pr() * 0.12 + (i % 3) * 0.3, i < 3 ? -0.23 : i < 6 ? 0.23 : -0.02 + pr() * 0.05, 1.3, 0.012); }
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
    if (rand() < 0.25) continue;
    const x = -0.25 + i * 0.1; const z = -0.16 + j * 0.105; const h = 0.015 + rand() * 0.05;
    if (rand() < 0.5) k.box('stone', 0.09, h, 0.014, x, 0.016, z); else k.box('stone', 0.014, h, 0.09, x, 0.016, z);
  }
  arcade(k, 'stone', 0.08, -0.05, 0.08, 0.13, 3, 0.07, 0.02, 0.016);
  arcade(k, 'stoneDk', -0.2, 0.17, 0.0, 0.17, 3, 0.05, 0.018, 0.016);
  for (let i = 0; i < 7; i++) k.cyl('marble', 0.009, 0.01, 0.012 + rand() * 0.035, -0.06 + i * 0.03, 0.016, -0.05, 10);
  corinthian(k, 'marble', 0.016, 0.3, 0.17, 0.016, 0.02);
  k.box('stoneDk', 0.05, 0.004, 0.05, 0.17, 0.316, 0.02);
  // Punic ports
  const px = -0.36; const pz = 0.42;
  k.cyl('grass', 0.2, 0.21, 0.016, px, 0, pz, 32);
  k.cyl('water', 0.14, 0.14, 0.018, px, 0, pz, 32);
  k.cyl('grass', 0.05, 0.055, 0.03, px, 0, pz, 24);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    k.box('stone', 0.004, 0.012, 0.03, px + Math.cos(a) * 0.035, 0.03, pz + Math.sin(a) * 0.035, -a + Math.PI / 2);
  }
  k.box('water', 0.05, 0.018, 0.17, px + 0.02, 0, pz + 0.2);
  return k.build();
}

function matmata() {
  // troglodyte pit houses: a round courtyard dug into the hill with rooms cut into its walls
  const k = new Kit(); const rand = rng(11);
  const pits = [[0, 0, 1], [0.36, -0.16, 0.7], [-0.33, 0.15, 0.62]];
  for (const [x, z, R] of pits) {
    mound(k, 'earth', [[0, 0.016], [0.15, 0.016], [0.16, 0.1], [0.2, 0.115], [0.3, 0.09], [0.42, 0.035], [0.5, 0]].map(([r, y]) => [r * R, y * (0.6 + R * 0.4)]), 28, x, z);
    const n = 6 + Math.round(R * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand();
      k.put('hollow', archGeo(0.06 * R, 0.075 * R, 0.012, 0.048 * R, 0.045 * R, 0), { x: x + Math.cos(a) * 0.154 * R, y: 0.016, z: z + Math.sin(a) * 0.154 * R, ry: -a + Math.PI / 2 });
    }
  }
  for (let i = 0; i < 7; i++) palm(k, -0.4 + rand() * 0.8, 0.3 + rand() * 0.15, 1.4);
  return k.build();
}

function hullGeo(y0, y1) {
  const g = new THREE.BoxGeometry(1, y1 - y0, 0.3, 16, 2, 4); g.translate(0, (y0 + y1) / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i); const y = p.getY(i); const u = x / 0.5;
    const end = Math.sqrt(Math.max(0, 1 - Math.abs(u) ** (u > 0 ? 1.6 : 3)));
    p.setZ(i, p.getZ(i) * Math.max(0.03, end) * (0.45 + 0.55 * (y / 0.17)));
    p.setY(i, y + 0.07 * u * u);
  }
  g.computeVertexNormals();
  return g;
}
function boat() {
  // a small Djerbian fishing boat under a lateen sail, bow to +x
  const k = new Kit();
  k.put('blue', hullGeo(0, 0.075)); k.put('hull', hullGeo(0.075, 0.17));
  // mast, and the long yard hung across it carrying the triangular lateen sail
  k.cyl('wood', 0.008, 0.011, 0.5, 0.08, 0.15, 0, 6);
  const A = [0.5, 0.25]; const B = [-0.4, 0.95]; const C = [-0.26, 0.2];
  const s = new THREE.Shape(); s.moveTo(...A); s.lineTo(...B); s.lineTo(...C); s.closePath();
  k.put('sail', new THREE.ShapeGeometry(s), { z: 0.014 });
  k.put('wood', new THREE.CylinderGeometry(0.006, 0.006, Math.hypot(A[0] - B[0], A[1] - B[1]), 5), { x: (A[0] + B[0]) / 2, y: (A[1] + B[1]) / 2, z: 0.018, rz: Math.atan2(A[0] - B[0], B[1] - A[1]) });
  return k.build();
}

// natural ground under a site: an irregular low patch instead of a rectangular tray
function patch(k, mat, rx, rz, x = 0, z = 0, h = 0.008, seed = 1) {
  const r = rng(seed); const sh = new THREE.Shape(); const n = 22;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2; const f = 0.84 + r() * 0.24;
    const px = Math.cos(a) * rx * f; const py = Math.sin(a) * rz * f;
    if (i) sh.lineTo(px, py); else sh.moveTo(px, py);
  }
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: true, bevelThickness: h * 0.6, bevelSize: Math.min(rx, rz) * 0.08, bevelSegments: 2, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  k.put(mat, g, { x, y: 0, z });
}
// a straight wall from (x0,z0) to (x1,z1), with merlons along the top
function rampart(k, mat, x0, z0, x1, z1, h, t = 0.02, y = 0, crenel = 0.011) {
  const len = Math.hypot(x1 - x0, z1 - z0); const ry = Math.atan2(-(z1 - z0), x1 - x0);
  k.put(mat, new THREE.BoxGeometry(len, h, t), { x: (x0 + x1) / 2, y: y + h / 2, z: (z0 + z1) / 2, ry });
  if (!crenel) return;
  const n = Math.max(1, Math.floor(len / (crenel * 2)));
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    k.put(mat, new THREE.BoxGeometry(crenel, crenel * 1.1, t * 1.05), { x: x0 + (x1 - x0) * u, y: y + h + crenel * 0.55, z: z0 + (z1 - z0) * u, ry });
  }
}
// a tall town house facing +z (before turning): floors of shuttered windows, a parapet, a lamp or two at night
function townhouse(k, x, z, w, h, d, ry, mat, rand) {
  const c = Math.cos(ry); const sn = Math.sin(ry);
  k.put(mat, new THREE.BoxGeometry(w, h, d), { x, y: h / 2, z, ry });
  k.put(mat, new THREE.BoxGeometry(w * 1.04, 0.006, d * 1.04), { x, y: h + 0.003, z, ry });
  const floors = Math.max(1, Math.round(h / 0.03));
  for (let f = 0; f < floors; f++) for (const u of [-0.24, 0.24]) {
    const wy = (f + 0.55) * (h / floors);
    const fx = u * w; const fz = d / 2 + 0.0015;
    const lit = rand() < 0.3;
    k.put(lit ? 'lamp' : 'blue', new THREE.BoxGeometry(w * 0.2, Math.min(0.016, h / floors * 0.5), 0.003), { x: x + c * fx + sn * fz, y: wy, z: z - sn * fx + c * fz, ry });
  }
}
function minaretOct(k, mat, x, z, h, r) {
  k.cyl(mat, r * 1.15, r * 1.25, h * 0.08, x, 0, z, 8);
  k.cyl(mat, r, r * 1.05, h * 0.72, x, h * 0.08, z, 8);
  k.cyl('stoneDk', r * 1.35, r * 1.35, h * 0.03, x, h * 0.8, z, 8);
  k.cyl(mat, r * 0.62, r * 0.66, h * 0.12, x, h * 0.83, z, 8);
  k.put('dome', new THREE.SphereGeometry(r * 0.62, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), { x, y: h * 0.95, z });
  k.cyl('stoneDk', 0.0015, 0.0015, h * 0.08, x, h * 0.95 + r * 0.55, z, 4);
  for (const fy of [0.3, 0.55]) k.box('lamp', r * 0.5, h * 0.06, 0.003, x, h * fy, z + r * 0.98);
}
function boatAt(k, x, z, sc, ry, low, high) {
  for (const [m, y0, y1] of [[low, 0, 0.075], [high, 0.075, 0.17]]) {
    const g = hullGeo(y0, y1); g.scale(sc, sc, sc); g.rotateY(ry); k.put(m, g, { x, y: 0.02, z });
  }
}

// a whitewashed house with blue shutters
function house(k, x, z, w, h, d, ry = 0, y = 0) {
  k.box('white', w, h, d, x, y, z, ry);
  if (Math.random() < 0.6) { const c = Math.cos(ry); const sn = Math.sin(ry); k.box('lamp', w * 0.18, h * 0.22, 0.003, x + sn * d * 0.5, y + h * 0.66, z + c * d * 0.5, ry); }
  const c = Math.cos(ry); const sn = Math.sin(ry);
  for (const u of [-0.25, 0.25]) k.box('blue', w * 0.16, h * 0.28, 0.004, x + c * u * w + sn * d * 0.5, y + h * 0.45, z - sn * u * w + c * d * 0.5, ry);
}

function bizerte() {
  // the Old Port: a long canal between stone quays, lined with tall narrow houses in white, sand
  // and ochre with blue shutters; the Kasbah guards the north side of its mouth, the small Ksiba
  // fort the south side; the octagonal minaret of the Great Mosque rises over the west end;
  // fishing boats painted blue, red and white along the quays
  const k = new Kit(); const rand = rng(31);
  patch(k, 'sand', 0.5, 0.34, -0.02, 0, 0.012, 3);
  k.box('water', 1.0, 0.02, 0.17, 0.04, 0.003, 0.02);
  for (const sz of [-1, 1]) k.box('stoneDk', 0.86, 0.028, 0.018, -0.02, 0, 0.02 + sz * 0.094);
  const mats = ['white', 'white', 'white', 'sand', 'stone', 'white', 'sand', 'white'];
  for (const side of [-1, 1]) {
    let x = -0.36;
    while (x < 0.2) {
      const w = 0.045 + rand() * 0.03; const h = side > 0 ? 0.03 + rand() * 0.025 : 0.06 + rand() * 0.07;
      townhouse(k, x + w / 2, 0.02 + side * (0.103 + 0.038), w, h, 0.075, side > 0 ? Math.PI : 0, mats[Math.floor(rand() * mats.length)], rand);
      x += w + 0.004;
    }
  }
  // Kasbah, north of the mouth
  const kx = 0.33; const kz = -0.17; const kw = 0.19; const kh = 0.07;
  rampart(k, 'stone', kx - kw / 2, kz - kw / 2, kx + kw / 2, kz - kw / 2, kh);
  rampart(k, 'stone', kx - kw / 2, kz + kw / 2, kx + kw / 2, kz + kw / 2, kh);
  rampart(k, 'stone', kx - kw / 2, kz - kw / 2, kx - kw / 2, kz + kw / 2, kh);
  rampart(k, 'stone', kx + kw / 2, kz - kw / 2, kx + kw / 2, kz + kw / 2, kh);
  for (const [x, z] of [[kx - kw / 2, kz - kw / 2], [kx + kw / 2, kz - kw / 2], [kx - kw / 2, kz + kw / 2], [kx + kw / 2, kz + kw / 2]]) {
    k.box('stoneDk', 0.045, kh + 0.022, 0.045, x, 0, z);
    rampart(k, 'stoneDk', x - 0.022, z + 0.022, x + 0.022, z + 0.022, 0.001, 0.006, kh + 0.022, 0.008);
  }
  k.put('hollow', archGeo(0.04, 0.05, 0.022, 0.026, 0.026, 0), { x: kx - 0.04, y: 0, z: kz + kw / 2 + 0.001 });
  for (let i = 0; i < 6; i++) k.box('white', 0.03, 0.025 + rand() * 0.02, 0.03, kx - 0.06 + (i % 3) * 0.05, 0, kz - 0.05 + Math.floor(i / 3) * 0.06);
  // Ksiba, south of the mouth
  const qx = 0.32; const qz = 0.2; const qw = 0.1;
  rampart(k, 'stone', qx - qw / 2, qz - qw / 2, qx + qw / 2, qz - qw / 2, 0.05);
  rampart(k, 'stone', qx - qw / 2, qz + qw / 2, qx + qw / 2, qz + qw / 2, 0.05);
  rampart(k, 'stone', qx - qw / 2, qz - qw / 2, qx - qw / 2, qz + qw / 2, 0.05);
  rampart(k, 'stone', qx + qw / 2, qz - qw / 2, qx + qw / 2, qz + qw / 2, 0.05);
  // the Great Mosque's octagonal minaret
  minaretOct(k, 'stone', -0.3, -0.21, 0.19, 0.02);
  k.box('white', 0.1, 0.045, 0.07, -0.22, 0, -0.21);
  k.put('dome', new THREE.SphereGeometry(0.025, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), { x: -0.22, y: 0.045, z: -0.21 });
  // boats along the quays
  const hulls = [['blue', 'hull'], ['boatRed', 'hull'], ['blue', 'hull'], ['hull', 'blue'], ['boatRed', 'hull']];
  hulls.forEach(([lo, hi], i) => boatAt(k, -0.3 + i * 0.12, 0.02 + (i % 2 ? 0.05 : -0.05), 0.09, (rand() - 0.5) * 0.1, lo, hi));
  return k.build({ stone: 'ochre', stoneDk: 'ochreDk' });
}

function aindraham() {
  // a mountain town of the Kroumirie: stone houses with red tile roofs and chimneys on a hill of
  // cork oak, a road winding up, and the snow that falls here in winter on the treetops and slopes
  const k = new Kit(); const rand = rng(41);
  const prof = [[0, 0.2], [0.14, 0.19], [0.3, 0.12], [0.45, 0.045], [0.56, 0]];
  const hAt = (d) => { for (let i = 1; i < prof.length; i++) if (d <= prof[i][0]) { const [r0, y0] = prof[i - 1]; const [r1, y1] = prof[i]; return y0 + ((d - r0) / (r1 - r0)) * (y1 - y0); } return 0; };
  mound(k, 'hill', prof, 26);
  // the road: a ribbon spiralling up the slope
  const road = [];
  for (let t = 0; t <= 1; t += 1 / 60) {
    const a = 0.6 + t * 5.2; const d = 0.5 - t * 0.38;
    road.push([Math.cos(a) * d, hAt(d) + 0.003, Math.sin(a) * d]);
  }
  for (let i = 0; i < road.length - 1; i++) {
    const [x0, y0, z0] = road[i]; const [x1, y1, z1] = road[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    k.put('road', new THREE.BoxGeometry(len * 1.05, 0.003, 0.018), { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2, ry: Math.atan2(-(z1 - z0), x1 - x0) });
  }
  // cork oak forest, with snow on some crowns and patches on the ground
  for (let i = 0; i < 160; i++) {
    const a = rand() * Math.PI * 2; const d = 0.16 + rand() * 0.38;
    const x = Math.cos(a) * d; const z = Math.sin(a) * d;
    if (z > 0.02 && Math.abs(x) < 0.17 && d < 0.3) continue; // the town's clearing on the south slope
    const y = hAt(d) - 0.004; const r = 0.022 + rand() * 0.014;
    k.cyl('trunk', 0.003, 0.005, 0.018, x, y, z, 5);
    k.put(rand() < 0.7 ? 'forest' : 'olive', new THREE.IcosahedronGeometry(r, 0), { x, y: y + 0.03, z });
    if (rand() < 0.45) { const sc = new THREE.IcosahedronGeometry(r * 0.75, 0); sc.scale(1, 0.45, 1); k.put('snow', sc, { x, y: y + 0.03 + r * 0.6, z }); }
  }
  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2; const d = 0.08 + rand() * 0.3;
    const g = new THREE.CircleGeometry(0.03 + rand() * 0.03, 7); g.rotateX(-Math.PI / 2); g.scale(1, 1, 0.6 + rand() * 0.5);
    k.put('snow', g, { x: Math.cos(a) * d, y: hAt(d) + 0.002, z: Math.sin(a) * d });
  }
  // the town: stone houses with hipped red roofs and chimneys
  for (let i = 0; i < 11; i++) {
    const x = -0.14 + (i % 4) * 0.085 + (rand() - 0.5) * 0.03; const z = 0.06 + Math.floor(i / 4) * 0.075 + (rand() - 0.5) * 0.02;
    const d = Math.hypot(x, z); const y = hAt(d) - 0.006; const ry = (rand() - 0.5) * 0.5;
    const w = 0.045 + rand() * 0.02; const dd = 0.035 + rand() * 0.012; const h = 0.028 + rand() * 0.012;
    k.put(rand() < 0.5 ? 'stone' : 'white', new THREE.BoxGeometry(w, h, dd), { x, y: y + h / 2, z, ry });
    const roof = new THREE.ConeGeometry(Math.hypot(w, dd) * 0.56, 0.026, 4); roof.rotateY(Math.PI / 4); roof.scale(w / Math.hypot(w, dd) * 1.42, 1, dd / Math.hypot(w, dd) * 1.42);
    k.put('roof', roof, { x, y: y + h + 0.013, z, ry });
    k.put('stoneDk', new THREE.BoxGeometry(0.007, 0.016, 0.007), { x: x + w * 0.25, y: y + h + 0.018, z: z - dd * 0.2, ry });
    k.put('lamp', new THREE.BoxGeometry(w * 0.22, h * 0.3, 0.003), { x: x + Math.sin(ry) * (dd / 2 + 0.002), y: y + h * 0.5, z: z + Math.cos(ry) * (dd / 2 + 0.002), ry });
  }
  return k.build();
}

function hammamet() {
  // the medina on the shore: ochre ramparts with merlons and square towers, the kasbah in the
  // north-west corner, an arched gate, white houses with small domes and blue doors inside, the
  // square minaret of the Great Mosque, and the beach in front with palms and parasols
  const k = new Kit(); const rand = rng(53);
  patch(k, 'sand', 0.44, 0.3, 0, -0.06, 0.012, 9);
  patch(k, 'dune', 0.46, 0.09, 0, 0.21, 0.008, 12);
  const W = 0.44; const D = 0.3; const wh = 0.075; const cz = -0.07;
  const c = [[-W / 2, cz - D / 2], [W / 2, cz - D / 2], [W / 2, cz + D / 2], [-W / 2, cz + D / 2]];
  for (let i = 0; i < 4; i++) rampart(k, 'stone', c[i][0], c[i][1], c[(i + 1) % 4][0], c[(i + 1) % 4][1], wh, 0.022);
  for (const [x, z] of c) { k.box('stoneDk', 0.05, wh + 0.03, 0.05, x, 0, z); rampart(k, 'stoneDk', x - 0.025, z + 0.025, x + 0.025, z + 0.025, 0.001, 0.006, wh + 0.03, 0.009); }
  // kasbah
  k.box('stoneDk', 0.12, wh + 0.045, 0.1, -W / 2 + 0.07, 0, cz - D / 2 + 0.06);
  rampart(k, 'stoneDk', -W / 2 + 0.01, cz - D / 2 + 0.11, -W / 2 + 0.13, cz - D / 2 + 0.11, 0.001, 0.006, wh + 0.045, 0.01);
  // the sea gate
  k.put('hollow', archGeo(0.05, 0.06, 0.024, 0.032, 0.032, 0), { x: 0.06, y: 0, z: cz + D / 2 + 0.001 });
  // medina houses
  for (let i = 0; i < 34; i++) {
    const x = -W / 2 + 0.04 + rand() * (W - 0.08); const z = cz - D / 2 + 0.04 + rand() * (D - 0.08);
    if (x < -W / 2 + 0.14 && z < cz - D / 2 + 0.13) continue;
    if (Math.abs(x + 0.05) < 0.04 && Math.abs(z - cz) < 0.05) continue; // the mosque
    const hw = 0.028 + rand() * 0.026; const hh = 0.022 + rand() * 0.03; const hd = 0.028 + rand() * 0.026;
    k.box('white', hw, hh, hd, x, 0.012, z, 0);
    if (rand() < 0.25) k.put('dome', new THREE.SphereGeometry(Math.min(hw, hd) * 0.4, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), { x, y: 0.012 + hh, z });
    if (rand() < 0.5) k.box(rand() < 0.5 ? 'blue' : 'lamp', hw * 0.24, hh * 0.45, 0.003, x, 0.012, z + hd / 2 + 0.0015);
  }
  // the Great Mosque and its square minaret
  k.box('white', 0.08, 0.035, 0.07, -0.05, 0.012, cz);
  k.put('dome', new THREE.SphereGeometry(0.026, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), { x: -0.05, y: 0.047, z: cz });
  k.box('white', 0.03, 0.13, 0.03, -0.1, 0.012, cz - 0.03);
  k.box('stoneDk', 0.038, 0.006, 0.038, -0.1, 0.142, cz - 0.03);
  k.box('white', 0.018, 0.022, 0.018, -0.1, 0.148, cz - 0.03);
  k.put('dome', new THREE.SphereGeometry(0.01, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), { x: -0.1, y: 0.17, z: cz - 0.03 });
  k.box('lamp', 0.01, 0.018, 0.003, -0.1, 0.09, cz - 0.014);
  // palms between the ramparts and the beach, parasols on the sand
  for (let i = 0; i < 7; i++) palm(k, -0.38 + i * 0.125 + (rand() - 0.5) * 0.03, 0.13 + rand() * 0.03, 1.5, 0.01);
  for (let i = 0; i < 9; i++) {
    const x = -0.36 + i * 0.09 + (rand() - 0.5) * 0.02; const z = 0.22 + (rand() - 0.5) * 0.04;
    k.cyl('trunk', 0.0015, 0.0015, 0.03, x, 0.008, z, 4);
    k.put(i % 2 ? 'blue' : 'white', new THREE.ConeGeometry(0.02, 0.008, 8), { x, y: 0.042, z });
  }
  return k.build({ stone: 'ochre', stoneDk: 'ochreDk' });
}

function tozeur() {
  // the gateway to the Sahara: the palm grove of the oasis, patterned brick houses of the
  // old town, and the sand dunes of the desert beyond
  const k = new Kit(); const rand = rng(61);
  // dune ridges: long, with a sharp crest, lined up across the wind
  for (const [x, z, r, h, ry] of [[-0.32, -0.26, 0.2, 0.08, 0.3], [0.04, -0.36, 0.26, 0.11, 0.15], [0.36, -0.22, 0.2, 0.075, -0.2], [-0.45, 0.08, 0.15, 0.055, 0.5], [0.42, 0.12, 0.13, 0.05, -0.4]]) {
    const g = new THREE.LatheGeometry([[r, 0], [r * 0.55, h * 0.7], [r * 0.12, h * 0.98], [0.001, h]].map(([a, b]) => new THREE.Vector2(a, b)), 10);
    g.scale(1.9, 1, 0.5);
    k.put('dune', g, { x, z, ry });
  }
  k.cyl('grass', 0.3, 0.32, 0.012, 0.08, 0, 0.16, 24);
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2; const d = Math.sqrt(rand()) * 0.27;
    palm(k, 0.08 + Math.cos(a) * d, 0.16 + Math.sin(a) * d, 1.5 + rand() * 0.5, 0.012);
  }
  for (const [x, z, w, h] of [[-0.18, 0.2, 0.09, 0.06], [-0.26, 0.3, 0.07, 0.045], [-0.12, 0.33, 0.08, 0.05]]) {
    k.box('brick', w, h, 0.07, x, 0, z);
    for (let i = 0; i < 3; i++) k.box('stoneDk', w * 0.7, 0.004, 0.072, x, h * (0.45 + i * 0.15), z);
    k.box('hollow', 0.016, 0.026, 0.074, x, 0, z);
  }
  return k.build();
}

function ghriba() {
  // El Ghriba synagogue at Erriadh, Djerba: a whitewashed building with blue-framed
  // windows and doors, among palms and olive trees
  const k = new Kit(); const rand = rng(71);
  k.box('sand', 0.6, 0.012, 0.5, 0, 0, 0);
  k.box('white', 0.3, 0.1, 0.18, 0, 0.012, -0.04);
  k.box('white', 0.32, 0.012, 0.2, 0, 0.112, -0.04);
  for (let i = 0; i < 5; i++) {
    const x = -0.12 + i * 0.06;
    k.put('blue', archGeo(0.034, 0.05, 0.004, 0.022, 0.03, 0.02), { x, y: 0.04, z: 0.052 });
    k.put('blue', new THREE.BoxGeometry(0.02, 0.028, 0.004), { x, y: 0.054, z: 0.051 });
  }
  k.box('white', 0.12, 0.07, 0.1, 0.2, 0.012, 0.06);
  k.box('blue', 0.03, 0.045, 0.004, 0.2, 0.012, 0.112);
  for (let i = 0; i < 4; i++) k.box('white', 0.004, 0.012, 0.004, -0.15 + i * 0.1, 0.124, 0.06);
  for (let i = 0; i < 8; i++) palm(k, -0.27 + rand() * 0.54, i < 4 ? 0.2 + rand() * 0.04 : -0.22 + rand() * 0.04, 1.5, 0.012);
  for (let i = 0; i < 4; i++) tree(k, -0.26 + i * 0.06, 0.1 + rand() * 0.05, 1.1, 0.012);
  return k.build();
}

// ---------------- Greece ----------------
function acropolis() {
  // the rock (about 270 x 150 m) with the Parthenon on its south side (8 x 17 columns, its
  // centre blown out by the 1687 explosion), the Propylaea at the west end, the Erechtheion
  // to the north and the little temple of Athena Nike on the south-west bastion
  const k = new Kit();
  const outline = [[-0.5, 0.02], [-0.44, -0.12], [-0.25, -0.2], [0, -0.23], [0.25, -0.21], [0.42, -0.15], [0.5, -0.04], [0.47, 0.1], [0.3, 0.18], [0.05, 0.21], [-0.2, 0.18], [-0.4, 0.12]];
  const s = new THREE.Shape(); outline.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath();
  const rock = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.07, bevelSegments: 2, curveSegments: 4 });
  rock.rotateX(-Math.PI / 2); rock.translate(0, 0.04, 0);
  k.put('rock', rock);
  const top = 0.15;
  k.box('stoneDk', 0.9, 0.004, 0.36, 0, top, 0);
  // Parthenon
  temple(k, {
    nl: 17, ns: 8, sp: 0.022, r: 0.0068, h: 0.065, x: 0.08, y: top, z: 0.065,
    stand: (i, j, side) => !(side === 'S' && i >= 6 && i <= 10) && !(side === 'N' && i >= 7 && i <= 8),
  });
  k.box('marble', 0.012, 0.05, 0.1, -0.06, top + 0.01, 0.065);
  for (const dz of [-0.045, 0.045]) k.box('marble', 0.16, 0.02, 0.008, 0.03, top + 0.01, 0.065 + dz);
  // Propylaea: the six-column west front between two wings
  for (let j = 0; j < 6; j++) doric(k, 'marble', 0.0065, 0.055, -0.43, top, -0.055 + j * 0.022);
  k.box('marble', 0.012, 0.012, 0.13, -0.43, top + 0.055, 0);
  pediment(k, 'marble', 0.13, 0.016, 0.012, -0.43, top + 0.067, 0);
  k.box('marble', 0.05, 0.05, 0.05, -0.43, top, -0.1); k.box('marble', 0.04, 0.04, 0.035, -0.43, top, 0.095);
  k.box('marble', 0.11, 0.035, 0.035, -0.36, top, 0);
  // Athena Nike on its bastion
  k.box('stone', 0.06, 0.02, 0.06, -0.47, top - 0.02, 0.13);
  k.box('marble', 0.035, 0.03, 0.02, -0.47, top, 0.13);
  k.box('marble', 0.04, 0.006, 0.026, -0.47, top + 0.03, 0.13);
  // Erechtheion with the porch of the maidens on its south side
  k.box('marble', 0.1, 0.045, 0.045, 0.04, top, -0.09);
  for (let j = 0; j < 6; j++) corinthian(k, 'marble', 0.0045, 0.045, 0.095, top, -0.11 + j * 0.008);
  k.box('marble', 0.028, 0.025, 0.018, -0.0, top, -0.058);
  for (let i = 0; i < 4; i++) k.cyl('marble', 0.003, 0.0035, 0.022, -0.012 + i * 0.008, top, -0.052, 6);
  // the ramp up from the west
  k.put('stone', new THREE.BoxGeometry(0.2, 0.01, 0.07), { x: -0.54, y: top * 0.5, z: 0.02, rz: -0.62 });
  return k.build();
}

function sounion() {
  // the Temple of Poseidon (6 x 13 columns) on the cliff of Cape Sounion; the south colonnade
  // still stands, the north side only in part
  const k = new Kit();
  mound(k, 'rock', [[0, 0.1], [0.32, 0.095], [0.42, 0.06], [0.5, 0]], 9);
  temple(k, {
    nl: 13, ns: 6, sp: 0.032, r: 0.0095, h: 0.09, y: 0.1,
    stand: (i, j, side) => side === 'S' ? i > 0 && i < 12 : side === 'N' ? i >= 9 : side === 'E' ? false : false,
    ends: false,
  });
  return k.build();
}

function epidaurus() {
  // the theatre of the 4th century BC: 34 rows below the walkway, 21 above it,
  // a cavea a little wider than a half circle around a round orchestra, set into the hillside
  const k = new Kit();
  const half = 1.83;
  const band = (r0, r1, h, mat) => {
    const s = new THREE.Shape(); s.absarc(0, 0, r1, Math.PI / 2 - half, Math.PI / 2 + half, false); s.absarc(0, 0, r0, Math.PI / 2 + half, Math.PI / 2 - half, true); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 40 }); g.rotateX(-Math.PI / 2);
    k.put(mat, g);
  };
  mound(k, 'hill', [[0.4, 0.0], [0.5, 0.16], [0.56, 0.17], [0.7, 0.08], [0.8, 0]], 36);
  const rows = [];
  for (let j = 0; j < 9; j++) rows.push([0.12 + j * 0.026, 0.006 + j * 0.011]);
  for (let j = 0; j < 6; j++) rows.push([0.37 + j * 0.026, 0.11 + j * 0.011]);
  rows.forEach(([r0, h], j) => band(r0, 0.53, h, j % 2 ? 'stone' : 'marble'));
  k.cyl('sand', 0.1, 0.1, 0.006, 0, 0, 0, 40);
  k.box('stoneDk', 0.42, 0.018, 0.04, 0, 0, 0.17);
  for (let i = 0; i < 5; i++) tree(k, -0.6 + i * 0.3, 0.5 - Math.abs(i - 2) * 0.12, 1.4);
  return k.build();
}

// soft contact shadow under each model
let shadowTex;
function shadowDisc(size) {
  if (!shadowTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); shadowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.6 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.0015;
  return m;
}

// key, real coordinates, model, size on the map (scene units), heading, which leg it belongs to
const SITES = [
  { key: 'carthage', lon: 10.3317, lat: 36.8528, make: carthage, s: 0.2, ry: 0, leg: 'tn', d: 0.0, dx: -0.1, dz: 0.04 },
  { key: 'dougga', lon: 9.2183, lat: 36.4236, make: dougga, s: 0.27, ry: 0, leg: 'tn', d: 0.12 },
  { key: 'kairouan', lon: 10.1036, lat: 35.6814, make: kairouan, s: 0.3, ry: 0.52, leg: 'tn', d: 0.2 },
  { key: 'eljem', lon: 10.7069, lat: 35.2964, make: elJem, s: 0.3, ry: 0, leg: 'tn', d: 0.26 },
  { key: 'matmata', lon: 9.967, lat: 33.5426, make: matmata, s: 0.3, ry: 0, leg: 'tn', d: 0.34 },
  { key: 'bizerte', lon: 9.8739, lat: 37.2744, make: bizerte, s: 0.21, ry: 0, leg: 'tn', d: 0.05, dx: 0.05, dz: -0.03 },
  { key: 'aindraham', lon: 8.687, lat: 36.779, make: aindraham, s: 0.27, ry: 0, leg: 'tn', d: 0.1 },
  { key: 'hammamet', lon: 10.6153, lat: 36.3993, make: hammamet, s: 0.24, ry: 0, leg: 'tn', d: 0.18, dz: -0.035 },
  { key: 'djerba', lon: 10.8592, lat: 33.8139, make: ghriba, s: 0.22, ry: 0, leg: 'tn', d: 0.36 },
  { key: 'tozeur', lon: 8.1335, lat: 33.9197, make: tozeur, s: 0.3, ry: 0, leg: 'tn', d: 0.42 },
  { key: 'boat', lon: 10.86, lat: 33.99, make: boat, s: 0.07, ry: 0.6, leg: 'tn', d: 0.38, sea: true },
  { key: 'boat2', lon: 10.99, lat: 33.96, make: boat, s: 0.06, ry: -2.2, leg: 'tn', d: 0.4, sea: true },
  { key: 'parthenon', lon: 23.7267, lat: 37.9715, make: acropolis, s: 0.26, ry: 0, leg: 'gr', d: 0, label: true },
  { key: 'sounion', lon: 24.0247, lat: 37.6503, make: sounion, s: 0.15, ry: 0, leg: 'gr', d: 0.15, label: true },
  { key: 'epidaurus', lon: 23.0794, lat: 37.5961, make: epidaurus, s: 0.17, ry: 0, leg: 'gr', d: 0.25, label: true },
];

function gullGeo() {
  // a gull seen from above: two swept wings meeting at the body
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.004, -0.5, 0, -0.12, -0.18, 0, -0.03, 0, 0, 0.004, 0.18, 0, -0.03, 0.5, 0, -0.12, 0, 0, 0.004, -0.18, 0, -0.03, 0, 0, -0.05, 0, 0, 0.004, 0, 0, -0.05, 0.18, 0, -0.03], 3));
  g.computeVertexNormals();
  return g;
}

export function buildLandmarks(project, landH, stops = []) {
  const group = new THREE.Group();
  const gulls = [];
  const gullMat = new THREE.MeshBasicMaterial({ color: 0xf4f1ea, side: THREE.DoubleSide, transparent: true, opacity: 0 });
  const gGeo = gullGeo();
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(gGeo, gullMat); m.scale.setScalar(0.05 + Math.random() * 0.015);
    m.userData = { r: 0.12 + Math.random() * 0.1, h: 0.12 + Math.random() * 0.08, sp: 0.35 + Math.random() * 0.25, ph: Math.random() * 6.28, fl: 5 + Math.random() * 3 };
    group.add(m); gulls.push(m);
  }
  const gullAt = new THREE.Vector3(); let gullFade = 0;
  const items = SITES.map((site) => {
    const pos = project(site.lon, site.lat);
    const holder = new THREE.Group(); holder.position.set(pos.x + (site.dx || 0), site.sea ? 0.004 : landH, pos.z + (site.dz || 0));
    const model = site.make(); model.rotation.y = site.ry; holder.add(model);
    const sh = site.sea ? null : shadowDisc(1.5); if (sh) holder.add(sh);
    holder.scale.setScalar(site.s); holder.visible = false;
    group.add(holder);
    return { ...site, holder, model, sh, pos: holder.position, bob: Math.random() * 6, stop: stops.indexOf(site.key) };
  });
  const ease = (x) => { const c = 1.4; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; }; // easeOutBack
  function update(time, { tn, gr, reduced, cam, hop = -9, tour = 0, night = 0 }) {
    SHARED.uTime.value = reduced ? 0 : time;
    mats().lamp.emissiveIntensity = 1.8 * night;
    // gulls follow the stop the tour is on
    const stopIt = items.find((it) => it.stop === Math.round(hop) && it.leg === 'tn');
    const want = stopIt && tour > 0.5 && !reduced ? 1 : 0;
    gullFade += (want - gullFade) * 0.05;
    gullMat.opacity = gullFade * 0.95;
    if (stopIt) gullAt.lerp(stopIt.pos, gullFade < 0.05 ? 1 : 0.05);
    for (const g of gulls) {
      g.visible = gullFade > 0.01;
      if (!g.visible) continue;
      const u = g.userData; const a = u.ph + time * u.sp;
      g.position.set(gullAt.x + Math.cos(a) * u.r, gullAt.y + u.h + Math.sin(time * 0.7 + u.ph) * 0.01, gullAt.z + Math.sin(a) * u.r);
      g.rotation.set(0, -a, 0);
      g.scale.y = 1; g.rotation.z = Math.sin(time * u.fl + u.ph) * 0.45;
    }
    for (const it of items) {
      const lead = it.leg === 'tn' ? tn : gr;
      const r = THREE.MathUtils.smoothstep(lead, it.d, it.d + 0.55);
      it.rise = r;
      it.holder.visible = r > 0.002;
      if (!it.holder.visible) continue;
      const e = reduced ? r : ease(r);
      const far = cam ? THREE.MathUtils.clamp(cam.distanceTo(it.pos) / 2.6, 1, it.sea ? 1.25 : it.leg === 'tn' ? 1.7 : 1.3) : 1;
      it.far = it.far ? it.far + (far - it.far) * 0.15 : far;
      const on = it.stop >= 0 ? tour * (1 - THREE.MathUtils.smoothstep(Math.abs(hop - it.stop), 0, 0.6)) : 0;
      it.lift = it.lift ? it.lift + (on - it.lift) * 0.08 : on;
      const sz = it.s * it.far * (1 + 0.14 * it.lift);
      it.holder.scale.set(sz * (0.7 + 0.3 * r), sz * Math.max(0.001, e), sz * (0.7 + 0.3 * r));
      if (it.sh) it.sh.material.opacity = 0.55 * r;
      if (it.sea && !reduced) {
        it.model.position.y = Math.sin(time * 1.4 + it.bob) * 0.02;
        it.model.rotation.z = Math.sin(time * 1.1 + it.bob) * 0.06;
        it.model.rotation.x = Math.sin(time * 0.9 + it.bob * 2) * 0.05;
        it.model.rotation.y = it.ry + Math.sin(time * 0.15 + it.bob) * 0.25;
      }
    }
  }
  return { group, items, update };
}
