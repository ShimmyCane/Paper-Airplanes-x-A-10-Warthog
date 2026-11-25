# Convo v0.23 — training, race, flak, shake, lock, graphics

Date: 2026-11-25. Follows `convo v0.22.md`.

Jimmy:
- Slow the start: training missions first. Fly over labelled dots in sequence, then through a series of rings.
- An End mission button goes to the next mission.
- Mission 3: a simple race round the circuit with a couple of friends and a couple of allied planes, all in the same airframe, at 50–90% of the optimum speed, with up to −15% variability.
- A flak enemy that explodes close to you: damages vision and airframe.
- Damage shakes the screen; the harder the hit, the harder the shake.
- Spread the enemies out.
- No targeting of neutral units, buildings or other things.
- Graphics: recursive increments, four times the resolution first, then farmland, smaller roads, lakes, houses, railway. A to-do list, a few at a time, five increments.
- Simplify, update lessons, merge.

## What was done

1. **Lock only on enemies** (`isHostile`, `src/world.ts`). Lock, gun aim and bullets ignore buildings, farms, towns, trucks, rail, fuel, allies and racers. Objectives count hostile ground units only.
2. **Spread out.** Clusters 220 m apart (was 120), fighters 1.5–1.8 km out (was 1.1–1.3), bases every 2 km (was 1.4).
3. **Flak and shake.** A flak round now bursts by its fuse (18 m): airframe damage, a dark smoke cloud that hides the view and fades in a few seconds, and a jolt. Screen shake is set by hull damage (a missile shakes hard, a bullet barely) and dies away in about a second.
4. **Training and race.** Mission 1 Dots (6 dots, in order, radar labels, height ignored). Mission 2 Rings (8 rings, in order, next one lit). Mission 3 Circuit (two laps, 8 gates, 2 friends and 2 allied planes). Racers' pace is 50–90% of 60 m/s, and drops by up to 15% every 1.5–3.5 s.
5. **End mission** button in jet mode, under the objective line. A finished race offers "Next mission".
6. **Graphics** in five increments, tracked in `research/graphics_todo.md`: 960×540 canvas; farmland plots with more crops; country lanes; village houses and farm ponds; railway ballast and level crossings.
7. Tests: 58 → 83 checks in `tools/flight_test.js`, all pass. Browser: no console errors at 1180×820, 768×1024 and 390×844; no horizontal scroll.

## Readings I took (tell me if wrong)

- **Recursive improvement skill.** I could not find a skill called "recursive improvement" in the Index (`02 Refs/Skills`, `.claude/skills`, or the git history). I took it as your request for five successive graphics increments, each checked by a screenshot.
- **"Four times more resolved".** Read as four times the pixels (960×540, two per side). The layout stays in the old units, so the sprites keep their shapes. The sprites themselves are not yet finer; that is the next step.
- **Flak as an enemy.** The flak batteries already existed (in army and coast clusters, in gun missions). They are now proximity bursts with the vision and shake effects. I did not add a flying or mobile flak enemy.
- **"Up to planes".** The race has four racers: two friends and two allied planes. That count is fixed for now.
- **Mission numbering.** The new three come first, so the old Range Day is now mission 4. The fights follow in their old order.

## Questions

1. Should the game open on Dots (jet) instead of the paper glider? It opens on the glider now.
2. Do you want a mobile flak truck that drives the road and bursts at you, as a second flak enemy?
3. Should the race racers' number be adjustable in ⚙️ (up to 4), or fixed?
4. The frame rate at 960×540 is about half the old one in headless testing. Can you check the feel on the iPad, so we know whether to keep the full resolution or drop `RES` to 1.5?

## Not done

- Sprites finer than before (the next resolution step).
- The race has no start countdown or penalties.
- The screenshots were taken in headless Chromium, not on the iPad.
