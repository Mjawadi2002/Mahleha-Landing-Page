// The flight scene: real Mediterranean coastline (Natural Earth 1:50m via world-atlas),
// a route from Athens to Tunis drawn as the plane flies it, and markers for the places
// named in the Mahleha deck. Everything is driven by one `state` object that the page's
// scroll timeline writes into; this module never reads scroll position itself.
import * as THREE from 'three';
import { feature } from 'topojson-client';
import land50 from 'world-atlas/land-50m.json';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildAirliner } from './plane.js';
import { buildLandmarks } from './landmarks.js';
import { TOUR, haversineKm } from './places.js';
export { haversineKm };

// Map window (degrees). 1 scene unit = 1 degree of latitude.
const BBOX = { w: -1, e: 33, s: 29, n: 45 };
const LAT0 = 37;
const KX = Math.cos((LAT0 * Math.PI) / 180);
const lonToX = (lon) => (lon - 16) * KX;
const latToZ = (lat) => -(lat - LAT0);
export const project = (lon, lat) => new THREE.Vector3(lonToX(lon), 0, latToZ(lat));

// Real coordinates (airport coordinates for the route ends).
export const PLACES = {
  athens: { lon: 23.9445, lat: 37.9364, label: 'Athens', sub: 'Greece' },
  tunis: { lon: 10.2272, lat: 36.851, label: 'Tunis', sub: 'Tunisia' },
  kerkennah: { lon: 11.2, lat: 34.7, label: 'Kerkennah', sub: 'Charfia fishing' },
};

// Great-circle distance (places.js), so the HUD number is computed, not invented.
export const ROUTE_KM = haversineKm(PLACES.athens, PLACES.tunis);

// ---------- land texture ----------
function clipRing(ring) {
  // Sutherland-Hodgman against the bbox rectangle.
  const edges = [
    (p) => p[0] >= BBOX.w, (p) => p[0] <= BBOX.e, (p) => p[1] >= BBOX.s, (p) => p[1] <= BBOX.n,
  ];
  const cut = [
    (a, b) => { const t = (BBOX.w - a[0]) / (b[0] - a[0]); return [BBOX.w, a[1] + t * (b[1] - a[1])]; },
    (a, b) => { const t = (BBOX.e - a[0]) / (b[0] - a[0]); return [BBOX.e, a[1] + t * (b[1] - a[1])]; },
    (a, b) => { const t = (BBOX.s - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), BBOX.s]; },
    (a, b) => { const t = (BBOX.n - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), BBOX.n]; },
  ];
  let out = ring;
  for (let k = 0; k < 4; k++) {
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const cur = inp[i]; const prev = inp[(i + inp.length - 1) % inp.length];
      const ci = edges[k](cur); const pi = edges[k](prev);
      if (ci) { if (!pi) out.push(cut[k](prev, cur)); out.push(cur); }
      else if (pi) out.push(cut[k](prev, cur));
    }
    if (!out.length) break;
  }
  return out;
}

function buildLandCanvas(pxPerDeg) {
  const W = Math.round((BBOX.e - BBOX.w) * KX * pxPerDeg);
  const H = Math.round((BBOX.n - BBOX.s) * pxPerDeg);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const toPx = ([lon, lat]) => [((lon - BBOX.w) * KX) * pxPerDeg, (BBOX.n - lat) * pxPerDeg];
  const land = feature(land50, land50.objects.land);
  const rings = [];
  const polysOut = []; // [outer, ...holes] in pixels, for the raised land
  for (const f of land.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) {
      const inBoxP = poly[0].some(([x, y]) => x > BBOX.w - 3 && x < BBOX.e + 3 && y > BBOX.s - 3 && y < BBOX.n + 3);
      if (inBoxP) {
        const parts = poly.map((r) => clipRing(r)).filter((r) => r.length > 2).map((r) => r.map(toPx));
        if (parts.length && clipRing(poly[0]).length > 2) polysOut.push(parts);
      }
      for (const ring of poly) {
        const inBox = ring.some(([x, y]) => x > BBOX.w - 3 && x < BBOX.e + 3 && y > BBOX.s - 3 && y < BBOX.n + 3);
        if (!inBox) continue;
        const cl = clipRing(ring);
        if (cl.length > 2) rings.push(cl.map(toPx));
      }
    }
  }
  return { canvas: c, ctx: g, rings, polys: polysOut, W, H };
}

// Two map moods: the Aegean on the way out to Tunisia, Tunisia's own colours on the way home.
export const MAP_THEMES = {
  // the way home: the Acropolis, old parchment land over a warm stone sea, Attic ink route
  tn: { bg: 0xe4d6bc, route: 0x23405f, accent: 0x23405f, dots: 0x2b2620, tunis: 0xd81e34, athens: 0x23405f,
    deep: 0xb09c7a, shallow: 0xc7b693, sky: 0xe2d5bb, landTop: 0xbcae95, landSide: 0x8f7c62, coastLight: 0x000000 },
  // the way out: the colours of Tunisia, deep night blue sea, Sidi Bou Said blue route, flag red accents
  gr: { bg: 0x0d1830, route: 0x6fb2ff, accent: 0xd81e34, dots: 0xf8f5ef, tunis: 0xd81e34, athens: 0x6fb2ff,
    deep: 0x0a1730, shallow: 0x1d5a9e, sky: 0x2d5f9a, landTop: 0x16233f, landSide: 0x0a1226, coastLight: 0x9cc8ff },
};


function coastMap(rings, W, H) {
  // black everywhere, a soft bright coastline: used as the land's emissive map
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.beginPath();
  for (const r of rings) { g.moveTo(r[0][0], r[0][1]); for (const p of r) g.lineTo(p[0], p[1]); g.closePath(); }
  g.save(); g.shadowColor = 'rgba(255,255,255,0.55)'; g.shadowBlur = W / 300;
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = Math.max(1.2, W / 2200); g.stroke(); g.restore();
  return c;
}

function shoreMask(rings, W, H) {
  // a blurred land mask: shallow water glows along every coast
  const s = 1024 / W; const w = 1024; const h = Math.round(H * s);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  g.beginPath();
  for (const r of rings) { g.moveTo(r[0][0] * s, r[0][1] * s); for (const p of r) g.lineTo(p[0] * s, p[1] * s); g.closePath(); }
  g.filter = 'blur(10px)'; g.fillStyle = '#fff'; g.fill('evenodd');
  g.filter = 'blur(3px)'; g.fill('evenodd');
  return c;
}

function raisedLand(polys, pxPerDeg, depth) {
  // extrude the real coastline polygons into a thin landmass
  const toXY = ([px, py]) => new THREE.Vector2((BBOX.w - 16) * KX + px / pxPerDeg, BBOX.n - 37 - py / pxPerDeg);
  const thin = (ring) => {
    const out = []; let last = null;
    for (const pt of ring) { const v = toXY(pt); if (!last || v.distanceTo(last) > 0.012) { out.push(v); last = v; } }
    return out;
  };
  const shapes = [];
  for (const [outer, ...holes] of polys) {
    const o = thin(outer); if (o.length < 3) continue;
    const sh = new THREE.Shape(o);
    for (const hRing of holes) { const hh = thin(hRing); if (hh.length > 2) sh.holes.push(new THREE.Path(hh)); }
    shapes.push(sh);
  }
  const geo = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, steps: 1, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  // map UVs onto the map rectangle so the coast texture lines up
  const x0 = lonToX(BBOX.w); const z0 = latToZ(BBOX.n);
  const mapW = (BBOX.e - BBOX.w) * KX; const mapH = BBOX.n - BBOX.s;
  const pos = geo.attributes.position; const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - x0) / mapW, 1 - (pos.getZ(i) - z0) / mapH);
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function cumulusTexture(seed) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160;
  const g = c.getContext('2d');
  let r = seed; const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  for (let i = 0; i < 14; i++) {
    const x = 50 + rnd() * 156; const y = 70 + rnd() * 40 - (Math.abs(x - 128) < 50 ? 25 * rnd() : 0); const rad = 26 + rnd() * 34;
    const gr = g.createRadialGradient(x, y - rad * 0.3, rad * 0.1, x, y, rad);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.55, 'rgba(236,242,250,0.6)'); gr.addColorStop(1, 'rgba(220,230,244,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  // soft shaded underside
  const sh = g.createLinearGradient(0, 80, 0, 150);
  sh.addColorStop(0, 'rgba(120,140,170,0)'); sh.addColorStop(1, 'rgba(120,140,170,0.35)');
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = sh; g.fillRect(0, 0, 256, 160);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function landDots(rings, W, H, pxPerDeg) {
  // Halftone dots sampled from the real land mask.
  const m = document.createElement('canvas');
  m.width = W; m.height = H;
  const g = m.getContext('2d', { willReadFrequently: true });
  g.beginPath();
  for (const r of rings) { g.moveTo(r[0][0], r[0][1]); for (const p of r) g.lineTo(p[0], p[1]); g.closePath(); }
  g.fillStyle = '#fff'; g.fill('evenodd');
  const data = g.getImageData(0, 0, W, H).data;
  const step = 0.16; // degrees
  const pts = [];
  const seeds = [];
  for (let lat = BBOX.s + step / 2; lat < BBOX.n; lat += step) {
    for (let lon = BBOX.w; lon < BBOX.e; lon += step / KX) {
      const x = Math.round((lon - BBOX.w) * KX * pxPerDeg);
      const y = Math.round((BBOX.n - lat) * pxPerDeg);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      if (data[(y * W + x) * 4] > 128) { pts.push(lonToX(lon), LAND_H + 0.004, latToZ(lat)); seeds.push(Math.random()); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  geo.setAttribute('seed', new THREE.Float32BufferAttribute(seeds, 1));
  return geo;
}

const LAND_H = 0.022; // height of the raised land


function glowTexture(inner = 'rgba(255,255,255,1)') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, inner); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- scene ----------
export function createFlight(canvas, labelLayer, { reduced = false, lite = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lite ? 1.25 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x0b1a2a, 1);
  const shadows = !reduced && window.innerWidth >= 700;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b1a2a, 9, 26);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 80);

  // a soft studio environment gives the paint real reflections
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const hemi = new THREE.HemisphereLight(0xdfe8f5, 0x0b1a2a, 0.7); scene.add(hemi);
  const SUN_DIR = new THREE.Vector3(-4, 6, 3).normalize();
  const sun = new THREE.DirectionalLight(0xf2f5fb, 2.4);
  sun.position.copy(SUN_DIR).multiplyScalar(6); scene.add(sun); scene.add(sun.target);
  if (shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -1.4, right: 1.4, top: 1.4, bottom: -1.4, near: 0.5, far: 20 });
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  }

  // Land plane
  const pxPerDeg = Math.min(110, renderer.capabilities.maxTextureSize / ((BBOX.e - BBOX.w) * KX));
  const { rings, polys, W, H } = buildLandCanvas(pxPerDeg);
  const mapW = (BBOX.e - BBOX.w) * KX; const mapH = BBOX.n - BBOX.s;
  const center = new THREE.Vector3(lonToX((BBOX.w + BBOX.e) / 2), 0, latToZ((BBOX.s + BBOX.n) / 2));

  // the sea: a live water surface with shallows along the coasts, small waves and sun glints
  const shoreTex = new THREE.CanvasTexture(shoreMask(rings, W, H));
  const seaMat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uDeep: { value: new THREE.Color(MAP_THEMES.gr.deep) }, uShallow: { value: new THREE.Color(MAP_THEMES.gr.shallow) },
      uSky: { value: new THREE.Color(MAP_THEMES.gr.sky) }, uSun: { value: SUN_DIR.clone() }, uTime: { value: 0 }, uShore: { value: null },
    }]),
    vertexShader: `varying vec2 vUv; varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky; uniform vec3 uSun; uniform float uTime; uniform sampler2D uShore;
      varying vec2 vUv; varying vec3 vWorld;
      #include <fog_pars_fragment>
      float h(vec2 p){ return sin(p.x*1.7 + uTime*0.55)*0.5 + sin(p.y*2.3 - uTime*0.42)*0.5 + sin((p.x+p.y)*3.7 + uTime*0.9)*0.22 + sin((p.x-p.y)*6.1 - uTime*1.25)*0.11 + sin(p.x*11.0 + p.y*7.0 + uTime*1.7)*0.05; }
      void main(){
        vec2 p = vWorld.xz * 7.0; float e = 0.03;
        float dx = (h(p + vec2(e,0.0)) - h(p - vec2(e,0.0))) / (2.0*e);
        float dz = (h(p + vec2(0.0,e)) - h(p - vec2(0.0,e))) / (2.0*e);
        vec3 n = normalize(vec3(-dx*0.035, 1.0, -dz*0.035));
        vec3 V = normalize(cameraPosition - vWorld);
        float shore = texture2D(uShore, vUv).r;
        vec3 col = mix(uDeep, uShallow, shore * 0.85);
        float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
        col = mix(col, uSky, fres * 0.55);
        vec3 R = reflect(-uSun, n);
        float spec = pow(max(dot(R, V), 0.0), 180.0);
        float glint = pow(max(dot(R, V), 0.0), 900.0) * step(0.6, fract(sin(dot(floor(vWorld.xz*90.0), vec2(12.9898,78.233)))*43758.5453));
        col += vec3(1.0) * (spec * 0.35 + glint * 1.2);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  seaMat.uniforms.uShore.value = shoreTex;
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(mapW, mapH), seaMat);
  sea.rotation.x = -Math.PI / 2; sea.position.copy(center);
  scene.add(sea);

  // the land: real coastline polygons, raised, lit by the sun, with a glowing shoreline
  const coastTex = new THREE.CanvasTexture(coastMap(rings, W, H));
  coastTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const landTop = new THREE.MeshStandardMaterial({ color: MAP_THEMES.gr.landTop, roughness: 0.95, metalness: 0, emissive: MAP_THEMES.gr.coastLight, emissiveMap: coastTex, emissiveIntensity: 0.6, envMapIntensity: 0.06 });
  const landSide = new THREE.MeshStandardMaterial({ color: MAP_THEMES.gr.landSide, roughness: 1, metalness: 0, envMapIntensity: 0.04 });
  const land = new THREE.Mesh(raisedLand(polys, pxPerDeg, LAND_H), [landTop, landSide]);
  land.receiveShadow = shadows;
  scene.add(land);

  // catches the plane's shadow on the water
  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(mapW, mapH), new THREE.ShadowMaterial({ color: 0x000610, opacity: 0.38 }));
  shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.position.copy(center); shadowCatcher.position.y = 0.0015;
  shadowCatcher.receiveShadow = true; shadowCatcher.visible = shadows;
  scene.add(shadowCatcher);

  // Halftone land dots
  const dotGeo = landDots(rings, W, H, pxPerDeg);
  const dotMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() }, uColor: { value: new THREE.Color(0xf5f1ea) } },
    vertexShader: `attribute float seed; varying float vSeed; uniform float uPx;
      void main(){ vSeed = seed; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * 22.0 / -mv.z; }`,
    fragmentShader: `varying float vSeed; uniform float uTime; uniform vec3 uColor;
      void main(){ float d = length(gl_PointCoord - 0.5); if(d>0.5) discard;
        float tw = 0.16 + 0.10 * sin(uTime*0.8 + vSeed*40.0);
        gl_FragColor = vec4(uColor, tw * smoothstep(0.5,0.2,d)); }`,
  });
  scene.add(new THREE.Points(dotGeo, dotMat));

  // Route arc
  const A = project(PLACES.athens.lon, PLACES.athens.lat);
  const T = project(PLACES.tunis.lon, PLACES.tunis.lat);
  const mid = A.clone().lerp(T, 0.5); mid.y = 1.6;
  const q1 = A.clone().lerp(mid, 0.5); q1.y = 1.25;
  const q2 = mid.clone().lerp(T, 0.5); q2.y = 1.25;
  const curve = new THREE.CatmullRomCurve3([A, A.clone().setY(0.35).lerp(q1, 0.25), q1, mid, q2, T.clone().setY(0.35).lerp(q2, 0.25), T], false, 'centripetal');
  const N = 400;
  const routePts = curve.getSpacedPoints(N);
  const routeGeo = new THREE.BufferGeometry().setFromPoints(routePts);
  const routeMat = new THREE.LineDashedMaterial({ color: 0x6fd8bf, dashSize: 0.07, gapSize: 0.06, transparent: true, opacity: 0.95 });
  const route = new THREE.Line(routeGeo, routeMat);
  route.computeLineDistances();
  routeGeo.setDrawRange(0, 0);
  scene.add(route);
  // faint ghost of the full route so the destination reads before we arrive
  const ghost = new THREE.Line(routeGeo.clone(), new THREE.LineDashedMaterial({ color: 0xeef2f8, dashSize: 0.03, gapSize: 0.09, transparent: true, opacity: 0.18 }));
  ghost.computeLineDistances(); scene.add(ghost);

  // Ground shadow of the route
  const shadowPts = routePts.map((p) => new THREE.Vector3(p.x, LAND_H + 0.002, p.z));
  const shadowGeo = new THREE.BufferGeometry().setFromPoints(shadowPts);
  const shadow = new THREE.Line(shadowGeo, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
  scene.add(shadow);

  // Plane
  const plane = buildAirliner({ shadows });
  scene.add(plane);
  // glow halos on the navigation lights
  const navGlow = {};
  for (const [k, m] of Object.entries(plane.userData.lights)) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,1)'), color: m.material.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.scale.setScalar(k === 'strobe' ? 0.09 : 0.05); m.add(sp); navGlow[k] = sp;
  }
  // contrails from both engines
  const TRAIL = 80;
  const trails = plane.userData.engines.map(() => {
    const posArr = new Float32Array(TRAIL * 3); const alpha = new Float32Array(TRAIL);
    for (let i = 0; i < TRAIL; i++) alpha[i] = 1 - i / (TRAIL - 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3)); geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uOpacity: { value: 0 } },
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform float uOpacity; varying float vA; void main(){ gl_FragColor = vec4(0.94,0.97,1.0, vA * vA * uOpacity); }' });
    const line = new THREE.Line(geo, mat); line.frustumCulled = false; scene.add(line);
    return { posArr, geo, mat, filled: false };
  });
  const engW = new THREE.Vector3();

  // the cabin view: on the way home the camera sits by a window and looks out at the sea
  let cabinK = 0;
  const winPos = new THREE.Vector3(); const winLook = new THREE.Vector3(); const sideV = new THREE.Vector3();
  const trailGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,0.9)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  trailGlow.scale.setScalar(0.5); scene.add(trailGlow);

  // Markers
  const ringTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.stroke();
    const t = new THREE.CanvasTexture(c); return t;
  })();
  const markers = {};
  const COLORS = { athens: 0x6fb2ff, tunis: 0xd81e34, kerkennah: 0xd81e34 };
  const ALL = { ...PLACES };
  for (const p of TOUR) ALL[p.key] = { ...p, label: p.key, sub: '', tour: true };
  for (const [key, p] of Object.entries(ALL)) {
    const pos = project(p.lon, p.lat);
    const grp = new THREE.Group(); grp.position.copy(pos);
    const r0 = p.tour ? 0.03 : 0.06;
    const dot = new THREE.Mesh(new THREE.CircleGeometry(r0, 24), new THREE.MeshBasicMaterial({ color: COLORS[key] ?? 0x6fd8bf, transparent: true }));
    dot.rotation.x = -Math.PI / 2; dot.position.y = LAND_H + 0.008; grp.add(dot);
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(r0 * 8, r0 * 8), new THREE.MeshBasicMaterial({ map: ringTex, color: COLORS[key] ?? 0x6fd8bf, transparent: true, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = LAND_H + 0.009; grp.add(ring);
    scene.add(grp);
    const el = document.createElement('div');
    el.className = 'map-label';
    el.dataset.place = key;
    el.innerHTML = `<strong>${p.label}</strong><span>${p.sub}</span>`;
    labelLayer.appendChild(el);
    markers[key] = { grp, dot, ring, el, pos, tour: !!p.tour, phase: Math.random() * 6 };
  }

  // landmark miniatures: Tunisia's rise as the plane nears Tunis, Greece's on the way home
  const lm = buildLandmarks(project, LAND_H, TOUR.map((p) => p.key));
  scene.add(lm.group);
  const lmLabels = lm.items.filter((it) => it.label).map((it) => {
    const el = document.createElement('div');
    el.className = 'map-label lm-label'; el.dataset.place = it.key; el.style.opacity = 0;
    labelLayer.appendChild(el);
    return { it, el };
  });
  for (const it of lm.items) if (markers[it.key]) markers[it.key].site = it;
  const acro = lm.items.find((it) => it.key === 'parthenon');
  const acroPos = new THREE.Vector3(); const acroLook = new THREE.Vector3();
  let homeK = 0;

  // Tour path: arcs hopping from one place to the next, drawn up to state.hop.
  const SEG = 64;
  const tourPts = [];
  TOUR.forEach((p, i) => {
    if (i === 0) return;
    const a = project(TOUR[i - 1].lon, TOUR[i - 1].lat); const b = project(p.lon, p.lat);
    const lift = Math.max(0.12, a.distanceTo(b) * 0.35);
    for (let j = i === 1 ? 0 : 1; j <= SEG; j++) {
      const u = j / SEG;
      const v = a.clone().lerp(b, u); v.y = LAND_H + 0.02 + Math.sin(Math.PI * u) * lift;
      tourPts.push(v);
    }
  });
  const tourGeo = new THREE.BufferGeometry().setFromPoints(tourPts);
  const tourMat = new THREE.LineBasicMaterial({ color: 0x6fd8bf, transparent: true, opacity: 0 });
  const tourLine = new THREE.Line(tourGeo, tourMat);
  tourGeo.setDrawRange(0, 0); scene.add(tourLine);
  const tourGhostMat = new THREE.LineDashedMaterial({ color: 0xeef2f8, dashSize: 0.02, gapSize: 0.03, transparent: true, opacity: 0 });
  const tourGhost = new THREE.Line(tourGeo.clone(), tourGhostMat);
  tourGhost.computeLineDistances(); scene.add(tourGhost);
  const tourHead = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,1)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  tourHead.scale.setScalar(0.22); scene.add(tourHead);
  const headPos = new THREE.Vector3();

  // Clouds: soft sprites layered at cruising height
  const cloudTexs = [cumulusTexture(7), cumulusTexture(19), cumulusTexture(43), cumulusTexture(97)];
  const clouds = [];
  for (let i = 0; i < 44; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexs[i % cloudTexs.length], transparent: true, depthWrite: false, opacity: 0 }));
    const u = Math.random();
    const base = curve.getPoint(u);
    s.position.set(base.x + (Math.random() - 0.5) * 5, base.y - 0.2 + Math.random() * 0.5, base.z + (Math.random() - 0.5) * 3);
    const sc = 0.7 + Math.random() * 1.6; s.scale.set(sc * 1.6, sc, 1);
    s.userData = { o: 0.12 + Math.random() * 0.22, drift: 0.02 + Math.random() * 0.04 };
    scene.add(s); clouds.push(s);
  }

  // State written by the scroll timeline.
  const state = {
    t: 0, // route progress 0..1
    camDist: 2.2, camHeight: 0.9, camSide: 0.5, // chase camera
    overview: 0, // 0 = chase cam, 1 = overview cam over focus point
    focusLon: 16.5, focusLat: 36.5, ovHeight: 9, ovTilt: 0.6,
    clouds: 0, // 0..1 opacity of clouds
    labels: Object.fromEntries(Object.keys(ALL).map((k) => [k, 0])),
    tour: 0, // 0..1 visibility of the tour path and its markers
    hop: 0, // position along the tour: 2.5 = halfway from stop 3 to stop 4
    cabin: 0, // 0..1, the view from a cabin window (way home only)
    theme: 0, // 0 = Aegean (outbound), 1 = Tunisian colours (set by the page when the visitor heads home)
  };
  const TH = { tn: {}, gr: {} };
  for (const k of ['bg', 'route', 'accent', 'dots', 'athens', 'deep', 'shallow', 'sky', 'landTop', 'landSide', 'coastLight']) { TH.tn[k] = new THREE.Color(MAP_THEMES.gr[k]); TH.gr[k] = new THREE.Color(MAP_THEMES.tn[k]); }
  // TH.tn = the start of the trip (Aegean), TH.gr = the way home (Tunisian colours)
  const mixC = new THREE.Color();
  let themeK = 0; let themeInit = false;
  trailGlow.material.color.set(MAP_THEMES.gr.route);
  tourHead.material.color.set(MAP_THEMES.gr.route);

  const tmp = new THREE.Vector3(); const tan = new THREE.Vector3();
  const chasePos = new THREE.Vector3(); const chaseLook = new THREE.Vector3();
  const ovPos = new THREE.Vector3(); const ovLook = new THREE.Vector3();
  const camPos = new THREE.Vector3(); const camLook = new THREE.Vector3();
  let first = true;
  // heading: 0 = flying to Tunis, PI = turned around, flying back to Athens
  let lastT = 0; let dir = 1; let yaw = 0;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  if (!reduced) window.addEventListener('pointermove', (e) => { pointer.x = e.clientX / innerWidth - 0.5; pointer.y = e.clientY / innerHeight - 0.5; }, { passive: true });

  let sizedW = 0; let sizedH = 0;
  function resize() {
    const w = canvas.clientWidth; const h = canvas.clientHeight;
    // on phones the canvas is sized to the large viewport, so small height changes are the address bar: skip them
    if (w === sizedW && Math.abs(h - sizedH) < 160 && sizedW) return;
    sizedW = w; sizedH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // narrow screens need a wider lens so both coasts fit
    camera.fov = w < 700 ? 58 : 42;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  const clock = new THREE.Clock();
  let running = true;

  function frame() {
    if (!running) return;
    const time = clock.getElapsedTime();
    const t = THREE.MathUtils.clamp(state.t, 0, 1);

    // plane on the curve
    curve.getPointAt(Math.min(t, 0.9999), tmp);
    curve.getTangentAt(Math.min(Math.max(t, 0.0001), 0.9999), tan);
    plane.position.copy(tmp);
    plane.position.y += Math.sin(time * 1.3) * 0.01;
    plane.lookAt(tmp.clone().add(tan));
    // which way is the scroll taking us? keep the last heading while the plane holds still
    const dt = t - lastT; lastT = t;
    if (dt < -0.0004) dir = -1; else if (dt > 0.0004) dir = 1;
    const targetYaw = dir < 0 ? Math.PI : 0;
    yaw += (targetYaw - yaw) * (reduced ? 1 : 0.08);
    const turning = Math.sin(yaw); // 0 when straight, 1 mid-turn
    plane.rotateY(Math.PI + yaw); // model nose points -z
    plane.rotateZ(Math.sin(time * 0.7) * 0.05 - (t > 0.02 && t < 0.98 ? 0.1 : 0) * Math.cos(yaw) - turning * 0.45);
    trailGlow.position.copy(plane.position);
    trailGlow.material.opacity = t > 0.001 && t < 0.999 ? 0.5 : 0;
    routeGeo.setDrawRange(0, Math.floor(t * N) + 1);
    plane.visible = t < 0.999 && cabinK < 0.5 && homeK < 0.4;
    const hideRoute = 1 - state.tour;
    routeMat.opacity = 0.95 * hideRoute; ghost.material.opacity = 0.18 * hideRoute; shadow.material.opacity = 0.25 * hideRoute;

    // chase camera: behind and above the plane
    const back = tan.clone().multiplyScalar(-state.camDist);
    const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize().multiplyScalar(state.camSide);
    chasePos.copy(tmp).add(back).add(side); chasePos.y = tmp.y + state.camHeight;
    chaseLook.copy(tmp).add(tan.clone().multiplyScalar(1.4)); chaseLook.y = tmp.y * 0.6;

    // overview camera over a focus point
    const f = project(state.focusLon, state.focusLat);
    ovLook.copy(f);
    ovPos.set(f.x, state.ovHeight, f.z + state.ovHeight * state.ovTilt);

    const k = state.overview;
    const targetPos = chasePos.clone().lerp(ovPos, k);
    const targetLook = chaseLook.clone().lerp(ovLook, k);
    // home again: on the last stretch the camera circles slowly over the Acropolis
    const homeT = (acro.rise || 0) * (1 - THREE.MathUtils.smoothstep(t, 0.15, 0.27));
    homeK += (homeT - homeK) * (reduced ? 1 : 0.05);
    if (homeK > 0.001) {
      const ang = -0.35 + (reduced ? 0 : Math.sin(time * 0.1) * 0.45);
      const near = canvas.clientWidth < 700;
      const dist = near ? 0.78 : 0.62;
      acroLook.copy(acro.pos); acroLook.y -= 0.06;
      acroPos.set(acroLook.x + Math.sin(ang) * dist, acroLook.y + dist * 0.55, acroLook.z + Math.cos(ang) * dist);
      // on wide screens keep the rock right of the hero text
      if (!near) { const sh = 0.16; acroLook.x -= Math.cos(ang) * sh; acroLook.z += Math.sin(ang) * sh; acroPos.x -= Math.cos(ang) * sh; acroPos.z += Math.sin(ang) * sh; }
      else { acroLook.z += 0.12; acroPos.z += 0.12; }
      targetPos.lerp(acroPos, homeK); targetLook.lerp(acroLook, homeK);
    }
    cabinK += ((state.cabin || 0) - cabinK) * (reduced ? 1 : 0.06);
    if (cabinK > 0.001) {
      // a seat by the window: just beside the fuselage, looking out and down at the sea and the clouds
      sideV.set(-tan.z, 0, tan.x).normalize();
      winPos.copy(tmp).addScaledVector(sideV, 0.05); winPos.y = tmp.y + 0.02;
      winLook.copy(winPos).addScaledVector(sideV, 2.2).addScaledVector(tan, 0.6); winLook.y = tmp.y * 0.35;
      targetPos.lerp(winPos, cabinK);
      targetLook.lerp(winLook, cabinK);
    }
    pointer.sx += (pointer.x - pointer.sx) * 0.04; pointer.sy += (pointer.y - pointer.sy) * 0.04;
    targetPos.x += pointer.sx * 0.35; targetPos.y += -pointer.sy * 0.2;
    if (first) { camPos.copy(targetPos); camLook.copy(targetLook); first = false; }
    camPos.lerp(targetPos, reduced ? 1 : 0.08);
    camLook.lerp(targetLook, reduced ? 1 : 0.08);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    if (import.meta.env.DEV && state.debugCam) { camera.position.copy(state.debugCam.pos); camera.lookAt(state.debugCam.look); }

    // clouds
    for (const c of clouds) {
      // fade clouds that drift right in front of the lens so text stays readable
      const near = THREE.MathUtils.smoothstep(c.position.distanceTo(camera.position), 1.2, 3.4);
      c.material.opacity = c.userData.o * state.clouds * near;
      if (!reduced) c.position.x -= c.userData.drift * 0.016;
    }

    // markers + projected HTML labels
    const w = canvas.clientWidth; const h = canvas.clientHeight;
    for (const [key, m] of Object.entries(markers)) {
      const vis = state.labels[key] ?? 0;
      const pulse = reduced ? 0.5 : (time * 0.6 + m.phase) % 1;
      m.ring.scale.setScalar(0.4 + pulse * 1.2);
      m.ring.material.opacity = (1 - pulse) * 0.8 * Math.max(vis, 0.35);
      const gate = m.tour ? state.tour : 1 - state.tour;
      m.dot.material.opacity = (0.5 + vis * 0.5) * gate;
      if (m.site) m.dot.material.opacity *= 1 - (m.site.rise || 0);
      m.ring.material.opacity *= gate;
      const sp = m.pos.clone(); sp.y = 0.05; sp.project(camera);
      const onScreen = sp.z < 1 && Math.abs(sp.x) < 1.1 && Math.abs(sp.y) < 1.1;
      m.el.style.opacity = onScreen ? vis : 0;
      m.el.style.transform = `translate(${(sp.x * 0.5 + 0.5) * w}px, ${(-sp.y * 0.5 + 0.5) * h}px)`;
    }

    // landmarks rise on their leg of the trip
    lm.update(time, { tn: THREE.MathUtils.smoothstep(t, 0.72, 0.97), gr: themeK, reduced, cam: camera.position, hop: state.hop, tour: state.tour });
    for (const { it, el } of lmLabels) {
      const sp = it.pos.clone(); sp.y += it.s * 0.3; sp.project(camera);
      const vis = (it.rise || 0) * (1 - THREE.MathUtils.smoothstep(t, 0.15, 0.27)) * (sp.z < 1 && Math.abs(sp.x) < 1.05 && Math.abs(sp.y) < 1.05 ? 1 : 0);
      el.style.opacity = vis;
      el.style.transform = `translate(${(sp.x * 0.5 + 0.5) * w}px, ${(-sp.y * 0.5 + 0.5) * h}px)`;
    }

    // tour path
    const hop = THREE.MathUtils.clamp(state.hop, 0, TOUR.length - 1);
    const fIdx = hop * SEG;
    tourGeo.setDrawRange(0, Math.floor(fIdx) + 1);
    tourMat.opacity = 0.9 * state.tour;
    tourGhostMat.opacity = 0.22 * state.tour;
    const i0 = Math.min(Math.floor(fIdx), tourPts.length - 1); const i1 = Math.min(i0 + 1, tourPts.length - 1);
    headPos.copy(tourPts[i0]).lerp(tourPts[i1], fIdx - Math.floor(fIdx));
    tourHead.position.copy(headPos);
    tourHead.scale.setScalar(THREE.MathUtils.clamp(state.ovHeight * 0.05, 0.05, 0.3));
    tourHead.material.opacity = state.tour * (reduced ? 0.8 : 0.75 + Math.sin(time * 4) * 0.2);
    // soften the cursor once it reaches a stop, so it does not wash out the landmark standing there
    tourHead.material.opacity *= 0.25 + 0.75 * THREE.MathUtils.smoothstep(Math.abs(hop - Math.round(hop)), 0, 0.25);

    // theme: glide every map colour between the two moods
    themeK += (state.theme - themeK) * (reduced ? 1 : 0.035);
    if (Math.abs(state.theme - themeK) > 0.0005 || !themeInit) {
      themeInit = true;
      const k = themeK;
      mixC.lerpColors(TH.tn.bg, TH.gr.bg, k); renderer.setClearColor(mixC, 1); scene.fog.color.copy(mixC);
      seaMat.uniforms.uDeep.value.lerpColors(TH.tn.deep, TH.gr.deep, k);
      seaMat.uniforms.uShallow.value.lerpColors(TH.tn.shallow, TH.gr.shallow, k);
      seaMat.uniforms.uSky.value.lerpColors(TH.tn.sky, TH.gr.sky, k);
      landTop.color.lerpColors(TH.tn.landTop, TH.gr.landTop, k);
      // the parchment mood is bright already: a softer, warmer sun keeps it from washing out
      sun.intensity = 2.4 - 1.05 * k; hemi.intensity = 0.7 - 0.25 * k; sun.color.setRGB(0.95 + 0.03 * k, 0.96 - 0.02 * k, 0.98 - 0.08 * k);
      landTop.emissive.lerpColors(TH.tn.coastLight, TH.gr.coastLight, k);
      landSide.color.lerpColors(TH.tn.landSide, TH.gr.landSide, k);
      mixC.lerpColors(TH.tn.route, TH.gr.route, k);
      routeMat.color.copy(mixC); tourMat.color.copy(mixC); trailGlow.material.color.copy(mixC); tourHead.material.color.copy(mixC);
      mixC.lerpColors(TH.tn.athens, TH.gr.athens, k);
      for (const [key, m] of Object.entries(markers)) if (key === 'athens' || m.tour) { m.dot.material.color.copy(mixC); m.ring.material.color.copy(mixC); }
      const kq = Math.round(k * 8) / 8; // repaint the livery in a few steps, not every frame
      plane.userData.setAccent(mixC.lerpColors(TH.tn.accent, TH.gr.accent, kq));
      dotMat.uniforms.uColor.value.lerpColors(TH.tn.dots, TH.gr.dots, k);
    }

    // navigation lights: steady red/green, white strobe and red beacon blinking
    const L = plane.userData.lights;
    L.strobe.visible = (time % 1.3) < 0.07 || ((time + 0.18) % 1.3) < 0.05;
    L.belly.visible = ((time + 0.65) % 1.3) < 0.12;
    // contrails: push the engines' world positions into each trail while flying
    const flying = plane.visible && state.overview < 0.95;
    trails.forEach((tr, i) => {
      engW.copy(plane.userData.engines[i]); plane.localToWorld(engW);
      const a = tr.posArr;
      if (!tr.filled) { for (let j = 0; j < TRAIL; j++) a.set([engW.x, engW.y, engW.z], j * 3); tr.filled = true; }
      const moved = Math.hypot(a[0] - engW.x, a[1] - engW.y, a[2] - engW.z) > 0.006;
      if (moved) { a.copyWithin(3, 0, (TRAIL - 1) * 3); }
      a[0] = engW.x; a[1] = engW.y; a[2] = engW.z;
      tr.geo.attributes.position.needsUpdate = true;
      tr.mat.uniforms.uOpacity.value += (((flying ? 0.5 : 0) * (1 - state.overview)) - tr.mat.uniforms.uOpacity.value) * 0.1;
    });
    // keep the sun's shadow box on the plane
    if (shadows) { sun.position.copy(plane.position).addScaledVector(SUN_DIR, 6); sun.target.position.copy(plane.position); sun.target.updateMatrixWorld(); }
    seaMat.uniforms.uTime.value = reduced ? 0 : time;

    dotMat.uniforms.uTime.value = time;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if (import.meta.env.DEV) window.__frame = (n = 1) => { for (let i = 0; i < n; i++) frame(); }; // render on demand when the pane is hidden

  document.addEventListener('visibilitychange', () => {
    const was = running; running = !document.hidden;
    if (running && !was) { clock.getDelta(); requestAnimationFrame(frame); }
  });

  return { state, landmarks: lm };
}
