🤖 _claude-fable-5 (via Pi) wrote this draft._ 🤖

# pixeltown at work

A tiny pixel town for a second monitor. People wander about and get on with their day; some of what they do is random, and some of it is a reaction to what you are doing on this machine.

## Running it

```
node server.js
```

Then open http://localhost:1337. Add `?dev=true` for menus that fire every signal by hand.

The server serves `public/` and relays events to the page over SSE. It also watches your repos (see Signals). Override the watched roots with `PIXELTOWN_ROOTS=~/src/a:~/src/b node server.js`; the default is `~/src/github.com/Shopify` and `~/src/github.com/carmelal`.

Anything on the machine can post an event:

```
curl "localhost:1337/event?type=commit&msg=repo:%20message"
```

With no server running, every hook below is a silent no-op.

## What happens on its own

People
- Walk, sit on benches, look at the fountain, a tree, or the sky.
- Go for coffee, go to work, run errands, visit town hall.
- Visit the bakery, library, gym, museum, clinic and florist during their opening hours; the club opens at 21:00 and is the one place allowed to flash.
- Feed the ducks, go fishing (not in winter), pet a dog, catch the bus.
- Form chat groups of up to five with their own topic emoji.
- Follow a routine: commute 08–10, lunch at the cafes 12–13:30, errands and home 17–19, asleep after dark. In rain or snow they hurry indoors, carry umbrellas, or shelter under trees.

Animals
- Five dogs with temperaments: tuck (loyal; follows the mouse pointer; drops everything for a picnic), biscuit (lazy), pepper (wild; jumps in the pond after the ducks), rufus and olive (social). They follow people, play with each other, chase squirrels, beg at picnics and race people to air-dropped parcels.
- Mallards on the pond; they come for bread and fly off when a dog turns up.
- Squirrels dashing between trees.
- A black cat on the rooftops who keeps her thoughts to herself.
- Small birds, and chimney smoke in winter.

Town
- A yellow bus every minute or two.
- Weather rolls every 1–3 minutes: clear, cloudy, rain, or snow in winter. Streetlights come on at night and in rain.
- The season follows the date (flipped for southern-hemisphere timezones) and sets the palette, daylight hours and tree state. Crocuses in winter.
- A working clock on the town hall.

## Signals

### From the repo watcher (no setup)

`watch.js` tails `.git/logs/HEAD`, `refs/heads` and the stash reflog in every repo under the watched roots, and watches for file changes.

| signal | detected from | the town |
|---|---|---|
| `editing` | files changing in a repo | about half of everyone outside heads into the offices; windows light up; coffee runs between office and cafe for 40 s |
| `idle` | a repo quiet for 90 s | office workers come out for a break: chat groups and duck feeding |
| `commit` | reflog | the fountain sprays high with confetti |
| `checkout` | reflog | 1–4 people take bikes from the rack for a ride around town |
| `pull` | reflog | the mail van brings one big package to a random building |
| `merge` | reflog | a teal coach brings 3–5 visitors who wander for a while, then leave by bus |
| `rebase` | reflog | someone sweeps the footpath, someone waters the flowerbeds (shovelling in winter) |
| `reset` | reflog | 😬 |
| `new` | a new file under `refs/heads` | a notice is pinned on the town hall; taken down after 15 min |
| `stash` | stash reflog grows | someone picks flowers from a bed (it regrows) |
| `stash_pop` | stash reflog shrinks | a picnic on the hill, which tuck attends |

Pushes do not touch the reflog, so `push` comes from the hook below.

### From the zsh hook

Add to `~/.zshrc`:

```
source ~/src/github.com/carmelal/pixeltown-at-work/hooks/pixeltown.zsh
```

Commands are matched by prefix (`PIXELTOWN_CHECKS` and `PIXELTOWN_LONG` at the top of the file).

| signal | commands | the town |
|---|---|---|
| `push` | `hooks/post-commit` (optional, per repo) | the mail van comes and the carrier delivers to every building |
| `check_start` / `check_pass` / `check_fail` | `dev test`, `dev style`, `dev lint`, `dev typecheck`, `dev tc`, `bundle exec rspec`, `bundle exec rubocop`, `npm test`, `pnpm test`, `yarn test`, `go test`, `cargo test`, `pytest`, `gh run watch`, `gs ci` | geese fly in and wait by the pond; on pass they leave; on fail they roam the whole town for 20 s and everyone hides |
| `server_start` / `server_stop` | `dev server`, `bin/rails server`, `npm run dev`, `pnpm dev` | a flatbed arrives along the footpath with a crew who unload materials and raise green scaffolding on a building; they leave with the truck |
| `up_start` | `dev up` | a plane drops parcels on parachutes; people and dogs race for them (dogs shred) |
| `console_start` / `console_stop` | `dev console`, `dev c`, `bin/rails console`, `bin/rails c` | three people in deerstalkers and trenchcoats investigate the town's fixtures until the console closes |
| `pr_start` | `dev create pr`, `gs pr create`, `gh pr create` | a sculptor carves an abstract statue on the hill; four spots, oldest replaced |

`hooks/check <label> <command...>` reports any command as a check without the zsh hook.

### Dev-only

`gathering`, `nap`/`wake`, `weather`, `bus`, `geese`, `time` (+3h / reset), `season` (next / reset). Unknown event types put ❓ over someone.

## Layout

```
server.js        static files + SSE relay + repo watcher
watch.js         reflog, refs and file-change detection
hooks/           pixeltown.zsh, check, post-commit
public/js/
  world.js       grid, time, season, weather, map, pathfinding
  people.js      intents, chat groups, routines, event-triggered jobs
  animals.js     dogs, squirrels, mallards, geese
  town.js        bus, mail van, flatbed and crew, air drop, cat, particles
  sprites.js     everything drawn, string-art sprites
  events.js      signal handlers, status line
  main.js        frame loop, depth sorting, hover
```
