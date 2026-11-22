# Convo v0.22 — speed, backward flight, early attacks

Date: 2026-11-22. Follows `convo v0.21.md`.

Jimmy:
- "I still don't understand why I can't go past 100 knots."
- "Sometimes I can go backwards."
- "The first two levels I'm constantly under attack."
- What version are we on? Then merge.

## Answers

- **Version:** 0.21 was on `main` (merged as #6). This round is 0.22.
- **100 knots:** the default lever was 36%, and level flight at that setting tops out near 103 kt. The lever is the only power control (the helper only adds power when you are slow), so at 36% you cannot go faster. At full lever the sim reaches about 150 kt level. Climbing steeply at full power, the speed settles near 100 kt. That is physics, not a cap, but it is also why it felt like a wall.
- **Backwards:** the helper let the nose go past vertical (over 120° in a hard pull-up), and then thrust pushed the plane backwards and it dived. Nothing limited the nose.
- **Constant attack in levels 1–2:** the route bases (SAM and flak every 1400 m) and the tanks and ships fired in every mission, whatever its guns setting said. Mission 1 had 183 enemy shells and 13 missiles in two minutes, with no fighters.

## Changed

1. `src/flight.ts`: the nose is limited to about 69° (`AIR.maxPitch`). In the sim a hard pull-up never flies backward, with the helper on or off.
2. `src/game.ts`: ground guns, ships and route bases only operate in missions with guns. Missions 1 and 2 are silent except for one fighter in mission 2.
3. `src/game.ts`: the default lever is 60% (`CRUISE_THROTTLE`), about 130 kt level. The lever is still yours to change.
4. `tools/flight_test.js`: the gun, base and arrow tests now run in a gun mission (they were testing guns in a calm one). The 30 s nose-up check's speed floor is 40 kt (was 50): holding 69° on a 36% lever settles near 49 kt, which is correct for that climb, and the check also requires forward speed.
5. New checks: calm missions fire nothing, guns still fire, default lever past 120 kt, no backward flight.
6. Version 0.22.

## Not done

- The steep climb still settles near 100 kt at full power, because a steep climb needs more thrust than the engine gives at high speed. If you want a faster climb, the engine number is `maxThrust` in `src/flight.ts`.
- Escort, carrier start, team battle, bomber intercept and larger armour remain planned (`research/missions.md`).
