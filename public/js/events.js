// events from the server (and the dev bar) and how the town reacts to them
import { rnd, pick } from './util.js';
import { mode, weather, rollWeather, WICON, bType, doorOf, walkTiles } from './world.js';
import { people, clearGroups, leave, send, sendToWork } from './people.js';
import { geese, spawnGeese } from './animals.js';
import { bus, summonBus, burst } from './town.js';

export const ticker = { text: '', until: 0 };
export function say(msg, secs = 6) { ticker.text = msg; ticker.until = performance.now() + secs * 1000; }

const outside = () => people.filter(p => !p.inside);
// a share of the people outside react with an emoji for a moment
function react(emojis, share = 1, hold = 2) { for (const p of outside()) if (Math.random() < share) { p.say = pick(emojis); p.wait = Math.max(p.wait, hold); } }
function setMode(m, secs) { mode.current = m; mode.until = performance.now() + secs * 1000; clearGroups(); }

const HANDLERS = {
  hello: () => {},
  commit: (ev, msg) => { react(['✅️', '👏', '🎉']); burst(12); say('✅️ commit' + msg); },
  push: (ev, msg) => { react(['🚀', '🎊', '🙌'], 1, 3); burst(60); say('🚀 pushed' + msg); },
  merge: (ev, msg) => { react(['🤝'], 0.5); burst(20); say('🤝 merged' + msg); },
  checkout: ev => { react(['🔀'], 0.4); say('🔀 ' + (ev.msg || 'checkout')); },
  pull: (ev, msg) => { react(['📥'], 0.4); say('📥 pulled' + msg); },
  rebase: (ev, msg) => { react(['🔄'], 0.3); say('🔄 rebased' + msg); },
  reset: (ev, msg) => { react(['😬'], 0.3); say('⏪ reset' + msg); },
  editing: ev => {                                               // light an office and send a few idle people to it
    const b = pick(bType('office')); b.lit = true; let k = 0;
    for (const p of outside()) if (p.act === 'idle' && k < 3) { k++; p.wait = 0; p.route = []; sendToWork(p, b); p.say = '💻'; }
    say('✏️ editing ' + (ev.msg || ''));
  },
  idle: (ev, msg) => { for (const p of people) if (p.inside && p.inside.type === 'office' && Math.random() < 0.5) p.wait = Math.min(p.wait, rnd(1, 4)); say('☕️ taking a break' + msg, 4); },
  gathering: (ev, msg) => { setMode('gathering', 25); for (const p of people) { if (p.inside === bus) continue; if (p.inside) leave(p); p.route = []; p.wait = rnd(0, 2); } say('🏛️ town gathering' + msg); },
  nap: (ev, msg) => { setMode('nap', 20); for (const p of people) { if (p.inside === bus) continue; p.route = []; p.wait = 0; } say('💤 nap time' + msg); },
  wake: (ev, msg) => { mode.current = 'normal'; for (const p of people) if (p.inside !== bus) p.wait = rnd(0, 2); say('wake up' + msg); },
  weather: ev => { rollWeather(ev.msg && WICON[ev.msg] ? ev.msg : null); say(`${WICON[weather.type]} ${weather.type}`); },
  bus: () => summonBus(),
  geese: () => { if (geese.state === 'away') spawnGeese(true); },
};

export function onEvent(ev) {
  const msg = ev.msg ? `: ${ev.msg}` : '';
  const h = HANDLERS[ev.type];
  if (h) return h(ev, msg);
  const p = pick(people.filter(p => !p.inside)) || people[0]; p.say = '❓️'; p.wait = Math.max(p.wait, 3); say(ev.type + msg);
}

export function connect(statusEl) {
  const es = new EventSource('/events');
  es.onopen = () => statusEl.textContent = '● live';
  es.onerror = () => statusEl.textContent = '○ reconnecting';
  es.onmessage = e => onEvent(JSON.parse(e.data));
}
