import { T, W, H, SKY, SEASON, southern, night, weather, WICON, nowDate, clock, seasonOverridden, notices, reno, statues, buildings, trees, docks, lamps, pond, LANE, BUS_STOP, mode, cursor } from './world.js';
import { cv, ctx, hi, hctx, fitOverlay, label } from './canvas.js';
import { people, tickPerson, picnics, tickPicnics, tickNotices } from './people.js';
import { dogs, tickDog, ducks, tickDucks, squirrels, tickSquirrel, geese, tickGeese, gooseAirborne } from './animals.js';
import { bus, tickBus, tickAmbient, particles, birds, van, carrier, tickMail, truck, tickTruck, workers, plane, parcels, tickAirDrop, cat, tickCat } from './town.js';
import { onEvent, connect } from './events.js';
import * as draw from './sprites.js';

const params = new URLSearchParams(location.search);
const tip = document.getElementById('tip'), bar = document.getElementById('bar');
if (params.get('dev') === 'true') bar.classList.add('dev');
bar.querySelectorAll('[data-ev]').forEach(el => el.onclick = () => { fetch('/event?type=' + el.dataset.ev + (el.dataset.msg ? '&msg=' + el.dataset.msg : '')); el.closest('details')?.removeAttribute('open'); });
document.addEventListener('click', e => { if (!bar.contains(e.target)) bar.querySelectorAll('details[open]').forEach(d => d.removeAttribute('open')); });
bar.querySelectorAll('details').forEach(d => d.addEventListener('toggle', () => { if (d.open) bar.querySelectorAll('details[open]').forEach(o => { if (o !== d) o.removeAttribute('open'); }); }));
connect(document.getElementById('conn'));

// ---------- frame ----------
const FRAME_MS = 1000 / 30;
let last = performance.now();
function frame(now) {
  if (now - last < FRAME_MS - 1) return requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if ((mode.current === 'gathering' || mode.current === 'nap') && now > mode.until) onEvent({ type: 'wake' });
  for (const p of people) tickPerson(p, dt); tickPicnics(); tickNotices();
  for (const d of dogs) tickDog(d, dt);
  for (const q of squirrels) tickSquirrel(q, dt);
  tickGeese(dt); tickDucks(dt); tickBus(dt); tickMail(dt); tickTruck(dt); tickAirDrop(dt); tickCat(dt); tickAmbient(dt);
  render(now);
  requestAnimationFrame(frame);
}

const FRONT = 1e9;
function render(now) {
  const n = night();
  ctx.clearRect(0, 0, W, H); hctx.clearRect(0, 0, hi.width, hi.height);
  draw.drawSky(n, now);
  draw.drawGround(n, now);
  const layer = [
    ...buildings.map(b => ({ y: (b.r + b.h) * T - 0.5, f: () => draw.drawBuilding(b, n, now) })),
    { y: BUS_STOP[1] * T - 0.5, f: () => draw.drawShelter(n) },
    ...(cat.state === 'inside' || cat.state === 'hidden' ? [] : [{ y: (cat.row + 3) * T - 0.4, f: () => draw.drawCat(cat, now) }]),
    ...people.map(p => ({ y: p.y, f: () => draw.drawPerson(p, now) })),
    ...dogs.map(d => ({ y: d.y, f: () => draw.drawDog(d) })),
    ...squirrels.map(q => ({ y: q.y, f: () => draw.drawSquirrel(q) })),
    ...(geese.state === 'away' ? [] : geese.birds.map(g => ({ y: (geese.state === 'landed' && !gooseAirborne(g)) || (geese.state === 'landing' && Math.abs(g.gy - g.y) < 3) ? g.y + 1 : FRONT, f: () => draw.drawGoose(g, now) }))),
    ...ducks.filter(d => !(d.air && d.air.phase === 'gone')).map(d => ({ y: d.air ? FRONT : d.y, f: () => draw.drawDuck(d, now) })),
    { y: bus.state === 'rising' ? H + 1 : bus.y + 1, f: () => draw.drawBus(bus, n) },
    { y: van.state === 'rising' ? H + 2 : van.y + 1, f: () => draw.drawVan(van, n) },
    { y: truck.y + 1, f: () => draw.drawTruck(truck, n) },
    ...(reno.pileTile ? [{ y: reno.pileTile[1] * T + 7, f: () => draw.drawPile(reno.pileTile, reno.pile) }] : []),
    ...(carrier.active ? [{ y: carrier.y, f: () => draw.drawPerson(carrier, now) }] : []),
    ...workers.map(w => ({ y: w.y, f: () => draw.drawPerson(w, now) })),
    ...parcels.map(p => ({ y: p.chute ? FRONT : p.y + 1, f: () => draw.drawParcel(p) })),
    { y: FRONT, f: () => draw.drawPlane(plane) },
    ...trees.map(([c, r]) => ({ y: r * T + 6, f: () => draw.drawTree(c, r, n) })),
    ...docks.map(d => ({ y: d.r * T + 2, f: () => draw.drawDock(d) })),
    ...picnics.map(b => ({ y: b.y - 3, f: () => draw.drawBlanket(b) })),
    ...statues.map(s => ({ y: s.tile[1] * T + 1, f: () => draw.drawStatue(s) })),
    ...lamps.map(([c, r]) => ({ y: r * T + 1, f: () => draw.drawLamp(c, r, n) })),
  ];
  layer.sort((a, b) => a.y - b.y).forEach(d => d.f());
  for (const b of birds) draw.drawBird(b, now);
  for (const f of particles) draw.drawParticle(f);
  draw.drawTints(n);
  const d = nowDate();
  label(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${WICON[weather.type]}${clock.offsetHours ? ' ⏩' : ''}${seasonOverridden() ? ' ' + SEASON : ''}`, 2, 5, 'rgba(255,255,255,0.85)', 5.5, 'left', true);
}

// ---------- hover: one list of hit targets, nearest wins, then area fallbacks ----------
function hitTargets() {
  const t = [];
  for (const p of people) if (!p.inside) t.push({ x: p.x, y: p.y + 2, r: 5, text: `${p.name}${p.visitor ? ' (visiting)' : ''} — ${p.desc}` });
  for (const d of dogs) t.push({ x: d.x, y: d.y, r: 5, text: `${d.name} (${d.temperament}) — ${d.desc}` });
  if (carrier.active) t.push({ x: carrier.x, y: carrier.y + 2, r: 5, text: `mail carrier — ${carrier.desc}` });
  for (const q of parcels) t.push({ x: q.x, y: q.y - 2, r: 5, text: q.chute ? 'parcel — coming down' : dogs.some(d => d.parcel === q) ? `parcel — ${dogs.find(d => d.parcel === q).name} is going for it` : q.claimed ? `parcel — ${q.claimed.name} is on the way` : 'parcel — waiting to be collected' });
  if (cat.state !== 'inside' && cat.state !== 'hidden') t.push({ x: cat.x, y: cat.y - 2, r: 5, text: `cat — ${cat.state === 'loaf' ? 'loafing' : 'being a cat'}` });
  for (const w of workers) t.push({ x: w.x, y: w.y + 2, r: 5, text: `${w.name} (crew) — ${w.desc}` });
  if (geese.state !== 'away') for (const g of geese.birds) t.push({ x: g.x, y: g.y, r: 5, text: `canada goose — ${geese.menace ? `${geese.check} failed; on the warpath` : geese.state === 'landed' ? `waiting on ${geese.check || 'the checks'}` : geese.state === 'leaving' ? 'leaving in a huff' : 'flying in'}` });
  for (const q of squirrels) if (!q.hidden) t.push({ x: q.x, y: q.y, r: 4, text: 'squirrel — making a run for it' });
  for (const d of ducks) if (!(d.air && d.air.phase === 'gone')) t.push({ x: d.x, y: d.y, r: 4, text: `duck — ${d.air ? 'flying' : d.scared > 0 ? 'fleeing a dog' : d.lure ? 'coming for bread' : 'paddling'}` });
  for (const s of statues) t.push({ x: s.tile[0] * T + 4, y: s.tile[1] * T + 2, r: 6, text: s.done ? `statue of ${s.sculptor.name}'s PR` : `statue — ${Math.round(s.progress * 100)}% carved` });
  for (const d of docks) t.push({ x: d.c * T + 4, y: d.r * T + 4, r: 5, text: `bikeshare — ${d.bikes} bike${d.bikes === 1 ? '' : 's'} docked` });
  return t;
}
function areaText(mx, my) {
  if (bus.state !== 'away' && mx >= bus.x && mx < bus.x + bus.w && my >= bus.y - 14 && my < bus.y + 1) return `${bus.visitorRun ? 'coach' : 'bus'} — ${bus.incoming ? `bringing ${bus.incoming} visitors` : bus.riders.length ? 'carrying ' + bus.riders.map(p => p.name).join(', ') : 'empty'}`;
  if (van.state !== 'away' && mx >= van.x && mx < van.x + van.w && my >= van.y - 12 && my < van.y + 1) return `mail van — ${van.state === 'parked' ? 'waiting for the carrier' : van.state === 'leaving' ? 'off with the outgoing mail' : 'arriving'}`;
  if (truck.state !== 'away' && mx >= truck.x && mx < truck.x + truck.w && my >= truck.y - 12 && my < truck.y + 1) return `truck — ${truck.state === 'dumping' ? 'unloading' : truck.state === 'parked' ? 'parked at the site' : truck.loaded ? 'bringing the crew' : 'heading off'}`;
  if (reno.pileTile && reno.pile > 0 && Math.hypot(reno.pileTile[0] * T + 4 - mx, reno.pileTile[1] * T + 4 - my) < 6) return `materials — ${reno.pile} left`;
  if (my >= LANE.r * T && mx >= LANE.c * T) return 'bus lane';
  if (my >= pond.r * T && mx < pond.w * T) return 'pond';
  const b = buildings.find(b => mx >= b.c * T && mx < (b.c + b.w) * T && my >= b.r * T && my < (b.r + b.h) * T);
  if (b) { const ins = people.filter(q => q.inside === b).map(q => q.name); const extra = b.type === 'hall' && notices.length ? ` — notices: ${notices.map(n => n.text).join(', ')}` : ''; return `${b.type}${ins.length ? ' — inside: ' + ins.join(', ') : ''}${extra}`; }
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
