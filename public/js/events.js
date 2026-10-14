// events from the server (and the dev bar) and how the town reacts to them
import { rnd, pick } from './util.js';
import { mode, weather, rollWeather, WICON, bType, doorOf, walkTiles, clock, SEASON, SEASONS, setSeason, fountain } from './world.js';
import { people, clearGroups, leaveGroup, leave, send, sendToWork } from './people.js';
import { geese, spawnGeese } from './animals.js';
import { bus, summonBus, burst, deliverMail } from './town.js';
import { ri } from './util.js';
import { coffeeRun } from './people.js';

export function say() {}                                        // banners are gone; the dev status line is the only readout

const outside = () => people.filter(p => !p.inside);
// a share of the people outside react with an emoji for a moment
function react(emojis, share = 1, hold = 2) { for (const p of outside()) if (Math.random() < share) { p.say = pick(emojis); p.wait = Math.max(p.wait, hold); } }
function setMode(m, secs) { mode.current = m; mode.until = performance.now() + secs * 1000; clearGroups(); }

const HANDLERS = {
  hello: () => {},
  commit: () => { fountain.sprayUntil = performance.now() + 5000; burst(16); },          // the fountain celebrates
  push: () => { deliverMail(); react(['👋'], 0.3); },
  merge: () => summonBus(ri(3, 5)),                                                       // a busload of visitors arrives
  checkout: ev => { react(['🔀'], 0.4); say('🔀 ' + (ev.msg || 'checkout')); },
  pull: (ev, msg) => { react(['📥'], 0.4); say('📥 pulled' + msg); },
  rebase: (ev, msg) => { react(['🔄'], 0.3); say('🔄 rebased' + msg); },
  reset: (ev, msg) => { react(['😬'], 0.3); say('⏪ reset' + msg); },
  editing: ev => {                                               // light an office and send a few idle people to it
    // about half of everyone outside heads for an office (spread across all of them), unless mid-ride or already at work
    const offices = bType('office'); let k = 0;
    for (const p of outside()) if (!p.bike && p.intent !== 'work' && Math.random() < 0.55 && k < 9) { k++; p.wait = 0; p.route = []; if (p.group) leaveGroup(p); const b = pick(offices); b.lit = true; sendToWork(p, b, 'heading in to work'); p.say = '💻'; }
    coffeeRun.until = performance.now() + 40000;                // while you are editing, office workers trickle out for coffee and back
  },
  idle: () => { coffeeRun.until = 0; for (const p of people) if (p.inside && p.inside.type === 'office' && Math.random() < 0.7) { p.wait = Math.min(p.wait, rnd(1, 5)); p.urge = 'break'; } },
  gathering: (ev, msg) => { setMode('gathering', 25); for (const p of people) { if (p.inside === bus) continue; if (p.inside) leave(p); p.route = []; p.wait = rnd(0, 2); } say('🏛️ town gathering' + msg); },
  nap: (ev, msg) => { setMode('nap', 20); for (const p of people) { if (p.inside === bus) continue; p.route = []; p.wait = 0; } say('💤 nap time' + msg); },
  wake: (ev, msg) => { mode.current = 'normal'; for (const p of people) if (p.inside !== bus) p.wait = rnd(0, 2); say('wake up' + msg); },
  weather: ev => { rollWeather(ev.msg && WICON[ev.msg] ? ev.msg : null); say(`${WICON[weather.type]} ${weather.type}`); },
  bus: () => summonBus(),
  season: ev => setSeason(ev.msg === 'reset' ? 'reset' : SEASONS.includes(ev.msg) ? ev.msg : SEASONS[(SEASONS.indexOf(SEASON) + 1) % 4]),   // cycle seasons (msg: name, or 'reset')
  time: ev => { clock.offsetHours = ev.msg === 'reset' ? 0 : (clock.offsetHours + (Number(ev.msg) || 3)) % 24; },   // advance the town clock (msg: hours, or 'reset')
  geese: () => { if (geese.state === 'away') spawnGeese(true); },
};

let statusEl = null, connected = false, lastSignal = '';
const ICON = { editing: '✏️', idle: '☕️', commit: '✅️', push: '🚀', merge: '🤝', checkout: '🔀', pull: '📥', rebase: '🔄', reset: '⏪' };
function showStatus() { if (statusEl) statusEl.textContent = `${connected ? '●' : '○'} ${lastSignal || (connected ? 'connected, waiting for signals' : 'reconnecting')}`; }

export function onEvent(ev) {
  const msg = ev.msg ? `: ${ev.msg}` : '';
  if (ev.type !== 'hello') { const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); const repo = (ev.msg || '').split(/[:→]/)[0].trim(); lastSignal = `${ICON[ev.type] || '·'} ${ev.type}${repo ? ' ' + repo : ''} (${t})`; showStatus(); }
  const h = HANDLERS[ev.type];
  if (h) return h(ev, msg);
  const p = pick(people.filter(p => !p.inside)) || people[0]; p.say = '❓️'; p.wait = Math.max(p.wait, 3); say(ev.type + msg);
}

export function connect(el) {
  statusEl = el;
  const es = new EventSource('/events');
  es.onopen = () => { connected = true; showStatus(); };
  es.onerror = () => { connected = false; showStatus(); };
  es.onmessage = e => onEvent(JSON.parse(e.data));
}
