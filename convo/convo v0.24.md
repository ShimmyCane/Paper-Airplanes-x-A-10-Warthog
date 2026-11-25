# Convo v0.24 — the landscape: sun, shadows, sky and clouds

Date: 2026-11-25. Follows `convo v0.23.md`. (Earlier this round: Dots as an open run of up to 50, 0.23.1.)

Jimmy:
- Research the landscape first; compile references in a research folder; update accordingly.
- Shadows, and the sun's place and movement, are important.
- Clouds: borrow from the Generate Clouds project, dialled down for this resolution.
- Add to lessons learned.

## What was done

1. **Research:** `research/landscape/` — README, 01 sun and shadows, 02 sky light, 03 clouds. Sources are listed in each note. The Generate Clouds material was read from the Index repo's history (the project graduated on 2026-11-24); no other repository was read.
2. **Light model:** `src/light.ts`. The solar position is the Meeus / NOAA method ported from Generate Clouds' `js/sun.js`. The sun is for 1 October at 51° N, longitude 0, in solar time.
3. **Solar clock:** starts at 14:30 (the sun is high-afternoon, shadows short-to-long), moves with flight time. ⚙️ has Sun still / slow / fast; the readout shows the time and what the sun is doing.
4. **Sun, sky and ground:** the sky palette follows the sun's height (day, golden hour, civil twilight, nautical, night). The sun disc, flare, water glint, ground brightness and object shadows follow the sun each frame. Object shadows go when the sun is below 2°.
5. **Clouds:** one deck of cumulus at 520 m, drifting with the wind. It is sampled on a 30 m grid round the camera every 0.4 s, so it costs a few lookups per pixel. Sky rays that meet the deck are shaded by the sun, and the ground takes the cloud's shadow along the sun ray. The old billboard clouds are removed.
6. **Checks:** 148 checks in `tools/flight_test.js` pass, including the sun's place at noon and in the afternoon, sunset between 17 and 18 UT, night, cloud cover near 40%, the drift and the clock speeds. Browser: no errors at 1180×820, 768×1024 and 390×844; the golden hour, afternoon, civil twilight and night frames were reviewed.
7. **Lessons:** `04 AI/lessons.md` (round 17), and the brief has a round 17 entry.

## Readings I took (tell me if wrong)

- **Place and day:** 51° N, longitude 0, 1 October, solar time, so the sunset is about 17:33 UT. I picked a mid-latitude autumn day to match the look we had, and did not use a real location or your date.
- **"Sun movement":** the sun moves with flight time, not real time. At Slow an in-game hour passes in three minutes; at Fast in one. Headless testing runs slower because the step is capped; on a device the clock runs at the set rate.
- **"Dialled down":** the cloud deck is a single flat layer with soft edges and about 40% cover, with the opacity capped at 0.85. There are no storm towers and no thickness, so you cannot fly through it.
- **Shadows on objects:** trees, houses and the plane's own shadow follow the sun. The objects themselves are lit the same at every hour; only the ground, sky and cloud change colour.

## Questions

1. Should the sun start at a different time (dawn, or near sunset for the dusk look), or should we keep mid-afternoon as the default?
2. The default is "Sun slow". Do you want that as the default, or "Sun still" as the default with slow as an option?
3. Would you like the cloud cover adjustable (clear, scattered, overcast) in ⚙️?
4. Do the objects (houses, trees, the plane) need to take on the sun's colour at dusk too? It would cost a little more per object.
5. Frame rate on an iPad matters most now: the sky and ground are per-pixel at 960×540 with the cloud pass. Can you tell me how the sky feels on the iPad at each sun time?

## Not done

- Stars and the moon.
- Object lighting by the sun's colour.
- A real place or real date.
- A cloud deck with thickness and storm towers.

## Answers (Jimmy, 2026-11-25)

1. **Start time:** the sun starts at a different time in each mission (dawn, afternoon, dusk), and it moves on in real time during the mission.
2. **Default:** nothing should be static. The sun setting goes; the sun always runs in real time. Everything should just work.
3. **Clouds and weather:** cloud cover depends on the imagined weather of the area. Weather covers clear, scattered cloud, overcast, rain, thunder, windy, and dust storms, and it may affect dust storms and explosions. Weather should differ from mission to mission.
4. **Object colour:** yes. Houses, trees and the plane take the sun's colour at dusk too, and they should render correctly.
5. **iPad feel:** put these questions in the ⚙️ feedback, so the answer comes with the screen it is about.

Also asked: put the answers and the increment into the Index repo (lessons learned, and an increment for the next round).
