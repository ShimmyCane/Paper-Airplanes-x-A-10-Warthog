# Missions — plan and status

Status: 10 missions set up in `src/world.ts` (`MISSIONS`, `missionFor`) as of 0.21 (2026-11-22).
Read first: `CLAUDE.md`, `src/world.ts` (`MISSIONS`, `spawnTargets`, `makeMission`), `src/game.ts` (`newFlight`, `updateWaves`, `waveSize`, `countsForObjective`).

## Why these ten

The old games started on the ground, waiting for you to begin. The start is calm, the middle adds fighters, guns and ships, and one or two start with you already under attack. The first mission is a mock target, so the first flight is about the controls.

| # | Name | Goal | Start | What it adds |
|---|------|------|-------|--------------|
| 1 | Range Day | 3 ground targets | takeoff | Controls only. No fighters, no guns. |
| 2 | First Contact | 4 ground targets | takeoff | One fighter about 90 s in. Learn the lock. |
| 3 | Coast Watch | 2 ships | takeoff | Ships at sea, flak on the shore. |
| 4 | Armour Strike | 6 ground targets | takeoff | Tanks on the road, guns, a fighter now and then. |
| 5 | Intercept | 3 fighters shot down | takeoff | Fighters in waves, from the first 30 s. |
| 6 | Heading Home | 3 ground targets | **return** | Starts flying home with a fighter on the tail. |
| 7 | Town Watch | 5 ground targets | takeoff | Town SAM sites. Keep out of the missiles. |
| 8 | Air Superiority | 5 fighters shot down | takeoff | Bigger waves, guns and missiles. |
| 9 | Port Strike | 3 ships | takeoff | Harbour ships with the shore guns awake. |
| 10 | Last Light | 8 ground targets | **return** | The biggest finale: under fire on the way home. |

After mission 10 the list starts again, one more target and one more fighter per wave each time round.

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

`npm test` checks: ten missions in order; mission 1 has no fighters and no guns; mission 2 sends its first fighter at 90 s; a return starts behind a fighter with hull 60; ships and fighters count toward their missions; no building sits on the road or railway; nothing within 450 m of the start.
