// The flight scene: real Mediterranean coastline (Natural Earth 1:50m via world-atlas),
// a route from Athens to Tunis drawn as the plane flies it, and markers for the places
// named in the Mahleha deck. Everything is driven by one `state` object that the page's
// scroll timeline writes into; this module never reads scroll position itself.
import * as THREE from 'three';
import { feature } from 'topojson-client';
import land50 from 'world-atlas/land-50m.json';
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
  for (const f of land.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) {
      for (const ring of poly) {
        const inBox = ring.some(([x, y]) => x > BBOX.w - 3 && x < BBOX.e + 3 && y > BBOX.s - 3 && y < BBOX.n + 3);
        if (!inBox) continue;
        const cl = clipRing(ring);
        if (cl.length > 2) rings.push(cl.map(toPx));
      }
    }
  }
  return { canvas: c, ctx: g, rings, W, H };
}

function landTexture(rings, W, H) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  // sea
  const sea = g.createRadialGradient(W * 0.55, H * 0.55, 0, W * 0.55, H * 0.55, W * 0.7);
  sea.addColorStop(0, '#16384c');
  sea.addColorStop(1, '#0d2231');
  g.fillStyle = sea; g.fillRect(0, 0, W, H);
  // land fill (evenodd keeps lakes as holes)
  g.beginPath();
  for (const r of rings) { g.moveTo(r[0][0], r[0][1]); for (const p of r) g.lineTo(p[0], p[1]); g.closePath(); }
  g.fillStyle = '#1b3b4f';
  g.fill('evenodd');
  // coast glow + line
  g.save();
  g.shadowColor = 'rgba(243,235,220,0.25)'; g.shadowBlur = W / 400;
  g.strokeStyle = 'rgba(243,235,220,0.42)'; g.lineWidth = Math.max(1, W / 2600);
  g.stroke();
  g.restore();
  return c;
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
      if (data[(y * W + x) * 4] > 128) { pts.push(lonToX(lon), 0.012, latToZ(lat)); seeds.push(Math.random()); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  geo.setAttribute('seed', new THREE.Float32BufferAttribute(seeds, 1));
  return geo;
}

// ---------- plane ----------
function buildPlane() {
  const g = new THREE.Group();
  const cream = new THREE.MeshStandardMaterial({ color: 0xf3ebdc, roughness: 0.45, metalness: 0.1 });
  const terra = new THREE.MeshStandardMaterial({ color: 0xb94a26, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.42, 6, 16), cream);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0.07); wingShape.lineTo(0.36, -0.06); wingShape.lineTo(0.36, -0.12); wingShape.lineTo(0, -0.05);
  wingShape.lineTo(-0.36, -0.12); wingShape.lineTo(-0.36, -0.06); wingShape.closePath();
  const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(wingShape, { depth: 0.012, bevelEnabled: false }), cream);
  wing.rotation.x = -Math.PI / 2; wing.position.set(0, -0.005, 0.02);
  g.add(wing);
  const tailShape = new THREE.Shape();
  tailShape.moveTo(0, 0.02); tailShape.lineTo(0.13, -0.05); tailShape.lineTo(0.13, -0.08); tailShape.lineTo(0, -0.05);
  tailShape.lineTo(-0.13, -0.08); tailShape.lineTo(-0.13, -0.05); tailShape.closePath();
  const tail = new THREE.Mesh(new THREE.ExtrudeGeometry(tailShape, { depth: 0.01, bevelEnabled: false }), cream);
  tail.rotation.x = -Math.PI / 2; tail.position.set(0, 0.005, 0.24);
  g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.09, 0.09), terra);
  fin.position.set(0, 0.05, 0.25); fin.rotation.x = -0.35;
  g.add(fin);
  g.scale.setScalar(0.85);
  return g;
}

function glowTexture(inner = 'rgba(255,255,255,1)') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, inner); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- scene ----------
export function createFlight(canvas, labelLayer, { reduced = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x0d2231, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0d2231, 9, 26);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 80);

  scene.add(new THREE.HemisphereLight(0xf3ebdc, 0x0d2231, 1.4));
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.2);
  sun.position.set(-4, 6, 3); scene.add(sun);

  // Land plane
  const pxPerDeg = Math.min(110, renderer.capabilities.maxTextureSize / ((BBOX.e - BBOX.w) * KX));
  const { rings, W, H } = buildLandCanvas(pxPerDeg);
  const tex = new THREE.CanvasTexture(landTexture(rings, W, H));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const mapW = (BBOX.e - BBOX.w) * KX; const mapH = BBOX.n - BBOX.s;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(mapW, mapH), new THREE.MeshBasicMaterial({ map: tex }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(lonToX((BBOX.w + BBOX.e) / 2), 0, latToZ((BBOX.s + BBOX.n) / 2));
  scene.add(ground);

  // Halftone land dots
  const dotGeo = landDots(rings, W, H, pxPerDeg);
  const dotMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() }, uColor: { value: new THREE.Color(0xf3ebdc) } },
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
  const routeMat = new THREE.LineDashedMaterial({ color: 0xe6a83a, dashSize: 0.07, gapSize: 0.06, transparent: true, opacity: 0.95 });
  const route = new THREE.Line(routeGeo, routeMat);
  route.computeLineDistances();
  routeGeo.setDrawRange(0, 0);
  scene.add(route);
  // faint ghost of the full route so the destination reads before we arrive
  const ghost = new THREE.Line(routeGeo.clone(), new THREE.LineDashedMaterial({ color: 0xf3ebdc, dashSize: 0.03, gapSize: 0.09, transparent: true, opacity: 0.18 }));
  ghost.computeLineDistances(); scene.add(ghost);

  // Ground shadow of the route
  const shadowPts = routePts.map((p) => new THREE.Vector3(p.x, 0.01, p.z));
  const shadowGeo = new THREE.BufferGeometry().setFromPoints(shadowPts);
  const shadow = new THREE.Line(shadowGeo, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
  scene.add(shadow);

  // Plane
  const plane = buildPlane();
  scene.add(plane);
  const trailGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(230,168,58,0.9)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  trailGlow.scale.setScalar(0.5); scene.add(trailGlow);

  // Markers
  const ringTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.stroke();
    const t = new THREE.CanvasTexture(c); return t;
  })();
  const markers = {};
  const COLORS = { athens: 0xe6a83a, tunis: 0xd0582f, kerkennah: 0xd0582f };
  const ALL = { ...PLACES };
  for (const p of TOUR) ALL[p.key] = { ...p, label: p.key, sub: '', tour: true };
  for (const [key, p] of Object.entries(ALL)) {
    const pos = project(p.lon, p.lat);
    const grp = new THREE.Group(); grp.position.copy(pos);
    const r0 = p.tour ? 0.03 : 0.06;
    const dot = new THREE.Mesh(new THREE.CircleGeometry(r0, 24), new THREE.MeshBasicMaterial({ color: COLORS[key] ?? 0xe6a83a, transparent: true }));
    dot.rotation.x = -Math.PI / 2; dot.position.y = 0.02; grp.add(dot);
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(r0 * 8, r0 * 8), new THREE.MeshBasicMaterial({ map: ringTex, color: COLORS[key] ?? 0xe6a83a, transparent: true, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.021; grp.add(ring);
    scene.add(grp);
    const el = document.createElement('div');
    el.className = 'map-label';
    el.dataset.place = key;
    el.innerHTML = `<strong>${p.label}</strong><span>${p.sub}</span>`;
    labelLayer.appendChild(el);
    markers[key] = { grp, dot, ring, el, pos, tour: !!p.tour, phase: Math.random() * 6 };
  }

  // Tour path: arcs hopping from one place to the next, drawn up to state.hop.
  const SEG = 64;
  const tourPts = [];
  TOUR.forEach((p, i) => {
    if (i === 0) return;
    const a = project(TOUR[i - 1].lon, TOUR[i - 1].lat); const b = project(p.lon, p.lat);
    const lift = Math.max(0.12, a.distanceTo(b) * 0.35);
    for (let j = i === 1 ? 0 : 1; j <= SEG; j++) {
      const u = j / SEG;
      const v = a.clone().lerp(b, u); v.y = 0.03 + Math.sin(Math.PI * u) * lift;
      tourPts.push(v);
    }
  });
  const tourGeo = new THREE.BufferGeometry().setFromPoints(tourPts);
  const tourMat = new THREE.LineBasicMaterial({ color: 0xe6a83a, transparent: true, opacity: 0 });
  const tourLine = new THREE.Line(tourGeo, tourMat);
  tourGeo.setDrawRange(0, 0); scene.add(tourLine);
  const tourGhostMat = new THREE.LineDashedMaterial({ color: 0xf3ebdc, dashSize: 0.02, gapSize: 0.03, transparent: true, opacity: 0 });
  const tourGhost = new THREE.Line(tourGeo.clone(), tourGhostMat);
  tourGhost.computeLineDistances(); scene.add(tourGhost);
  const tourHead = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(230,168,58,1)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  tourHead.scale.setScalar(0.22); scene.add(tourHead);
  const headPos = new THREE.Vector3();

  // Clouds: soft sprites layered at cruising height
  const cloudTex = glowTexture('rgba(243,235,220,0.55)');
  const clouds = [];
  for (let i = 0; i < 60; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, opacity: 0 }));
    const u = Math.random();
    const base = curve.getPoint(u);
    s.position.set(base.x + (Math.random() - 0.5) * 5, base.y - 0.2 + Math.random() * 0.5, base.z + (Math.random() - 0.5) * 3);
    const sc = 0.8 + Math.random() * 1.8; s.scale.set(sc * 1.8, sc, 1);
    s.userData = { o: 0.25 + Math.random() * 0.35, drift: 0.02 + Math.random() * 0.04 };
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
  };

  const tmp = new THREE.Vector3(); const tan = new THREE.Vector3();
  const chasePos = new THREE.Vector3(); const chaseLook = new THREE.Vector3();
  const ovPos = new THREE.Vector3(); const ovLook = new THREE.Vector3();
  const camPos = new THREE.Vector3(); const camLook = new THREE.Vector3();
  let first = true;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  if (!reduced) window.addEventListener('pointermove', (e) => { pointer.x = e.clientX / innerWidth - 0.5; pointer.y = e.clientY / innerHeight - 0.5; }, { passive: true });

  function resize() {
    const w = canvas.clientWidth; const h = canvas.clientHeight;
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
    plane.rotateY(Math.PI); // model nose points -z
    plane.rotateZ(Math.sin(time * 0.7) * 0.05 - (t > 0.02 && t < 0.98 ? 0.1 : 0));
    trailGlow.position.copy(plane.position);
    trailGlow.material.opacity = t > 0.001 && t < 0.999 ? 0.5 : 0;
    routeGeo.setDrawRange(0, Math.floor(t * N) + 1);
    plane.visible = t < 0.999;

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
    pointer.sx += (pointer.x - pointer.sx) * 0.04; pointer.sy += (pointer.y - pointer.sy) * 0.04;
    targetPos.x += pointer.sx * 0.35; targetPos.y += -pointer.sy * 0.2;
    if (first) { camPos.copy(targetPos); camLook.copy(targetLook); first = false; }
    camPos.lerp(targetPos, reduced ? 1 : 0.08);
    camLook.lerp(targetLook, reduced ? 1 : 0.08);
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    // clouds
    for (const c of clouds) {
      // fade clouds that drift right in front of the lens so text stays readable
      const near = THREE.MathUtils.smoothstep(c.position.distanceTo(camera.position), 0.8, 2.6);
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
      const gate = m.tour ? state.tour : 1 - 0.85 * state.tour;
      m.dot.material.opacity = (0.5 + vis * 0.5) * gate;
      m.ring.material.opacity *= gate;
      const sp = m.pos.clone(); sp.y = 0.05; sp.project(camera);
      const onScreen = sp.z < 1 && Math.abs(sp.x) < 1.1 && Math.abs(sp.y) < 1.1;
      m.el.style.opacity = onScreen ? vis : 0;
      m.el.style.transform = `translate(${(sp.x * 0.5 + 0.5) * w}px, ${(-sp.y * 0.5 + 0.5) * h}px)`;
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

    dotMat.uniforms.uTime.value = time;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    const was = running; running = !document.hidden;
    if (running && !was) { clock.getDelta(); requestAnimationFrame(frame); }
  });

  return { state };
}
