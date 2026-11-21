# Acro mode for the racing quad — build plan

Status: planned (2026-11-21). The ⚙️ panel already says "Coming soon: acro mode". To be built later, step by step, from this file.
Read first: `CLAUDE.md` (rules), `src/drone.ts`, the drone parts of `src/render.ts` (`DRONE_VIEWS`, `makeCam`, `droneSelf`) and `src/main.ts` (`bindPads`, `resolvePads`), and `tools/flight_test.js` sections 32–34.

## What acro mode is

Today the racer flies in **angle mode**: the right stick sets a tilt angle, up to 69°, and letting go levels the drone.
In **acro mode** (also called rate mode), the stick sets a **spin rate**:
- Push the stick and the drone keeps rotating. Centre the stick and it stops rotating, but **stays at whatever angle it reached**. Nothing levels it.
- A full roll or flip is possible, and so is flying upside down.
- The throttle still pushes along the frame's "up". Upside down, it pushes the drone **down**.
- "Air mode": the drone can still be steered at zero throttle, as on real flight controllers.

Real numbers (typical Betaflight-style rates):
- About 670°/s (11.7 rad/s) at full stick for roll and pitch, and about 400°/s (7 rad/s) for yaw.
- A "super rate" curve is used, so the middle of the stick is gentle and the ends are fast.

## Scope

- Only the **racer** (`DRONES.racer`). The other drones keep their help.
- A new setting, `droneFlight: 'angle' | 'acro'`. The default is `'angle'`. It is shown only when the racer is chosen.
- No change to the jet, the glider, or the other drones. Their tests must still pass unchanged.

## Step 1: setting and ⚙️ (small)

1. `src/game.ts`, `Settings`: add `droneFlight?: 'angle' | 'acro';   // racer only`.
2. `src/main.ts`:
   - `DEFAULTS`: add `droneFlight: 'angle'`.
   - `onSeg`: add `'droneFlight'` to the list of keys that hold strings (the line with `'droneKind' || key === 'stickMode'`).
3. `index.html`, in the drone settings:
   - Add a `.setting droneOnly racerOnly` block containing `<div class="seg" data-key="droneFlight">`, with buttons `angle` ("Angle (self-level)") and `acro` ("Acro (rate)").
   - Add a hint.
   - Replace the "Coming soon: acro mode" line with that hint.
4. `css/app.css`: add `.racerOnly { display: none; }` and `body.drone.racer .racerOnly { display: block; }`. In `applyBodyClasses()`, toggle the class `racer` on `<body>` when `settings.droneKind === 'racer'`.
5. In the `ASSIST_TEXT` area of `renderDroneHints()`, when the racer is in acro, say: "Acro: the sticks spin the drone; let go and it holds its angle. Practise high up."

Check: `npm run build`, `npm test` (everything passes), and the toggle shows only for the racer.

## Step 2: attitude as a quaternion (the main change, in `src/drone.ts`)

Angle mode stores small angles (`pitch`, `roll`, `yaw`). A flip needs a full 3-D orientation, so acro keeps a **quaternion**.

1. Add to `Drone`: `q: [number, number, number, number] = [1, 0, 0, 0]` (w, x, y, z), the body-to-world rotation.
   - World axes, as in the game: X east, Y up (height `h`), Z north.
   - Body axes: right `+x`, up `+y`, forward `+z`.
2. Small helpers in `drone.ts` (no library):
   - `qMul(a, b)`
   - `qNorm(q)`
   - `qRotate(q, v)` (rotates a vector)
   - `qFromYaw(yaw)` (rotation about world Y by `yaw`, so that body forward `[0,0,1]` maps to `[sin yaw, 0, cos yaw]`)
3. In `place()`: set `this.q = qFromYaw(yaw)`.
4. In `DRONES.racer`, add `rates: { roll: 11.7, pitch: 11.7, yaw: 7, superRate: 0.7 }`. Put it in the `DroneSpec` interface as optional. Numbers live only in `DRONES` (CLAUDE.md rule).
5. Rate curve: `rate(stick, max, sr) = max * stick * (1 - sr + sr * stick * stick)`.
   - Full stick still gives `max`.
   - Half stick gives about 40% of `max` (gentle near the centre).
6. In `step()`, when `this.kind === 'racer' && this.acro` (set `acro` from the game, as `assist` is for the jet), use a new branch instead of the angle-mode tilt lines (lines ~129–131 today):
   - Body rates in rad/s:
     - `wx = rate(st.pitch, …)`: pitch forward is a rotation about body +x. Check the sign: stick forward must tip the nose down.
     - `wy = -rate(st.yaw, …)`: yaw right is about body −y. Check the sign: stick right must turn right.
     - `wz = -rate(st.roll, …)`: roll right is about body −z. Check the sign: stick right must drop the right side.
   - Integrate: `q = qNorm(qMul(q, [1, wx*dt/2, wy*dt/2, wz*dt/2]))`. This is a body-frame update and is accurate at 60 fps.
   - Thrust: `up = qRotate(q, [0, 1, 0])` and `T = throttle * twr * g`. Then `vX += up[0]*T*dt`, `vy += (up[1]*T - g)*dt`, `vZ += up[2]*T*dt`.
   - Drag: the same as today, on all three axes (`dragLin + dragQuad*|v|`).
   - Position: `X += vX*dt`, and so on, as today.
   - Throttle: as today, `(raw.thr + 1) / 2` and it stays put. Air mode needs nothing extra: rotation does not depend on throttle.
7. Keep the old fields working for the rest of the game, which reads `yaw`, `pitch`, `bank`, `vx`, `speed`:
   - `fwd = qRotate(q, [0,0,1])` and `right = qRotate(q, [1,0,0])`.
   - `yaw = atan2(fwd[0], fwd[2])`. When the nose points almost straight up or down (`|fwd[1]| > 0.98`), use the `up` vector's horizontal direction instead, so the heading does not jump.
   - `pitch = -asin(clamp(fwd[1]))` (negative is nose down, as in angle mode), and `roll = asin(clamp(-right[1]))`. Set `bank = roll`.
   - `vx = vX*sin(yaw) + vZ*cos(yaw)`.
   - Also keep `this.upsideDown = up[1] < 0`. The HUD and FPV use it.
8. Ground: as today. Also treat touching the ground while upside down (`up[1] < 0.2`) as a crash.

## Step 3: FPV and chase camera for full rotations (`src/render.ts`)

`makeCam` builds the camera from yaw, tilt and roll, which cannot show the drone upside down.
- **FPV with acro:** build the camera straight from the body axes. Tilt the camera up by the racer's uptilt (0.35 rad) about body right:
  - forward = `cos(t)*fwd + sin(t)*up`
  - up = `cos(t)*up − sin(t)*fwd`
  - right = `fwd × up`, normalised. Check its handedness against the existing `Cam` (`rx, ry, rz` is screen-right).
  - Fill `Cam` (`fx, fy, fz`, `ux, uy, uz`, `rx, ry, rz`) with these, set `roll = 0` (the axes already carry it) and `yaw` from `fwd`.
  - `project()` needs no change. Check that `paintBackground` handles a camera looking up or upside down. If the sky and ground per-pixel code assumes `fy` small, the horizon test may need the up vector. Look for where it uses `c.roll`.
- **Chase with acro:** keep the camera level behind the drone's heading (as today). Draw the drone model with `pose.roll = roll` and `elev` from `pitch`. When `upsideDown`, flip it with `pose.roll += Math.PI`, so a flip reads clearly.
- Top-down: no change.

## Step 4: HUD and help text (`src/main.ts`)

- `message()` for the racer in acro:
  - "Acro: the sticks spin the drone; centre them to hold the angle."
  - When `upsideDown`: "Upside down! Roll back over."
- Optional: a small attitude ball (horizon) in the FPV overlay, drawn from `up` and `fwd`. Leave it for a later round if short of time.

## Step 5: tests (`tools/flight_test.js`, a new section after 34)

Write each test to check the mechanic, not a random result:
1. **Rate, not angle:** a racer in acro, at 50 m, throttle at hover. Full roll stick for 0.25 s turns it about 11.7 × 0.25 ≈ 2.9 rad, give or take 20%. Read the angle from `q`.
2. **No self-level:** roll to about 45°, centre the sticks, step 2 s. The bank stays within 3° of 45°. (Angle mode, by contrast, levels it: keep that as a check too.)
3. **Full flip:** full pitch stick for 2π/11.7 s ≈ 0.537 s. The drone ends close to upright (`up[1] > 0.95`), and `yaw` has not jumped by more than 0.2 rad.
4. **Thrust follows the frame:** upside down at full throttle, `vy` goes down faster than gravity alone.
5. **Sign checks:** pitch stick forward gives forward speed after a moment at hover throttle. Roll right moves the drone right (+X when the heading is north). Yaw right turns the heading clockwise (`yaw` increases).
6. **Other drones unchanged:** sections 32–34 still pass with no edits.

Run `npm test` five times. All runs must pass. If one fails now and then, trace the cause; do not loosen the check.

## Step 6: release

1. `src/config.ts`: set `VERSION` to `0.21 (… acro mode for the racer)`. In `index.html`, change `?v=0.20` to `?v=0.21` on the CSS and the script.
2. `npm run build` and `npm test`. Commit both `src/` and `js/game.js`.
3. Browser check (`smoke-test` skill, or Playwright as in earlier rounds):
   - Racer plus acro: no page errors.
   - Screenshots of FPV mid-roll and upside down, and of the chase view mid-flip.
   - Phone size, 390×844: no sideways scroll.
4. Log:
   - `convo/convo v0.21.md`: what was built, the checks, and questions.
   - `schematic.md`: a round-14 section.
   - `04 AI/brief.md` and `lessons.md`.
5. Push to the session's branch and open a draft PR.

## Watch out for

- **Sign conventions:** they are the most likely bug. Write the sign tests (step 5.5) first and make them pass before anything else.
- **Normalise the quaternion every step,** or it drifts.
- **Heading at nose-straight-up:** `atan2` of a near-zero vector jumps. Use the fallback in step 2.7.
- **Old fields:** do not break `yaw`, `pitch` and `bank` for the rest of the game. The rival racers, the gates and the place all read only `X`, `Z` and `h`.
- **Key repeat:** keyboard acro is hard. Holding an arrow key spins the drone continuously. That is correct; the hint should say so.
