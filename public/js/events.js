import { rnd, ri, pick } from './util.js';
import { mode, weather, rollWeather, WICON, bType, buildings, clock, SEASON, SEASONS, setSeason, fountain } from './world.js';
import { people, clearGroups, leaveGroup, leave, sendToWork, coffeeRun, tidyUp, pinNotice, freePerson, INTENTS, bikeRide } from './people.js';
import { geese, spawnGeese, flushGeese, startMenace } from './animals.js';
import { bus, summonBus, burst, deliverMail, startReno, endReno, airDrop } from './town.js';

const outside = () => people.filter(p => !p.inside);
function react(emojis, share = 1, hold = 2) { for (const p of outside()) if (Math.random() < share) { p.say = pick(emojis); p.wait = Math.max(p.wait, hold); } }
function setMode(m, secs) { mode.current = m; mode.until = performance.now() + secs * 1000; clearGroups(); }
const repoOf = ev => (ev.msg || '').split(/[:→]/)[0].trim();

const HANDLERS = {
  hello: () => {},
  // git
  commit: () => { fountain.sprayUntil = performance.now() + 5000; burst(16); },
  push: () => { deliverMail(); react(['👋'], 0.3); },
  pull: () => deliverMail(pick(buildings)),
  merge: () => summonBus(ri(3, 5)),
  checkout: () => bikeRide(ri(1, 4)),
  rebase: () => tidyUp(),
  reset: () => react(['😬'], 0.3),
  new: ev => pinNotice((ev.msg || '').split(': ').pop()),
  stash: () => { const p = freePerson(); if (p) INTENTS.pickflowers.go(p); },
  stash_pop: () => { const p = freePerson(); if (p) INTENTS.picnic.go(p); },
  // working
  editing: () => {
    const offices = bType('office');
    let k = 0;
    for (const p of outside()) {
      if (p.bike || p.intent === 'work' || Math.random() >= 0.55 || k >= 9) continue;
      k++; p.wait = 0; p.route = [];
      if (p.group) leaveGroup(p);
      const b = pick(offices); b.lit = true;
      sendToWork(p, b, 'heading in to work'); p.say = '💻';
    }
    coffeeRun.until = performance.now() + 40000;
  },
  idle: () => { coffeeRun.until = 0; for (const p of people) if (p.inside && p.inside.type === 'office' && Math.random() < 0.7) { p.wait = Math.min(p.wait, rnd(1, 5)); p.urge = 'break'; } },
  check_start: ev => { geese.check = ev.msg || 'tests'; if (geese.state === 'away') spawnGeese(true); },
  check_pass: () => flushGeese(),
  check_fail: ev => { geese.check = ev.msg || 'tests'; if (geese.state === 'away') spawnGeese(true); startMenace(); setTimeout(flushGeese, 20000); },
  server_start: () => startReno(),
  server_stop: () => endReno(),
  up_start: () => airDrop(ri(4, 7)),
  up_stop: () => {},
  // town
  gathering: () => { setMode('gathering', 25); for (const p of people) { if (p.inside === bus) continue; if (p.inside) leave(p); p.route = []; p.wait = rnd(0, 2); } },
  nap: () => { setMode('nap', 20); for (const p of people) if (p.inside !== bus) { p.route = []; p.wait = 0; } },
  wake: () => { mode.current = 'normal'; for (const p of people) if (p.inside !== bus) p.wait = rnd(0, 2); },
  weather: ev => rollWeather(WICON[ev.msg] ? ev.msg : null),
  bus: () => summonBus(),
  geese: () => { if (geese.state === 'away') spawnGeese(true); },
  season: ev => setSeason(ev.msg === 'reset' ? 'reset' : SEASONS.includes(ev.msg) ? ev.msg : SEASONS[(SEASONS.indexOf(SEASON) + 1) % 4]),
  time: ev => { clock.offsetHours = ev.msg === 'reset' ? 0 : (clock.offsetHours + (Number(ev.msg) || 3)) % 24; },
};

let statusEl = null, connected = false, lastSignal = '';
function showStatus() { if (statusEl) statusEl.textContent = `${connected ? '●' : '○'} ${lastSignal || (connected ? 'connected, waiting for signals' : 'reconnecting')}`; }

export function onEvent(ev) {
  if (ev.type !== 'hello') {
    const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), repo = repoOf(ev);
    lastSignal = `${ev.type.replace('_', ' ')}${repo ? ' · ' + repo : ''} (${t})`;
    showStatus();
  }
  const h = HANDLERS[ev.type];
  if (h) return h(ev);
  const p = pick(outside()) || people[0];
  p.say = '❓️'; p.wait = Math.max(p.wait, 3);
}

export function connect(el) {
  statusEl = el;
  const es = new EventSource('/events');
  es.onopen = () => { connected = true; showStatus(); };
  es.onerror = () => { connected = false; showStatus(); };
  es.onmessage = e => onEvent(JSON.parse(e.data));
}
