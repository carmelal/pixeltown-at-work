// the bus, ambient life (birds, weather particles, leaves, smoke) and confetti
import { rnd, ri, pick, hash } from './util.js';
import { T, W, H, SKY, SEASON, night, wet, weather, rollWeather, buildings, trees, fountain, LANE, BUS_STOP, tileX, tileY } from './world.js';
import { people, leaveGroup } from './people.js';

// ---------- bus: climbs out of the bottom edge at the lane's curve, turns right, stops under the shelter, leaves to the right ----------
export const bus = { type: 'bus', x: LANE.c * T, y: H + 30, state: 'away', timer: rnd(20, 50), riders: [], stopX: 21 * T - 4, laneY: LANE.r * T + 8, w: 24, h: 10 };
export function tickBus(dt) {
  bus.timer -= dt;
  if (bus.state === 'away' && bus.timer <= 0) { bus.state = 'rising'; bus.x = LANE.c * T; bus.y = H + 30; }
  if (bus.state === 'rising') { bus.y -= 40 * dt; if (bus.y <= bus.laneY) { bus.y = bus.laneY; bus.state = 'arriving'; bus.x = LANE.c * T - 10; } }
  if (bus.state === 'arriving') { bus.x += 50 * dt; if (bus.x >= bus.stopX) { bus.x = bus.stopX; bus.state = 'stopped'; bus.timer = 6; stopBus(); } }
  if (bus.state === 'stopped' && bus.timer <= 0) bus.state = 'leaving';
  if (bus.state === 'leaving') { bus.x += 50 * dt; if (bus.x > W + 10) { bus.state = 'away'; bus.timer = rnd(60, 120); } }
}
function stopBus() {
  for (const p of bus.riders) { p.inside = null; [p.c, p.r] = BUS_STOP; p.x = tileX(p.c); p.y = tileY(p.r); p.act = 'idle'; p.desc = 'just got off the bus'; p.say = pick(['😮‍💨', '🧳', '']); p.wait = rnd(1, 4); }
  bus.riders = [];
  for (const p of people) if (p.desc === 'waiting for the bus' && !p.inside) { bus.riders.push(p); p.inside = bus; p.desc = 'riding the bus'; p.act = 'inside'; p.wait = 1e9; p.say = ''; if (p.group) leaveGroup(p); }
}
export function summonBus() { if (bus.state === 'away') bus.timer = 0; }

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
    if (f.t < 0 || f.y > H || (precip && f.y > SKY * T && f.y > groundHit(f.x))) particles.splice(i, 1);
  }
}
