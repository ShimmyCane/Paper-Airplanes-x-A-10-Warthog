# Paper Airplanes × A-10 Warthog — Lessons

## 2026-11-18

- **A fetch can fail as a DNS error or a proxy 403.** The subagent saw ENOTFOUND; a direct curl got a CONNECT 403. Check the proxy status (`$HTTPS_PROXY/__agentproxy/status`) before writing a reference off, and say in the convo which source was not read.
- **Global `tsc` may be a newer major.** Pin the TypeScript version in the project and use `npx tsc`; v6 deprecated `module: none` and `outFile`.
- **A physics model with no lift at zero angle sinks with no input.** A stability term that pulls the nose to the flight path needs a camber (base) lift, or the plane never climbs.
- **Test a stall with the nose set after `start()`.** `start()` aims velocity along the nose, so the angle of attack starts at zero.
- **The drawer's button margins double** inside a group with side margins. Use a calc width, not 100% plus margin.
- **Node tests can load the compiled script in `vm`** if the page boot is guarded by `typeof document`.

## 2026-11-18 (round 2)

- **A class name on `<body>` can hide the whole page.** `body.stick` picked up the base `.stick { display:none }` rule meant for the joystick pad. Use names that no component uses (`joy`).
- **Ground squares under the camera vanish if they are dropped when a corner is behind the near plane.** Clamp the depth for ground corners instead.
- **Synthetic pointer events from a test can have no active pointer.** Guard `setPointerCapture` in a try/catch.
- **Drive drawer buttons with direct clicks in tests** when a gear is mid-fade; a real tap is needed only for the wake.

## 2026-11-18 (round 8, convo v0.13)

- **A stack must show.** A one-unit step with a light shade reads as a dark edge. Use a visible step (two design units) and a strong shade for the lower slices, then look at it zoomed in.
- **Enemies that chase at a fixed turn rate orbit.** Give them a phase: approach, attack run, break away, return.
- **Lead every moving shot, including allies'.** A shot aimed at where a target was misses it. Include the target's motion, and its climb or descent.
- **Test for the mechanic, not the random outcome.** The ally test failed twice for reasons in the fighter's altitude, not the gun. Trace the frames before changing the code.
- **Felix mode is for seeing things.** Radar markers should be bigger and clearer there.
- **A tap command in a shell can hide a failure.** Read the exit code of the test run itself, not of the pipe after it.

## 2026-11-21 (round 9, graphics)

- **True sprite stacking needs voxel models,** not 2-D sprites with a darker copy underneath. Bake each layer once; draw each layer with one setTransform (yaw, squash by the viewing angle, roll) and drawImage.
- **Clearing voxels needs its own call.** Writing colour 0 left black voxels (black wing tips, a black tank front). Use `cut()`.
- **A per-pixel ground is affordable at 480×270** with a field cache, a haze lookup table, no `pow` in the loop, a 2×2 sky away from the horizon, and every other column far away.
- **Size the cache to the view.** A 2 km cache under a 3 km view made near and far cells evict each other every frame.
- **Check the camera roll's sign.** A right bank must tip the land to the left.
- **Put the sun behind the player** when shadows should be seen: they then fall ahead and objects are lit from the front.

## 2026-11-21 (round 10, vapour and animations)

- **Attach effects to the drawn model, not the world.** Vapour placed in world space drifted off the wing tips because the plane is drawn with an extra bank and size. Use `modelToScreen` on the model's tip and spawn on the screen.
- **A single frame's timing lies.** The canvas defers its drawing, so the cost lands wherever it flushes. Time many frames and force a flush (`getImageData` of one pixel) at the end.
- **Profile both the stress case and normal play.** A stack cache halved a dense forest but slowed normal flight, because it kept creating canvases. Reuse fixed-size canvases from a pool, cap new entries per frame, and only cache what is expensive to draw.
- **Things that look the same from every side can be cached by size and viewing angle only.** Roll and sway then become a turn and a shear of one image.
- **Check where a test click lands.** A drag started at the right edge hit the CHAFF button, so the "turn" screenshot showed level flight.

## 2026-11-21 (round 11, curved trail, mood)

- **A constant sideways drift makes a straight trail, not a curve.** Make the drift grow with each point's age, as a point further behind a turning plane swings further.
- **Mood comes from consequence and one shared wind.** Burning wrecks show what the player did; one wind for smoke and flags ties the scene together.
- **Bridge gaps in ribbons.** When a ribbon trail restarts, insert an invisible point so it does not join the old end with a straight line.

- **Bump the version every release.** VERSION sat at 0.1.0 for eleven rounds, so Jimmy could not tell whether he had the update. Bump `VERSION` and the `?v=` cache-buster on the script and CSS links together.

## 2026-11-21 (round 13)

- **Check a registry's constraints before writing a script for it.** `app_table_registry.access` only allows `owner` or `reads`; read `pg_constraint` first.
- **A test that checks "every missile" fails when the world spawns new ones.** Keep a reference to the thing under test.
- **Ring and gate sizes carry the jet's scale.** A line width set for 6 m rings seen from 100 m fills the screen at 10 m; scale by what is being drawn.
- **A drone with GPS holds a speed: do not add drag on top of its speed controller,** or it never reaches its top speed.
- **Pursuit AI that aims past a gate can orbit it.** Count a gate when the racer crosses its plane near the middle.

## 2026-11-22 (round 14, convo v0.21)

- **A camera angle that moves with the nose must add, not subtract.** A nose-up plane shows more of its top, so the view goes up with the pitch.
- **A default that hides a control is a bug, not a setting.** The throttle only showed with the helper off, and the helper ignored it. Make the control always show and let the helper add to it.
- **A test that counts live objects can see zero by chance.** A fighter spawned and shot down by an ally before the check ran. Watch over the whole window instead.
- **Keep the mission data in one table.** Goal, start, guns and waves in `MISSIONS` let the HUD, radar and spawner read the same rules.

## 2026-11-22 (round 15, convo v0.22)

- **A limit that is only on the angle of attack lets the nose go over the top.** Clamp the attitude itself. Past vertical, thrust points backward.
- **Check which mode runs before blaming the physics.** The 100-knot "wall" was the default lever (36%), not the drag model.
- **A rule set on one list must reach every spawner.** Route bases and tank guns ignored the mission's guns setting. Gate the firing, not just the spawn.
- **Tests that set up the thing under test must use the mode it needs.** After calm missions became the default, gun tests needed a gun mission.

## 2026-11-25 (round 16, convo v0.23)

- **A rule that says "targetable" must be checked in every path.** The lock was fixed first, but the gun aim and the bullets still reached neutral buildings. Make one `isHostile` helper and call it from the lock, the aim and the hit loop.
- **Order matters inside one frame.** The mission-complete check ran before the dot check, so the mission advanced one frame late and a test that checked straight after the last dot failed. Run the thing that changes the count before the thing that reads it.
- **Tests that name missions by position break when the list grows.** Thirteen missions shifted every index. Refer to a mission by its number in one place, or look it up by name.
- **Resolution changes need a transform, not new constants.** Keeping the layout in 480×270 units and drawing through `setTransform(RES)` raised the detail four times without touching every size in `render.ts`. The per-pixel background is the one place that must use device pixels.
- **Check the default mode before a browser test.** The page opens in paper-glider mode, so a test that expected missions saw none. Switch the mode in the test first.
- **Shake belongs on the element, not the canvas drawing.** A CSS transform on the view canvas shakes the picture without repainting it, and the scale hides the edges.
- **A village is a cluster, not a scatter.** Five percent of farm cells with one house each read as isolated; a 10% chance of three or four houses together reads as a place.

## 2026-11-25 (round 17, the landscape)

- **Keep the sun in one vector and derive everything from it.** Sky, sun disc, flare, water glint, ground light and object shadows all read the same sun vector from the frame's light. The first version had the sun fixed in the code, and moving it meant editing five places.
- **Shadow length is 1/tan(elevation), so clamp the elevation.** Near the horizon a tower's shadow runs off to kilometres, and at sunset it is negative. Clamp the angle to a few degrees for the stretch, and switch shadows off below 2°.
- **Night needs an ambient floor, or the ground is black.** At 19:30 the ground was almost black; a floor of 0.16 on the sky's colour keeps it dim and readable. Check a dusk screenshot, not only a noon one.
- **Do not evaluate a noise field per pixel for clouds.** A density grid of 30 m cells round the camera, refreshed every 0.4 s (the wind moves the deck about a metre in that time), makes each sky and ground lookup four reads instead of three noise octaves.
- **A test for drift must pick a point on a cloud edge.** At a fully covered or fully clear point the density is 0 or 1 at every time, so the check failed for no real reason; search for a point where it changes.
- **Game time tied to flight time runs slower when frames are slow.** The step is capped at 1/30 s, so a headless browser at 15 fps moves the clock at half speed. Test the clock with explicit update counts, not with wall-clock waits.
- **Check the astronomy against known values before trusting it.** Noon at 51° N in early October must be about 36° high and due south, and the sun must set in the late afternoon. The first sunset note said 18:10; the formula gave 17:33. Fix the note to the number the code gives.
- **A corner readout collides with the HUD.** The time line sat over the ammo and missile pills at the top. Put a new readout in a free corner (top right) and check it at 390 px.
- **Borrow from a sister project's history, not from another repo.** The Generate Clouds code was read from the Index repo's history, which the nursery keeps. Say where a borrowed idea came from in the research README, and cut it back to the page's resolution (the full volumetric march is not kept).

## 2026-11-25 (round 18, real-time sun, weather, object light)

- **A stretched fill covers only what the transform says.** The rain veil covered only the top-left quarter: an earlier step had left the drawing transform at 1×, so `fillRect(0,0,W,H)` filled 480×270 device pixels. The seam sat at the screen centre. Set the transform inside each overlay function, do not inherit it.
- **Find the cause by removing one thing at a time.** Clear weather had no seam; rain did. Switching off the ground shadow did not help; switching off the overlay did. Three one-shot renders found it in a few minutes.
- **A coarse cloud grid shows its own cell edges and window edges.** The window edge is faded over the last 900 m, so no line shows at its border.
- **Tint by caching a copy, not by painting over the picture.** Each model's slices are multiplied by the light's tint and kept per light level (quantised to a twelfth, up to six sets). Painting a veil over objects would also tint the sky behind them.
- **Keep the transparent outline when tinting.** Multiply fills the whole canvas and makes the transparent pixels opaque; a `destination-in` pass with the original brings the outline back.
- **Real time means a mission starts at its own hour.** A 1-minute-per-minute clock with per-mission start times gives dawn, afternoon and dusk missions without any setting. The first version had a sun-speed setting; Jimmy's answer ("nothing static") removed it.
- **Weather is per flight, from the seed.** The cover threshold is the one knob that gives clear, scattered, overcast and rain from the same noise; calibrate the threshold against the cover share with a sweep, not by eye.
- **Put the open questions beside the feedback box.** A "Questions" group in ⚙️ keeps the answers tied to the screen they are about.

## 2026-11-25 (fix: sprites off-centre and half size since the 960×540 change)

- **A helper that resets the transform to 1× breaks every later draw.** The sprite code set an absolute matrix in layout units and then reset to identity. After the first sprite, the plane and everything drawn after it used device pixels, so the plane sat a quarter of the way across and objects were half size. The check that caught it was a screenshot against an old one, not the tests. Every reset goes back to the layout scale (`resetLayout` in `voxel.ts`), and every absolute matrix multiplies by RES (`setLayout`).
- **Compare a new screenshot with an old one of the same view.** The plane was centred in the 480×270 frames and not in the 960×540 frames; a side-by-side made the change obvious.
