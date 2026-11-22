# Convo v0.21 — the controls, a clear start, ten missions

Date: 2026-11-22. Follows `convo v0.20.md`.

Jimmy:
- Nose up makes the plane look like it tilts down.
- Can't find the throttle.
- Reduce the density of enemies: it is too hard to fight them.
- A clear starting point, not right in the middle of everything.
- "There is place for all assets on the ground as well."
- Ten missions of various difficulty, planned well. Start with a mock target to learn the controls, then escort, battles, interceptions, larger ground units, a team battle, ocean launches. One or two start under attack, on a boat or on the way back.
- Merge.

## Answers

- **Nose up looked like a dive.** The sprite never rotates. Pitch moves the camera, and the sign was backwards: a nose-up plane showed less of its top, so it looked as if it dropped. Fixed in `src/render.ts` (`elev` now adds the pitch).
- **Throttle.** Two things hid it. The default mode is the paper glider, which has no engine. In the jet, the lever only showed with the flight helper off, and the helper ignored it. The lever now shows in the jet with the helper on, and it counts: the helper adds power when you are slow, on top of your setting. Settings › Mode › A-10 jet to fly with it.
- **Fewer fighters.** The default is now half (setting 1), and the wave count is set by the mission, not by a fixed rule. The first wave comes after 30–120 s, not 8 s.
- **Clear start.** Mission 1 is a range day: no fighters, no guns, ground targets 520 m out instead of 260 m.
- **Ground assets.** My reading: every building sits on land, not on the road or railway, and no cluster is placed on a line. Tell me if you meant something else (e.g. spacing or what is drawn on the ground).

## Built

1. `src/render.ts`: nose-up camera sign fixed.
2. `src/game.ts`: the lever always counts in the jet. Mission spec drives waves, goal, start, and guns. Objective counts for ground, air and ship missions. Return start: 900 m out, hull 60, fighters behind.
3. `src/world.ts`: `MISSIONS` (ten, see `research/missions.md`), `missionFor` (loops harder), `landSite` (keeps off the road and rail), `spawnTargets(…, guns)`.
4. `src/main.ts`, `src/radar.ts`, `index.html`, `css/app.css`: HUD and radar follow the mission goal; default density 1; hint and label updated; the lever is shown in the jet.
5. `tools/flight_test.js`: the flaky wave check (it could see 0 fighters by chance) is replaced by a check that watches over the window. New checks for the missions, the return, the ships, guns, the start, placement and the lever.
6. Version 0.21 (`src/config.ts`, `?v=0.21` on the CSS and script).

## Not done this round

- Escort, carrier start, team battle, bomber intercept, larger armour (see `research/missions.md`).
- The nose-up fix is checked by the camera geometry, not by eye in a browser. Please look at it in the jet and the glider.
- Saved settings on a device keep their old enemy density (2) until changed.
