// dogs, ducks, squirrels and geese
import { rnd, ri, pick, clamp, moveToward } from './util.js';
import { T, W, H, tileX, tileY, SEASON, hourNow, night, wet, pond, trees, walkTiles, pondSide, spotsAround, nearestTile, path, routeTo, followRoute, cursor } from './world.js';
import { people, groups, send, idle } from './people.js';
import { particles, splash, carrier } from './town.js';

// ---------- dogs ----------
// temperament drives behaviour: lazy dogs lie around, loyal ones stick to people, wild ones chase, social ones hang around chats
const DOGS = [
  { name: 'tuck', coat: '#1a1a1a', marking: 'tuxedo', size: 3, ears: 'floppy', collar: '#3b82f6', temperament: 'loyal', favourite: 'cursor', loyalty: 0.97, curiosity: 0.25, laziness: 0.05 },
  { name: 'biscuit', coat: '#c9a060', marking: 'none', size: 2, ears: 'floppy', collar: '#d33', temperament: 'lazy', loyalty: 0.3, curiosity: 0.0, laziness: 0.6 },
  { name: 'pepper', coat: '#8a8a90', marking: 'spots', size: 1, ears: 'pointy', collar: null, temperament: 'wild', loyalty: 0.3, curiosity: 0.55, laziness: 0.02 },
  { name: 'rufus', coat: '#8a5a2b', marking: 'none', size: 2, ears: 'pointy', collar: '#2a4', temperament: 'social', loyalty: 0.6, curiosity: 0.1, laziness: 0.15 },
  { name: 'olive', coat: '#e8e0d0', marking: 'spots', size: 2, ears: 'floppy', collar: '#a3d', temperament: 'lazy', loyalty: 0.5, curiosity: 0.05, laziness: 0.45 },
];
const PLAYFUL = { wild: 0.35, social: 0.3, loyal: 0.15, lazy: 0.03 };
export const dogs = DOGS.map(d => { const [c, r] = pick(walkTiles); return { ...d, play: null, playUntil: 0, c, r, x: tileX(c), y: tileY(r), route: [], wait: rnd(0, 3), follow: null, chase: null, swim: null, lying: false, say: '', flip: false, frame: 0, desc: 'sniffing around' }; });
export const nearestDog = p => dogs.slice().sort((a, b) => Math.hypot(a.c - p.c, a.r - p.r) - Math.hypot(b.c - p.c, b.r - p.r))[0];

const pondX = () => rnd(4, pond.w * T - 8), pondY = () => rnd(pond.r * T + 4, H - 4);
function startSwim(d) {
  d.chase = null; d.swim = { t: rnd(5, 10), tx: clamp(d.x + rnd(-10, 10), 4, pond.w * T - 8), ty: pondY(), back: [d.c, d.r] };
  d.say = '💦'; d.desc = 'jumped in the pond'; splash(d.swim.tx, d.swim.ty, 8);
}
function scareDucksNear(d, radius) { for (const k of ducks) if (!k.air && Math.hypot(k.x - d.x, k.y - d.y) < radius) { k.say = '🎺'; k.air = { phase: 'out', vx: k.x < d.x ? -40 : 40 }; } }
const chaseTo = (d, tile, desc) => { d.route = path([d.c, d.r], tile) || []; d.desc = desc; d.say = '❗️'; };

export function tickDog(d, dt) {
  d.frame += dt;
  if (d.swim) {                                                   // paddling about, then back to the bank tile it came from
    const sw = d.swim; sw.t -= dt;
    if (sw.t <= 0) {
      if (moveToward(d, tileX(sw.back[0]), tileY(sw.back[1]), 14, dt)) { d.swim = null; d.say = '💦'; d.desc = 'shaking off'; d.wait = rnd(2, 4); splash(d.x, d.y - 2, 6); }
      return;
    }
    if (moveToward(d, sw.tx, sw.ty, 12, dt)) { sw.tx = clamp(d.x + rnd(-12, 12), 4, pond.w * T - 8); sw.ty = pondY(); if (Math.random() < 0.3) d.say = pick(['💦', '😆', '🦆']); scareDucksNear(d, 12); }
    d.desc = 'swimming after the ducks'; return;
  }
  if (d.route.length) {
    followRoute(d, d.chase ? 44 : d.play ? 36 : 20 + d.size * 2, dt, () => { d.wait = d.chase ? 0 : d.play ? rnd(0.2, 0.6) : rnd(1, 4); });
    // mid-chase: squirrel flees when the dog gets close
    if (d.chase && d.chase.kind === 'squirrel' && !d.chase.hidden && Math.hypot(d.chase.x - d.x, d.chase.y - d.y) < 10) { hideSquirrel(d.chase); d.say = '🐿️'; d.chase = null; d.route = []; d.wait = 2.5; d.desc = 'lost the squirrel'; }
    return;
  }
  if ((d.wait -= dt) > 0) { if (d.lying && Math.random() < 0.004) d.say = d.say ? '' : '💤'; return; }
  d.say = ''; d.lying = false;
  if (d.chase) {                                              // arrived at the chase target
    if (d.chase.kind === 'ducks') { for (const k of ducks) { if (k.air) continue; k.say = '🎺'; if (Math.random() < 0.6) k.air = { phase: 'out', vx: k.x < d.x ? -40 : 40 }; else k.scared = 3; } d.say = pick(['🦆', '😤']); d.desc = 'barking at the ducks'; if (d.temperament === 'wild') return startSwim(d); }
    else if (d.chase.kind === 'geese') { if (geese.state === 'landed') { flushGeese(); d.say = '😤'; d.desc = 'scattered the geese'; if (d.temperament === 'wild' && geese.tile[0] < pond.w) return startSwim(d); } else d.desc = 'missed the geese'; }
    else if (!d.chase.hidden) { hideSquirrel(d.chase); d.say = '🐿️'; d.desc = 'lost the squirrel'; }
    d.chase = null; d.wait = rnd(2, 4); return;
  }
  // playing: two dogs take turns running at each other for a while
  if (d.play) {
    const o = d.play;
    if (performance.now() > d.playUntil || o.play !== d || o.lying) { d.play = null; if (o.play === d) o.play = null; d.say = '😮‍💨'; d.desc = 'worn out'; d.wait = rnd(3, 6); return; }
    const sp = spotsAround(o.c, o.r);
    if (sp.length && Math.hypot(o.c - d.c, o.r - d.r) > 1.2) d.route = path([d.c, d.r], pick(sp)) || [];
    else d.route = path([d.c, d.r], pick(walkTiles.filter(t => Math.hypot(t[0] - d.c, t[1] - d.r) < 4))) || [];
    if (Math.random() < 0.4) d.say = pick(['🎾', '😆', '🐾', '😛']); d.desc = `playing with ${o.name}`; d.flip = o.x < d.x; return;
  }
  if (Math.random() < PLAYFUL[d.temperament]) {
    const o = pick(dogs.filter(o => o !== d && !o.play && !o.chase && !o.lying && !o.swim && Math.hypot(o.c - d.c, o.r - d.r) < 9));
    if (o) { const until = performance.now() + rnd(8, 15) * 1000; d.play = o; o.play = d; d.playUntil = until; o.playUntil = until; o.route = []; o.wait = 0; o.follow = null; d.follow = null; o.say = '❗️'; d.say = '🎾'; d.desc = `playing with ${o.name}`; o.desc = `playing with ${d.name}`; d.wait = 0.4; return; }
  }
  // lazy dogs flop down wherever they are (more so in summer and mid-afternoon)
  const lazyNow = d.laziness * (SEASON === 'summer' ? 1.4 : 1) * (hourNow() > 13 && hourNow() < 16 ? 1.5 : 1);
  if (Math.random() < lazyNow) { d.lying = true; d.follow = null; d.desc = pick(['lying in the sun', 'having a lie down', 'not moving for anyone']); d.wait = rnd(8, 25); if (Math.random() < 0.5) d.say = '💤'; return; }
  // social dogs drift toward a chat group
  if (d.temperament === 'social' && groups.length && Math.random() < 0.4) { const g = pick(groups), m = pick(g.members), sp = spotsAround(m.c, m.r); if (sp.length) { d.follow = null; d.route = path([d.c, d.r], pick(sp)) || []; d.desc = `joining ${m.name}'s conversation`; return; } }
  // distraction: geese, squirrels or ducks
  if (Math.random() < d.curiosity) {
    if (geese.state === 'landed' && Math.random() < 0.6) { const sp = spotsAround(...geese.tile); if (sp.length) { d.chase = { kind: 'geese' }; return chaseTo(d, pick(sp), 'going for the geese'); } }
    const sq = squirrels.find(q => !q.hidden);
    if (sq) { const sp = spotsAround(sq.c, sq.r); if (sp.length) { d.chase = sq; return chaseTo(d, pick(sp), 'chasing a squirrel'); } }
    if (pondSide.length && Math.random() < 0.5) { d.chase = { kind: 'ducks' }; return chaseTo(d, pick(pondSide), 'going after the ducks'); }
  }
  // tuck follows the mouse cursor while it is over the town
  if (d.favourite === 'cursor' && cursor.active) {
    d.follow = null; d.desc = 'following the cursor';
    const best = nearestTile(cursor.x, cursor.y);
    if (best && Math.hypot(best[0] - d.c, best[1] - d.r) > 1.5) d.route = path([d.c, d.r], best) || [];
    else { d.wait = rnd(0.5, 1.5); d.flip = cursor.x < d.x; if (Math.random() < 0.25) d.say = pick(['🐾', '❤️', '🐶']); }
    return;
  }
  // following a person
  if (d.follow && (d.follow.inside || (d.follow === carrier && !carrier.active) || Math.random() > d.loyalty)) d.follow = null;
  if (!d.follow && Math.random() < 0.35) d.follow = pick([...people.filter(p => !p.inside), ...(carrier.active ? [carrier, carrier, carrier] : [])]);   // the carrier is popular
  if (d.follow) {
    const f = d.follow, sp = spotsAround(f.c, f.r);
    d.desc = `following ${f.name}`;
    if (sp.length && Math.hypot(f.c - d.c, f.r - d.r) > 1.5) d.route = path([d.c, d.r], pick(sp)) || [];
    else { d.wait = rnd(1, 3); d.flip = f.x < d.x; if (Math.random() < 0.3) d.say = pick(['🐾', '❤️']); }
    return;
  }
  d.desc = 'sniffing around'; d.route = path([d.c, d.r], pick(walkTiles)) || []; if (Math.random() < 0.2) d.say = '🐾';
}

// ---------- squirrels: live in trees, occasionally dash to another tree ----------
export const squirrels = Array.from({ length: 3 }, () => ({ kind: 'squirrel', hidden: true, wait: rnd(5, 30), tree: pick(trees), c: 0, r: 0, x: 0, y: 0, route: [], flip: false, frame: 0 }));
export function hideSquirrel(q) { q.hidden = true; q.route = []; q.wait = rnd(8, 40); q.tree = trees.slice().sort((a, b) => Math.hypot(a[0] - q.c, a[1] - q.r) - Math.hypot(b[0] - q.c, b[1] - q.r))[0]; }
export function tickSquirrel(q, dt) {
  q.frame += dt;
  if (q.hidden) {
    if ((q.wait -= dt) > 0) return;
    const from = spotsAround(...q.tree); if (!from.length) { q.wait = 5; return; }
    [q.c, q.r] = pick(from); q.x = tileX(q.c); q.y = tileY(q.r); q.hidden = false;
    const dest = pick(trees.filter(t => t !== q.tree)), to = spotsAround(...dest);
    q.route = to.length ? (path([q.c, q.r], pick(to)) || []) : []; if (!q.route.length) hideSquirrel(q);
    return;
  }
  if (q.route.length) return followRoute(q, 30, dt, () => { q.wait = rnd(0.5, 2); });
  if ((q.wait -= dt) <= 0) hideSquirrel(q);                   // pause at the foot of the tree, then climb
}

// ---------- mallards ----------
export const ducks = Array.from({ length: 4 }, (_, i) => ({ male: i % 2 === 0, air: null, scared: 0, x: (2 + i * 3) * T, y: (pond.r + 0.6 + (i % 2) * 0.7) * T, tx: 0, ty: 0, wait: rnd(0, 2), flip: false, lure: null, say: '' }));
export function tickDucks(dt) {
  const left = 2, right = pond.w * T - 4, top = pond.r * T + 2, bottom = H - 3;
  for (const d of ducks) {
    if (d.lure && d.lure.desc !== 'feeding the ducks') d.lure = null;
    if (d.air) {                                                   // in flight: climb and leave, wait out of sight, glide back in and land
      const a = d.air;
      if (a.phase === 'out') { d.x += a.vx * dt; d.y -= 26 * dt; d.flip = a.vx < 0; if (d.x < -12 || d.x > W + 12 || d.y < 2) { a.phase = 'gone'; a.t = rnd(12, 35); } }
      else if (a.phase === 'gone') { if ((a.t -= dt) <= 0) { a.phase = 'back'; d.x = Math.random() < 0.5 ? -8 : W + 8; d.y = rnd(4, 12); d.tx = rnd(4, pond.w * T - 8); d.ty = rnd(pond.r * T + 3, H - 4); } }
      else if (moveToward(d, d.tx, d.ty, 34, dt, 1.5)) { d.air = null; d.say = '💦'; d.wait = 1; }
      continue;
    }
    if (d.scared > 0) { d.scared -= dt; d.lure = null; if (d.wait > 0.3) d.wait = 0.3; }
    if ((d.wait -= dt) <= 0) {
      d.say = Math.random() < 0.12 ? '🎺' : '';
      if (d.lure) { d.tx = clamp(d.lure.x + rnd(-6, 6), left, right); d.ty = clamp(d.lure.y + rnd(-4, 4), top, bottom); }
      else { d.tx = rnd(left, right); d.ty = rnd(top, bottom); }
      d.wait = rnd(1.5, 4);
    }
    if (Math.hypot(d.tx - d.x, d.ty - d.y) > 0.5) moveToward(d, d.tx, d.ty, d.scared > 0 ? 22 : d.lure ? 10 : 4, dt, 0.5);
  }
}

// ---------- canada geese: a V flies over now and then; sometimes the flock lands in the park, hisses at anyone close, leaves when a dog shows up ----------
export const geese = { state: 'away', timer: rnd(20, 60), birds: [], dir: 1, tile: null, landing: false };
const landingTiles = () => walkTiles.filter(([c, r]) => r === 14 && c >= 3 && c <= 12);
export function spawnGeese(forceLanding = false) {
  geese.dir = Math.random() < 0.5 ? 1 : -1; geese.landing = forceLanding || Math.random() < 0.55; geese.state = 'flying';
  const n = ri(4, 7), y0 = rnd(5, 10), x0 = geese.dir > 0 ? -10 : W + 10;
  geese.birds = Array.from({ length: n }, (_, i) => { const k = Math.ceil(i / 2), side = i % 2 ? 1 : -1; return { x: x0 - geese.dir * k * 5, y: y0 + k * 2 * (side > 0 ? 1 : 0.6), gx: 0, gy: 0, wait: 0, say: '', flip: geese.dir < 0 }; });
  if (geese.landing) { geese.tile = pick(landingTiles()); if (!geese.tile) geese.landing = false; }
}
export function flushGeese() { geese.state = 'leaving'; geese.dir = 1; for (const g of geese.birds) { g.say = '🎺'; g.flip = false; } }
export function tickGeese(dt) {
  geese.timer -= dt;
  if (geese.state === 'away') { if (geese.timer <= 0 && night() < 0.7 && !wet()) spawnGeese(); return; }
  if (geese.state === 'flying') {
    for (const g of geese.birds) g.x += geese.dir * 22 * dt;
    const lead = geese.birds[0];
    if (geese.landing && Math.abs(lead.x - tileX(geese.tile[0])) < 6) { geese.state = 'landing'; for (const g of geese.birds) { g.gx = tileX(geese.tile[0]) + rnd(-10, 10); g.gy = tileY(geese.tile[1]) + rnd(-2, 3); } return; }
    if ((geese.dir > 0 && lead.x > W + 40) || (geese.dir < 0 && lead.x < -40)) { geese.state = 'away'; geese.timer = rnd(60, 180); }
    return;
  }
  if (geese.state === 'landing') {
    let done = true; for (const g of geese.birds) if (!moveToward(g, g.gx, g.gy, 28, dt)) done = false;
    if (done) { geese.state = 'landed'; geese.timer = rnd(20, 45); for (const g of geese.birds) g.say = Math.random() < 0.4 ? '🎺' : ''; }
    return;
  }
  if (geese.state === 'landed') {
    for (const g of geese.birds) {
      if ((g.wait -= dt) <= 0) { g.gx = clamp(g.x + rnd(-6, 6), geese.tile[0] * T - 12, geese.tile[0] * T + 20); g.gy = clamp(g.y + rnd(-2, 2), 14 * T + 1, 14 * T + 7); g.wait = rnd(1, 4); g.say = Math.random() < 0.08 ? '🎺' : ''; }
      if (Math.hypot(g.gx - g.x, g.gy - g.y) > 0.5) moveToward(g, g.gx, g.gy, 6, dt, 0.5);
    }
    // hiss at people who get too close; they back off
    for (const p of people) {
      if (p.inside || p.route.length) continue;
      const g = geese.birds.find(g => Math.hypot(g.x - p.x, g.y - p.y) < 9); if (!g) continue;
      g.say = '🔪'; g.flip = p.x < g.x;
      if (p.act === 'idle' || p.act === 'fish') { p.say = '😬'; send(p, 'flee', pick(walkTiles.filter(t => Math.hypot(t[0] * T - p.x, t[1] * T - p.y) > 30)), 'getting away from the geese'); p.say = '😬'; }
    }
    if (geese.timer <= 0) flushGeese();
    return;
  }
  if (geese.state === 'leaving') { for (const g of geese.birds) { g.x += 30 * dt; g.y -= 14 * dt; if (g.y < 6) g.y = 6; } if (geese.birds[0].x > W + 40) { geese.state = 'away'; geese.timer = rnd(90, 240); } }
}
export const geeseOnGround = () => geese.state === 'landed' || geese.state === 'landing';
