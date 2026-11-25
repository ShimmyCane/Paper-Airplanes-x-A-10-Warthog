# Landscape: sun, shadows, sky and clouds

Research for version 0.24 (2026-11-25). Three short notes and the decisions they led to.

| Note | What it answers |
|------|-----------------|
| [01 sun and shadows](01_sun_and_shadows.md) | Where the sun is at a time and place, how it moves, and how long shadows fall. |
| [02 sky light](02_sky_light.md) | What colour the sky, the horizon and the ground are at each sun height (day, golden hour, dusk, night). |
| [03 clouds](03_clouds.md) | What a cloud deck looks like from below and above, how it casts shadow, and how much of the volumetric method to keep at this resolution. |
| [04 weather](04_weather.md) | The seven imagined kinds of weather (clear to dust storm), what each does to cloud, light and air, and what the game does with them. |

## What the game does, in one list

- A solar clock that runs in real time. Each mission starts at its own time of day (dawn to night), and the sun moves on from there.
- The sun's direction and colour come from that clock every frame. Sky, horizon, ground brightness, sun disc, lens flare, water glint and every object's shadow follow it.
- A cloud deck at a few hundred metres: shaded from the sun's colour, drifting with the wind, casting soft shadows on the ground along the sun's ray.

## Borrowed, and where from

The solar position formula, the air model numbers and the cloud method are taken from the family's own **Generate Clouds** project (its research notes and `js/sun.js`, `js/shader.js`, read from the Index repo's history, 2026-11-15 work). That project is written in WebGL with a full volumetric march; this game is Canvas 2D with per-pixel painting, so the method is ported and cut back, not copied as shader code. See note 03 for what was dropped.

## Not in this round

- Stars and a moon. The night is dark blue with no stars.
- Real weather, real dates. The day is fixed (1 October, mid-latitude). Weather is imagined per flight (note 04).
- Rain, snow and storms.
