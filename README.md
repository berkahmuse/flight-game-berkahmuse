# Island Hopper

[![Make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/berkahmuse/flight-game-berkahmuse/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/berkahmuse/flight-game-berkahmuse/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

A bush-plane run across the tropics, built for the
[Make the best flight game](https://make.fun/c/best-flight-game-20261126-0057)
competition on [make.fun](https://make.fun).

Fly three legs between four island strips — Koral Bay, Palm Cay, Turtle Reef,
Sunset Atoll — in a little red bush plane. Thread the golden rings, mind the
wind and the rain squalls, watch the fuel, and put her down soft on a short
strip. Hard landings bend the airframe; the sea forgives nothing.

## Play

```sh
node serve.ts            # game/ on http://localhost:8082
```

Open the page in desktop Chrome and press Enter or click to fly.

| Key | Does |
| --- | --- |
| ↑ / ↓ (W / S) | Pitch up / down |
| ← / → (A / D) | Throttle down / up (or drag the lever, bottom-right) |
| F | Flaps |
| G | Landing gear |
| Space | Brakes |
| P | Pause |
| M | Sound on / off |
| R | Restart the route |

## How it is built

Plain static files under `game/` — no build step, no network request, no
assets: the sky, sea, islands, plane and instruments are all drawn on one
canvas, and the engine drone, wind and chimes are synthesized with WebAudio.

- `game/src/config.js` — tuning constants and the golden-hour palette
- `game/src/random.js` — the seeded random source (one seed, one archipelago)
- `game/src/world.js` — the islands, rings, squalls, wind and leg state
- `game/src/plane.js` — the flight model: thrust, drag, stall, fuel, damage
- `game/src/render.js` — sky, sea, islands, plane, HUD and screens
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — procedural sound, no audio files
- `game/src/shots.js` — the deterministic screenshot scenes (`?shot=`)
- `game/src/main.js` — boot and the fixed-step loop

`main.ts` hands the game in: it copies `game/` and `screenshots/` to
`/output` and writes `/output/dossier.json` with the vendored make.fun
library. Screenshots are real renders of the game's own code, staged by the
autopilot in `shots.js` (`?shot=start|play|storm|end&seed=7`).

## License

MIT — see [LICENSE](LICENSE).
