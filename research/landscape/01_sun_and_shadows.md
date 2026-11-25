# 01 The sun, where it is, and the shadows it makes

## Where the sun is

Two numbers say where the sun is for anyone standing on the ground:

- **Elevation** (height above the horizon, degrees): 90° is overhead, 0° is on the horizon, below 0° the sun has set.
- **Azimuth** (compass bearing, degrees clockwise from north): 0° north, 90° east, 180° south, 270° west.

Both come from the time, the date, the latitude and the longitude. The standard method is the one in Meeus, *Astronomical Algorithms* (1998), simplified as in the NOAA Solar Calculator (https://gml.noaa.gov/grad/solcalc/calcdetails.html):

1. Days since 2000-01-01 12:00 UT, from the date and time.
2. The sun's mean longitude and anomaly, which give its true longitude on the ecliptic (accurate to a fraction of a degree for this game's use).
3. The obliquity of the ecliptic (23.44°) turns that into right ascension and declination.
4. Greenwich sidereal time plus the longitude gives the hour angle.
5. Hour angle, declination and latitude give elevation and azimuth.

The Generate Clouds project uses exactly these steps in `js/sun.js` (`GC.Sun.pos`), and we port them to `src/light.ts`.

## How the sun moves

- It turns 15° of longitude per hour, so about 15° of azimuth per hour near the equator and less in the north at other times of year.
- Near the horizon it moves fastest in azimuth at a given rate. On 1 October at 51° N (longitude 0, solar time, no refraction) the sun rises about 06:05 UT and sets about 17:33 UT; the game's clock starts at 14:30, so sunset comes about three hours in.
- In a flight of two minutes the sun should be seen to move. In the afternoon, at "Slow" (one game hour per three real minutes) the sun's height falls about 3° a minute and its bearing turns about 4°; at "Fast" (one hour a minute) about 9° and 13°. The readout shows the time.

## Shadows

- A shadow falls directly away from the sun. Its length is the object's height divided by the tangent of the sun's elevation. At 30° elevation a 10 m tower casts a 17 m shadow; at 10° it casts 57 m; at 5° it casts 114 m. That is why golden hour looks long and dramatic.
- Shadow direction is the sun's azimuth plus 180°. A plane flying into the sun sees its shadow ahead of it; flying away, the shadow is behind.
- Cloud shadows work the same way. A cloud at height H casts its shadow at ground distance H ÷ tan(elevation) from the point below it, along the sun's bearing. A deck at 600 m casts its shadow 1 km away at 30° and 3.4 km away at 10°.
- The shadow is soft at the edges because the sun is not a point. The sun's disc is about 0.5° across, so the penumbra is about 1/100 of the distance to the object; we keep that as a soft edge, not a hard one.

## What the game uses

- `src/light.ts`: the sun's elevation and azimuth for a day and place (1 October, latitude 51° N, longitude 0, solar time), the unit vector toward the sun in the game's own axes (X east, Z north, Y up), and the sun's colour.
- Object shadows: their direction and stretch come from the sun vector each frame, not from a fixed one.
- Ground brightness: the ground's direct light is proportional to the sine of the elevation (the flat-ground Lambert term), plus a sky-coloured ambient floor, so the ground darkens with the sun.
