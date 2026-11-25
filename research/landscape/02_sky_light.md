# 02 The colour of the sky, the horizon and the ground

## Three things scatter sunlight

| Scatterer | Size against light | What it does | In the game |
|-----------|--------------------|--------------|-------------|
| Air molecules (Rayleigh) | Far smaller than light | Scatter blue about 5.6× more than red, in all directions (1/λ⁴) | Blue sky overhead |
| Haze (dust, smoke, salt; Mie) | About the same as light | Scatter all colours, mostly forward: a white glow round the sun and a pale horizon | Horizon band and sun glow |
| Cloud droplets | Far larger | Scatter all colours many times: white on top, grey below | The cloud deck |

Ozone absorbs orange light high up; it is one reason the sky stays blue after sunset (Generate Clouds, note 02).

## The day by sun height

Taken from the Generate Clouds sky notes, which follow the usual twilight names:

| Sun elevation | Name | Sky overhead | Horizon | Ground |
|---------------|------|--------------|---------|--------|
| above 10° | Day | blue | pale, almost white | full green and bright |
| 0° to 10° | Golden hour | blue, warmer | gold to orange | long warm shadows |
| 0° to −6° | Civil twilight | deep blue | orange band, pink opposite the sun | dim, shadows gone |
| −6° to −12° | Nautical twilight | deep blue | fading orange | grey-blue |
| −12° to −18° | Astronomical twilight | dark blue | dark | nearly night |
| below −18° | Night | navy | navy | dark |

## How the game turns this into colour

`src/light.ts` holds one palette for the sky: a zenith colour and a horizon colour for each of five key sun heights (10°, 0°, −6°, −12°, −18°), blended smoothly between them. Two extra things follow the sun:

- The sun's own colour: white-gold above 10°, warmer and dimmer as it sinks, off below the horizon.
- The sun's glow in the sky: a wide warm halo that grows as the sun gets low.

Ground colour is multiplied by the sun's light (direct, from the elevation) plus the sky's ambient colour, so the land takes on the sky's warmth at dusk without a separate palette.

## Limits we keep

- Single scattering in the air, approximated by the palette. A full model (Bruneton 2008, Hillaire 2020) would use lookup tables.
- No moon, stars or city lights at night.
- Exposure is fixed; night is dark, not a dark day.
