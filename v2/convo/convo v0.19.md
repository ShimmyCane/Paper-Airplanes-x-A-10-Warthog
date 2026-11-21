# Convo v0.19 — the flight helper (no more easy stalls)

Date: 2026-11-21. Follows `convo v0.18.md`.

Jimmy: "When I played the game, it is too easy to stall, and it is too hard to maintain speed. Do you have any ideas? Is the answer an automatic speed adjuster, or another thruster to control it?"

## Why it stalled

- The nose turns at 1.1 rad/s, so holding nose-up for only a quarter of a second passes the 15° stall angle.
- The engine sat at a fixed 36% (cruise) unless BOOST was held, and full power (6) is less than the weight (9.8), so any climb bled speed away.
- Measured: one second of full nose-up stalled the jet and dropped it from about 100 kt to 68 kt.

## Answer: both ideas, done as a helper (not another button)

A child on an iPad already has FIRE, BOOST, MISSILE and CHAFF, so the helper works on its own. It is what a modern jet's flight computer does:

1. **Stall guard.** The nose stops at about 11° from the flight path, short of the 15° stall.
2. **Automatic speed.** Below 100 kt the engine adds power by itself. BOOST still gives full power for more speed.
3. **Nose eases down when slow.** Below about 75 kt in a climb, the nose drops gently to win speed back.

**Flight helper** is a new setting (⚙️ › Other toggles › Safety and reload), on by default. Off is real flying: the old stall and the old speed loss, for when it should be a challenge. It works for the paper glider too.

Numbers, a 2-second full pull from cruise: off, 264 stalled frames; on, none, lowest speed 58 kt, back to about 110 kt. Holding full nose-up for 30 s: no stall, about 83 kt.

## Notes and database reviewed

- **Family database:** there is no notes table for this game yet. `supabase/001_gen_notes.sql` is still not applied (waiting for Jimmy). The `game_feedback` rows are all for other family games. Nothing to change there.
- **Notes for improvement (📝):** these live on the device only (never sent anywhere), so they cannot be read from here. Copy them from 📝 into a message to have them worked through.
- **Earlier open questions** (Q24 fight size, Q25 stacked ground sprites, vapour strength): Q25 is done (everything is a voxel model since v0.16); the vapour now curves (v0.18). Q24 still waits for an answer.

## Checks

- 63 flight and rule checks pass (`npm test`), five of them new for the helper.
- Browser: page loads with no errors; the Flight helper setting shows, on.

## Questions

1. Does the jet feel right now, or should the stall guard be looser (closer to 15°) for more turn?
2. Should the paper glider keep the helper too, or should it teach stalls (helper off in glider)?
