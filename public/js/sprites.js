// how everything looks. Each draw function takes the entity (and night level n / time now where needed) and paints with px().
import { clamp, hash, lerp } from './util.js';
import { T, W, H, SKY, SEASON, PAL, weather, wet, hourNow, nowDate, HEIGHTS, isOpen, pond, fountain, benches, beds, notices, LANE, BUS_STOP, BUS_WAIT, mode, reno } from './world.js';
import { ctx, px, shade, rgbn, grey, label, bubble, blit } from './canvas.js';
import { geese } from './animals.js';

// ---------- buildings ----------
const WALLS = (b, n) => ({
  house: `hsl(${b.hue} 35% ${shade(58, n)}%)`, cafe: `hsl(25 45% ${shade(50, n)}%)`, shop: `hsl(${b.hue} 40% ${shade(62, n)}%)`, office: `hsl(215 15% ${shade(50, n)}%)`, hall: `hsl(40 30% ${shade(68, n)}%)`,
  bakery: `hsl(35 60% ${shade(72, n)}%)`, library: `hsl(15 35% ${shade(42, n)}%)`, club: `hsl(270 20% ${shade(22, n)}%)`, gym: `hsl(200 25% ${shade(55, n)}%)`, museum: `hsl(45 20% ${shade(75, n)}%)`,
  clinic: `hsl(0 0% ${shade(88, n)}%)`, florist: `hsl(140 30% ${shade(60, n)}%)`, apartment: `hsl(${b.hue} 12% ${shade(52, n)}%)`,
}[b.type]);
const GRID_WINDOWS = new Set(['office', 'apartment']), NO_WINDOWS = new Set(['gym', 'clinic', 'museum', 'club']);

// facade details per type; (x, y) top-left of the facade, w/h its size
const FACADE = {
  hall(x, y, w, h, n, now, roof) {                                              // clock tower with a real clock
    px(x + w / 2 - 3, y - 7, roof, 6, 7); px(x + w / 2 - 2, y - 6, '#f4f4ee', 4, 4);
    const hr = (hourNow() % 12) / 12 * Math.PI * 2, mn = (nowDate().getMinutes() / 60) * Math.PI * 2, cx = x + w / 2, cy = y - 4;
    px(cx - 0.5 + Math.sin(hr), cy - 0.5 - Math.cos(hr), '#222'); px(cx - 0.5 + Math.sin(mn) * 1.6, cy - 0.5 - Math.cos(mn) * 1.6, '#222');
    for (let i = 0; i < Math.min(notices.length, 6); i++) { const nx = x + 2 + (i % 3) * 5, ny = y + h - 13 + Math.floor(i / 3) * 5; px(nx, ny, '#f8f6ee', 4, 4); px(nx + 1, ny + 1, '#889', 2, 1); px(nx + 1, ny + 2, '#889', 2, 1); px(nx + 1, ny, '#d33', 1, 1); }   // pinned notices
  },
  cafe(x, y, w) { px(x + 1, y + 6, '#c33', w - 2, 2); for (let i = 1; i < w - 2; i += 2) px(x + i, y + 8, '#eee', 1, 1); },
  shop(x, y, w, h, n, now, roof, b) { for (let i = 0; i < w; i += 2) px(x + i, y + 6, i % 4 ? '#eee' : `hsl(${b.hue} 70% 45%)`, 2, 2); },
  bakery(x, y, w) { for (let i = 0; i < w; i += 2) px(x + i, y + 6, i % 4 ? '#fff' : '#e8a', 2, 2); px(x + 2, y + 10, '#c84', 3, 2); px(x + w - 5, y + 10, '#c84', 3, 2); },
  club(x, y, w, h, n, now) {                                                    // the one place allowed to flash: only while open at night
    const open = isOpen('club'), hue = (now / 6) % 360;
    px(x + 1, y + 5, open ? `hsl(${hue} 90% 60%)` : '#3a3344', w - 2, 1);
    for (let i = 2; i < w - 2; i += 4) px(x + i, y + 8, open ? `hsl(${(hue + i * 40 + Math.floor(now / 250) * 90) % 360} 90% ${55 + 15 * Math.sin(now / 90 + i)}%)` : '#1a1626', 2, 2);
    if (open && Math.floor(now / 700) % 2 === 0) bubble('🎶', x + w / 2, y - 4 - (now / 300) % 3);
  },
  library(x, y, w, h, n) { for (let i = 1; i < w - 1; i += 4) px(x + i, y + 6, `hsl(15 20% ${shade(70, n)}%)`, 2, h - 8); px(x + w / 2 - 3, y + 7, '#c9a', 2, 1); px(x + w / 2 + 1, y + 7, '#9ac', 2, 1); },
  museum(x, y, w, h, n) { px(x, y + 3, `hsl(45 20% ${shade(55, n)}%)`, w, 2); px(x + 1, y + 6, `hsl(45 20% ${shade(90, n)}%)`, 2, h - 9); px(x + w - 3, y + 6, `hsl(45 20% ${shade(90, n)}%)`, 2, h - 9); px(x + w / 2 - 2, y + 5, '#c33', 4, 3); },
  clinic(x, y, w) { px(x + w / 2 - 3, y + 5, '#fff', 6, 5); px(x + w / 2 - 2, y + 5, '#d33', 1, 5); px(x + w / 2 + 1, y + 5, '#d33', 1, 5); px(x + w / 2 - 1, y + 7, '#d33', 2, 1); },   // red H
  gym(x, y, w) { px(x + 1, y + 6, '#9fd8ff', w - 2, 5); px(x + 3, y + 8, '#333', w - 6, 1); px(x + 2, y + 7, '#333', 1, 3); px(x + w - 3, y + 7, '#333', 1, 3); },
  florist(x, y, w, h, n, now, roof, b) { for (let i = 1; i < w - 1; i += 2) px(x + i, y + h - 3, ['#f7a', '#fd6', '#f55', '#fff'][(b.c * 7 + i * 3) % 4], 1, 1); px(x + 1, y + h - 2, '#6b4a2a', w - 2, 1); px(x, y + 6, '#fff', w, 1); },
  apartment(x, y, w, h, n, now, roof, b) { px(x, y + 3, `hsl(${b.hue} 12% ${shade(40, n)}%)`, w, 1); },
  house(x, y, w, h, n, now, roof, b) { if (b.hue % 2 === 0) px(x + w / 2 + 3, y + h - 3, `hsl(${b.hue} 50% 40%)`, 1, 3); },   // mailbox post
};

export function drawBuilding(b, n, now) {
  const h = (HEIGHTS[b.type] || 24) + (b.type === 'house' ? (b.hue % 3) : 0), x = b.c * T, y = (b.r + b.h) * T - h, w = b.w * T;
  const roof = PAL.snow ? `rgb(${225 - 90 * n},${228 - 90 * n},${235 - 90 * n})` : b.type === 'office' ? `hsl(215 15% ${shade(30, n)}%)` : `hsl(${(b.hue + 160) % 360} 40% ${shade(32, n)}%)`;
  px(x, y + 3, WALLS(b, n), w, h - 3);
  px(x, y, roof, w, 4);
  if (b.chimney) px(x + w - 4, y - 2, `hsl(${b.hue} 20% ${shade(35, n)}%)`, 2, 3);
  FACADE[b.type]?.(x, y, w, h, n, now, roof, b);
  const win = b.lit ? '#fff0a0' : n > 0.3 ? '#1a1c28' : '#a8dcff';
  if (GRID_WINDOWS.has(b.type)) { for (let i = 2; i < w - 1; i += 3) for (let j = 6; j < h - 4; j += 4) px(x + i, y + j, win, 2, 2); }
  else if (!NO_WINDOWS.has(b.type)) for (let i = 2; i < w - 2; i += 4) px(x + i, y + Math.max(7, h - 11), win, 2, 2);
  px(x + w / 2 - 1, y + h - 5, '#2a1a0e', 3, 5);                                     // door
  if (reno.site === b && reno.scaffold > 0) {                                        // green scaffolding, built up from the ground as materials arrive
    const pole = '#2f8f4e', plank = '#c9a060', top = y + h - Math.round((h + 3) * reno.scaffold);
    px(x - 1, top, pole, 1, y + h - top); px(x + w, top, pole, 1, y + h - top); if (w > 16) px(x + w / 2, top, pole, 1, y + h - top);
    for (let j = y + h - 4; j >= top + 1; j -= 6) { px(x - 1, j, pole, w + 2, 1); px(x - 2, j - 1, plank, Math.min(w + 4, 9), 1); }
    if (reno.scaffold >= 1) px(x - 1, y - 3, plank, w + 2, 1);
  }
}

// ---------- people ----------
// h hair, s skin, t shirt, l leg, r bike frame / rod, w wheel. Column 0 is x-1 for the plain frames; the bike frame is two wider on each side.
const PERSON = {
  stand: ['hhh', 'sss', 'sss', 'ttt', 'ttt', 'ttt', '.l.'],
  step:  ['hhh', 'sss', 'sss', 'ttt', 'ttt', 'ttt', 'l.l'],
  sit:   ['hhh', 'sss', 'sss', 'sss', 'ttt', 'ttt', 'lll'],
  fish:  ['......r.', 'hhh..r..', 'sss.r...', 'sssr....', 'ttt.....', 'ttt.....', 'ttt.....', '.ll.....'],
  bike:  ['..hhh..', '..sss..', '..sss..', '..ttt..', '..ttt..', '.rrrrr.', 'ww...ww'],
};
const SKIN = '#f1c9a5';
export function drawPerson(p, now) {
  if (p.inside) return;
  const x = Math.round(p.x) - 1, y = Math.round(p.y) - 5, moving = p.route.length > 0, step = moving && Math.floor(p.frame * 7) % 2;
  const dance = mode.current === 'gathering' && !moving ? Math.round(Math.sin(now / 120 + p.x)) : 0;
  const yy = y - Math.abs(dance);
  const pal = { h: p.hair, s: SKIN, t: p.shirt, l: '#223', r: '#c33', w: '#222' };
  if (p.bike) blit(PERSON.bike, x - 2, yy - 1, pal);
  else if (p.act === 'fish') {
    blit(PERSON.fish, x, yy - 2, { ...pal, r: '#8a6a3a' });
    const bob = Math.round(Math.sin(now / 500)); px(x + 7, yy - 1, 'rgba(200,220,255,0.6)', 1, 10 + bob); px(x + 7, yy + 9 + bob, '#e33', 1, 1);   // line and float
  }
  else if (p.act === 'sit') blit(PERSON.sit, x, yy, pal);
  else if (p.act === 'work') blit(Math.floor(p.frame * 4) % 2 ? PERSON.step : PERSON.stand, x, yy - 1, pal);
  else blit(step ? PERSON.step : PERSON.stand, x, yy - 1, pal);
  if (p.hardhat) { px(x - 1, yy - 2, '#f5c400', 5, 1); px(x, yy - 3, '#f5c400', 3, 1); }   // hard hat
  else if (p.hat || (SEASON === 'winter' && hash(p.name) % 2)) px(x - 1, yy - 2, p.hatColor || (SEASON === 'winter' ? p.shirt : '#333'), 5, 1);
  if (p.pkg) { px(x - 2, yy - 7, '#b8863b', 7, 5); px(x - 2, yy - 5, '#d9a65a', 7, 1); px(x + 1, yy - 7, '#d9a65a', 1, 5); }   // big parcel carried overhead
  bubble(p.say, x + 1.5, yy - 4, 5);
}

// ---------- dogs ----------
// Drawn facing right; mirrored when d.flip. Column 0 is the tail (x-1), body starts at column 1.
// c coat, e eye, m muzzle tip, w chest, v chest-or-spot, d spot, k collar, p pointy ear, f floppy ear, t tail, l leg
const DOG = {
  1: { stand: ['.....p.', '....fe.', 'tcdckcm', '.ccvww.', '..ll...'], step: ['.....p.', '....fe.', 'tcdckcm', '.ccvww.', '.l..l..'],
       wag:   ['.....p.', 't...fe.', '.cdckcm', '.ccvww.', '..ll...'], lie:  ['.....p.', '.cdcce.', 'tccvkcm'],                swim: ['.....p.', '.....e.', '..cckcm'] },
  2: { stand: ['......p.', '.....fe.', 'tcdcckcm', '.cccvww.', '..l.l...'], step: ['......p.', '.....fe.', 'tcdcckcm', '.cccvww.', '.l...l..'],
       wag:   ['......p.', 't....fe.', '.cdcckcm', '.cccvww.', '..l.l...'], lie:  ['......p.', '.cdccce.', 'tcccvkcm'],         swim: ['......p.', '......e.', '..ccckcm'] },
  3: { stand: ['.......p.', '......fe.', 'tcdcccccm', '.ccccdkcm', '.ccccwww.', '..l..l...'], step: ['.......p.', '......fe.', 'tcdcccccm', '.ccccdkcm', '.ccccwww.', '.l....l..'],
       wag:   ['.......p.', 't.....fe.', '.cdcccccm', '.ccccdkcm', '.ccccwww.', '..l..l...'], lie:  ['.......p.', '.cdcccce.', 'tccccvkcm'], swim: ['.......p.', '.......e.', '..cccckcm'] },
};
function dogPalette(d) {
  const tux = d.marking === 'tuxedo', spots = d.marking === 'spots', white = '#f2f2f2', dark = 'rgba(0,0,0,0.25)';
  return { c: d.coat, t: d.coat, e: '#111', m: tux ? white : d.coat, w: tux ? white : d.coat, v: tux ? white : spots ? dark : d.coat, d: spots ? dark : d.coat,
    k: d.collar || d.coat, p: d.ears === 'pointy' ? d.coat : null, f: d.ears === 'floppy' ? d.coat : null, l: tux ? white : '#222' };
}
export function drawDog(d) {
  const bw = 3 + d.size, bh = d.size === 3 ? 3 : 2, x = Math.round(d.x) - Math.floor(bw / 2), y = Math.round(d.y) - bh, moving = d.route.length > 0;
  const left = d.flip ? x - 2 : x - 1, pal = dogPalette(d), frames = DOG[d.size];
  if (d.swim) {                                                                  // head and a sliver of back above the water, with a ripple
    const wy = Math.round(d.y); blit(frames.swim, left, wy - 3, pal, d.flip);
    px(x - 1, wy, 'rgba(255,255,255,0.35)', bw + 3, 1); return bubble(d.say, x + bw / 2, wy - 5);
  }
  if (d.lying) { const ly = y + bh - 2; blit(frames.lie, left, ly - 1, pal, d.flip); return bubble(d.say, x + bw / 2, ly - 3); }
  const step = moving && Math.floor(d.frame * 10) % 2, wag = d.follow && !moving && Math.floor(d.frame * 6) % 2;
  blit(step ? frames.step : wag ? frames.wag : frames.stand, left, y - 2, pal, d.flip);
  bubble(d.say, x + bw / 2, y - 4);
}

// ---------- small animals (drawn facing right, mirrored when flipped; ox = which column sits on the entity's x) ----------
const SQUIRREL = { ox: 2, run: [['T...', 'Tbbh'], ['T..h', 'Tbb.']] };                        // T tail, b body, h head
const DUCK = { ox: 1, swim: ['..Hb', '..H.', 'gBB.'], flyUp: ['w.w.', 'BBBH'], flyDown: ['BBBH', 'w.w.'] };   // B body, g wing/speculum, H head, b bill, w wing
const GOOSE = { ox: 3, ground: ['.....nn', '.....n.', 'B....w.', '.BBBBB.', '.BBBBB.', '..f.f..'], flyUp: ['w.w..', 'BBBnn', '.....'], flyDown: ['.....', 'BBBnn', 'w.w..'] };
const BIRD = { ox: 1, up: ['w.w', '.b.'], down: ['...', 'wbw'] };
const leftOf = (rows, ox, x, flip) => flip ? x - (rows[0].length - 1 - ox) : x - ox;

export function drawSquirrel(q) {
  if (q.hidden) return; const x = Math.round(q.x), y = Math.round(q.y), step = q.route.length ? Math.floor(q.frame * 12) % 2 : 0;
  blit(SQUIRREL.run[step], leftOf(SQUIRREL.run[step], SQUIRREL.ox, x, q.flip), y - 1, { T: '#b05a28', b: '#9a4a20', h: '#9a4a20' }, q.flip);
}
export function drawDuck(d, now) {                                              // mallards: drakes with a green head and blue speculum, hens mottled brown
  const x = Math.round(d.x), y = Math.round(d.y), body = d.male ? '#8a7a66' : '#8c6a44';
  const pal = { B: body, g: d.male ? '#5a6a90' : body, w: d.male ? '#5a6a90' : body, H: d.male ? '#1f7a3a' : '#7a5a3a', b: '#e8b020' };
  if (d.air) { const rows = Math.floor(now / 170 + x / 10) % 2 ? DUCK.flyDown : DUCK.flyUp; blit(rows, leftOf(rows, DUCK.ox, x, d.flip), y - 1, pal, d.flip); }
  else blit(DUCK.swim, leftOf(DUCK.swim, DUCK.ox, x, d.flip), y - 2, pal, d.flip);
  bubble(d.say, x + 1, y - 4);
}
export function drawGoose(g, now) {
  const x = Math.round(g.x), y = Math.round(g.y), pal = { B: '#6e6358', w: '#eee', n: '#1a1a1a', f: '#333' };
  const airborne = geese.menace && g.hop && Math.hypot(g.gx - g.x, g.gy - g.y) > 4;
  if ((geese.state === 'landed' && !airborne) || geese.state === 'landing') blit(GOOSE.ground, leftOf(GOOSE.ground, GOOSE.ox, x, g.flip), y - 4, pal, g.flip);
  else { const rows = ((now / 500 + x / 20) % 1) < 0.5 ? GOOSE.flyUp : GOOSE.flyDown; blit(rows, leftOf(rows, 1, x, g.flip), y - 1, { ...pal, w: pal.B }, g.flip); }
  bubble(g.say, x, y - 6);
}
export function drawBird(b, now) { const rows = Math.floor(now / 260 + b.x / 15) % 2 ? BIRD.down : BIRD.up; blit(rows, Math.round(b.x) - 1, Math.round(b.y) - 1, { w: '#333', b: '#333' }); }

// ---------- street furniture ----------
export function drawTree(c, r, n) {
  const x = c * T, y = r * T, trunk = '#5a3b1e';
  px(x + 3, y + 1, trunk, 2, 7); px(x + 2, y + 6, trunk, 4, 2);                                   // trunk with a flared base
  if (SEASON === 'winter') { px(x + 1, y - 3, trunk, 1, 5); px(x + 6, y - 4, trunk, 1, 6); px(x - 1, y - 5, trunk, 3, 1); px(x + 6, y - 6, trunk, 3, 1); px(x + 3, y - 7, trunk, 2, 4); px(x - 1, y - 6, '#eef', 3, 1); px(x + 2, y - 8, '#eef', 4, 1); px(x + 6, y - 7, '#eef', 3, 1); return; }
  const leaf = rgbn(PAL.tree, n), dark = rgbn(PAL.tree.map(v => v * 0.75), n), light = rgbn(PAL.tree.map(v => Math.min(255, v * 1.2)), n);
  px(x - 2, y - 7, leaf, 12, 9); px(x, y - 9, leaf, 8, 2); px(x - 3, y - 5, leaf, 1, 5); px(x + 10, y - 5, leaf, 1, 5);   // rounded canopy ~14x12
  px(x + 3, y - 1, dark, 7, 3); px(x + 8, y - 5, dark, 2, 4); px(x - 1, y - 7, light, 4, 2); px(x + 1, y - 9, light, 3, 1);   // shading
  if (SEASON === 'spring') { px(x, y - 6, '#f9c', 1, 1); px(x + 5, y - 8, '#f9c', 1, 1); px(x + 8, y - 3, '#f9c', 1, 1); px(x + 2, y - 2, '#fff', 1, 1); }
  if (SEASON === 'autumn') { px(x + 1, y - 4, '#d44', 1, 1); px(x + 7, y - 7, '#e83', 1, 1); px(x + 4, y - 3, '#fb4', 1, 1); }
}
export function drawPile(tile, n) {
  if (!tile || n <= 0) return; const x = tile[0] * T, y = tile[1] * T;
  for (let i = 0; i < Math.min(n, 8); i++) px(x + (i % 4) * 2, y + 6 - Math.floor(i / 4) * 2, i % 2 ? '#c9a060' : '#a66', 2, 2);
}
export function drawTruck(v, n) {
  if (v.state === 'away') return;
  const x = Math.round(v.x), y = Math.round(v.y) - v.h, f = v.flip ? -1 : 1, cab = v.flip ? x : x + v.w - 6;   // flatbed with a cab, load (and crew) on the back until unloaded
  px(x, y + 5, '#555', v.w, 2); px(cab, y + 1, '#e8701a', 6, 6); px(v.flip ? x + 1 : x + v.w - 3, y + 2, n > 0.5 ? '#ffe28a' : '#9fd8ff', 2, 2);
  const bed = v.flip ? x + 7 : x + 1;
  if (v.loaded) { for (let i = 0; i < 6; i++) px(bed + (i % 3) * 3, y + 3 - Math.floor(i / 3) * 2, i % 2 ? '#c9a060' : '#a66', 3, 2); for (let i = 0; i < 4; i++) px(bed + 1 + i * 3, y - 2, '#f5c400', 2, 1); }   // hard hats peeking over the load
  px(x + 1, y + v.h - 2, '#444', 3, 2); px(x + v.w - 5, y + v.h - 2, '#444', 3, 2);
}
export function drawBlanket(b) {                                                 // red and white check with a basket
  const x = Math.round(b.x) - 6, y = Math.round(b.y) - 2;
  for (let i = 0; i < 12; i++) for (let j = 0; j < 5; j++) px(x + i, y + j, ((i >> 1) + (j >> 1)) % 2 ? '#e44' : '#fff', 1, 1);   // 2x2 checks
  px(x + 1, y + 1, '#8a5a2b', 3, 2); px(x + 2, y, '#b8863b', 1, 1);                                                    // basket at one corner
  px(x + 8, y + 2, '#f4f4f4', 2, 1); px(x + 8, y + 3, '#fd6', 1, 1);                                                    // a plate with something on it
}
export function drawDock(d) {                                                    // bikeshare rail with however many bikes are docked
  const x = d.c * T, y = d.r * T;
  px(x, y + 3, '#556', 8, 1); px(x, y + 2, '#556', 1, 3); px(x + 7, y + 2, '#556', 1, 3);
  for (let i = 0; i < d.bikes; i++) { px(x + 1 + i * 2, y + 5, '#222', 1, 1); px(x + 1 + i * 2, y + 4, '#c33', 1, 1); }
}
export function drawLamp(c, r, n) {
  const on = n > 0.3 || wet(), glow = Math.max(n, wet() ? 0.6 : 0);
  px(c * T + 3, r * T - 7, '#345', 1, 8); px(c * T + 2, r * T - 8, on ? '#fff3b0' : '#9ab', 3, 2);
  if (on) {                                                                      // two-step halo: a bright core and a wider soft pool on the ground
    ctx.fillStyle = `rgba(255,225,130,${0.32 * glow})`; ctx.fillRect(c * T - 2, r * T - 9, 11, 10);
    ctx.fillStyle = `rgba(255,215,120,${0.16 * glow})`; ctx.fillRect(c * T - 6, r * T - 7, 19, 16);
  }
}
export function drawShelter(n) {                                                 // glass bus shelter straddling the three waiting tiles
  const x = BUS_WAIT[0][0] * T, y = BUS_STOP[1] * T;
  px(x, y - 4, '#2d3340', 24, 2); px(x + 1, y - 2, 'rgba(160,200,230,0.35)', 22, 9); px(x, y - 2, '#2d3340', 1, 10); px(x + 23, y - 2, '#2d3340', 1, 10);
  px(x + 10, y - 7, '#2d3340', 1, 3); px(x + 9, y - 8, '#e8b020', 3, 2);
  if (n > 0.3) { ctx.fillStyle = `rgba(255,240,200,${0.18 * n})`; ctx.fillRect(x + 1, y - 2, 22, 9); }
}
export function drawBus(bus, n) {
  if (bus.state === 'away') return;
  const body = bus.visitorRun ? '#2a9d8f' : '#e8b020', trim = bus.visitorRun ? '#1f7a70' : '#c8901a';
  if (bus.state === 'rising') {                                                 // seen from behind as it climbs out of the bottom edge
    const x = Math.round(bus.x) + 2, y = Math.round(bus.y) - 14;
    px(x, y, body, 12, 14); px(x + 1, y + 1, '#9fd8ff', 10, 4); px(x + 1, y + 11, '#d33', 2, 2); px(x + 9, y + 11, '#d33', 2, 2); px(x + 4, y + 7, '#222', 4, 3);
    px(x, y + 14, '#222', 3, 1); px(x + 9, y + 14, '#222', 3, 1); return;
  }
  const x = Math.round(bus.x), y = Math.round(bus.y) - bus.h;                  // side view
  px(x, y, body, bus.w, bus.h - 2); px(x, y, trim, bus.w, 1); if (bus.visitorRun) px(x + 1, y + 6, '#f4f4f4', bus.w - 2, 1);
  for (let i = 0; i < 4; i++) px(x + 2 + i * 5, y + 2, n > 0.5 ? '#ffe28a' : '#9fd8ff', 3, 3);
  px(x + bus.w - 3, y + 2, '#9fd8ff', 2, 3);                                     // windscreen
  px(x + 1, y + bus.h - 2, '#444', 4, 2); px(x + bus.w - 6, y + bus.h - 2, '#444', 4, 2); px(x + 2, y + bus.h - 2, '#999', 2, 1); px(x + bus.w - 5, y + bus.h - 2, '#999', 2, 1);   // wheels
  px(x + 10, y + 2, bus.state === 'stopped' ? '#2a1a0e' : trim, 3, 6);     // door (open when stopped)
  if (n > 0.5) px(x + bus.w - 1, y + 5, '#ffe', 1, 1);
}

export function drawVan(v, n) {
  if (v.state === 'away') return;
  if (v.state === 'rising') { const x = Math.round(v.x) + 3, y = Math.round(v.y) - 12; px(x, y, '#f4f4f4', 10, 12); px(x, y + 4, '#d33', 10, 2); px(x + 1, y + 1, '#9fd8ff', 8, 3); px(x + 1, y + 10, '#d33', 2, 1); px(x + 7, y + 10, '#d33', 2, 1); px(x, y + 12, '#222', 3, 1); px(x + 7, y + 12, '#222', 3, 1); return; }
  const x = Math.round(v.x), y = Math.round(v.y) - v.h;                        // side view: white box van with a red stripe and a cab at the front
  px(x, y + 1, '#f4f4f4', v.w - 4, v.h - 3); px(x + v.w - 4, y + 3, '#f4f4f4', 4, v.h - 5); px(x, y + 4, '#d33', v.w - 4, 2); px(x + v.w - 3, y + 3, n > 0.5 ? '#ffe28a' : '#9fd8ff', 2, 3);
  px(x + 2, y + 2, '#1e3f8a', 3, 1); px(x + 1, y + v.h - 2, '#444', 3, 2); px(x + v.w - 5, y + v.h - 2, '#444', 3, 2); if (n > 0.5) px(x + v.w - 1, y + 6, '#ffe', 1, 1);
}

// ---------- ground and sky ----------
export function drawSky(n, now) {
  const cloudy = weather.type !== 'clear' ? 0.35 : 0;
  ctx.fillStyle = `rgb(${lerp(120, 150, cloudy) - 105 * n},${lerp(175, 160, cloudy) - 150 * n},${lerp(225, 175, cloudy) - 170 * n})`;
  ctx.fillRect(0, 0, W, SKY * T + 6);
  if (n > 0.5) for (let i = 0; i < 25; i++) px((i * 97) % W, (i * 53) % 14, '#ddd');
  px(W - 22, 3, n > 0.5 ? '#f0f0e0' : '#ffd34d', 6, 6);
  for (let i = 0; i < (weather.type === 'clear' ? 2 : 5); i++) { const cx = ((now / (900 + i * 150)) + i * 61) % (W + 40) - 20, cy = 2 + (i * 5) % 9; const c = `rgba(${235 - 70 * n},${235 - 70 * n},${240 - 70 * n},${weather.type === 'clear' ? 0.6 : 0.9})`; px(cx, cy, c, 14, 3); px(cx + 3, cy - 2, c, 7, 2); }
}
export function drawGround(n, now) {
  ctx.fillStyle = rgbn(PAL.grass, n); ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, SKY * T + 1);                                   // gently rolling skyline
  ctx.quadraticCurveTo(W * 0.15, SKY * T - 5, W * 0.32, SKY * T); ctx.quadraticCurveTo(W * 0.45, SKY * T + 3, W * 0.58, SKY * T - 1);
  ctx.quadraticCurveTo(W * 0.75, SKY * T - 6, W * 0.88, SKY * T - 1); ctx.quadraticCurveTo(W * 0.95, SKY * T + 1, W, SKY * T); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  const pathCol = PAL.snow ? `rgb(${215 - 70 * n},${212 - 70 * n},${205 - 70 * n})` : `rgb(${196 - 70 * n},${176 - 65 * n},${132 - 50 * n})`;
  for (const r of [6, 10]) { px(0, r * T + 1, pathCol, W, 6); for (let x = 1; x < W; x += 5) px(x, r * T + 2 + (x * 7) % 4, PAL.snow ? '#cdd' : `rgb(${170 - 60 * n},${150 - 55 * n},${110 - 40 * n})`, 2, 1); }   // footpaths
  px(9 * T, 7 * T, `rgb(${150 - 60 * n},${140 - 60 * n},${120 - 50 * n})`, 12 * T, 3 * T);                       // plaza
  for (let x = 0; x < W; x += 3) px(x, 13 * T, `rgba(90,70,40,${n > 0.5 ? 0.5 : 0.8})`, 2, 1);                 // park path edge
  // pond: a curved shoreline, off the left and bottom edges
  const water = PAL.snow && weather.type !== 'rain' ? `rgb(${170 - 60 * n},${200 - 70 * n},${225 - 80 * n})` : `rgb(${50 - 20 * n},${110 - 50 * n},${180 - 80 * n})`;
  const pr = pond.w * T, pt = pond.r * T;
  ctx.fillStyle = water; ctx.beginPath(); ctx.moveTo(0, pt + 2); ctx.quadraticCurveTo(pr * 0.35, pt - 2, pr * 0.6, pt + 1); ctx.quadraticCurveTo(pr - 2, pt + 3, pr, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = rgbn([120, 100, 60], n); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, pt + 1.5); ctx.quadraticCurveTo(pr * 0.35, pt - 2.5, pr * 0.6, pt + 0.5); ctx.quadraticCurveTo(pr - 2.5, pt + 2.5, pr - 0.5, H); ctx.stroke();
  if (!PAL.snow) for (let i = 0; i < 6; i++) px((i * 37 + Math.floor(now / 400)) % (pr - 10), pt + 4 + (i * 5) % 10, 'rgba(255,255,255,0.35)', 3, 1);   // ripples
  // bus lane curving up from the bottom edge, with a kerb line
  ctx.fillStyle = grey(84, n); ctx.beginPath(); ctx.moveTo(LANE.c * T, H); ctx.quadraticCurveTo(LANE.c * T, LANE.r * T, LANE.c * T + 16, LANE.r * T); ctx.lineTo(W, LANE.r * T); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = grey(150, n); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(LANE.c * T + 0.5, H); ctx.quadraticCurveTo(LANE.c * T + 0.5, LANE.r * T + 0.5, LANE.c * T + 16, LANE.r * T + 0.5); ctx.lineTo(W, LANE.r * T + 0.5); ctx.stroke();
  // plaza flowerbeds, fountain, benches
  for (const b of beds) drawBed(b, n);
  px(fountain.c * T + 1, fountain.r * T + 1, '#889', 14, 14); px(fountain.c * T + 3, fountain.r * T + 3, PAL.snow ? '#cde' : '#5ac', 10, 10);
  if (!PAL.snow) { const big = now < fountain.sprayUntil; px(fountain.c * T + 7, fountain.r * T + (big ? -4 : 3) + Math.round(Math.sin(now / 90)), '#cff', 2, big ? 11 : 4); if (big) { px(fountain.c * T + 4, fountain.r * T - 1 + Math.round(Math.sin(now / 70)), '#cff', 1, 3); px(fountain.c * T + 11, fountain.r * T - 1 + Math.round(Math.cos(now / 70)), '#cff', 1, 3); } }
  if (PAL.snow) for (let i = 0; i < 14; i++) px((i * 53 + 7) % W, 14 * T + 1 + (i * 3) % 6, i % 3 ? '#a6d' : '#c8f', 1, 1);   // crocuses here and there on the park row
  for (const [c, r] of benches) { px(c * T + 1, r * T + 4, '#6b4a2a', 6, 2); px(c * T + 1, r * T + 6, '#4a3018', 1, 1); px(c * T + 6, r * T + 6, '#4a3018', 1, 1); }
}
// a raised bed: stone border, dark soil, two staggered rows of flowers on stems (colours fixed per position, seasonal)
const BLOOMS = { spring: ['#f7a', '#fd6', '#fff', '#c9f'], summer: ['#e44', '#f80', '#fd3', '#f5a'], autumn: ['#c84', '#a63', '#e93', '#875'], winter: [] };
function drawBed(b, n) {
  const x = b.c * T, y = b.r * T, w = b.w * T;
  const watered = performance.now() < b.wateredUntil, soil = watered ? 0.7 : 1, picked = performance.now() < b.pickedUntil;
  px(x, y, grey(150, n), w, T); px(x + 1, y + 1, `rgb(${(74 - 30 * n) * soil},${(50 - 20 * n) * soil},${(32 - 12 * n) * soil})`, w - 2, T - 2);     // border and soil (darker when wet)
  if (PAL.snow) { px(x + 1, y + 1, `rgb(${225 - 70 * n},${228 - 70 * n},${235 - 70 * n})`, w - 2, 2); for (let i = 1; i < w - 1; i += 3) if ((b.c + i) % 2) px(x + i, y + 4 + (i % 2), '#a6d', 1, 1); return; }   // winter: crocuses poking through
  const cols = BLOOMS[SEASON], stem = `rgb(${40 - 15 * n},${110 - 50 * n},${50 - 20 * n})`;
  for (let i = 1; i < w - 1; i += 2) {
    const back = (i >> 1) % 2 === 0, fy = y + (back ? 2 : 4), col = cols[(b.c * 7 + i * 3) % cols.length];
    px(x + i, fy + 1, stem, 1, back ? 3 : 2); if (picked && (i >> 1) % 3 !== 1) continue;   // most blooms gone for a while after picking
    px(x + i, fy, col, 1, 1);
    if (watered) px(x + i + (i % 2 ? 1 : -1), fy, col, 1, 1);                                                  // fuller blooms for a while after watering
    if (SEASON === 'spring' && i % 3 === 0) px(x + i, fy - 1, '#fff', 1, 1);
  }
}
export function drawParticle(f) {
  if (f.k === 'rain') px(f.x, f.y, 'rgba(170,200,240,0.8)', 1, 3);
  else if (f.k === 'snow') px(f.x, f.y, '#fff');
  else if (f.k === 'smoke') px(f.x, f.y, `rgba(200,200,210,${clamp(f.t / 3, 0, 0.7)})`, 2, 2);
  else if (f.k === 'leaf') px(f.x, f.y, '#c84');
  else if (f.k === 'splash') px(f.x, f.y, 'rgba(210,235,255,0.9)');
  else if (f.k === 'petal') px(f.x, f.y, '#f9c');
  else px(f.x, f.y, f.c);
}
export function drawTints(n) {
  if (n > 0) { ctx.fillStyle = `rgba(10,12,40,${0.45 * n})`; ctx.fillRect(0, 0, W, H); }
  if (weather.type !== 'clear') { ctx.fillStyle = `rgba(60,70,90,${weather.type === 'cloudy' ? 0.12 : 0.22})`; ctx.fillRect(0, 0, W, H); }
}
