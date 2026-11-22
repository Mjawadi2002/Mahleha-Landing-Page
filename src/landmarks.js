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
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0, flatShading: true, envMapIntensity: 0.2, ...o });
function mats() {
  if (M) return M;
  M = {
    stone: std(0xc8b99e), stoneDk: std(0xa08f74), marble: std(0xd9d1c2, { roughness: 0.7 }),
    rock: std(0x8f8575), earth: std(0xa48f6e, { side: THREE.DoubleSide }), sand: std(0xc6b796), hill: std(0x8c8768, { side: THREE.DoubleSide }),
    hollow: std(0x2a2623, { roughness: 1 }), olive: std(0x5a6b4b), trunk: std(0x5e4f40),
    water: std(0x2a6fb8, { roughness: 0.15, flatShading: false, envMapIntensity: 0.9 }),
    hull: std(0xf4f0e8, { roughness: 0.55 }), blue: std(0x2f7de1, { roughness: 0.45 }), wood: std(0x6d5a47),
    sail: std(0xf6f2ea, { side: THREE.DoubleSide, roughness: 0.85 }),
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
    (this.parts[mat] ||= []).push(g);
    return this;
  }
  // boxes and cylinders sit on y (their base), not on their centre
  box(mat, w, h, d, x, y, z, ry = 0) { return this.put(mat, new THREE.BoxGeometry(w, h, d), { x, y: y + h / 2, z, ry }); }
  cyl(mat, rt, rb, h, x, y, z, seg = 12, ry = 0) { return this.put(mat, new THREE.CylinderGeometry(rt, rb, h, seg), { x, y: y + h / 2, z, ry }); }
  build() {
    const g = new THREE.Group(); const m = mats();
    for (const [k, list] of Object.entries(this.parts)) g.add(new THREE.Mesh(mergeGeometries(list), m[k]));
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
  // the cavea: seating stepping down from the outer wall to the arena wall
  const steps = 7;
  for (let j = 0; j < steps; j++) {
    const u = j / steps;
    const a = A - D * 0.5 - u * (A - D * 0.5 - 0.23); const b = B - D * 0.5 - u * (B - D * 0.5 - 0.17);
    k.put(j % 2 ? 'stone' : 'stoneDk', ellipseSlab(a, b, 0.22, 0.16, H * 2.5 * (1 - u) + 0.02));
  }
  k.put('sand', ellipseSlab(0.22, 0.16, 0, 0, 0.012));
  return k.build();
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
  }
  k.box('stone', W - 2 * T, 0.008, pd, 0, WH * 0.78, -L / 2 + T + pd / 2);
  arcade(k, 'stone', -inner + pd, -L / 2 + T + pd, inner - pd, -L / 2 + T + pd, 7, WH * 0.78, 0.012);
  // prayer hall, its courtyard facade and the raised central nave
  const hallL = L / 2 - T - hallZ;
  k.box('stone', W - 2 * T, WH * 1.05, hallL, 0, 0, hallZ + hallL / 2);
  arcade(k, 'stoneDk', -inner, hallZ - 0.004, inner, hallZ - 0.004, 11, WH * 1.0, 0.01);
  k.box('stone', 0.09, WH * 1.35, hallL, 0, 0, hallZ + hallL / 2);
  for (const [dz, r] of [[0.045, 0.045], [hallL - 0.05, 0.05]]) {
    const y = WH * 1.35;
    k.box('stone', r * 2.1, 0.012, r * 2.1, 0, y, hallZ + dz);
    k.cyl('stone', r, r, 0.02, 0, y + 0.012, hallZ + dz, 16);
    k.put('stone', new THREE.SphereGeometry(r, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), { y: y + 0.032, z: hallZ + dz });
  }
  // the minaret: three square storeys, each a little narrower, crowned by a small dome
  const mz = -L / 2 + 0.065; let y = 0;
  for (const [rb, rt, h] of [[0.1, 0.09, 0.15], [0.075, 0.07, 0.05], [0.054, 0.05, 0.04]]) {
    k.cyl('stone', rt, rb, h, 0, y, mz, 4, Math.PI / 4);
    k.cyl('stoneDk', rt * 1.06, rt * 1.06, 0.006, 0, y + h - 0.006, mz, 4, Math.PI / 4);
    y += h;
  }
  k.put('stone', new THREE.SphereGeometry(0.03, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), { y, z: mz });
  for (const fy of [0.05, 0.1]) k.box('hollow', 0.014, 0.02, 0.004, 0, fy, mz + 0.066);
  return k.build();
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
  k.box('sand', 0.62, 0.016, 0.42, 0, 0, 0);
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
  k.cyl('sand', 0.2, 0.21, 0.016, px, 0, pz, 32);
  k.cyl('water', 0.14, 0.14, 0.018, px, 0, pz, 32);
  k.cyl('sand', 0.05, 0.055, 0.03, px, 0, pz, 24);
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
  for (let i = 0; i < 6; i++) tree(k, -0.35 + rand() * 0.7, 0.25 + rand() * 0.15, 0.9);
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
  { key: 'carthage', lon: 10.3317, lat: 36.8528, make: carthage, s: 0.13, ry: 0, leg: 'tn', d: 0.0, dx: -0.07, dz: 0.03 },
  { key: 'dougga', lon: 9.2183, lat: 36.4236, make: dougga, s: 0.16, ry: 0, leg: 'tn', d: 0.12 },
  { key: 'kairouan', lon: 10.1036, lat: 35.6814, make: kairouan, s: 0.19, ry: 0.52, leg: 'tn', d: 0.2 },
  { key: 'eljem', lon: 10.7069, lat: 35.2964, make: elJem, s: 0.19, ry: 0, leg: 'tn', d: 0.26 },
  { key: 'matmata', lon: 9.967, lat: 33.5426, make: matmata, s: 0.2, ry: 0, leg: 'tn', d: 0.34 },
  { key: 'boat', lon: 10.88, lat: 33.95, make: boat, s: 0.07, ry: 0.6, leg: 'tn', d: 0.38, sea: true },
  { key: 'boat2', lon: 10.98, lat: 33.92, make: boat, s: 0.055, ry: -2.2, leg: 'tn', d: 0.4, sea: true },
  { key: 'parthenon', lon: 23.7267, lat: 37.9715, make: acropolis, s: 0.26, ry: 0, leg: 'gr', d: 0, label: true },
  { key: 'sounion', lon: 24.0247, lat: 37.6503, make: sounion, s: 0.15, ry: 0, leg: 'gr', d: 0.15, label: true },
  { key: 'epidaurus', lon: 23.0794, lat: 37.5961, make: epidaurus, s: 0.17, ry: 0, leg: 'gr', d: 0.25, label: true },
];

export function buildLandmarks(project, landH) {
  const group = new THREE.Group();
  const items = SITES.map((site) => {
    const pos = project(site.lon, site.lat);
    const holder = new THREE.Group(); holder.position.set(pos.x + (site.dx || 0), site.sea ? 0.004 : landH, pos.z + (site.dz || 0));
    const model = site.make(); model.rotation.y = site.ry; holder.add(model);
    const sh = site.sea ? null : shadowDisc(1.5); if (sh) holder.add(sh);
    holder.scale.setScalar(site.s); holder.visible = false;
    group.add(holder);
    return { ...site, holder, model, sh, pos: holder.position, bob: Math.random() * 6 };
  });
  const ease = (x) => { const c = 1.4; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; }; // easeOutBack
  function update(time, { tn, gr, reduced }) {
    for (const it of items) {
      const lead = it.leg === 'tn' ? tn : gr;
      const r = THREE.MathUtils.smoothstep(lead, it.d, it.d + 0.55);
      it.rise = r;
      it.holder.visible = r > 0.002;
      if (!it.holder.visible) continue;
      const e = reduced ? r : ease(r);
      it.holder.scale.set(it.s * (0.7 + 0.3 * r), it.s * Math.max(0.001, e), it.s * (0.7 + 0.3 * r));
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
