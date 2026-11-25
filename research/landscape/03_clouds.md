# 03 Clouds: what to draw, what the field does, what we keep

## What a cloud deck looks like from the air

- **Bright top, dark base.** Light is scattered out as it goes deeper (Beer's law). A thick cloud is grey underneath and white on top.
- **Soft edges, silver rims.** Droplets scatter strongly forward, so the thin edge toward the sun glows.
- **Flat bases.** A cumulus base sits where the air reaches its dew point, at about 125 m for every degree between the air and dew-point temperatures (Espy's rule, Generate Clouds note 01). The game uses one flat base at a few hundred metres.
- **Gaps.** Fair-weather cumulus covers a fraction of the sky; the gaps show blue. We use a cover of about 40%.

## The method the field uses

Generate Clouds (note 04) and the games industry (Schneider and Vos, 2015; Schneider, 2017 and 2022) ray-march a density field: for each pixel step along the view ray, sample the density, step a few times toward the sun to get the shadowing, and add up the light. Shape comes from noise (Perlin-Worley in the games), eroded at the edges; a weather map sets where clouds are.

## What we keep, and how it is cut back

| Part | Field (Generate Clouds, games) | Here (0.24) |
|------|-------------------------------|-------------|
| Density | 3-D Perlin-Worley, baked | 2-D value noise, three octaves (the Generate Clouds fallback) |
| Layers | several volumes | one deck at a height between 400 and 700 m |
| Lighting | 6–24 steps toward the sun, multiple scattering | two steps toward the sun (Beer), a soft fill for the dark side |
| Colour | sun colour at height, sky ambient | the sun's colour from `light.ts`, ambient from the sky palette |
| Shadow on the ground | cloud-to-ground shadows in the games | the same density sampled along the sun ray, one lookup per ground pixel |
| Wind | per-layer drift | one wind vector, the same as the wisps and smoke in the game |
| Opacity | fully opaque cores | capped at about 0.85 so the land still reads through thin cloud; softened toward the horizon |

The density is:

    cloud(X, Z) = clamp((fbm(X/S, Z/S) − (1 − cover)) × k, 0, 1)

with S a few hundred metres for the field's size, cover 0.4 for scattered cloud, k a steepness. Soft edges come from that ramp, not from a hard threshold.

## Why the cloud shadow is cheap

A ground pixel asks one question: is the sun's ray to this point blocked by the deck? The ray goes from the ground point up toward the sun to the deck's height, a single point, one density lookup. The shadow is 1 − 0.55 × cloud at that point, applied to the ground's direct light only, so the shadow darkens the land but leaves ambient light alone.

## Limits we keep

- No volumetric thickness: the deck is a flat sheet with a density, so you cannot fly into it and see its inside.
- No storm towers, anvils or rain.
- Clouds are not drawn from the deck's underside when the plane is above it; from above, the deck is drawn as a lighter sheet with the same density.

## Sources

- Schneider and Vos, "The Real-time Volumetric Cloudscapes of Horizon Zero Dawn", SIGGRAPH 2015: https://www.advances.realtimerendering.com/s2015/
- Schneider, "Nubis: Authoring Real-Time Volumetric Cloudscapes with the Decima Engine", 2017: https://www.guerrilla-games.com/read/nubis-authoring-real-time-volumetric-cloudscapes-with-the-decima-engine
- Schneider, "Nubis, Evolved", SIGGRAPH 2022: https://advances.realtimerendering.com/s2022/
- WMO International Cloud Atlas (types and levels): https://cloudatlas.wmo.int/en/
- Generate Clouds project, research notes 01–04 (family project, Index repo history, 2026-11-15).
