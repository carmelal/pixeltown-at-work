# pixeltown at work

https://github.com/user-attachments/assets/2a815b29-9052-4694-b0cb-46de8e269cc6

A tiny pixel town for a second monitor. People wander about and get on with their day; some of what they do is random, and some of it is a reaction to what you are doing on your machine.

Made entirely using AI (Claude Fable 5) in an attempt to make me more productive.

## Running it

```
node server.js
```

Then open http://localhost:1337. Add `?dev=true` for menus that fire every signal by hand.

The server serves `public/`, relays events to the page, and watches your repos. Tell it where they are with `PIXELTOWN_ROOTS` — a colon-separated list of folders whose subfolders are git repos (default `~/src`):

```
PIXELTOWN_ROOTS=~/src/work:~/src/personal node server.js
```

Anything on the machine can post an event:

```
curl "localhost:1337/event?type=commit&msg=repo:%20message"
```

With nothing listening, every hook below is a silent no-op.

## Sensory-friendly mode

The `○ sensory-friendly` toggle under the clock keeps the town but turns the volume down. The setting is remembered by the browser. While it is on:

- No emoji speech bubbles.
- Everything moves at 60% speed, the page renders at 15 fps, and the fountain, ripples and clouds are slower.
- Fewer people are out at once (about seven); dogs are lazier and do not chase, play, or race for parcels; squirrels stay in their trees.
- No confetti, splashes, smoke, stone chips or shredded cardboard. Rain and snow are slow diagonal streaks and drifting flakes. Leaves and petals still fall.
- No dancing or hammering wobble; the club is closed; nothing flashes.
- A failed check still brings the geese, but they stay by the pond and people walk indoors instead of running.
- Colours are gently desaturated.

The numbers live in `CALM` in `public/js/world.js`.

## What happens on its own

People
- Walk, sit on benches, look at the fountain, a tree, or the sky.
- Go for coffee, go to work, run errands, visit town hall.
- Visit the bakery, library, gym, museum, clinic and florist during their opening hours. The club opens at 21:00 and is the one place allowed to flash.
- Feed the ducks, go fishing (not in winter), pet a dog, catch the bus.
- Form chat groups of up to five, each person with their own topic.
- Keep a routine: commute 08–10, lunch at the cafes 12–13:30, errands and home 17–19, asleep after dark. In rain or snow they hurry indoors, carry umbrellas, or shelter under trees.

Animals
- Five dogs with temperaments: tuck (loyal; follows the mouse pointer; drops everything for a picnic), biscuit (lazy), pepper (wild; jumps in the pond after the ducks), rufus and olive (social). They follow people, play with each other, chase squirrels, beg at picnics and race people to air-dropped parcels.
- Mallards on the pond; they come for bread and fly off when a dog turns up.
- Squirrels dashing between trees.
- A black cat on the rooftops who keeps her thoughts to herself.
- Small birds, and chimney smoke in winter.

Town
- A yellow bus every minute or two.
- Weather rolls every 1–3 minutes: clear, cloudy, rain, or snow in winter. Streetlights come on at night and in rain.
- The season follows the date (flipped for southern-hemisphere timezones) and sets the palette, daylight hours and the trees. Crocuses in winter.
- A working clock on the town hall.

## Signals

### Git, detected automatically

`watch.js` tails `.git/logs/HEAD`, `refs/heads` and the stash reflog in every watched repo, and notices file changes. Nothing is installed into any repo.

| what you did | the town |
|---|---|
| edited files in a repo | about half of everyone outside heads into the offices; windows light up; coffee runs between office and cafe |
| a repo went quiet for 90 s | office workers come out for a break: chat groups and duck feeding |
| commit | the fountain sprays high with confetti |
| checkout | 1–4 people take bikes from the rack for a ride around town |
| pull | the mail van brings one big package to a random building |
| merge | a teal coach brings 3–5 visitors who wander for a while, then leave by bus |
| rebase | someone sweeps the footpath, someone waters the flowerbeds (shovelling in winter) |
| reset | 😬 |
| new branch | a notice is pinned on the town hall; taken down after 15 minutes |
| stash | someone picks flowers from a bed (it regrows) |
| stash pop | a picnic on the hill, which tuck attends |

Pushes do not show up in the reflog; `hooks/post-commit` can be copied into a repo's `.git/hooks/` to report them.

### Shell commands, via the zsh hook

Add to `~/.zshrc`:

```
source /path/to/pixeltown-at-work/hooks/pixeltown.zsh
```

Commands are matched by prefix against two lists at the top of that file — `PIXELTOWN_CHECKS` for things that pass or fail, `PIXELTOWN_LONG` for things that start and stop. Common test runners and package managers are listed; add whatever your own tooling uses.

| what you did | the town |
|---|---|
| pushed | the mail van comes and the carrier delivers to every building |
| started a check (tests, lint, typecheck, CI) | geese fly in and wait by the pond |
| the check passed | the geese leave |
| the check failed | the geese roam the whole town for 20 s and everyone hides |
| started a dev server (while it runs) | a flatbed arrives along the footpath with a crew who unload materials and raise green scaffolding on a building; they leave when the server stops |
| installed or updated dependencies | a plane drops parcels on parachutes; people and dogs race for them, and dogs shred what they catch |
| opened a console / REPL (while it is open) | three people in deerstalkers and trenchcoats investigate the town's fixtures |
| created a pull request | a sculptor carves an abstract statue on the hill; four spots, oldest replaced |

Without the zsh hook, `hooks/check <label> <command...>` reports any single command as a check.

### Dev-only

With `?dev=true`: `gathering`, `nap`/`wake`, `weather`, `bus`, `geese`, `time` (+3h / reset), `season` (next / reset). Unknown event types put ❓ over someone.

## Layout

```
server.js        static files + event relay + repo watcher
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
