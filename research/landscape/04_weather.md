# 04 Weather: what each sky looks like, and what the game does with it

Research for version 0.25 (2026-11-25). The weather in the game is imagined: each flight gets one, from its seed. It is not a forecast. The rules below are the ones the picture follows.

## The kinds, and how each looks from the air

| Weather (game) | Sky | Air | Light | Game rule |
|----------------|-----|-----|-------|-----------|
| Clear | a few wisps, mostly blue | calm | full sun | 12% cloud cover |
| Scattered cloud | fair-weather cumulus, flat bases, gaps of blue | light | the sun in and out of the clouds | 42% cover |
| Overcast | one grey-white sheet | still, cool | flat, soft, no hard shadows | 85% cover, a little darker |
| Rain | a dark grey deck, low base | breezy | dimmer, bluish | 90% cover, streaks falling, a grey veil |
| Thunderstorm | a tall dark mass, anvil top | gusty | dim, with flashes | 97% cover, lightning now and then, thunder a second or two after |
| Windy | broken cloud moving fast | strong | sharp light | 50% cover, the cloud moves three times as fast |
| Dust storm | a low tan haze, little cloud | strong and gusty | brown, the sun dulled | 20% cover, brown haze, a tan veil, blasts throw up dust that the wind carries |

## What the sources say (general, not a forecast)

- Cumulus bases are flat because the air condenses at one height (note 03). The deck's flat base in the game is the same idea.
- A thunderstorm builds upward through the whole sky, with an anvil at the top spreading sideways (note 01). The game shows the dark cover and the flashes, not the towers.
- Rain and thunder darken the light: the cloud is thick, so less sun reaches the ground.
- Dust storms (haboobs and similar) are a mass of fine dust carried by strong wind. They look brown, cut visibility, and do not have clouds in the usual sense.

## How the game uses it

- One weather per flight, from the seed. The mix leans to fair weather: clear and scattered together are about 60%.
- The weather sets the cloud cover (the threshold of the cloud noise), the wind multiplier (how fast the cloud moves), and a storm number (0 to 1) that dims the sun and the sky light.
- Dust storms turn the haze brown and add a tan veil. Explosions in dust or wind throw up extra dust that drifts away.
- Thunder: lightning flashes a veil at once, and the thunder is heard one to two and a half seconds later.

## Limits we keep

- No real weather data. No temperature or humidity; no fog; no snow.
- The clouds are one deck, not a column of towers and anvils.
- Rain is streaks over the picture, not drops in the world.

## Sources

- WMO International Cloud Atlas: https://cloudatlas.wmo.int/en/
- Generate Clouds project, research notes 01 and 04 (family project, read from Index repo history, 2026-11-15).
