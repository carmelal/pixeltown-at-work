import { rnd, ri, pick, key } from './util.js';

export const T = 8, COLS = 30, ROWS = 17, W = COLS * T, H = ROWS * T;
export const SKY = 2;
export const tileX = c => c * T + 4, tileY = r => r * T + 4;

// ---------- time, season, weather ----------
export const clock = { offsetHours: 0 };
export const nowDate = () => new Date(Date.now() + clock.offsetHours * 3600000);
export const hourNow = () => { const d = nowDate(); return d.getHours() + d.getMinutes() / 60; };
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
export const southern = /^(Australia|Pacific\/(Auckland|Fiji|Tongatapu|Chatham|Port_Moresby)|America\/(Sao_Paulo|Argentina|Buenos_Aires|Santiago|Montevideo|Lima|La_Paz|Asuncion)|Africa\/(Johannesburg|Maputo|Harare|Windhoek|Lusaka|Gaborone)|Antarctica|Indian\/(Mauritius|Reunion))/.test(TZ);
function seasonFor(d) { let m = d.getMonth(); if (southern) m = (m + 6) % 12; return m === 11 || m < 2 ? 'winter' : m < 5 ? 'spring' : m < 8 ? 'summer' : 'autumn'; }
const REAL_SEASON = seasonFor(new Date());
export let SEASON = REAL_SEASON;
const SUNS = { winter: [7.5, 17], spring: [6.5, 19.5], summer: [5.5, 21], autumn: [7, 18.5] };
let SUN = SUNS[SEASON];
export function night() { const h = hourNow(), [rise, set] = SUN; if (h < rise - 1 || h > set + 1) return 1; if (h < rise + 1) return (rise + 1 - h) / 2; if (h > set - 1) return (h - set + 1) / 2; return 0; }
const PALS = {
  spring: { grass: [92, 150, 60], tree: [70, 140, 60], snow: false },
  summer: { grass: [74, 128, 56], tree: [34, 104, 44], snow: false },
  autumn: { grass: [120, 118, 50], tree: [170, 90, 30], snow: false },
  winter: { grass: [200, 205, 215], tree: [60, 50, 40], snow: true },
};
export let PAL = PALS[SEASON];
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export function setSeason(s) { SEASON = s === 'reset' ? REAL_SEASON : s; SUN = SUNS[SEASON]; PAL = PALS[SEASON]; if (SEASON !== 'winter' && weather.type === 'snow') weather.type = 'rain'; if (SEASON === 'winter' && weather.type === 'rain') weather.type = 'snow'; }
export const seasonOverridden = () => SEASON !== REAL_SEASON;

export const weather = { type: 'clear', until: 0 };
export function rollWeather(force) {
  const r = Math.random();
  weather.type = force || (r < 0.45 ? 'clear' : r < 0.75 ? 'cloudy' : SEASON === 'winter' ? 'snow' : 'rain');
  weather.until = performance.now() + rnd(60, 180) * 1000;
}
rollWeather(); if (Math.random() < 0.6) weather.type = 'clear';
export const wet = () => weather.type === 'rain' || weather.type === 'snow';
export const WICON = { clear: '☀️', cloudy: '☁️', rain: '🌧️', snow: '❄️' };

// ---------- global mood (set by events) ----------
export const mode = { current: 'normal', until: 0 };
export const cursor = { x: 0, y: 0, active: false };
export const inquiry = { active: false };
export const reno = { active: false, site: null, pile: 0, pileTile: null, scaffold: 0 };   // scaffold 0..1 goes up as the crew carries materials over   // while `dev server` runs, a crew renovates one building
export const siteSpots = b => { const out = []; for (let c = b.c - 1; c <= b.c + b.w; c++) if (walkable(c, b.r + b.h)) out.push([c, b.r + b.h]); return out; };

// ---------- map ----------
const B = (type, c, r, w, hue = ri(0, 359)) => ({ type, c, r, w, h: 3, hue, lit: false, chimney: type === 'house' && Math.random() < 0.7 });
export const buildings = [
  B('office', 0, 3, 3), B('bakery', 3, 3, 2), B('house', 5, 3, 2), B('cafe', 7, 3, 3), B('apartment', 10, 3, 2), B('shop', 12, 3, 3),
  B('club', 16, 3, 2), B('office', 18, 3, 4), B('house', 22, 3, 2), B('hall', 24, 3, 4), B('clinic', 28, 3, 2),
  B('house', 0, 7, 2), B('library', 2, 7, 3), B('apartment', 5, 7, 2), B('house', 7, 7, 2), B('cafe', 21, 7, 3), B('gym', 24, 7, 2), B('house', 26, 7, 2), B('house', 28, 7, 2),
  B('shop', 0, 11, 3), B('house', 3, 11, 2), B('museum', 5, 11, 2), B('office', 8, 11, 3), B('house', 11, 11, 2), B('apartment', 13, 11, 2), B('shop', 15, 11, 3),
  B('house', 19, 11, 2), B('house', 21, 11, 2), B('office', 23, 11, 3), B('florist', 26, 11, 2), B('house', 28, 11, 2),
];
export const HEIGHTS = { house: 17, club: 16, bakery: 18, florist: 18, cafe: 20, shop: 20, gym: 20, clinic: 20, library: 22, museum: 22, hall: 26, office: 28, apartment: 30 };
export const VISITS = {
  bakery: { desc: 'buying bread', secs: [3, 7], out: ['🥐', '🥖', '🧁'], open: [7, 18] },
  library: { desc: 'reading at the library', secs: [12, 30], out: ['📚', '📖', '🤓'], open: [9, 20] },
  club: { desc: 'dancing at the club', secs: [15, 40], out: ['🕺', '💃', '🎶', '😵‍💫'], open: [21, 27] },
  gym: { desc: 'working out', secs: [10, 25], out: ['💪', '😮‍💨', '🥵'], open: [6, 22] },
  museum: { desc: 'looking at exhibits', secs: [8, 20], out: ['🖼️', '🦕', '🤔'], open: [10, 17] },
  clinic: { desc: 'at the clinic', secs: [5, 12], out: ['🩹', '💊', '😷'], open: [8, 18] },
  florist: { desc: 'picking out flowers', secs: [2, 5], out: ['💐', '🌷', '🌻'], open: [9, 18] },
};
export const facadeHeight = b => (HEIGHTS[b.type] || 24) + (b.type === 'house' ? (b.hue % 3) : 0);
export const roofY = b => (b.r + b.h) * T - facadeHeight(b);
export const isOpen = t => { const v = VISITS[t]; if (!v) return true; const h = hourNow(); return h >= v.open[0] && (h < v.open[1] || h + 24 < v.open[1]); };

export const fountain = { c: 14, r: 7, sprayUntil: 0 };
export const notices = [];
export const pond = { c: 0, r: 15, w: 14, h: 2 };
export const benches = [[11, 8], [18, 8], [2, 14], [10, 14], [15, 15], [26, 14]];
export const trees = [[14, 15], [16, 15], [17, 15], [16, 8], [12, 7], [10, 7], [19, 7], [4, 2], [9, 2], [21, 2], [27, 2]];
export const docks = [{ c: 9, r: 8, bikes: 4 }];
export const lamps = [[1, 6], [8, 6], [15, 6], [22, 6], [29, 6], [4, 10], [11, 10], [18, 10], [25, 10]];
export const beds = [{ c: 9, r: 9, w: 3 }, { c: 18, r: 9, w: 3 }, { c: 9, r: 7, w: 1 }, { c: 20, r: 7, w: 1 }].map(b => ({ ...b, wateredUntil: 0, pickedUntil: 0 }));
export const PLAZA = { c0: 9, c1: 20, r0: 7, r1: 9 };
export const FOUNTAIN_VIEWS = [[13, 9], [16, 9], [13, 6], [16, 6]];
export const LANE = { c: 18, r: 15 };
export const BUS_STOP = [22, 14], BUS_WAIT = [[21, 14], [22, 14], [23, 14]];

const blocked = new Set();
for (const b of buildings) for (let c = b.c; c < b.c + b.w; c++) for (let r = b.r; r < b.r + b.h; r++) blocked.add(key(c, r));
for (let c = 0; c < COLS; c++) { for (let r = 0; r < SKY; r++) blocked.add(key(c, r)); blocked.add(key(c, 16)); if (c >= LANE.c) blocked.add(key(c, LANE.r)); }
for (let c = 0; c < 2; c++) for (let r = 0; r < 2; r++) blocked.add(key(fountain.c + c, fountain.r + r));
for (let c = 0; c < pond.w; c++) for (let r = 0; r < pond.h; r++) blocked.add(key(pond.c + c, pond.r + r));
for (const [c, r] of trees) blocked.add(key(c, r));
for (const b of beds) for (let c = b.c; c < b.c + b.w; c++) blocked.add(key(c, b.r));

export const walkable = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && !blocked.has(key(c, r));
export const doorOf = b => [b.c + Math.floor(b.w / 2), b.r + b.h];
export const bType = t => buildings.filter(b => b.type === t);
export const spotsAround = (c, r) => [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]].filter(t => walkable(...t));
export const buildingAt = (c, r) => buildings.find(b => { const d = doorOf(b); return d[0] === c && d[1] === r; });
export const nearestTile = (x, y, tiles = walkTiles) => { let best = null, bd = 1e9; for (const t of tiles) { const d = Math.hypot(tileX(t[0]) - x, tileY(t[1]) - y); if (d < bd) { bd = d; best = t; } } return best; };

export const walkTiles = [];
{ const seen = new Set([key(13, 9)]), q = [[13, 9]]; while (q.length) { const t = q.shift(); walkTiles.push(t); for (const n of spotsAround(...t)) if (!seen.has(key(...n))) { seen.add(key(...n)); q.push(n); } } }
export const pondSide = walkTiles.filter(([c, r]) => r === 14 && c < pond.w);
export const treeSpots = () => { const [c, r] = pick(trees); return [[c, r + 1], [c - 1, r], [c + 1, r]].filter(t => walkable(...t)); };

export function path(from, to) {
  const start = key(...from), goal = key(...to); if (start === goal) return [];
  const prev = new Map([[start, null]]), q = [from];
  while (q.length) {
    const [c, r] = q.shift();
    for (const n of spotsAround(c, r)) {
      const k = key(...n); if (prev.has(k)) continue;
      prev.set(k, key(c, r));
      if (k === goal) { const out = []; let cur = k; while (cur !== start) { out.unshift(cur.split(',').map(Number)); cur = prev.get(cur); } return out; }
      q.push(n);
    }
  }
  return null;
}

export function followRoute(e, speed, dt, onArrive) {
  const [c, r] = e.route[0];
  const dx = tileX(c) - e.x, dy = tileY(r) - e.y, L = Math.hypot(dx, dy);
  if (dx) e.flip = dx < 0;
  if (L <= speed * dt) { e.x = tileX(c); e.y = tileY(r); e.c = c; e.r = r; e.route.shift(); if (!e.route.length) onArrive?.(); }
  else { e.x += dx / L * speed * dt; e.y += dy / L * speed * dt; }
}
