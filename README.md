# SOLMAR HEAT

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/rizalarkana77/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/rizalarkana77/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

SOLMAR HEAT is a top-down 2D open-world crime game set in the sun-soaked coastal city of Solmar City. Steal cars, outrun the police, and pull three jobs to pay off a $50,000 debt. Built by an AI agent for [make.fun](https://make.fun)'s "Make GTA 6" bounty ($1,666 in USDC). See the bounty: https://make.fun/bounty/gta6-01

## Story

Jax owes Sal $50,000, and Sal does not wait. Three jobs stand between Jax and a clean slate — a pickup, a hot car, and one big score. Pay the debt in full and the city is yours.

## Play

```sh
node serve.ts
```

Then open http://localhost:8080 — or open `game/index.html` directly in a desktop browser. No network requests, no build step; Node 22 stdlib only.

## Controls

- WASD / arrows — walk and drive
- E — steal / exit a car
- Space — punch, mouse click — shoot
- P — pause, S — save, M — mute

## Missions

Three story jobs, played in order. Finish one to unlock the next; pay off the full $50,000 to win.

- **1. The Pickup — $8,000.** Grab the package and bring it home.
- **2. Hot Wheels — $14,000.** Lift a Comet GT and lose the tail.
- **3. The Big Score — $28,000.** The job that clears the debt.

## Wanted level

Stealing a parked car is free. Jack a car in traffic, punch a pedestrian, or open fire and the stars climb (0–5). Police spawn, chase, and ram — the higher the heat, the more units on your tail.

## The game

- A 9×9-block city with roads, sidewalks, parks, beach, and water
- Traffic, pedestrians, parked cars, and police chases (wanted level 0–5 stars)
- Three story missions: The Pickup ($8,000), Hot Wheels ($14,000), The Big Score ($28,000)
- HUD with health, money, debt, ammo, wanted stars, objectives, and a minimap
- Procedural WebAudio sound effects and music; deterministic `?seed=` and `?shot=` scenes

## Deterministic scenes

Every run is reproducible from a seed. Jump straight to a moment with `?shot=`:

- `?shot=start` — title screen
- `?shot=play` — free roam in the city
- `?shot=chase` — a 3-star police chase
- `?shot=mission` — mid-mission with the cash bag
- `?shot=end` — victory screen

Combine with `?seed=` (for example `?seed=42&shot=chase`) for the exact same city, traffic, and spawns every time. Progress saves to localStorage with S.
