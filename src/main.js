import '@fontsource/lora/latin-400.css';
import '@fontsource/lora/latin-400-italic.css';
import '@fontsource/lora/latin-600.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/literata/greek-400.css';
import '@fontsource/literata/greek-400-italic.css';
import '@fontsource/literata/greek-600.css';
import '@fontsource/commissioner/greek-400.css';
import '@fontsource/commissioner/greek-500.css';
import '@fontsource/commissioner/greek-600.css';
import '@fontsource/noto-naskh-arabic/arabic-600.css';
import '@phosphor-icons/web/regular';
import './style.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { EL, PLACE_LABELS, CREDIT_NAMES } from './i18n.js';
import { TOUR, TUN, haversineKm } from './places.js';

gsap.registerPlugin(ScrollTrigger);
let lang = 'en';
const ENGLISH = {};
function captureEnglish() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { ENGLISH[el.dataset.i18n] = el.textContent.trim(); });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => { ENGLISH[el.dataset.i18nHtml] = el.innerHTML.trim(); });
  document.querySelectorAll('[data-i18n-alt]').forEach((el) => { ENGLISH[el.dataset.i18nAlt] = el.alt; });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { ENGLISH[el.dataset.i18nAria] = el.getAttribute('aria-label'); });
  ENGLISH['meta.title'] = document.title;
  ENGLISH['form.copied'] = 'Copied';
  ENGLISH['form.subject'] = 'Becoming a Mahleha partner';
  ENGLISH['tour.km'] = '{n} km from Tunis-Carthage airport';
}
function initialLang() {
  if (location.hash === '#el') return 'el';
  if (location.hash === '#en') return 'en';
  try { const saved = localStorage.getItem('mahleha-lang'); if (saved === 'el' || saved === 'en') return saved; } catch { /* no storage */ }
  return (navigator.languages || [navigator.language]).some((l) => /^el\b/i.test(l)) ? 'el' : 'en';
}
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ---------- smooth scroll ----------
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href');
  const el = id === '#top' ? document.body : $(id);
  if (!el) return;
  e.preventDefault();
  closeMenu();
  const offset = el.classList.contains('tour-mark') ? -innerHeight * 0.3 : 0;
  if (lenis) lenis.scrollTo(el, { offset, duration: 1.6 });
  else scrollTo({ top: el.getBoundingClientRect().top + scrollY + offset, behavior: 'auto' });
  if (id !== '#top' && el.id) history.replaceState(null, '', id);
}));

// ---------- 3D flight ----------
let flight = null;
let ROUTE_KM = 0;
async function startFlight() {
  try {
    const mod = await import('./flight.js');
    ROUTE_KM = mod.ROUTE_KM;
    $('#km-total').textContent = Math.round(ROUTE_KM).toLocaleString('en-US');
    flight = mod.createFlight($('#flight'), $('#labels'), { reduced });
    applyMapLabels();
  } catch (err) {
    // WebGL unavailable: the page still reads top to bottom over the navy background.
    console.warn('Flight scene disabled:', err);
    $('#flight').remove();
  }
}

// One keyframe per chapter: what the camera does when that chapter reaches the top.
const L = (o = {}) => ({ athens: 0, tunis: 0, kerkennah: 0, ...Object.fromEntries(TOUR.map((p) => [p.key, 0])), ...o });
const KEYS = {
  departure: { t: 0, overview: 0.8, focusLon: 23.6, focusLat: 37.7, ovHeight: 2.6, ovTilt: 1.1, camDist: 2.2, camHeight: 0.9, camSide: 0.5, clouds: 0, labels: L({ athens: 1 }) },
  name: { t: 0.14, overview: 0, camDist: 3.2, camHeight: 1.1, camSide: 1.1, clouds: 0.45, labels: L({ athens: 0.5 }) },
  bridge: { t: 0.32, overview: 0.7, focusLon: 16.6, focusLat: 36.6, ovHeight: 6.2, ovTilt: 0.85, clouds: 0.35, labels: L({ athens: 1, tunis: 1 }) },
  shift: { t: 0.6, overview: 0, camDist: 3.0, camHeight: 1.2, camSide: -1.0, clouds: 0.6, labels: L({ tunis: 0.6 }) },
  descent: { t: 0.86, overview: 0.2, camDist: 1.6, camHeight: 0.45, camSide: -0.3, clouds: 0.4, labels: L({ tunis: 1 }) },
  tour: { t: 1, overview: 1, focusLon: 9.6, focusLat: 35.4, ovHeight: 7.2, ovTilt: 0.7, clouds: 0, tour: 1, hop: 0, labels: L({ carthage: 1 }) },
  ...Object.fromEntries(TOUR.map((p, i) => [p.key, {
    t: 1, overview: 1, focusLon: p.lon, focusLat: p.lat, ovHeight: p.h, ovTilt: 0.85, clouds: 0, tour: 1, hop: i, near: true,
    labels: L({ [p.key]: 1 }),
  }])),
  feel: { t: 1, overview: 1, focusLon: 10.5, focusLat: 36.6, ovHeight: 3.6, ovTilt: 1.0, clouds: 0, labels: L({ tunis: 1 }) },
  gains: { t: 1, overview: 1, focusLon: 16.8, focusLat: 36.2, ovHeight: 9.5, ovTilt: 0.6, clouds: 0, labels: L({ athens: 1, tunis: 1 }) },
  pilot: { t: 1, overview: 1, focusLon: 11.2, focusLat: 34.8, ovHeight: 2.4, ovTilt: 1.0, clouds: 0, labels: L({ kerkennah: 1 }) },
  board: { t: 1, overview: 1, focusLon: 16.8, focusLat: 36.6, ovHeight: 8.5, ovTilt: 0.45, clouds: 0, labels: L({ athens: 1, tunis: 1 }) },
};

for (const k of Object.values(KEYS)) if (k.tour === undefined) k.tour = 0;

// Close-up keys keep the place clear of the card: left of it on wide screens, above it on phones.
function framed(key) {
  const { near, ...k } = KEYS[key];
  if (!near) return k;
  if (innerWidth < 900) return { ...k, focusLat: k.focusLat - k.ovHeight * 0.3 };
  // put the place in the middle of the open map between the index and the card
  const idx = $('.tour-index').getBoundingClientRect();
  const card = $('.tour-cards').getBoundingClientRect();
  const target = (idx.right + card.left) / 2;
  const dist = k.ovHeight * Math.hypot(1, k.ovTilt);
  const unitsPerPx = (2 * dist * Math.tan((42 * Math.PI) / 360)) / innerHeight;
  return { ...k, focusLon: k.focusLon + ((innerWidth / 2 - target) * unitsPerPx) / 0.8 };
}

function buildFlightTimeline() {
  if (!flight) return;
  const st = flight.state;
  if (reduced) { Object.assign(st, KEYS.gains); return; }
  Object.assign(st, structuredClone(KEYS.departure));
  const marks = [];
  $$('[data-chapter]').forEach((sec) => {
    marks.push({ el: sec, key: sec.dataset.chapter });
    $$('[data-place]', sec).forEach((a) => marks.push({ el: a, key: a.dataset.place, offset: -0.35 }));
  });
  let tl;
  const make = () => {
    tl?.scrollTrigger?.kill(); tl?.kill();
    tl = gsap.timeline({ paused: true });
    const pos = marks.map((m) => Math.max(0, m.el.getBoundingClientRect().top + scrollY + (m.offset ?? 0) * innerHeight));
    for (let i = 0; i < marks.length - 1; i++) {
      const to = framed(marks[i + 1].key);
      const from = pos[i]; const dur = Math.max(1, pos[i + 1] - from);
      const { labels, ...rest } = to;
      tl.to(st, { ...rest, duration: dur, ease: 'sine.inOut' }, from);
      tl.to(st.labels, { ...labels, duration: dur * 0.6, ease: 'none' }, from + dur * 0.4);
    }
    const end = document.documentElement.scrollHeight - innerHeight;
    tl.set({}, {}, Math.max(end, tl.duration()));
    ScrollTrigger.create({ start: 0, end, scrub: 1.4, animation: tl, invalidateOnRefresh: true });
  };
  make();
  ScrollTrigger.addEventListener('refreshInit', () => { tl?.scrollTrigger?.kill(); });
  ScrollTrigger.addEventListener('refresh', () => { if (!tl?.scrollTrigger) make(); });
}

// ---------- HUD ----------
const hud = $('.hud');
const kmEl = $('#km');
let lastKm = -1;
gsap.ticker.add(() => {
  if (!flight) return;
  const t = Math.min(1, Math.max(0, flight.state.t));
  const km = Math.round(t * ROUTE_KM);
  if (km !== lastKm) { kmEl.textContent = km.toLocaleString('en-US'); hud.style.setProperty('--p', `${t * 100}%`); lastKm = km; }
});
ScrollTrigger.create({ trigger: '.name', start: 'top 85%', endTrigger: '#board', end: 'top 30%', toggleClass: { targets: hud, className: 'is-on' } });

// ---------- nav ----------
ScrollTrigger.create({ start: 40, end: 'max', toggleClass: { targets: '.nav', className: 'is-solid' } });

// ---------- hero: Athens photo becomes the cabin window, then we're out over the sea ----------
function splitWords(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map((w) => `<span class="line" style="display:inline-block"><span>${w}</span></span>`).join(' ');
  return $$('.line > span', el);
}
captureEnglish();
const heroWords = splitWords($('.hero h1'));
if (!reduced) {
  gsap.from(heroWords, { yPercent: 110, duration: 1.2, ease: 'expo.out', stagger: 0.06, delay: 0.15 });
  gsap.from(['.hero .lede', '.hero .ctas'], { y: 24, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.1, delay: 0.55 });
  gsap.from('.window img', { scale: 1.18, duration: 2.4, ease: 'expo.out' });

  const isNarrow = innerWidth < 700;
  const win = isNarrow ? 'inset(22% 18% 22% 18% round 120px)' : 'inset(16% 36% 16% 36% round 220px)';
  gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } })
    .to('.window', { clipPath: win, ease: 'power2.inOut', duration: 0.55 }, 0)
    .to('.window img', { scale: 1.25, ease: 'none', duration: 1 }, 0)
    .to('.window', { yPercent: -30, scale: 0.6, opacity: 0, ease: 'power2.in', duration: 0.45 }, 0.55)
    .to('.hero-copy', { y: -80, opacity: 0, ease: 'power1.in', duration: 0.5 }, 0.1);
}

// ---------- name ----------
const nameEl = $('.name h2');
nameEl.innerHTML = [...nameEl.textContent].map((c) => `<span class="ch">${c}</span>`).join('');
if (!reduced) {
  gsap.timeline({ scrollTrigger: { trigger: '.name', start: 'top 80%', end: 'center center', scrub: 1 } })
    .from('.name .ch', { yPercent: 100, opacity: 0, rotate: 6, stagger: 0.05, ease: 'power3.out' }, 0)
    .from('.name .arabic', { opacity: 0, y: 30, ease: 'power2.out' }, 0.1)
    .from('.name-def', { opacity: 0, y: 30, ease: 'power2.out' }, 0.3);
  gsap.to('.name-inner', { y: -120, opacity: 0, ease: 'power1.in', scrollTrigger: { trigger: '.name', start: 'center 35%', end: 'bottom top', scrub: true } });
}

// ---------- bridge: four stops light up in order ----------
const mm = gsap.matchMedia();
if (!reduced) {
  mm.add('(min-width: 601px)', () => {
    const tl = gsap.timeline({ scrollTrigger: { trigger: '.bridge', start: 'top top', end: '+=160%', pin: '.bridge-pin', scrub: 0.8, anticipatePin: 1 } });
    $$('.stop').forEach((s, i) => tl.to(s, { opacity: 1, y: 0, duration: 1, ease: 'power2.out' }, i * 0.9));
    tl.to('.stops-rail span', { scaleX: 1, duration: 3.7, ease: 'none' }, 0);
    tl.to({}, { duration: 0.6 });
  });
  mm.add('(max-width: 600px)', () => {
    $$('.stop').forEach((s) => gsap.to(s, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', scrollTrigger: { trigger: s, start: 'top 85%' } }));
    gsap.to('.stops-rail span', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '.stops', start: 'top 70%', end: 'bottom 60%', scrub: true } });
  });
}

// ---------- shift: each line turns as you scroll ----------
const morphRows = $$('.morph li');
if (!reduced) {
  ScrollTrigger.create({
    trigger: '.shift', start: 'top top', end: 'bottom bottom',
    onUpdate: (self) => {
      const n = Math.floor(self.progress * (morphRows.length + 1.2));
      morphRows.forEach((li, i) => li.classList.toggle('is-turned', i < n));
    },
  });
}

// ---------- descent: the colour block opens, then we land ----------
if (!reduced) {
  gsap.timeline({ scrollTrigger: { trigger: '.descent', start: 'top bottom', end: 'bottom top', scrub: true } })
    .to('.descent-bg', { clipPath: 'circle(80% at 50% 50%)', ease: 'power2.inOut', duration: 0.35 }, 0.05)
    .from('.descent-line span', { yPercent: 40, opacity: 0, stagger: 0.12, ease: 'power3.out', duration: 0.25 }, 0.25)
    .to('.descent-line', { opacity: 0, y: -60, duration: 0.2 }, 0.72)
    .to('.descent-bg', { opacity: 0, duration: 0.2 }, 0.75);
}

// ---------- reveals ----------
if (!reduced) {
  $$('.story').forEach((s) => {
    gsap.fromTo($('.story-media img', s), { yPercent: -8 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: s, start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.from($('.story-copy', s), { y: 60, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: s, start: 'top 65%' } });
    gsap.from($('.story-media', s), { clipPath: 'inset(12% 12% 12% 12% round 22px)', duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: s, start: 'top 75%' } });
    const b = $('.pair-b', s);
    if (b) gsap.fromTo(b, { yPercent: 30 }, { yPercent: -10, ease: 'none', scrollTrigger: { trigger: s, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  gsap.from('.rules li', { y: 20, opacity: 0, stagger: 0.08, duration: 0.8, ease: 'expo.out', scrollTrigger: { trigger: '.rules', start: 'top 85%' } });
  gsap.from('.steps li', { y: 40, opacity: 0, stagger: 0.12, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.steps', start: 'top 80%' } });
  gsap.from('.pass', { y: 80, rotate: -2, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.pass', start: 'top 85%' } });
  gsap.fromTo('.pass-plane', { xPercent: -40 }, { xPercent: 40, ease: 'none', scrollTrigger: { trigger: '.pass', start: 'top bottom', end: 'bottom top', scrub: true } });
}

// ---------- tour: one card per place, switched by the scroll marks ----------
const tourStops = $$('.tour-stop');
const tourLinks = $$('.tour-index a');
let tourOn = 0;
function showStop(i) {
  if (i === tourOn) return;
  tourOn = i;
  tourStops.forEach((s, k) => { s.classList.toggle('is-on', k === i); s.inert = k !== i; });
  tourLinks.forEach((a, k) => { if (k === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
}
tourLinks[0]?.setAttribute('aria-current', 'true');
$$('.tour-mark').forEach((m, i) => ScrollTrigger.create({
  trigger: m, start: 'top 62%', end: 'bottom 62%',
  onToggle: (self) => { if (self.isActive) showStop(i); },
}));
ScrollTrigger.create({ trigger: '.tour-track', start: 'top bottom', end: 'bottom top', toggleClass: { targets: document.documentElement, className: 'in-tour' } });
ScrollTrigger.create({
  trigger: '.tour-marks', start: 'top 62%', end: 'bottom 62%',
  onUpdate: (self) => $('.tour-progress').style.setProperty('--p', self.progress.toFixed(4)),
});
function renderTourKm() {
  $$('[data-km]').forEach((el) => {
    const p = TOUR.find((x) => x.key === el.dataset.km);
    const km = Math.round(haversineKm(TUN, p));
    el.textContent = t('tour.km').replace('{n}', km.toLocaleString(lang === 'el' ? 'el-GR' : 'en-US'));
  });
}

// ---------- menu (tablet and phone) ----------
const menu = $('#menu');
const menuBtn = $('.menu-btn');
function closeMenu() {
  if (menu.hidden) return;
  menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.querySelector('i').className = 'ph ph-list';
  document.documentElement.classList.remove('menu-open');
}
menuBtn.addEventListener('click', () => {
  if (!menu.hidden) { closeMenu(); return; }
  menu.hidden = false; menuBtn.setAttribute('aria-expanded', 'true');
  menuBtn.querySelector('i').className = 'ph ph-x';
  document.documentElement.classList.add('menu-open');
  menu.querySelector('a').focus();
});
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { closeMenu(); menuBtn.focus(); } });
matchMedia('(min-width: 961px)').addEventListener('change', (e) => { if (e.matches) closeMenu(); });

// ---------- idle cue: after 3 s without scrolling, invite the next move ----------
const cue = $('#cue');
let idleTimer = null;
function armCue() {
  cue.classList.remove('is-on');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    const doc = document.documentElement;
    const nearEnd = scrollY > doc.scrollHeight - innerHeight * 1.8; // boarding pass and footer: nothing left to discover
    const busy = !menu.hidden || document.activeElement?.closest?.('form');
    if (!nearEnd && !busy && !document.hidden) cue.classList.add('is-on');
  }, 3000);
}
['scroll', 'wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((ev) => addEventListener(ev, armCue, { passive: true }));
document.addEventListener('visibilitychange', armCue);
cue.addEventListener('click', () => {
  const to = scrollY + innerHeight * 0.85;
  if (lenis) lenis.scrollTo(to, { duration: 1.4 }); else scrollTo({ top: to });
});
armCue();

// ---------- feel: four feelings, cycling while in view ----------
const fws = $$('.fw'); const fqs = $$('.fq');
let fi = 0; let auto = !reduced; let timer = null;
const showFeel = (i) => { fi = i; fws.forEach((b, k) => b.classList.toggle('is-on', k === i)); fqs.forEach((q, k) => q.classList.toggle('is-on', k === i)); };
fws.forEach((b, i) => b.addEventListener('click', () => { auto = false; clearInterval(timer); showFeel(i); }));
ScrollTrigger.create({
  trigger: '.feel', start: 'top 60%', end: 'bottom 40%',
  onToggle: (self) => { clearInterval(timer); if (self.isActive && auto) timer = setInterval(() => showFeel((fi + 1) % fws.length), 3400); },
});

// ---------- gains: tabs ----------
const tabs = $$('[role=tab]');
const select = (tab) => {
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
    const p = document.getElementById(t.getAttribute('aria-controls'));
    p.hidden = !on; p.classList.toggle('is-on', on);
  });
};
tabs.forEach((t, i) => {
  t.addEventListener('click', () => select(t));
  t.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return; e.preventDefault();
    const n = tabs[(i + d + tabs.length) % tabs.length]; select(n); n.focus();
  });
});

// ---------- photo credits ----------
let credits = null;
function renderCredits() {
  if (!credits) return;
  const names = CREDIT_NAMES[lang];
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  $('#credit-count').textContent = `(${Object.keys(credits).length})`;
  $('#credits').innerHTML = Object.entries(credits).map(([k, v]) =>
    `<li><a href="${esc(v.page)}" target="_blank" rel="noopener">${esc(names[k] || k)}</a> ${CREDIT_NAMES.by[lang]} ${esc(v.artist)}, ${esc(v.license)}</li>`).join('');
}
fetch('img/credits.json').then((r) => r.json()).then((c) => { credits = c; renderCredits(); }).catch(() => {});

// ---------- active section in the nav ----------
$$('.nav nav a').forEach((a) => {
  const sec = $(a.getAttribute('href'));
  if (!sec) return;
  ScrollTrigger.create({ trigger: sec, start: 'top 55%', end: 'bottom 55%', toggleClass: { targets: a, className: 'is-active' } });
});

// ---------- enquiry form: validates, then prepares an email (the page itself sends and stores nothing) ----------
const form = $('#enquiry');
const TO = 'dhiamaraouch4@gmail.com';
const t = (key) => (lang === 'el' ? EL[key] : ENGLISH[key]) ?? ENGLISH[key];
function fieldError(id, show) {
  const input = $('#f-' + id); const err = $('#e-' + id);
  input.setAttribute('aria-invalid', show ? 'true' : 'false');
  if (show) input.setAttribute('aria-describedby', 'e-' + id); else input.removeAttribute('aria-describedby');
  err.hidden = !show;
  return show;
}
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const v = Object.fromEntries(new FormData(form).entries());
  const bad = [
    fieldError('name', !v.name.trim()),
    fieldError('agency', !v.agency.trim()),
    fieldError('email', !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())),
  ];
  const first = ['name', 'agency', 'email'][bad.indexOf(true)];
  if (first) { $('#f-' + first).focus(); return; }
  const lines = [
    `${t('form.name')}: ${v.name.trim()}`,
    `${t('form.agency')}: ${v.agency.trim()}`,
    v.city.trim() ? `${t('form.city')}: ${v.city.trim()}` : '',
    `${t('form.email')}: ${v.email.trim()}`,
    v.message.trim() ? `\n${v.message.trim()}` : '',
  ].filter(Boolean);
  const subject = t('form.subject');
  const body = lines.join('\n');
  $('#form-preview').textContent = `${TO}\n${subject}\n\n${body}`;
  $('#form-done').hidden = false;
  location.href = `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});
['name', 'agency', 'email'].forEach((id) => $('#f-' + id).addEventListener('input', () => fieldError(id, false)));
$('#form-copy').addEventListener('click', async (e) => {
  const label = $('span', e.currentTarget);
  try { await navigator.clipboard.writeText($('#form-preview').textContent); label.textContent = t('form.copied'); }
  catch { const r = document.createRange(); r.selectNodeContents($('#form-preview')); const sel = getSelection(); sel.empty(); sel.addRange(r); }
});

// ---------- language ----------
function applyMapLabels() {
  $$('.map-label').forEach((el) => {
    const l = PLACE_LABELS[lang][el.dataset.place];
    if (l) el.innerHTML = l[1] ? `<strong>${l[0]}</strong><span>${l[1]}</span>` : `<strong>${l[0]}</strong>`;
  });
}
function setLang(next, { replay = false } = {}) {
  lang = next;
  document.documentElement.lang = lang;
  document.title = t('meta.title');
  $$('[data-i18n]').forEach((el) => { if (!el.closest('.hero h1')) el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  $$('[data-i18n-alt]').forEach((el) => { el.alt = t(el.dataset.i18nAlt); });
  $$('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  const h1 = $('.hero h1');
  h1.textContent = t('hero.title');
  const words = splitWords(h1);
  if (replay && !reduced) gsap.from(words, { yPercent: 110, duration: 0.9, ease: 'expo.out', stagger: 0.04 });
  applyMapLabels();
  renderTourKm();
  $$('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  renderCredits();
  try { localStorage.setItem('mahleha-lang', lang); } catch { /* storage blocked: the choice lasts for this visit */ }
  ScrollTrigger.refresh();
}
$$('.lang button').forEach((b) => b.addEventListener('click', () => { if (b.dataset.lang !== lang) setLang(b.dataset.lang, { replay: true }); }));

// Build the flight timeline once fonts and images have settled the layout.
const ready = Promise.all([document.fonts.ready, new Promise((r) => (document.readyState === 'complete' ? r() : addEventListener('load', r)))]);
renderTourKm();
const startLang = initialLang();
if (startLang !== 'en') setLang(startLang);
Promise.all([ready, startFlight()]).then(() => { if (lang !== 'en') setLang(lang); ScrollTrigger.refresh(); buildFlightTimeline(); });
