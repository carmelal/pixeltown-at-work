// townspeople: state, intents (what they set out to do), arrivals (what happens when they get there), chat groups
import { rnd, pick, hash, weighted } from './util.js';
import { T, tileX, tileY, SKY, SEASON, hourNow, night, weather, wet, buildings, VISITS, isOpen, benches, docks, FOUNTAIN_VIEWS, PLAZA, BUS_WAIT,
  walkable, walkTiles, pondSide, treeSpots, doorOf, bType, spotsAround, buildingAt, path, followRoute, mode } from './world.js';
import { dogs, nearestDog, ducks } from './animals.js';
import { bus } from './town.js';

export const TOPICS = ['☕️', '🍕', '🐶', '🌧️', '💻', '🎮', '📺', '🚲', '🏠', '😂', '🤔', '💸', '🎂', '✈️', '📚', '🧦'];
const NAMES = ['ada', 'bo', 'cy', 'dot', 'eli', 'fay', 'gus', 'hal', 'ivy', 'jo', 'kit', 'lou', 'mo', 'nan', 'oz', 'pip'];
export const people = [];
export const coffeeRun = { until: 0 };                       // set by the editing signal

function addPerson(name) {
  const homes = buildings.filter(b => b.type === 'house' || b.type === 'apartment'), h = hash(name), home = homes[h % homes.length], [c, r] = doorOf(home);
  const p = { name, home, c, r, x: tileX(c), y: tileY(r), route: [], act: 'idle', intent: null, data: null, say: '', wait: rnd(0, 3), inside: null,
    shirt: `hsl(${h % 360} 55% 50%)`, hair: pick(['#2b1b0e', '#5a3b1e', '#d8b060', '#1a1a1a', '#8a2a2a', '#eee']), hat: h % 4 === 0, umbrella: h % 3 !== 0,
    frame: 0, flip: false, desc: 'standing around' };
  people.push(p); return p;
}
NAMES.forEach(addPerson);
const VISITOR_NAMES = ['quinn', 'rae', 'sol', 'tam', 'uma', 'vic', 'wren', 'xan', 'yas', 'zed', 'ash', 'blu', 'cass', 'dev', 'em', 'fin'];
let visitorN = 0;
export function addVisitor() {                                               // off the bus; wanders for a while, then catches a bus out
  const v = addPerson(VISITOR_NAMES[visitorN++ % VISITOR_NAMES.length]);
  v.visitor = true; v.leaveAt = performance.now() + rnd(90, 200) * 1000; v.desc = 'just arrived'; v.shirt = `hsl(${hash(v.name) % 360} 70% 62%)`; return v;
}

// ---------- primitives ----------
export function idle(p, desc, secs = [1, 5], say = '') { p.act = 'idle'; p.desc = desc; p.wait = rnd(...secs); p.say = say; }
export function enter(p, b, secs, desc) { p.inside = b; if (b.lit !== undefined) b.lit = true; p.wait = typeof secs === 'number' ? secs : rnd(...secs); p.desc = desc; p.act = 'inside'; }
// set off toward a tile with an intent; returns false when there is no path
export function send(p, intent, tile, desc, data = null) {
  const pth = path([p.c, p.r], tile); if (!pth) return false;
  p.route = pth; p.act = 'walk'; p.intent = intent; p.data = data; p.desc = desc; p.say = ''; return true;
}
export function goHome(p, secs, desc) { if (p.visitor) return INTENTS.bench.go(p) || INTENTS.cafe.go(p); const d = doorOf(p.home); return (p.c === d[0] && p.r === d[1]) ? enter(p, p.home, secs, desc) : send(p, 'home', d, 'heading home', { secs, desc }); }
export function sendToWork(p, b = pick(bType('office')), desc = 'going to work') { return send(p, 'work', doorOf(b), desc); }
const toDoor = (p, intent, type, desc) => send(p, intent, doorOf(pick(bType(type))), desc);
const look = (p, tile, what) => send(p, 'look', tile, `going to look at ${what}`, what);

// ---------- intents: weight, optional condition, how to set off, what to do on arrival ----------
// `go` returns false if the intent cannot start right now (no path, nothing to do), and choose() then falls back to standing around
export const INTENTS = {
  walk:     { w: 18, go: p => send(p, 'walk', pick(walkTiles), 'out for a walk'),                          arrive: p => idle(p, 'standing around') },
  cafe:     { w: 12, go: p => toDoor(p, 'cafe', 'cafe', 'going for coffee'),                                arrive: (p, here) => enter(p, here, p.backTo ? [2, 4] : [3, 8], 'inside the cafe') },
  work:     { w: 12, go: p => sendToWork(p),                                                                 arrive: (p, here) => enter(p, here, [15, 40], 'at work') },
  shop:     { w: 8,  go: p => toDoor(p, 'shop', 'shop', 'running an errand'),                               arrive: (p, here) => enter(p, here, [3, 8], 'shopping') },
  bench:    { w: 10, go: p => send(p, 'bench', pick(benches), 'going to sit down'),                         arrive: p => { p.act = 'sit'; p.desc = 'sitting on a bench'; p.wait = rnd(8, 20); } },
  fountain: { w: 4,  go: p => look(p, pick(FOUNTAIN_VIEWS), 'the fountain'),                                arrive: lookArrive },
  tree:     { w: 3,  go: p => { const s = treeSpots(); return s.length && look(p, pick(s), 'a tree'); },     arrive: lookArrive },
  sky:      { w: 3,  go: p => look(p, pick(walkTiles.filter(([, r]) => r === SKY)), 'the sky'),             arrive: lookArrive },
  ducks:    { w: 5,  go: p => pondSide.length && send(p, 'ducks', pick(pondSide), 'going to feed the ducks'),
              arrive: p => { idle(p, 'feeding the ducks', [6, 12], '🍞'); p.flip = false; for (const d of ducks) d.lure = p; } },
  dog:      { w: 4,  go: p => { const d = nearestDog(p), s = spotsAround(d.c, d.r); return s.length && send(p, 'dog', pick(s), 'going to pet the dog'); },
              arrive: p => { const d = nearestDog(p); if (Math.hypot(d.c - p.c, d.r - p.r) <= 1.5) { idle(p, `petting ${d.name}`, [3, 6], '🐶'); d.say = '❤️'; d.wait = 4; d.route = []; d.follow = p; } else idle(p, 'looking for the dog', [3, 6], '🤔'); } },
  bus:      { w: 4,  when: () => bus.riders.length < 4, go: p => send(p, 'bus', pick(BUS_WAIT), 'going to catch the bus'),
              arrive: p => idle(p, 'waiting for the bus', [40, 70]) },
  visit:    { w: 7,  go: p => { const t = pick(Object.keys(VISITS).filter(isOpen)); return !!t && send(p, 'visit', doorOf(pick(bType(t))), `going to the ${t}`, t); },
              arrive: (p, here) => here && here.type === p.data ? enter(p, here, VISITS[p.data].secs, VISITS[p.data].desc) : idle(p, 'standing around') },
  fish:     { w: 4.5, when: () => SEASON !== 'winter' && pondSide.length > 0, go: p => send(p, 'fish', pick(pondSide), 'going fishing'),
              arrive: p => { p.act = 'fish'; p.desc = 'fishing'; p.wait = rnd(15, 35); p.fishT = rnd(3, 8); p.flip = false; } },
  bike:     { w: 3,  go: p => { const d = pick(docks.filter(d => d.bikes > 0)); return !!d && send(p, 'bike', [d.c, d.r], 'going to grab a bike'); }, arrive: bikeArrive },
  chat:     { w: 5.5, go: startChat,                                                                           arrive: joinChat },
  hall:     { w: 7,  go: p => toDoor(p, 'hall', 'hall', 'visiting town hall'),                               arrive: (p, here) => enter(p, here, [4, 10], 'inside town hall') },
  // intents that are only ever set directly (routine, weather, events, other actors)
  home:     { w: 0,  arrive: p => enter(p, p.home, p.data?.secs ?? rnd(10, 40), p.data?.desc ?? (night() > 0.6 ? 'asleep at home' : 'at home')) },
  shelter:  { w: 0,  arrive: p => idle(p, 'sheltering under a tree', [8, 20], '☔️') },
  gather:   { w: 0,  arrive: p => idle(p, 'at the gathering', [1, 3]) },
  flee:     { w: 0,  arrive: p => idle(p, 'catching their breath', [2, 4]) },
  ride:     { w: 0,  arrive: bikeArrive },
};
function lookArrive(p) { idle(p, `looking at ${p.data}`, [4, 8], '👀'); }
function bikeArrive(p) {
  const dock = docks.find(d => d.c === p.c && d.r === p.r);
  if (!dock) return idle(p, 'standing around');
  if (p.bike) { dock.bikes++; p.bike = false; return idle(p, 'just docked a bike', [1, 3], '🚲'); }
  if (dock.bikes > 0) {
    dock.bikes--; p.bike = true; const other = docks.find(d => d !== dock);
    if (send(p, 'ride', [other.c, other.r], 'riding a bike across town')) return;
    dock.bikes++; p.bike = false;
  }
  idle(p, 'no bikes left', [2, 4], '😕');
}

// urges that override the everyday table: [probability, condition, action]
const URGES = [
  [0.6,  () => night() > 0.6,                            p => goHome(p, [20, 60], 'asleep at home')],
  [0.45, () => hourNow() >= 8 && hourNow() < 10,          p => sendToWork(p, undefined, 'commuting to work')],
  [0.4,  () => hourNow() >= 12 && hourNow() < 13.5,       p => toDoor(p, 'cafe', 'cafe', 'going for lunch')],
  [0.35, () => hourNow() >= 17 && hourNow() < 19,         p => Math.random() < 0.5 ? toDoor(p, 'shop', 'shop', 'running an errand') : goHome(p, [10, 30], 'home for the evening')],
  [0.35, wet,                                              p => Math.random() < 0.5 ? toDoor(p, 'cafe', 'cafe', 'getting out of the ' + weather.type) : goHome(p, [10, 30], 'staying dry at home')],
  [0.1,  wet,                                              p => { const s = treeSpots(); return s.length && send(p, 'shelter', pick(s), 'going to shelter under a tree'); }],
];

export function choose(p) {
  if (p.visitor && performance.now() > p.leaveAt) { if (send(p, 'bus', pick(BUS_WAIT), 'heading for the bus home')) return; }
  if (p.urge === 'break') { p.urge = null; const ok = Math.random() < 0.65 ? INTENTS.chat.go(p) : INTENTS.ducks.go(p); if (ok !== false) { p.desc = p.desc.replace('going', 'on a break, going'); return; } }
  if (mode.current === 'gathering') { const t = [Math.floor(rnd(PLAZA.c0 + 1, PLAZA.c1)), Math.floor(rnd(PLAZA.r0 + 1, PLAZA.r1 + 1))]; if (walkable(...t)) send(p, 'gather', t, 'heading to the gathering'); p.wait = rnd(1, 3); return; }
  if (mode.current === 'nap') return idle(p, 'napping', [5, 5], '💤');
  for (const [prob, when, act] of URGES) if (when() && Math.random() < prob) { if (act(p) !== false) return; }
  const entries = Object.entries(INTENTS).filter(([, i]) => i.w > 0 && (!i.when || i.when(p))).map(([id, i]) => ({ id, w: i.w }));
  if (INTENTS[weighted(entries).id].go(p) === false) idle(p, 'standing around');
}

export function arrived(p) {
  const here = buildingAt(p.c, p.r), intent = INTENTS[p.intent];
  p.intent = null;
  if (intent?.arrive) intent.arrive(p, here); else idle(p, 'standing around');
  p.data = null;
}

// ---------- chat groups ----------
export const groups = [];
const spotTaken = (g, c, r) => g.members.some(m => m.c === c && m.r === r) || people.some(o => o.joining === g && o.route.length && o.route.at(-1)[0] === c && o.route.at(-1)[1] === r);
function chatSpot(g) {                                        // free tile adjacent to someone in the group, beside them first
  const cands = [];
  for (const m of g.members) for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = m.c + dc, r = m.r + dr; if (walkable(c, r) && !spotTaken(g, c, r)) cands.push([c, r, dr === 0 ? 0 : 1]); }
  cands.sort((a, b) => a[2] - b[2] || Math.random() - 0.5); return cands[0] ? [cands[0][0], cands[0][1]] : null;
}
function startChat(p) {
  let g = pick(groups.filter(g => g.members.length < 5));
  if (!g) {
    const q = pick(people.filter(o => o !== p && o.act === 'idle' && !o.inside && !o.joining));
    if (!q) return false;
    g = { members: [q] }; groups.push(g); q.group = g; q.act = 'chat'; q.wait = rnd(10, 25); q.say = pick(TOPICS); q.nextSay = rnd(2, 5); q.desc = 'waiting to chat';
  }
  const spot = chatSpot(g); if (!spot) return false;
  p.joining = g; return send(p, 'chat', spot, 'going to chat');
}
function joinChat(p) {
  const g = p.joining; p.joining = null;
  if (!g || !groups.includes(g)) return idle(p, 'standing around');
  g.members.push(p); p.group = g; p.act = 'chat'; p.wait = rnd(8, 20); p.say = pick(TOPICS); p.nextSay = rnd(2, 5); faceGroup(g);
}
function faceGroup(g) {
  const cx = g.members.reduce((s, m) => s + m.x, 0) / g.members.length;
  for (const m of g.members) { const names = g.members.filter(o => o !== m).map(o => o.name); m.desc = names.length ? `chatting with ${names.join(', ')}` : 'waiting to chat'; if (Math.abs(m.x - cx) > 1) m.flip = m.x > cx; }
}
export function leaveGroup(p) {
  const g = p.group; if (!g) return; p.group = null; g.members = g.members.filter(m => m !== p);
  if (g.members.length <= 1) { for (const m of g.members) { m.group = null; idle(m, 'standing around', [1, 4]); } groups.splice(groups.indexOf(g), 1); }
  else faceGroup(g);
}
export function clearGroups() { for (const p of people) { p.group = null; p.joining = null; } groups.length = 0; }

// ---------- inside / outside ----------
export function leave(p) {
  const b = p.inside; p.inside = null; if (b.lit !== undefined && !people.some(o => o.inside === b)) b.lit = false;
  const out = VISITS[b.type] ? pick(VISITS[b.type].out) : { cafe: '☕️', shop: '🛍️', hall: '📜' }[b.type] ?? (b.type === 'office' ? pick(['💻', '😮‍💨', '📎']) : '');
  if (p.backTo) { const o = p.backTo; p.backTo = null; if (sendToWork(p, o, 'back to work with coffee')) { p.say = '☕️'; return; } }
  if (b.type === 'office' && performance.now() < coffeeRun.until && Math.random() < 0.6 && !p.urge) { if (send(p, 'cafe', doorOf(pick(bType('cafe'))), 'coffee run')) { p.backTo = b; return; } }
  idle(p, 'just stepped outside', [1, 3], out);
}

// ---------- per-frame ----------
export function tickPerson(p, dt) {
  p.frame += dt;
  if (p.route.length) {
    if (wet() && p.umbrella && !p.say) p.say = weather.type === 'rain' ? '☔️' : '🧣';
    followRoute(p, p.bike ? 42 : wet() ? 20 : 14, dt, () => { if (/☔️|🧣/.test(p.say)) p.say = ''; arrived(p); });
    return;
  }
  p.wait -= dt;
  if (p.act === 'fish' && p.wait > 0 && (p.fishT -= dt) <= 0) { const r = Math.random(); p.say = r < 0.25 ? pick(['🐟', '🐠']) : r < 0.32 ? '🥾' : ''; if (p.say === '🐟' || p.say === '🐠') for (const k of ducks) if (Math.random() < 0.5) k.say = '🎺'; p.fishT = rnd(3, 8); }
  if (p.act === 'chat' && p.wait > 0 && (p.nextSay -= dt) <= 0) { p.say = Math.random() < 0.8 ? pick(TOPICS) : ''; p.nextSay = rnd(2, 5); }
  if (p.wait > 0) return;
  p.say = '';
  if (p.group) leaveGroup(p);
  if (p.inside === bus) return;                                  // riders get off when the bus stops
  if (p.inside) return leave(p);
  choose(p);
}
