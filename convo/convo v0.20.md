# Convo v0.20 — archive v2, real enemy fire, red radar arrow, throttle lever, drone flight

Date: 2026-11-21. Follows `convo v0.19.md`.

Jimmy:
- The notes SQL failed: `app_table_registry_access_check`. "May need to rewrite sql, maybe delete and reset (ok with lost notes)."
- Flight helper on by default (yes). Off: add a throttle "like a second joystick", lower right. The paper glider keeps the helper (yes).
- "Archive the game, I think it is playable enough right now."
- Enemy fire: tanks cannot fire up; flak can; others have machine guns that are usually not effective; ship and base turrets fire cannon; SAMs and fighters' missiles are the most dangerous. Above all, incoming fire must have a source.
- When a missile is locked on, a red arrow to where the radar is, half a second late, always pointing at the opponent.
- A new mode, drone flight, to bridge paper planes, the 1950s jet and today's drones. Start from the paper airplane mode. Drones to pick from (hobby, DJI, racer, military). Real drone controls, with two other layouts in ⚙️ to learn the common ones. Real scale, speed, acceleration and control. A timed race round the loop, with more racers.

## Built

1. **Notes SQL fixed** (`supabase/001_gen_notes.sql`). The registry only allows `access` of `owner` or `reads`; the script used `family`. It now starts by dropping both tables and their registry rows (a clean reset; notes in them are lost, as agreed), and registers them as `owner`. Not applied from here: paste it as before.
2. **Archived as v2** (`v2/`): the jet game with the flight helper, as it was. Linked from ⚙️ › 🗄️ Archived, with v1.
3. **Throttle lever** (helper off, jet only): a lever left of the buttons, lower right. It stays where you leave it, like a real throttle; R and F on a keyboard. BOOST still gives full power.
4. **Enemy fire with a source and a weapon** (`KINDS` in `src/world.ts`):
   - Tanks and carriers: machine guns. Weak (4 of 100 hull), scattered, and a tank cannot aim more than about 17° up.
   - Flak: an anti-aircraft gun that aims straight up and bursts near the plane (12).
   - Ships: cannon (20).
   - SAM sites: a homing missile from the launcher (45), one in the air at a time.
   - Fighters: machine guns (6) and their missiles (45).
   - Every shot leaves its gun with a muzzle flash and a puff of smoke. Nothing comes from empty ground.
5. **Red arrow to the radar:** while a missile is on you, a red arrow on the warning ring points at whoever launched it (SAM or FIGHTER and the distance). It shows where they were half a second ago, and keeps following as you or they move.
6. **Drone flight** (⚙️ › Plane › Drone):
   - **Four drones** (`DRONES` in `src/drone.ts`), with the help each really has:
     - Hobby quad: 15 cm, about 8 m/s, holds its height.
     - Camera drone (DJI-style): 35 cm, 15 m/s, climbs 5 m/s. GPS: push to fly, let go and it brakes to a hover.
     - Racing quad (FPV): 22 cm, about 38 m/s (over 130 km/h). Angle mode with no help: the throttle stays where you leave it, and about a quarter holds a hover.
     - Military drone: 1.2 m, 26 m/s, GPS-held, slow to get going and to turn.
   - **Two thumb sticks** replace the other controls. Three transmitter layouts in ⚙️:
     - Mode 2 (default, the most common): left stick is throttle and yaw, right stick is pitch and roll.
     - Mode 1: left stick is pitch and yaw, right stick is throttle and roll.
     - Mode 3: Mode 2 the other way round.
     - Keys: W A S D for the left stick, the arrows for the right.
   - **Physics:** a drone tilts to move. The rotors push along the frame, and tilting turns part of that push forward or sideways. There is no lift from speed and no stall.
   - **The race:** a loop of 14 gates over open fields, about 700 m round, two laps, with a 3-2-1-GO start. The next gate is lit yellow, gates count only in order, and a crash puts you back at the last gate with 3 s added.
   - **Three rivals:** Swift, Comet and Pixel, paced to the drone you chose.
   - **Results:** a timer and your place in the bar, the finish order at the end, and your best time per drone kept on this device.
   - **Views:** chase, top-down and FPV. Camera and military drones hold the FPV camera level on a gimbal. On the hobby and racing quads the camera is fixed to the frame (tilted up on the racer), so it tips and rolls with the drone.

## Checks

- `npm test`: every check passes, including the new ones for weapons, the arrow, drone physics, stick modes and the race. The "hard turn breaks the lock" check had failed now and then: a SAM could spawn during the turn and launch a new missile. It now checks only the missile it launched.
- Browser (Chromium): no page errors. Screenshots of the arrow at a SAM launch, the throttle lever, the drone chase view, FPV, and a phone-size screen with no sideways scroll. The racer's throttle stays put after letting go.
- Not tested on an iPad.

## Questions

1. Is the race length right (two laps, about 2 minutes on the camera drone), or should laps be a setting?
2. Should the racing quad also offer **acro (rate) mode**, the way most real FPV pilots fly (no self-levelling)? It is much harder.
3. Drone ideas for later: obstacles (trees and poles near gates), a freestyle course, or wind gusts.
