// the bus, ambient life (birds, weather particles, leaves, smoke) and confetti
import { rnd, ri, pick, hash, moveToward } from './util.js';
import { T, W, H, SKY, SEASON, night, wet, weather, rollWeather, buildings, trees, fountain, LANE, BUS_STOP, tileX, tileY, doorOf, path, followRoute, reno, siteSpots, walkTiles } from './world.js';
import { people, leaveGroup, addVisitor } from './people.js';

// ---------- bus: climbs out of the bottom edge at the lane's curve, turns right, stops under the shelter, leaves to the right ----------
export const bus = { type: 'bus', x: LANE.c * T, y: H + 30, state: 'away', timer: rnd(20, 50), riders: [], incoming: 0, stopX: 21 * T - 4, laneY: LANE.r * T + 8, w: 24, h: 10 };
export function tickBus(dt) {
  bus.timer -= dt;
  if (bus.state === 'away' && bus.timer <= 0) { bus.state = 'rising'; bus.x = LANE.c * T + 8; bus.y = H + 30; bus.visitorRun = bus.incoming > 0; }
  if (bus.state === 'rising') { bus.y -= 40 * dt; if (bus.y <= bus.laneY) { bus.y = bus.laneY; bus.state = 'arriving'; bus.x = LANE.c * T + 2; } }
  if (bus.state === 'arriving') { bus.x += 50 * dt; if (bus.x >= bus.stopX) { bus.x = bus.stopX; bus.state = 'stopped'; bus.timer = 6; stopBus(); } }
  if (bus.state === 'stopped' && bus.timer <= 0) bus.state = 'leaving';
  if (bus.state === 'leaving') { bus.x += 50 * dt; if (bus.x > W + 10) { bus.state = 'away'; bus.timer = rnd(60, 120); } }
}
function stopBus() {
  for (const p of bus.riders) {
    if (p.visitor) { people.splice(people.indexOf(p), 1); continue; }                      // visitors ride away for good
    p.inside = null; [p.c, p.r] = BUS_STOP; p.x = tileX(p.c); p.y = tileY(p.r); p.act = 'idle'; p.desc = 'just got off the bus'; p.say = pick(['😮‍💨', '🧳', '']); p.wait = rnd(1, 4);
  }
  bus.riders = [];
  for (let i = 0; i < bus.incoming; i++) { const v = addVisitor(); [v.c, v.r] = BUS_STOP; v.x = tileX(v.c) + rnd(-2, 2); v.y = tileY(v.r); v.say = pick(['🧳', '👋', '📸']); v.wait = rnd(1, 4); }
  bus.incoming = 0;
  for (const p of people) if (p.desc === 'waiting for the bus' && !p.inside) { bus.riders.push(p); p.inside = bus; p.desc = 'riding the bus'; p.act = 'inside'; p.wait = 1e9; p.say = ''; if (p.group) leaveGroup(p); }
}
export function summonBus(withVisitors = 0) { bus.incoming += withVisitors; if (bus.state === 'away') bus.timer = 0; }

// ---------- mail: on a push, a van parks on the lane and the carrier walks the whole town, then drives off with the outgoing mail ----------
const VAN_X = 11 * T + 4, CARRIER_HOME = [19, 14];
export const van = { state: 'away', x: LANE.c * T, y: H + 30, laneY: LANE.r * T + 8, w: 16, h: 9 };
export const carrier = { name: 'mail carrier', active: false, c: 0, r: 0, x: 0, y: 0, route: [], stops: [], wait: 0, frame: 0, flip: false, say: '', act: 'walk', desc: '', shirt: '#1e3f8a', hair: '#2b1b0e', hat: true, hatColor: '#1e3f8a' };   // postal blue
export function deliverMail(pkg = null) { if (van.state !== 'away') return; van.pkg = pkg; van.state = 'rising'; van.x = LANE.c * T + 8; van.y = H + 30; }   // pkg: a building that gets one big parcel instead of the full round
function nextStop() {
  if (!carrier.stops.length) { carrier.desc = 'heading back to the van'; carrier.route = path([carrier.c, carrier.r], CARRIER_HOME) || []; carrier.leaving = true; return; }
  // greedy nearest-next tour
  carrier.stops.sort((a, b) => Math.hypot(...tileDelta(a)) - Math.hypot(...tileDelta(b)));
  const b = carrier.stops.shift(), d = doorOf(b); carrier.target = b; carrier.desc = carrier.pkg ? `hauling a big package to the ${b.type}` : `delivering to the ${b.type}`;
  carrier.route = path([carrier.c, carrier.r], d) || []; if (!carrier.route.length) { carrier.wait = 0.3; carrier.say = '✉️'; }
}
const tileDelta = b => { const d = doorOf(b); return [d[0] - carrier.c, d[1] - carrier.r]; };
export function tickMail(dt) {
  if (van.state === 'rising') { van.y -= 40 * dt; if (van.y <= van.laneY) { van.y = van.laneY; van.state = 'arriving'; van.x = LANE.c * T + 2; } }
  else if (van.state === 'arriving') { van.x += 50 * dt; if (van.x >= VAN_X + 9 * T) { van.x = VAN_X + 9 * T; van.state = 'parked'; startCarrier(); } }
  else if (van.state === 'leaving') { van.x += 50 * dt; if (van.x > W + 20) van.state = 'away'; }
  if (!carrier.active) return;
  carrier.frame += dt;
  if (carrier.route.length) return followRoute(carrier, carrier.pkg ? 16 : 28, dt, () => { if (carrier.leaving) { carrier.active = false; carrier.leaving = false; van.state = 'leaving'; return; } if (carrier.pkg) { carrier.pkg = false; carrier.wait = 1.5; carrier.say = '📦'; carrier.desc = 'dropping off the package'; } else { carrier.wait = 0.35; carrier.say = '✉️'; } });
  if ((carrier.wait -= dt) > 0) return;
  carrier.say = ''; nextStop();
}
function startCarrier() {
  [carrier.c, carrier.r] = CARRIER_HOME; carrier.x = tileX(carrier.c); carrier.y = tileY(carrier.r);
  carrier.active = true; carrier.leaving = false; carrier.pkg = !!van.pkg; carrier.stops = van.pkg ? [van.pkg] : buildings.slice(); carrier.say = van.pkg ? '📦' : '📬'; carrier.wait = 0.6; carrier.desc = van.pkg ? 'heaving a big package out of the van' : 'sorting the mail';
}

// ---------- renovations: a flatbed brings its own crew, drives over whatever it likes to the site, and takes them away again ----------
export const truck = { state: 'away', x: LANE.c * T, y: H + 30, laneY: LANE.r * T + 8, w: 20, h: 9, loaded: true, timer: 0, tx: 0, ty: 0 };
export const workers = [];
const WORKER_NAMES = ['mac', 'flo', 'ike', 'dee'];
export function startReno() {
  if (reno.active || truck.state !== 'away') return;
  reno.active = true; reno.site = pick(buildings.filter(b => b.type !== 'hall' && siteSpots(b).length >= 3)); reno.pile = 0; reno.scaffold = 0;
  const spots = siteSpots(reno.site); reno.pileTile = spots[0];
  truck.ty = (reno.site.r + reno.site.h) * T + 8; truck.tx = (reno.site.c + reno.site.w / 2) * T - truck.w / 2;       // parks on the footpath right in front
  truck.fromLeft = truck.tx < W / 2; truck.x = truck.fromLeft ? -truck.w - 4 : W + 4; truck.y = truck.ty; truck.loaded = true; truck.state = 'driving';   // arrives along that footpath from the nearer edge
}
export function endReno() { if (!reno.active) return; reno.active = false; reno.scaffold = 0; for (const w of workers) { w.state = 'board'; w.say = '👋'; w.route = path([w.c, w.r], truck.spot) || []; w.desc = 'packing up'; } }
export function tickTruck(dt) {
  if (truck.state === 'driving') { if (moveToward(truck, truck.tx, truck.ty, 40, dt)) { truck.state = 'dumping'; truck.timer = 2; } }
  else if (truck.state === 'dumping') { if ((truck.timer -= dt) <= 0) { truck.loaded = false; reno.pile = 8; truck.state = 'parked'; unloadCrew(); } }
  else if (truck.state === 'parked') { if (!reno.active && !workers.length) truck.state = 'leaving'; }
  else if (truck.state === 'leaving') { truck.x += (truck.fromLeft ? -45 : 45) * dt; truck.flip = truck.fromLeft; if (truck.x < -truck.w - 10 || truck.x > W + 20) { truck.state = 'away'; reno.site = null; reno.pile = 0; reno.scaffold = 0; } }
  for (let i = workers.length - 1; i >= 0; i--) if (tickWorker(workers[i], dt)) workers.splice(i, 1);
}
function unloadCrew() {
  const spots = siteSpots(reno.site); truck.spot = spots[Math.floor(spots.length / 2)];
  WORKER_NAMES.forEach((name, i) => { const [c, r] = truck.spot; workers.push({ name, c, r, x: tileX(c) + i - 2, y: tileY(r), route: [], state: 'haul', wait: rnd(0.5, 2) + i, frame: 0, flip: false, say: i === 0 ? '📐' : '', act: 'idle', desc: 'hopping off the truck', shirt: '#f28c28', hair: pick(['#2b1b0e', '#d8b060', '#1a1a1a']), hardhat: true }); });
}
function tickWorker(w, dt) {
  w.frame += dt;
  if (w.route.length) { followRoute(w, 18, dt, () => arriveWorker(w)); return false; }
  if ((w.wait -= dt) > 0) return false;
  if (w.state === 'board') return true;                                            // reached the truck: gone
  if (w.state === 'work') { if (Math.random() < 0.5) w.say = pick(['🔨', '🔧', '🪚', '']); w.wait = rnd(1, 3); if (Math.random() < 0.25 && reno.pile > 0) w.state = 'haul'; else return false; }
  if (w.state === 'haul') { w.act = 'walk'; w.say = ''; w.desc = 'fetching materials'; w.route = path([w.c, w.r], reno.pileTile) || []; if (!w.route.length) arriveWorker(w); return false; }
  if (w.state === 'carry') { w.act = 'walk'; const s = siteSpots(reno.site).filter(t => t[0] !== reno.pileTile[0]); w.route = path([w.c, w.r], pick(s)) || []; w.desc = 'carrying materials'; if (!w.route.length) arriveWorker(w); return false; }
  return false;
}
function arriveWorker(w) {
  if (w.state === 'board') { w.wait = 0; return; }
  if (w.state === 'haul') { if (reno.pile > 0) { reno.pile--; w.say = pick(['🪵', '🧱']); w.state = 'carry'; w.wait = 0.3; } else { w.state = 'work'; w.wait = 0.2; } return; }
  if (w.state === 'carry') { reno.scaffold = Math.min(1, reno.scaffold + 1 / 6); w.state = 'work'; w.act = 'work'; w.say = pick(['🔨', '🔧']); w.desc = `renovating the ${reno.site.type}`; w.flip = w.x > (reno.site.c + reno.site.w / 2) * T; w.wait = rnd(3, 8); return; }
}

// ---------- air drop: a plane crosses the sky and parcels drift down on parachutes; people go and collect them ----------
export const plane = { active: false, x: 0, dir: 1, drops: 0, nextDrop: 0 };
export const parcels = [];                                   // { x, y, ty, chute, taken }
export function airDrop(n = 5) { if (plane.active) return; plane.active = true; plane.dir = Math.random() < 0.5 ? 1 : -1; plane.x = plane.dir > 0 ? -20 : W + 20; plane.drops = n; plane.nextDrop = rnd(0.5, 1.2); }
export function tickAirDrop(dt) {
  if (plane.active) {
    plane.x += plane.dir * 45 * dt;
    if (plane.drops > 0 && (plane.nextDrop -= dt) <= 0 && plane.x > 20 && plane.x < W - 20) {
      const t = pick(walkTiles.filter(([c, r]) => Math.abs(tileX(c) - plane.x) < 30 && r >= 6));
      if (t) { parcels.push({ x: plane.x, y: 6, tx: tileX(t[0]), ty: tileY(t[1]), tile: t, chute: true, taken: false, sway: rnd(0, 6) }); plane.drops--; plane.nextDrop = rnd(0.6, 1.4); }
    }
    if (plane.x < -30 || plane.x > W + 30) plane.active = false;
  }
  for (const p of parcels) if (p.chute) { p.sway += dt * 3; p.x += (p.tx - p.x) * dt * 1.5 + Math.sin(p.sway) * 6 * dt; p.y += 14 * dt; if (p.y >= p.ty) { p.y = p.ty; p.x = p.tx; p.chute = false; } }
}
export function takeParcel(p) { const i = parcels.indexOf(p); if (i >= 0) parcels.splice(i, 1); }

// ---------- particles and birds ----------
export const particles = [];                                  // { k: rain|snow|leaf|petal|smoke|splash|confetti, x, y, vx, vy, t, c? }
export const birds = [];
let birdTimer = rnd(5, 15);
export function splash(x, y, n) { for (let i = 0; i < n; i++) particles.push({ k: 'splash', x, y, vx: rnd(-20, 20), vy: rnd(-40, -10), t: 0.6 }); }
export function burst(n) { for (let i = 0; i < n; i++) particles.push({ k: 'confetti', x: fountain.c * T + 8, y: fountain.r * T, vx: rnd(-40, 40), vy: rnd(-90, -30), c: `hsl(${ri(0, 359)} 80% 60%)`, t: rnd(1.5, 3) }); }
const groundHit = x => H - 2 + (hash(String(Math.floor(x))) % 30) - 15;

export function tickAmbient(dt) {
  if (performance.now() > weather.until) rollWeather();
  if ((birdTimer -= dt) <= 0 && night() < 0.5 && !wet()) { birdTimer = rnd(8, 30); const y = rnd(4, 18), dir = Math.random() < 0.5 ? 1 : -1; for (let i = 0; i < ri(1, 4); i++) birds.push({ x: dir > 0 ? -6 - i * 5 : W + 6 + i * 5, y: y + rnd(-2, 2), vx: dir * rnd(18, 26) }); }
  for (let i = birds.length - 1; i >= 0; i--) { const b = birds[i]; b.x += b.vx * dt; if (b.x < -10 || b.x > W + 10) birds.splice(i, 1); }
  const rate = weather.type === 'rain' ? 40 : weather.type === 'snow' ? 12 : 0;
  for (let i = 0; i < rate * dt * 2; i++) if (Math.random() < 0.5) particles.push(weather.type === 'rain' ? { k: 'rain', x: rnd(0, W), y: 0, vx: -10, vy: 90, t: 2 } : { k: 'snow', x: rnd(0, W), y: 0, vx: rnd(-4, 4), vy: rnd(8, 14), t: 14 });
  if ((SEASON === 'autumn' || SEASON === 'spring') && Math.random() < 0.04) { const [c, r] = pick(trees); particles.push({ k: SEASON === 'autumn' ? 'leaf' : 'petal', x: c * T + rnd(0, 8), y: r * T - 2, vx: rnd(-6, 6), vy: rnd(5, 9), t: rnd(2, 4) }); }
  for (const b of buildings) if (b.chimney && (b.lit || SEASON === 'winter') && Math.random() < 0.03) particles.push({ k: 'smoke', x: b.c * T + b.w * T - 3, y: b.r * T - 2, vx: rnd(2, 5), vy: -6, t: rnd(1.5, 3) });
  for (let i = particles.length - 1; i >= 0; i--) {
    const f = particles[i]; if (f.k === 'confetti') f.vy += 120 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.t -= dt;
    const precip = f.k === 'rain' || f.k === 'snow';
    if (f.k === 'shred') f.vy += 90 * dt;
    if (f.t < 0 || f.y > H || (precip && f.y > SKY * T && f.y > groundHit(f.x))) particles.splice(i, 1);
  }
}
