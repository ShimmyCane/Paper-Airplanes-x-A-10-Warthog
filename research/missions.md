# Missions — plan and status

Status: 13 missions in `src/world.ts` (`MISSIONS`, `missionFor`) as of 0.23 (2026-11-25): three training and race missions, then the ten fights.
Read first: `CLAUDE.md`, `src/world.ts` (`MISSIONS`, `spawnTargets`, `makeMission`), `src/game.ts` (`newFlight`, `updateWaves`, `waveSize`, `countsForObjective`).

## Why these thirteen

The first three teach the controls and give the first race, with nothing shooting at you. Then the ten fights start calm and add fighters, guns and ships; one or two start with you already under attack.

| # | Name | Goal | Start | What it adds |
|---|------|------|-------|--------------|
| 1 | Dots | 6 dots flown over, in order | takeoff | Numbered dots on the radar and in the view. Height does not count. |
| 2 | Rings | 8 rings flown through, in order | takeoff | The next ring is lit. Fly through at its height. |
| 3 | Circuit | 2 laps of an 8-gate circuit | takeoff | Race two friends and two allied planes. |
| 4 | Range Day | 3 ground targets | takeoff | Controls only. No fighters, no guns. |
| 5 | First Contact | 4 ground targets | takeoff | One fighter about 90 s in. Learn the lock. |
| 6 | Coast Watch | 2 ships | takeoff | Ships at sea, flak on the shore. |
| 7 | Armour Strike | 6 ground targets | takeoff | Tanks on the road, guns, a fighter now and then. |
| 8 | Intercept | 3 fighters shot down | takeoff | Fighters in waves, from the first 30 s. |
| 9 | Heading Home | 3 ground targets | **return** | Starts flying home with a fighter on the tail. |
| 10 | Town Watch | 5 ground targets | takeoff | Town SAM sites. Keep out of the missiles. |
| 11 | Air Superiority | 5 fighters shot down | takeoff | Bigger waves, guns and missiles. |
| 12 | Port Strike | 3 ships | takeoff | Harbour ships with the shore guns awake. |
| 13 | Last Light | 8 ground targets | **return** | The biggest finale: under fire on the way home. |

After mission 13 the list starts again, one more target and one more fighter per wave each time round. The End mission button (jet mode) goes on to the next mission at any time; a finished race offers the same as Next mission.

## Rules added in 0.23

- **Lock only on enemies.** `isHostile` in `src/world.ts`: fighters, tanks, APCs, SAMs, flak, enemy jets and ships. Buildings, farms, towns, trucks, rail, fuel, allies and racers are neutral; the lock, the gun aim and the bullets all ignore them.
- **Flak bursts.** A flak round bursts by its fuse (18 m). The burst does its hull damage, puts smoke over the view (it fades in a few seconds), and jolts the screen.
- **Spread out.** Ground clusters 220 m apart (was 120), fighters spawn 1.5–1.8 km out, defended bases every 2 km.
- **Race.** Racers fly at a share of the optimum speed (60 m/s): each one between 50% and 90%, dropping by up to 15% now and then. They are not shot at and do not shoot.

## What the fields mean

- `goal`: `ground` (places and vehicles, as before), `air` (enemy fighters), `ship` (ships at sea).
- `guns`: anti-aircraft guns on the ground and the coast. Off in the first two missions.
- `start`: `takeoff` from the runway, or `return` (already at 900 m, hull 60, fighters behind).
- `firstWave`, `waveEvery`, `wave`: when the fighter waves come, how often, and how many at the normal setting (2). The ⚙️ slider is the density: 1 is half, 2 is full, 0 is none. Felix (easy) halves it again, never below one.

## Not built yet (needs new engine work)

The plan asked for these. They need more than the current targets and waves:

- **Escort.** A convoy that drives the road with allies flying cover. Needs a convoy that moves on its own, a "keep it alive" check, and the allies choosing targets near the convoy.
- **Ocean launch / carrier.** Start on a carrier deck at sea. Needs a carrier model and a takeoff from a moving deck.
- **Team battle.** Allies on a shared objective with a score for both sides. Today the allies only orbit and do not shoot.
- **Interception of a bomber.** A slow, large target that must be reached before it reaches a base. Needs a target that flies a fixed route to a goal.
- **Larger ground units.** A column of heavier armour. The kinds exist (`tank_mbt`), but not a formation.

Suggested order for the next round: escort (it reuses the road and the allies), then the carrier start (it reuses the ship kind), then the team battle.

## Testing

`npm test` checks: thirteen missions in order; the first (Dots) has no fighters and no guns; First Contact sends its first fighter at 90 s; a return starts behind a fighter with hull 60; ships and fighters count toward their missions; no building sits on the road or railway; nothing within 450 m of the start; the lock skips neutral things; dots and rings count only in order; the circuit's racers stay in their pace range and two laps finish it; End mission starts the next mission; a flak burst damages, dazzles and jolts; the shake dies away and a missile shakes harder than a bullet.
