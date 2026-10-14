// wiring: the frame loop, draw order, hover tooltips, dev bar
import { T, W, H, SKY, SEASON, southern, night, weather, WICON, buildings, trees, docks, lamps, pond, LANE, BUS_STOP, mode, cursor } from './world.js';
import { cv, ctx, hi, hctx, fitOverlay, label } from './canvas.js';
import { people, tickPerson } from './people.js';
import { dogs, tickDog, ducks, tickDucks, squirrels, tickSquirrel, geese, tickGeese, geeseOnGround } from './animals.js';
import { bus, tickBus, tickAmbient, particles, birds, van, carrier, tickMail } from './town.js';
import { onEvent, connect } from './events.js';
import * as draw from './sprites.js';

const params = new URLSearchParams(location.search);
const tip = document.getElementById('tip'), bar = document.getElementById('bar');
if (params.get('dev') !== 'true') bar.classList.add('hidden');
bar.querySelectorAll('[data-ev]').forEach(el => el.onclick = () => fetch('/event?type=' + el.dataset.ev));
connect(document.getElementById('conn'));

// ---------- frame ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if ((mode.current === 'gathering' || mode.current === 'nap') && now > mode.until) onEvent({ type: 'wake' });
  for (const p of people) tickPerson(p, dt);
  for (const d of dogs) tickDog(d, dt);
  for (const q of squirrels) tickSquirrel(q, dt);
  tickGeese(dt); tickDucks(dt); tickBus(dt); tickMail(dt); tickAmbient(dt);
  render(now);
  requestAnimationFrame(frame);
}

// everything on the ground is sorted by its bottom edge so nearer things cover farther ones; airborne things sort to the front
const FRONT = 1e9;
function render(now) {
  const n = night();
  ctx.clearRect(0, 0, W, H); hctx.clearRect(0, 0, hi.width, hi.height);
  draw.drawSky(n, now);
  draw.drawGround(n, now);
  const layer = [
    ...buildings.map(b => ({ y: (b.r + b.h) * T - 0.5, f: () => draw.drawBuilding(b, n, now) })),
    { y: BUS_STOP[1] * T - 0.5, f: () => draw.drawShelter(n) },
    ...people.map(p => ({ y: p.y, f: () => draw.drawPerson(p, now) })),
    ...dogs.map(d => ({ y: d.y, f: () => draw.drawDog(d) })),
    ...squirrels.map(q => ({ y: q.y, f: () => draw.drawSquirrel(q) })),
    ...(geese.state === 'away' ? [] : geese.birds.map(g => ({ y: geese.state === 'landed' || (geese.state === 'landing' && Math.abs(g.gy - g.y) < 3) ? g.y + 1 : FRONT, f: () => draw.drawGoose(g, now) }))),
    ...ducks.filter(d => !(d.air && d.air.phase === 'gone')).map(d => ({ y: d.air ? FRONT : d.y, f: () => draw.drawDuck(d, now) })),
    { y: bus.state === 'rising' ? H + 1 : bus.y + 1, f: () => draw.drawBus(bus, n) },
    { y: van.state === 'rising' ? H + 2 : van.y + 1, f: () => draw.drawVan(van, n) },
    ...(carrier.active ? [{ y: carrier.y, f: () => draw.drawPerson(carrier, now) }] : []),
    ...trees.map(([c, r]) => ({ y: r * T + 6, f: () => draw.drawTree(c, r, n) })),
    ...docks.map(d => ({ y: d.r * T + 2, f: () => draw.drawDock(d) })),
    ...lamps.map(([c, r]) => ({ y: r * T + 1, f: () => draw.drawLamp(c, r, n) })),
  ];
  layer.sort((a, b) => a.y - b.y).forEach(d => d.f());
  for (const b of birds) draw.drawBird(b, now);
  for (const f of particles) draw.drawParticle(f);
  draw.drawTints(n);
  const d = new Date();
  label(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${WICON[weather.type]}`, 2, 5, 'rgba(255,255,255,0.85)', 5.5, 'left', true);
}

// ---------- hover: one list of hit targets, nearest wins, then area fallbacks ----------
function hitTargets() {
  const t = [];
  for (const p of people) if (!p.inside) t.push({ x: p.x, y: p.y + 2, r: 5, text: `${p.name} — ${p.desc}` });
  for (const d of dogs) t.push({ x: d.x, y: d.y, r: 5, text: `${d.name} (${d.temperament}) — ${d.desc}` });
  if (carrier.active) t.push({ x: carrier.x, y: carrier.y + 2, r: 5, text: `mail carrier — ${carrier.desc}` });
  if (geese.state !== 'away') for (const g of geese.birds) t.push({ x: g.x, y: g.y, r: 5, text: `canada goose — ${geese.state === 'landed' ? 'occupying the park' : geese.state === 'leaving' ? 'leaving in a huff' : 'flying over'}` });
  for (const q of squirrels) if (!q.hidden) t.push({ x: q.x, y: q.y, r: 4, text: 'squirrel — making a run for it' });
  for (const d of ducks) if (!(d.air && d.air.phase === 'gone')) t.push({ x: d.x, y: d.y, r: 4, text: `duck — ${d.air ? 'flying' : d.scared > 0 ? 'fleeing a dog' : d.lure ? 'coming for bread' : 'paddling'}` });
  for (const d of docks) t.push({ x: d.c * T + 4, y: d.r * T + 4, r: 5, text: `bikeshare — ${d.bikes} bike${d.bikes === 1 ? '' : 's'} docked` });
  return t;
}
function areaText(mx, my) {
  if (bus.state !== 'away' && mx >= bus.x && mx < bus.x + bus.w && my >= bus.y - 14 && my < bus.y + 1) return `bus — ${bus.riders.length ? 'carrying ' + bus.riders.map(p => p.name).join(', ') : 'empty'}`;
  if (van.state !== 'away' && mx >= van.x && mx < van.x + van.w && my >= van.y - 12 && my < van.y + 1) return `mail van — ${van.state === 'parked' ? 'waiting for the carrier' : van.state === 'leaving' ? 'off with the outgoing mail' : 'arriving'}`;
  if (my >= LANE.r * T && mx >= LANE.c * T) return 'bus lane';
  if (my >= pond.r * T && mx < pond.w * T) return 'pond';
  const b = buildings.find(b => mx >= b.c * T && mx < (b.c + b.w) * T && my >= b.r * T && my < (b.r + b.h) * T);
  if (b) { const ins = people.filter(q => q.inside === b).map(q => q.name); return `${b.type}${ins.length ? ' — inside: ' + ins.join(', ') : ''}`; }
  if (my < SKY * T) return `${SEASON}, ${weather.type}${southern ? ' (southern hemisphere)' : ''}`;
  return null;
}
cv.onmousemove = e => {
  const r = cv.getBoundingClientRect(), mx = (e.clientX - r.left) * W / r.width, my = (e.clientY - r.top) * H / r.height;
  cursor.x = mx; cursor.y = my; cursor.active = true;
  let best = null, bd = 1e9;
  for (const t of hitTargets()) { const d = Math.hypot(t.x - mx, t.y - my); if (d < t.r && d < bd) { bd = d; best = t; } }
  const text = best ? best.text : areaText(mx, my);
  if (!text) { tip.style.display = 'none'; return; }
  tip.textContent = text; tip.style.display = 'block'; tip.style.left = e.clientX + 12 + 'px'; tip.style.top = e.clientY + 12 + 'px';
};
cv.onmouseleave = () => { tip.style.display = 'none'; cursor.active = false; };

fitOverlay();
requestAnimationFrame(frame);
