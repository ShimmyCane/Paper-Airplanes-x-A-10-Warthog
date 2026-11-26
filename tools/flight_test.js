// Headless check of the flight model and the missions. Loads the compiled game
// (js/game.js) in a sandbox, so there is no browser. Run: node tools/flight_test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'game.js'), 'utf8');
const ctx = { console, Math, Date };
vm.createContext(ctx);
vm.runInContext(code, ctx);
const PA = vm.runInContext('PA', ctx);

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
}
const flat = () => 0; // no hills for the flight tests
const still = { pitch: 0, yaw: 0, throttle: 0 };

// 1. Level flight. A simple hold-the-height controller finds the trim.
{
  const p = new PA.Aircraft(true);
  p.start(0, 0, 60, 60, 0.05, 0, 0.4);
  let maxAbsVy = 0;
  for (let i = 0; i < 60 * 60; i++) {           // 60 seconds at 60 fps
    const pilot = { pitch: Math.max(-1, Math.min(1, (0 - p.vy) * 0.6)), yaw: 0, throttle: 0.4 };
    p.step(1 / 60, pilot, flat);
    if (i > 60 * 20) maxAbsVy = Math.max(maxAbsVy, Math.abs(p.vy));
  }
  check('level flight: holds height with the nose (after 20 s)', maxAbsVy < 1.0, 'max |vy| = ' + maxAbsVy.toFixed(2) + ' m/s');
  check('level flight: speed settles near 94 m/s with throttle 0.4 (the stronger engine)', Math.abs(p.speed - 94) < 10, 'speed = ' + p.speed.toFixed(1) + ' m/s');
}

// 2. Full power climbs with the nose a little up.
{
  const p = new PA.Aircraft(true);
  p.start(0, 0, 60, 60, 0.05, 0, 1);
  for (let i = 0; i < 60 * 5; i++) p.step(1 / 60, still, flat);
  check('full power: climbs', p.h > 60, 'h after 5 s = ' + p.h.toFixed(1) + ' m, speed ' + p.speed.toFixed(1));
}

// 3. Stall: a steep nose at low speed loses lift.
{
  const p = new PA.Aircraft(true);
  p.start(0, 0, 80, 25, 0, 0, 0.2);
  p.pitch = 0.5;                       // nose up 29 degrees, still moving along the old path
  p.step(1 / 60, still, flat);
  check('stall: flagged past 15 degrees', p.stalled, 'alpha = ' + (p.alpha * 180 / Math.PI).toFixed(1) + ' deg');
  check('stall: lift is smaller than weight', Math.abs(p.lift[1]) < Math.abs(p.weight[1]), 'lift ' + p.lift[1].toFixed(2) + ' vs weight ' + p.weight[1].toFixed(2));
}

// 4. Paper glider (no thrust): glides down and lands; the sink fits the glide ratio.
{
  const p = new PA.Aircraft(false);
  p.start(0, 0, 90, 40, 0.08, 0, 0);
  let t = 0, touched = false;
  while (t < 120 && !touched) {
    touched = p.step(1 / 60, still, flat);
    t += 1 / 60;
  }
  const dist = Math.hypot(p.X, p.Z);
  check('paper: glides and touches down', touched, 'after ' + t.toFixed(1) + ' s, ' + dist.toFixed(0) + ' m away');
  check('paper: no thrust', p.thrust[0] === 0 && p.thrust[1] === 0);
  check('paper: flies a reasonable distance (100 to 1000 m)', dist > 100 && dist < 1000, 'distance = ' + dist.toFixed(0));
}

// 5. The ground stops the plane.
{
  const p = new PA.Aircraft(true);
  p.start(0, 0, 2, 30, -0.4, 0, 0);
  const hit = p.step(1 / 30, still, () => 3);
  check('ground: touching the ground is reported', hit && p.h === 3);
}

// 6. Turning: steering right turns the heading right and moves the plane to the right (+X).
{
  const p = new PA.Aircraft(true);
  p.start(0, 0, 60, 60, 0, 0, 0.6);
  for (let i = 0; i < 60; i++) p.step(1 / 60, { pitch: 0, yaw: 1, throttle: 0.6 }, flat);
  check('turn: right steering turns the heading right', p.yaw > 0.5, 'yaw = ' + p.yaw.toFixed(2) + ' rad');
  check('turn: the plane moves to the right of its start', p.X > 10 && p.bank > 0, 'X = ' + p.X.toFixed(0) + ', bank = ' + p.bank.toFixed(2));
}

// 6b. Flight helper: a long, hard pull never stalls, and the speed comes back by itself.
{
  const pull = (assist) => {
    const p = new PA.Aircraft(true);
    p.assist = assist;
    p.start(0, 0, 200, 50, 0.05, 0, 0.36);
    let stalled = 0, low = 999;
    for (let i = 0; i < 20 * 60; i++) {
      p.step(1 / 60, { pitch: i < 120 ? 1 : 0, yaw: 0, throttle: 0.36 }, flat);
      if (p.stalled) stalled++;
      if (i > 120) low = Math.min(low, p.speed);
    }
    return { stalled, low, end: p.speed };
  };
  const off = pull(false), on = pull(true);
  check('helper off: a 2 s full pull stalls (real flying)', off.stalled > 0, 'stalled frames ' + off.stalled);
  check('helper on: a 2 s full pull never stalls', on.stalled === 0, 'stalled frames ' + on.stalled);
  check('helper on: speed stays above 50 knots', on.low * 1.94 > 50, 'lowest ' + (on.low * 1.94).toFixed(0) + ' kt');
  check('helper on: speed comes back near cruise', on.end * 1.94 > 85, 'end ' + (on.end * 1.94).toFixed(0) + ' kt');

  const p = new PA.Aircraft(true);
  p.assist = true;
  p.start(0, 0, 200, 50, 0.05, 0, 0.36);
  let stalled = 0;
  for (let i = 0; i < 30 * 60; i++) {
    p.step(1 / 60, { pitch: 1, yaw: 0, throttle: 0.36 }, flat);
    if (p.stalled) stalled++;
  }
  check('helper on: holding full nose up for 30 s never stalls and keeps going forward', stalled === 0 && p.speed * 1.94 > 40 && p.vx > 0, 'speed ' + (p.speed * 1.94).toFixed(0) + ' kt');
}

// 7. Missions: the same seed gives the same targets and rings; free play has ground targets.
{
  const a = PA.makeMission('jet', 42);
  const b = PA.makeMission('jet', 42);
  check('missions: same seed, same targets', JSON.stringify(a.targets) === JSON.stringify(b.targets), 'targets ' + a.targets.length);
  check('missions: free play starts with ground targets', a.targets.filter(t => t.kind !== 'flak').length >= 8);
  const g = PA.makeMission('glider', 42);
  check('missions: glider has 24 rings and no guns', g.hoops.length === 24 && g.targets.length === 0);
}

// 8. Missile: locks on to a target ahead and destroys it.
{
  const settings = { mode: 'jet', control: 'drag', view: 'chase', sound: 0, forces: 0, showErrors: 0 };
  const g = new PA.Game(settings);
  g.onSound = () => {};
  const ahead = { kind: 'tank_mbt', X: g.plane.X, Z: g.plane.Z + 200, alive: true, points: 100, hp: 2, cool: 0 };
  g.mission.targets = [ahead];
  g.held.missile = true;
  for (let i = 0; i < 2 * 30; i++) g.update(1 / 30);   // hold: the lock takes about a second and a bit
  g.held.missile = false;
  for (let i = 0; i < 12 * 30 && ahead.alive; i++) g.update(1 / 30);
  check('missile: a steady hold locks on and destroys the target ahead', !ahead.alive && g.kills >= 1, 'kills = ' + g.kills);
}

// 9. A loss: the plane blinks once, then carries on with full health and a new flight; the score stays.
{
  const settings = { mode: 'jet', control: 'drag', view: 'chase', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 0, autoReload: 1, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 0, allies: 0 };
  const g = new PA.Game(settings);
  g.onSound = () => {};
  g.score = 500;
  g.hull = 0;
  g.update(1 / 30);
  check('loss: the plane blinks instead of ending the flight', g.phase === 'crashed' && g.blink > 0);
  for (let i = 0; i < 2 * 30; i++) g.update(1 / 30);
  check('loss: the flight carries on at full health, score kept', g.phase === 'flying' && g.hull === 100 && g.score === 500, 'score ' + g.score);
}

// 9b. Pause: nothing moves while the game is paused.
{
  const settings = { mode: 'jet', control: 'drag', view: 'chase', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 0, autoReload: 1, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 0, allies: 0 };
  const g = new PA.Game(settings);
  g.onSound = () => {};
  g.paused = true;
  const x0 = g.plane.X, t0 = g.time;
  for (let i = 0; i < 60; i++) g.update(1 / 30);
  check('pause: the plane and the clock stand still', g.plane.X === x0 && g.time === t0);
}

// 9c. Ammo: limited, and it comes back over time.
{
  const settings = { mode: 'jet', control: 'drag', view: 'chase', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 0, autoReload: 1, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 0, allies: 0 };
  const g = new PA.Game(settings);
  g.onSound = () => {};
  g.mission.targets = [];
  g.ammo = 10;
  g.held.fire = true;
  for (let i = 0; i < 3 * 30; i++) g.update(1 / 30);
  g.held.fire = false;
  check('ammo: firing uses it up to zero and no further', g.ammo <= 1 && g.ammo >= 0, 'ammo ' + g.ammo.toFixed(1));
  const before = g.ammo;
  for (let i = 0; i < 5 * 30; i++) g.update(1 / 30);
  check('ammo: it comes back over time', g.ammo > before + 5, 'ammo ' + g.ammo.toFixed(1));
}

// 9d. Waves: the calm first mission has no fighters; mission 2 sends one about 90 s in.
//     Allies fly and do not shoot.
{
  const settings = { mode: 'jet', control: 'drag', view: 'chase', difficulty: 'felix', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 0, autoReload: 1, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 2, allies: 1 };
  const g = new PA.Game(settings);
  g.onSound = () => {};
  check('missions: the first is the calm dots course (no fighters, no guns)', g.missionSpec.name === 'Dots' && g.missionSpec.wave === 0 && !g.missionSpec.guns, g.missionSpec.name);
  let calmSeen = 0;
  for (let i = 0; i < 100 * 30; i++) { g.update(1 / 30); calmSeen = Math.max(calmSeen, g.mission.targets.filter(t => t.faction === 'enemy').length); }
  check('range day: no fighters in 100 s', calmSeen === 0, 'max ' + calmSeen);

  g.missionNumber = 5;   // First Contact
  g.newFlight(5);
  let seen = 0, firstAt = -1;
  for (let i = 0; i < 120 * 30; i++) {
    g.update(1 / 30);
    const n = g.mission.targets.filter(t => t.faction === 'enemy').length;
    if (n > 0 && firstAt < 0) firstAt = i / 30;
    seen = Math.max(seen, n);
  }
  check('waves: First Contact sends a fighter about 90 s in', firstAt > 85 && firstAt < 95, 'first at ' + firstAt.toFixed(1) + ' s');
  check('waves: at half density a wave is one fighter (Felix)', seen === 1, 'max ' + seen);
  const ally = g.mission.targets.find(t => t.faction === 'ally');
  const a0 = ally.X;
  for (let i = 0; i < 2 * 30; i++) g.update(1 / 30);
  check('allies: they fly around (they move)', ally.X !== a0);
  check('allies: they do not shoot', !g.shells.some(s => s.warn === undefined && Math.hypot(s.X - ally.X, s.Z - ally.Z) < 2));
}

// 9f. The missions: ten in order, a return starts under fire, ships and fighters count,
//     the ground is clear of the road and rail, and the start is clear of targets.
{
  check('missions: thirteen (dots, rings, circuit, then the ten), the calm one first', PA.MISSIONS.length === 13 && PA.MISSIONS[0].wave === 0, 'count ' + PA.MISSIONS.length);
  check('missions: after thirteen, the list starts again a little harder', PA.missionFor(14).name === 'Dots' && PA.missionFor(14).count === PA.MISSIONS[0].count + 1);
  const base = { mode: 'jet', control: 'drag', view: 'chase', difficulty: 'normal', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 0, autoReload: 1, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 1, allies: 0 };

  const g = new PA.Game(base);
  g.onSound = () => {};
  g.missionNumber = 9; g.newFlight(9);   // Heading Home: starts flying home, hull down
  const behind = g.mission.targets.filter(t => t.faction === 'enemy' && t.Z < g.plane.Z).length;
  check('return: starts flying home with fighters on the tail', g.plane.Z > 800 && behind >= 1 && g.hull === 60, 'behind ' + behind + ', hull ' + g.hull);

  g.missionNumber = 12; g.newFlight(10);  // Port Strike: ships at sea
  const ships = g.mission.targets.filter(t => t.kind === 'ship');
  check('ship mission: three ships at sea', ships.length >= 3 && ships.every(t => t.X > PA.SEA_X), 'ships ' + ships.length);
  check('ship mission: a ship counts, a truck does not', g.countsForObjective(ships[0]) && !g.countsForObjective({ kind: 'truck', alive: true, faction: undefined }));

  g.missionNumber = 8; g.newFlight(11);  // Intercept: fighters count
  check('air mission: a fighter counts, a tank does not', g.countsForObjective({ kind: 'fighter', faction: 'enemy' }) && !g.countsForObjective({ kind: 'tank_mbt' }));

  g.missionNumber = 4; g.newFlight(12);  // Range Day: no guns anywhere
  const guns = g.mission.targets.filter(t => t.kind === 'sam' || t.kind === 'flak').length;
  check('range day: no guns on the map', guns === 0, 'guns ' + guns);
  const near = g.mission.targets.filter(t => t.faction === undefined && Math.hypot(t.X, t.Z) < 450).length;
  check('clear start: no ground place within 450 m of the start', near === 0, 'near ' + near);

  // Buildings never sit on the road or the railway.
  let onLine = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const m = PA.makeMission('jet', seed, PA.MISSIONS[12]);
    for (const t of m.targets) {
      if (!['farm', 'barn', 'city', 'hangar', 'barracks'].includes(t.kind)) continue;
      if (Math.abs(t.X - PA.roadX(t.Z)) < 25 || Math.abs(t.X - PA.RAIL_X) < 25) onLine++;
    }
  }
  check('ground: no building on the road or the railway', onLine === 0, 'on a line ' + onLine);

  // The lever counts with the helper on: at zero, above cruise speed, the engine is off.
  const th = new PA.Game(Object.assign({}, base, { flightHelp: 1, safeFlight: 0 }));
  th.onSound = () => {};
  th.mission.targets = [];
  th.plane.start(0, 0, 200, 60, 0, 0, 0.5);
  th.throttleSet = 0; th.update(1 / 30);
  const off = th.plane.throttle;
  th.throttleSet = 1; th.update(1 / 30);
  check('throttle: the lever counts with the flight helper on', off === 0 && th.plane.throttle === 1, 'at 0: ' + off + ', at 1: ' + th.plane.throttle);
}

// 9g. Calm missions: nothing fires at the plane for two minutes (no bases, guns, or missiles).
//     Gun missions still fire. The default lever gets past 120 knots level. Backward flight is impossible.
{
  const fired = (missionNumber) => {
    const g = new PA.Game({ mode: 'jet', control: 'drag', view: 'chase', difficulty: 'normal', sound: 0, forces: 0, showErrors: 0, safeFlight: 1, invincible: 1, autoReload: 1, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 1, allies: 1, flightHelp: 1 });
    g.onSound = () => {};
    g.missionNumber = missionNumber; g.newFlight(42);
    const seen = new Set();
    for (let i = 0; i < 120 * 30; i++) {
      g.update(1 / 30);
      for (const s of g.shells) seen.add(s);
      for (const m of g.missiles) if (m.enemy) seen.add(m);
    }
    return seen.size;
  };
  check('calm: range day, nothing fires at the plane in 2 minutes', fired(4) === 0, 'shots ' + fired(4));
  check('calm: first contact, nothing but a fighter fires in 2 minutes', fired(5) <= 12, 'shots ' + fired(5));
  check('guns: coast watch fires at the plane', fired(6) > 0, 'shots ' + fired(6));

  const g = new PA.Game({ mode: 'jet', control: 'drag', view: 'chase', difficulty: 'felix', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 0, autoReload: 1, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 0, allies: 0, flightHelp: 1 });
  g.onSound = () => {}; g.mission.targets = [];
  let top = 0;
  for (let i = 0; i < 60 * 30; i++) { g.update(1 / 30); top = Math.max(top, g.plane.speed); }
  check('speed: the default lever gets past 120 knots level', top * 1.944 > 120, 'top ' + (top * 1.944).toFixed(0) + ' kt');

  for (const assist of [true, false]) {
    const p = new PA.Aircraft(true);
    p.assist = assist;
    p.start(0, 0, 300, 52, 0, 0, 1);
    let minVx = 1e9, maxPitch = 0;
    for (let i = 0; i < 20 * 60; i++) {
      p.step(1 / 60, { pitch: 1, yaw: 0, throttle: 1 }, flat);
      minVx = Math.min(minVx, p.vx); maxPitch = Math.max(maxPitch, Math.abs(p.pitch));
    }
    check('backward: a hard pull-up never flies backward (helper ' + (assist ? 'on' : 'off') + ')', minVx > 0, 'min vx ' + minVx.toFixed(1));
    check('backward: the nose stops short of straight up (helper ' + (assist ? 'on' : 'off') + ')', maxPitch < Math.PI / 2, 'max pitch ' + (maxPitch * 57.3).toFixed(0) + ' deg');
  }
}

// 9e. Damage shows as a mark, even when invincible (and costs nothing then).
{
  const settings = { mode: 'jet', control: 'drag', view: 'chase', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 1, autoReload: 1, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 0, allies: 0 };
  const g = new PA.Game(settings);
  g.onSound = () => {};
  g.mission.targets = [];
  g.shells.push({ X: g.plane.X, Z: g.plane.Z, h: g.plane.h, vX: 0, vY: 0, vZ: 0, life: 2 });
  g.update(1 / 30);
  check('damage: a hit shows as a mark, invincible keeps the hull', g.marks.length === 1 && g.hull === 100, 'marks ' + g.marks.length);
}

// 10. Safe flight: a plane diving at the ground is pulled up and does not crash.
{
  const g = new PA.Game({ mode: 'jet', control: 'drag', view: 'chase', difficulty: 'felix', sound: 0, forces: 0, showErrors: 0, safeFlight: 1, invincible: 0, autoReload: 1 });
  g.onSound = () => {};
  g.mission.targets = [];
  g.plane.start(0, 0, PA.groundAt(0, 0) + 5, 60, -0.5, 0, 0.6);
  let crashed = false;
  for (let i = 0; i < 8 * 30; i++) { g.update(1 / 30); if (g.phase !== 'flying') { crashed = true; break; } }
  check('safe flight: a dive into the ground is pulled up, no crash', !crashed, 'phase = ' + g.phase + ', height above ground = ' + (g.plane.h - PA.groundAt(g.plane.X, g.plane.Z)).toFixed(1) + ' m');
}

// 11. Invincible: a crash with no hull does not end the flight.
{
  const g = new PA.Game({ mode: 'jet', control: 'drag', view: 'chase', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 1, autoReload: 1 });
  g.onSound = () => {};
  g.hull = 0;
  g.update(1 / 30);
  check('invincible: no crash with zero hull', g.phase === 'flying');
}

// 12. Missiles: six to start; with auto reload one comes back; without it none does.
{
  const on = new PA.Game({ mode: 'jet', control: 'drag', view: 'chase', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 0, autoReload: 1 });
  on.onSound = () => {};
  check('missiles: six to start', on.missileStock === 6);
  on.missileStock = 0;
  for (let i = 0; i < 3.2 * 30; i++) on.update(1 / 30);
  check('missiles: automatic reload brings one back', on.missileStock === 1, 'stock = ' + on.missileStock);
  const off = new PA.Game({ mode: 'jet', control: 'drag', view: 'chase', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 0, autoReload: 0 });
  off.onSound = () => {};
  off.missileStock = 0;
  for (let i = 0; i < 6 * 30; i++) off.update(1 / 30);
  check('missiles: no reload when it is off', off.missileStock === 0);
}

// 13. Gun aim: straight with nothing in front; down toward a ground target ahead.
{
  const g = new PA.Game({ mode: 'jet', control: 'drag', view: 'chase', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 0, autoReload: 1 });
  g.onSound = () => {};
  g.mission.targets = [];
  g.update(1 / 30);
  check('gun: straight with nothing in front', g.aim.mode === 'straight' && g.aim.pitch === 0);
  g.mission.targets = [{ kind: 'tank_mbt', X: g.plane.X, Z: g.plane.Z + 300, alive: true, points: 100, hp: 2, cool: 0 }];
  g.update(1 / 30);
  check('gun: depressed toward a tank ahead', g.aim.mode === 'ground' && g.aim.pitch < 0, 'pitch = ' + (g.aim.pitch * 180 / Math.PI).toFixed(2) + ' deg');
}

// 14. The world: every kind of thing has a sprite painted for it, and the sea is at the east.
{
  const names = Object.keys(PA.KINDS);
  const counts = names.map(k => { const v = PA.MODEL_BUILDERS[k](); let n = 0; for (const c of v.data) if (c) n++; return n; });
  check('models: every kind has a 3-D voxel model with real content', counts.every(n => n > 40), 'kinds: ' + names.length + ', smallest ' + Math.min(...counts) + ' voxels');
  const extra = ['plane', 'glider', 'tree0', 'tree1', 'tree2', 'tree3', 'tree4', 'house1', 'house2', 'city1', 'city2'];
  check('models: the plane, the glider, trees and town buildings all build', extra.every(k => PA.MODEL_BUILDERS[k] && PA.MODEL_BUILDERS[k]().data.some(c => c)));
  check('world: the ground is flat, so objects sit on what is drawn', PA.groundAt(123, 456) === 0 && PA.groundAt(-900, 4000) === 0);
  let lakes = 0, forests = 0, farms = 0, towns = 0;
  for (let x = -1200; x < 1200; x += 40) for (let z = 0; z < 4000; z += 40) {
    const b = PA.biomeAt(x, z);
    if (b === 'lake') lakes++; else if (b === 'forest') forests++; else if (b === 'farm') farms++; else if (b === 'town') towns++;
  }
  check('world: lakes, forests, farms and towns all appear', lakes > 0 && forests > 0 && farms > 0 && towns > 0, 'lakes ' + lakes + ', forests ' + forests + ', farms ' + farms + ', towns ' + towns);
  check('world: the sea is at the east', PA.biomeAt(PA.SEA_X + 200, 0) === 'sea' && PA.groundAt(PA.SEA_X + 200, 0) === 0);
}

// 15. Notes: numbered, with a status, sorted, and each snapshot has every code in the index.
{
  const settings = { mode: 'jet', control: 'drag', view: 'chase', sound: 0, forces: 0, showErrors: 0, safeFlight: 1, invincible: 0, autoReload: 1 };
  const g = new PA.Game(settings);
  const ids = PA.snapshot(g, settings);
  check('notes: snapshot has every code in the index', PA.INDEX.every(e => e.code in ids), 'codes ' + PA.INDEX.length);
  const a = PA.addNote('Health bar is hard to read', 'Flying', PA.subProject(settings), ids);
  const b = PA.addNote('Tanks too far away', 'Flying', 'A-10 jet / top', ids);
  check('notes: numbered N-0001 and N-0002', a.identifier === 'N-0001' && b.identifier === 'N-0002', a.identifier + ', ' + b.identifier);
  PA.setStatus(a.identifier, 'done');
  const all = PA.loadNotes();
  check('notes: status changes and is kept', all.find(n => n.identifier === 'N-0001').status === 'done');
  check('notes: sorted by status puts open first', PA.sortNotes(all, 'status')[0].identifier === 'N-0002');
  check('notes: the project name is on every note', all.every(n => n.project === PA.NOTES_PROJECT));
}

// 16. Lock-on takes time: a quick tap fires nothing; a steady hold fires.
{
  const st = { mode: 'jet', control: 'drag', view: 'chase', difficulty: 'normal', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 0, autoReload: 1, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 0, allies: 0 };
  const g = new PA.Game(st);
  g.onSound = () => {};
  g.mission.targets = [{ kind: 'tank_mbt', X: g.plane.X, Z: g.plane.Z + 300, alive: true, points: 100, hp: 2, cool: 0 }];
  g.held.missile = true;
  for (let i = 0; i < 15; i++) g.update(1 / 30);
  g.held.missile = false;
  check('lock: a quick tap fires nothing', g.missiles.length === 0 && g.missileStock === 6);
}

// 17. Normal mode: three hits and the plane is down (blinks, carries on). Felix never goes down.
{
  const st = { mode: 'jet', control: 'drag', view: 'chase', difficulty: 'normal', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 0, autoReload: 1, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 0, allies: 0 };
  const g = new PA.Game(st);
  g.onSound = () => {};
  g.mission.targets = [];
  for (let i = 0; i < 3; i++) g.shells.push({ X: g.plane.X, Z: g.plane.Z, h: g.plane.h, vX: 0, vY: 0, vZ: 0, life: 2 }), g.update(1 / 30);
  check('normal: three hits take the plane down', g.phase === 'crashed' && g.hits >= 3, 'phase ' + g.phase + ', hits ' + g.hits);
  const f = new PA.Game(Object.assign({}, st, { difficulty: 'felix' }));
  f.onSound = () => {};
  f.mission.targets = [];
  for (let i = 0; i < 6; i++) f.shells.push({ X: f.plane.X, Z: f.plane.Z, h: f.plane.h, vX: 0, vY: 0, vZ: 0, life: 2 }), f.update(1 / 30);
  check('felix: hits never take the plane down', f.phase === 'flying' && f.hull === 100 && f.hits === 6);
}

// 18. Supplies: normal mode runs out; Felix never does; a reload from the settings refills, with a cooldown.
{
  const st = { mode: 'jet', control: 'drag', view: 'chase', difficulty: 'normal', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 0, autoReload: 0, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 0, allies: 0 };
  const g = new PA.Game(st);
  g.onSound = () => {};
  g.mission.targets = [];
  g.ammo = 0;
  g.update(1 / 30);
  check('normal: the gun runs out when the ammo is gone', g.ammo < 1);
  check('reload: refills the gun from the settings', g.reloadFromSettings() === true && g.ammo === PA.AMMO_MAX);
  check('reload: a second one waits (cooldown)', g.reloadFromSettings() === false);
  const f = new PA.Game(Object.assign({}, st, { difficulty: 'felix' }));
  f.onSound = () => {};
  f.ammo = 0; f.chaff = 0; f.update(1 / 30);
  check('felix: nothing runs out', f.ammo === PA.AMMO_MAX && f.chaff === PA.CHAFF_MAX);
}

// 19. The tag: an enemy missile after the plane is tagged; a hard turn breaks it; chaff makes decoys.
{
  const st = { mode: 'jet', control: 'drag', view: 'chase', difficulty: 'normal', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 0, autoReload: 1, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 0, allies: 0 };
  const g = new PA.Game(st);
  g.onSound = () => {};
  g.mission.targets = [];
  const tagM = { X: g.plane.X + 50, Z: g.plane.Z + 200, h: g.plane.h, vX: 0, vY: 0, vZ: -100, life: 5, target: null, enemy: true };
  g.missiles.push(tagM);
  g.update(1 / 30);
  check('tag: an enemy missile tags the plane', g.tagged === true && g.tagDist > 0, 'distance ' + Math.round(g.tagDist));
  g.axes = { yaw: 1, pitch: 0 };
  // Only this missile is checked: a SAM that comes into range during the turn may launch a new one.
  for (let i = 0; i < 2 * 30; i++) g.update(1 / 30);
  check('tag: a hard turn breaks the lock', tagM.broken === true || !g.missiles.includes(tagM));
  g.fireChaff();
  check('chaff: two decoys come out and one is used', g.decoys.length === 2 && g.chaff === PA.CHAFF_MAX - 1);
}

// 20. Objective: finishing it restocks everything (normal mode).
{
  const st = { mode: 'jet', control: 'drag', view: 'chase', difficulty: 'normal', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 0, autoReload: 1, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 0, allies: 0 };
  const g = new PA.Game(st);
  g.onSound = () => {};
  g.ammo = 5; g.missileStock = 1; g.chaff = 0;
  g.objectiveDone = g.objectiveGoal;
  g.update(1 / 30);
  check('objective: finishing it restocks gun, missiles and chaff', g.ammo === PA.AMMO_MAX && g.missileStock === PA.MISSILE_MAX && g.chaff === PA.CHAFF_MAX && g.missionNumber === 2);
}

// 21. A loss in normal mode is a full reset: restocked, and the mission starts again.
{
  const st = { mode: 'jet', control: 'drag', view: 'chase', difficulty: 'normal', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 0, autoReload: 0, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 0, allies: 0 };
  const g = new PA.Game(st);
  g.onSound = () => {};
  g.ammo = 3; g.missileStock = 0; g.chaff = 0;
  g.hull = 0;
  g.update(1 / 30);
  for (let i = 0; i < 2 * 30; i++) g.update(1 / 30);
  check('loss: a full reset restocks the gun, missiles and chaff', g.ammo === PA.AMMO_MAX && g.missileStock === PA.MISSILE_MAX && g.chaff === PA.CHAFF_MAX && g.phase === 'flying');
}

// 22. The gun leads: at flying speed it hits a still target ahead, and a target moving along the road.
{
  const st = { mode: 'jet', control: 'drag', view: 'chase', difficulty: 'felix', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 0, autoReload: 1, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 0, allies: 0 };
  const still = new PA.Game(st);
  still.onSound = () => {};
  still.mission.targets = [{ kind: 'tank_mbt', X: 0, Z: still.plane.Z + 200, alive: true, points: 100, hp: 2, cool: 0 }];
  const t1 = still.mission.targets[0];
  still.held.fire = true;
  for (let i = 0; i < 3 * 30 && t1.alive; i++) still.update(1 / 30);
  check('gun: hits a still tank 200 m ahead at flying speed', !t1.alive || t1.hp < 2, 'hp ' + t1.hp + ', aim ' + still.aim.mode);

  const moving = new PA.Game(st);
  moving.onSound = () => {};
  moving.mission.targets = [{ kind: 'tank_mbt', X: 0, Z: moving.plane.Z + 250, alive: true, points: 100, hp: 2, cool: 0, vZ: 9 }];
  const t2 = moving.mission.targets[0];
  moving.held.fire = true;
  for (let i = 0; i < 3 * 30 && t2.alive; i++) moving.update(1 / 30);
  check('gun: leads a tank moving along the road', !t2.alive || t2.hp < 2, 'hp ' + t2.hp);
}

// 23. Fighters make attack runs and break off, instead of circling forever.
{
  const st = { mode: 'jet', control: 'drag', view: 'chase', difficulty: 'felix', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 0, autoReload: 1, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 0, allies: 0 };
  const g = new PA.Game(st);
  g.onSound = () => {};
  g.mission.targets = [];
  g.mission.targets.push({ kind: 'fighter', X: g.plane.X + 900, Z: g.plane.Z + 400, h: 90, alive: true, points: 200, hp: 1, cool: 0, faction: 'enemy', age: 0, vH: 0 });
  const f = g.mission.targets[0];
  const seen = new Set();
  for (let i = 0; i < 40 * 30 && f.alive; i++) { g.update(1 / 30); if (f.state) seen.add(f.state); }
  check('fighters: they go through approach, attack and break', seen.has('approach') && seen.has('attack') && seen.has('break'), 'states ' + [...seen].join(','));
}

// 24. Allies shoot at an enemy fighter that comes close to them.
{
  const st = { mode: 'jet', control: 'drag', view: 'chase', difficulty: 'felix', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 0, autoReload: 1, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 0, allies: 0 };
  const g = new PA.Game(st);
  g.onSound = () => {};
  g.mission.targets = [];
  const ally = { kind: 'ally', X: 0, Z: 1500, h: 90, alive: true, points: -300, hp: 1, cool: 0, faction: 'ally', orbit: { cx: 0, cz: 1500, r: 1, ang: 0, w: 0 }, age: 0 };
  const foe = { kind: 'fighter', X: 150, Z: 1500, h: 90, alive: true, points: 200, hp: 1, cool: 99, faction: 'enemy', age: 0, vH: 0, state: 'break', stateT: 0 };
  g.mission.targets.push(ally, foe);
  let fired = false;
  for (let i = 0; i < 3 * 30 && foe.alive; i++) { g.update(1 / 30); if (g.shots.some(s => s.friendly)) fired = true; }
  check('allies: they shoot at a fighter that comes close', fired && !foe.alive);
}

// 25. Bases: a defended base comes up as the plane passes each stretch of the route.
{
  const st = { mode: 'jet', control: 'drag', view: 'chase', difficulty: 'felix', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 0, autoReload: 1, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 0, allies: 0 };
  const g = new PA.Game(st);
  // a gun mission (Coast Watch), so bases and their guns come up
  g.missionNumber = 6; g.newFlight(7);   // Coast Watch
  g.onSound = () => {};
  const cities0 = g.mission.targets.filter(t => t.kind === 'city').length;
  g.plane.Z = 1200;   // bases come up 900 m ahead, every 2 km
  g.update(1 / 30);
  const cities1 = g.mission.targets.filter(t => t.kind === 'city').length;
  const allies = g.mission.targets.filter(t => t.faction === 'ally' && t.orbit && t.orbit.r === 450).length;
  check('bases: a base comes up ahead with towns and defending allies', cities1 >= cities0 + 3 && allies === 2, 'cities ' + cities1 + ', base allies ' + allies);
}

// 30. Enemy fire has a source and fits the weapon: a tank cannot shoot up, flak can, a SAM launches a missile.
{
  const st = { mode: 'jet', control: 'drag', view: 'chase', difficulty: 'normal', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 0, autoReload: 1, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 0, allies: 0, flightHelp: 1 };
  const setup = (kind, X, Z, h) => {
    const g = new PA.Game(st);
    // a gun mission (Coast Watch), so the ground guns are live
    g.missionNumber = 6; g.newFlight(7);   // Coast Watch
    g.onSound = () => {};
    g.plane.start(0, 0, h, 50, 0, 0, 0.36);
    const t = PA.target(kind, X, Z, () => 0.5);
    t.cool = 0;
    g.mission.targets = [t];
    g.update(1 / 30);
    return { g, t };
  };
  const over = setup('tank_mbt', 0, 20, 200);
  check('fire: a tank does not shoot at a plane high above it', over.g.shells.length === 0, 'shells ' + over.g.shells.length);
  const low = setup('tank_mbt', 0, 250, 30);
  const s0 = low.g.shells[0];
  check('fire: a tank shoots a low plane, from the tank, with a weak gun', !!s0 && Math.hypot(s0.X - low.t.X, s0.Z - low.t.Z) < 15 && s0.dmg < 10, s0 ? 'dmg ' + s0.dmg : 'no shot');
  const flak = setup('flak', 0, 100, 250);
  check('fire: flak shoots up at a high plane', flak.g.shells.length === 1 && flak.g.shells[0].r > 5);
  const sam = setup('sam', 0, 400, 200);
  const m = sam.g.missiles.find(x => x.enemy);
  check('fire: a SAM launches a homing missile that knows its source', !!m && m.src === sam.t && sam.g.shells.length === 0);
  // A missile hit hurts far more than a machine-gun hit.
  const hit = (dmg) => { const g = new PA.Game(st); g.onSound = () => {}; g.mission.targets = []; g.shells.push({ X: g.plane.X, Z: g.plane.Z, h: g.plane.h, vX: 0, vY: 0, vZ: 0, life: 2, dmg }); g.update(1 / 30); return 100 - g.hull; };
  check('fire: a machine-gun hit is small', hit(4) <= 5, 'lost ' + hit(4));
}

// 31. The red arrow points at the launcher, half a second late.
{
  const st = { mode: 'jet', control: 'drag', view: 'chase', difficulty: 'normal', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 1, autoReload: 1, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 0, allies: 0, flightHelp: 1 };
  const g = new PA.Game(st);
  // a gun mission (Coast Watch), so the ground guns are live
  g.missionNumber = 6; g.newFlight(7);   // Coast Watch
  g.onSound = () => {};
  g.plane.start(0, 0, 200, 50, 0, 0, 0.36);
  const sam = PA.target('sam', 600, 300, () => 0.5);   // ahead and to the right
  sam.cool = 0;
  g.mission.targets = [sam];
  g.update(1 / 30);
  check('arrow: shows when a SAM launches, pointing right of the nose', g.tagArrow !== null && g.tagArrow > 0.5 && g.tagArrow < 1.6, 'bearing ' + (g.tagArrow === null ? 'none' : (g.tagArrow * 180 / Math.PI).toFixed(0) + ' deg'));
  const before = g.tagArrow;
  g.plane.yaw += Math.PI / 2;            // the plane turns right 90 degrees at once
  g.update(1 / 30);
  const soon = g.tagArrow;
  for (let i = 0; i < 20; i++) g.update(1 / 30);
  check('arrow: lags about half a second, then follows the turn', Math.abs(soon - before) < 0.05 && g.tagArrow < before - 1, 'now ' + (g.tagArrow * 180 / Math.PI).toFixed(0) + ' deg');
}

// 32. Drones: each kind flies like its real class.
{
  const fly = (kind, secs, sticks, from) => {
    const d = new PA.Drone(kind);
    d.place(0, 0, 0, 0);
    if (from) from(d);
    let top = 0;
    for (let i = 0; i < secs * 60; i++) {
      d.sticks = typeof sticks === 'function' ? sticks(i / 60, d) : sticks;
      d.step(1 / 60, still, flat);
      top = Math.max(top, Math.hypot(d.vX, d.vZ));
    }
    return { d, top };
  };
  const air = (d) => { d.h = 20; };
  // Camera drone: climbs at about 5 m/s, flies about 15 m/s, stops when let go, hovers in place.
  const climb = fly('camera', 2, { throttle: 1, yaw: 0, pitch: 0, roll: 0 });
  check('drone camera: climbs at about 5 m/s', climb.d.vy > 4 && climb.d.vy < 5.5, 'vy ' + climb.d.vy.toFixed(1));
  const run = fly('camera', 8, { throttle: 0, yaw: 0, pitch: 1, roll: 0 }, air);
  check('drone camera: top speed about 15 m/s', run.top > 13.5 && run.top < 16, 'top ' + run.top.toFixed(1));
  const stop = fly('camera', 12, (t) => ({ throttle: 0, yaw: 0, pitch: t < 6 ? 1 : 0, roll: 0 }), air);
  check('drone camera: let go and it brakes to a hover', Math.hypot(stop.d.vX, stop.d.vZ) < 0.5 && Math.abs(stop.d.h - 20) < 1, 'speed ' + Math.hypot(stop.d.vX, stop.d.vZ).toFixed(2) + ', h ' + stop.d.h.toFixed(1));
  // Hobby quad: holds its height, slow.
  const hob = fly('hobby', 10, { throttle: 0, yaw: 0, pitch: 1, roll: 0 }, air);
  check('drone hobby: holds height and tops out near 8 m/s', Math.abs(hob.d.h - 20) < 1.5 && hob.top > 6 && hob.top < 10, 'top ' + hob.top.toFixed(1) + ', h ' + hob.d.h.toFixed(1));
  // Racer: a quarter throttle about hovers, full throttle climbs hard, and it is fast.
  const hov = fly('racer', 3, { throttle: 0.25, yaw: 0, pitch: 0, roll: 0 }, air);
  check('drone racer: a quarter throttle holds about a hover', Math.abs(hov.d.vy) < 1, 'vy ' + hov.d.vy.toFixed(2));
  const dash = fly('racer', 6, (t, d) => ({ throttle: 0.55 + Math.max(-0.2, Math.min(0.4, (20 - d.h) * 0.05 - d.vy * 0.05)), yaw: 0, pitch: 1, roll: 0 }), air);
  check('drone racer: much faster (over 30 m/s)', dash.top > 30, 'top ' + dash.top.toFixed(1));
  // Military: faster than the camera drone at the top, but slower to get going.
  const mil = fly('military', 2, { throttle: 0, yaw: 0, pitch: 1, roll: 0 }, air);
  const cam = fly('camera', 2, { throttle: 0, yaw: 0, pitch: 1, roll: 0 }, air);
  const milTop = fly('military', 20, { throttle: 0, yaw: 0, pitch: 1, roll: 0 }, air);
  check('drone military: slower off the mark, faster at the top', mil.top < cam.top && milTop.top > 22, '2 s ' + mil.top.toFixed(1) + ' vs ' + cam.top.toFixed(1) + ', top ' + milTop.top.toFixed(1));
  // A hard hit on the ground is a crash; a soft landing is not.
  const soft = new PA.Drone('camera'); soft.place(0, 0, 1, 0); soft.vy = -2;
  let crashed = false; for (let i = 0; i < 60; i++) crashed = soft.step(1 / 60, still, flat) || crashed;
  const hard = new PA.Drone('racer'); hard.place(0, 0, 0.3, 0); hard.vy = -15;
  check('drone: soft landing is fine, a hard hit crashes', !crashed && hard.step(1 / 30, still, flat));
}

// 33. Stick modes: the same pads mean different things in Mode 2, Mode 1 and Mode 3.
{
  const pads = { lx: 0.1, ly: 0.2, rx: 0.3, ry: 0.4 };
  const m2 = PA.sticksFrom(pads, 'mode2'), m1 = PA.sticksFrom(pads, 'mode1'), m3 = PA.sticksFrom(pads, 'mode3');
  check('sticks: Mode 2 throttle left, pitch right', m2.thr === 0.2 && m2.yaw === 0.1 && m2.pitch === 0.4 && m2.roll === 0.3);
  check('sticks: Mode 1 pitch left, throttle right', m1.pitch === 0.2 && m1.yaw === 0.1 && m1.thr === 0.4 && m1.roll === 0.3);
  check('sticks: Mode 3 pitch and roll left, throttle and yaw right', m3.pitch === 0.2 && m3.roll === 0.1 && m3.thr === 0.4 && m3.yaw === 0.3);
}

// 34. The drone race: countdown, gates only in order, two laps, rivals finish too.
{
  const st = { mode: 'drone', control: 'drag', view: 'chase', difficulty: 'felix', sound: 0, forces: 0, showErrors: 0, safeFlight: 1, invincible: 0, autoReload: 1, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 0, allies: 0, flightHelp: 1, droneKind: 'camera', stickMode: 'mode2' };
  const g = new PA.Game(st);
  g.onSound = () => {};
  check('race: a loop of gates and three rivals on the pad', g.mission.hoops.length >= 10 && g.rivals.length === 3 && g.race.countdown > 0);
  const x0 = g.plane.X;
  g.pads = { lx: 0, ly: 1, rx: 0, ry: 1 };
  for (let i = 0; i < 60; i++) g.update(1 / 30);
  check('race: nothing moves before the start', g.plane.X === x0 && g.plane.h === 0);
  for (let i = 0; i < 40; i++) g.update(1 / 30);
  // Skipping a gate does not count: jump to gate 2 first.
  const hs = g.mission.hoops;
  g.plane.X = hs[2].X; g.plane.Z = hs[2].Z; g.plane.h = hs[2].h; g.pads = { lx: 0, ly: 0, rx: 0, ry: 0 };
  g.update(1 / 30);
  check('race: a gate out of order does not count', g.race.next === 0);
  // Fly every gate in order, two laps.
  for (let lap = 0; lap < 2; lap++) {
    for (let k = 0; k < hs.length; k++) {
      g.plane.X = hs[k].X; g.plane.Z = hs[k].Z; g.plane.h = hs[k].h; g.plane.vX = g.plane.vZ = g.plane.vy = 0;
      g.update(1 / 30);
    }
  }
  check('race: two laps in order finish the race', g.race.finished && g.phase === 'landed' && g.race.results.some(r => r.name === 'You'), 'lap ' + g.race.lap + ', next ' + g.race.next);
  // Rivals fly the course on their own.
  const r = new PA.Game(st);
  r.onSound = () => {};
  for (let i = 0; i < 30 * 200; i++) r.update(1 / 30);
  const done = r.rivals.filter(x => x.done).length;
  check('race: the rivals fly both laps and finish', done === 3, done + ' finished, times ' + r.race.results.map(x => x.time.toFixed(0)).join(', '));
}

// 40. Hostile only: the missile lock and the guns ignore neutral buildings, civilians and allies.
{
  check('hostile: enemy guns, tanks and fighters are hostile', PA.isHostile({ kind: 'tank_mbt' }) && PA.isHostile({ kind: 'fighter', faction: 'enemy' }) && PA.isHostile({ kind: 'sam' }));
  check('hostile: farms, towns, trucks, rail and allies are neutral', !PA.isHostile({ kind: 'farm' }) && !PA.isHostile({ kind: 'city' }) && !PA.isHostile({ kind: 'truck' }) && !PA.isHostile({ kind: 'rail' }) && !PA.isHostile({ kind: 'ally', faction: 'ally' }));
  const st = { mode: 'jet', control: 'drag', view: 'chase', difficulty: 'normal', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 1, autoReload: 1, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 0, allies: 0 };
  const g = new PA.Game(st);
  g.onSound = () => {};
  g.mission.targets = [{ kind: 'city', X: 0, Z: 300, alive: true, points: 120, hp: 3, cool: 0 }];
  g.plane.X = 0; g.plane.Z = 0; g.plane.yaw = 0;
  check('hostile: a town straight ahead is not a lock target', g.candidate() === null);
  g.mission.targets.push({ kind: 'tank_mbt', X: 0, Z: 500, alive: true, points: 100, hp: 2, cool: 0 });
  const lock = g.candidate();
  check('hostile: a tank straight ahead is a lock target', lock !== null && lock.kind === 'tank_mbt');
}

// 41. Dots: fly roughly over each in order, from any height. Out of order does not count.
{
  const st = { mode: 'jet', control: 'drag', view: 'chase', difficulty: 'normal', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 1, autoReload: 1, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 0, allies: 0 };
  const g = new PA.Game(st);
  g.onSound = () => {};
  g.missionNumber = 1; g.newFlight(21);
  const hs = g.mission.hoops;
  check('dots: up to fifty, the first mission, no fighters or guns; the last is a big ring', g.missionSpec.goal === 'dots' && hs.length === 50 && hs.slice(0, 49).every(h => h.dot) && !hs[49].dot && hs[49].r === 60 && !g.missionSpec.guns && g.missionSpec.wave === 0);
  check('dots: later ones are further apart and smaller', hs[48].Z - hs[47].Z > hs[1].Z - hs[0].Z && hs[48].r < hs[0].r);
  const at = (h, extra) => { g.plane.X = h.X; g.plane.Z = h.Z; g.plane.h = PA.groundAt(h.X, h.Z) + extra; g.plane.vx = 50; g.plane.vy = 0; };
  at(hs[1], 30); g.update(1 / 30);
  check('dots: a dot out of order does not count', g.hoopsPassed === 0 && !hs[1].passed);
  at(hs[0], 30); g.update(1 / 30);
  check('dots: the first counts when flown over', hs[0].passed && g.hoopsPassed === 1);
  at(hs[1], 150); g.update(1 / 30);
  check('dots: height does not matter, the second counts', hs[1].passed && g.hoopsPassed === 2);
  for (let k = 2; k < hs.length - 1; k++) { at(hs[k], 30); g.update(1 / 30); }
  check('dots: the mission is still on before the fiftieth', g.missionNumber === 1 && g.hoopsPassed === 49, 'passed ' + g.hoopsPassed);
  at(hs[hs.length - 1], 30); g.update(1 / 30);
  check('dots: the mission goes on to the next one when all fifty are flown', g.missionNumber === 2, 'mission ' + g.missionNumber);
}

// 42. Rings: fly through each in order, at the ring's height. A ring out of line does not count.
{
  const st = { mode: 'jet', control: 'drag', view: 'chase', difficulty: 'normal', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 1, autoReload: 1, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 0, allies: 0 };
  const g = new PA.Game(st);
  g.onSound = () => {};
  g.missionNumber = 2; g.newFlight(22);
  const hs = g.mission.hoops;
  check('rings: twenty rings, the first big and high, then smaller', g.missionSpec.goal === 'rings' && hs.length === 20 && hs.every(h => !h.dot) && hs[0].r === 70 && hs[19].r < 20 && hs[0].h - PA.groundAt(hs[0].X, hs[0].Z) > 50);
  g.plane.X = hs[0].X; g.plane.Z = hs[0].Z; g.plane.h = hs[0].h + hs[0].r + 5; g.plane.vx = 50; g.plane.vy = 0;
  g.update(1 / 30);
  check('rings: a ring flown well above it does not count', !hs[0].passed);
  g.plane.X = hs[0].X; g.plane.Z = hs[0].Z; g.plane.h = hs[0].h; g.plane.vx = 50; g.plane.vy = 0;
  g.update(1 / 30);
  check('rings: flown through at its height, it counts', hs[0].passed && g.hoopsPassed === 1);
}

// 43. The circuit: four racers (two friends, two allied planes) at 50–90% of the optimum speed,
//     pace dropping by up to 15% now and then. Two laps finish the race.
{
  const st = { mode: 'jet', control: 'drag', view: 'chase', difficulty: 'normal', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 1, autoReload: 1, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 0, allies: 2 };
  const g = new PA.Game(st);
  g.onSound = () => {};
  g.missionNumber = 3; g.newFlight(23);
  check('circuit: a race of eight gates, two laps, four racers', g.missionSpec.goal === 'race' && g.mission.hoops.length === PA.RACE_GATES && g.race && g.race.laps === 2 && g.rivals.length === 4);
  check('circuit: racers at 50–90% of the optimum pace', g.rivals.every(r => r.vmax >= 0.5 * PA.RACE_OPTIMUM - 1e-6 && r.vmax <= 0.9 * PA.RACE_OPTIMUM + 1e-6), g.rivals.map(r => r.vmax.toFixed(1)).join(', '));
  check('circuit: no allies from the settings spawn during the race', g.mission.targets.filter(t => t.faction === 'ally' && t.orbit).length === 0);
  for (let i = 0; i < 30 * 60; i++) g.update(1 / 30);
  check('circuit: racers never exceed their top pace', g.rivals.every(r => r.v <= r.vmax * 1.02 + 0.5), g.rivals.map(r => r.v.toFixed(1)).join(', '));
  check('circuit: racers make progress round the course', g.rivals.some(r => r.lap > 1 || r.next > 0));
  const hs = g.mission.hoops;
  for (let lap = 0; lap < 2; lap++) {
    for (let k = 0; k < hs.length; k++) {
      g.plane.X = hs[k].X; g.plane.Z = hs[k].Z; g.plane.h = hs[k].h; g.plane.vx = 50; g.plane.vy = 0;
      g.update(1 / 30);
    }
  }
  check('circuit: two laps finish, the overlay goes to the results', g.race.finished && g.phase === 'landed');
  const before = g.missionNumber;
  g.endMission();
  check('end mission: the next mission starts, restocked', g.missionNumber === before + 1 && g.phase === 'flying' && g.hull === 100);
}

// 44. Flak and damage: a flak round bursts by its fuse (airframe damage, smoke over the view, a
//     jolt); a hit shakes the screen by its size, and the shake dies away.
{
  const st = { mode: 'jet', control: 'drag', view: 'chase', difficulty: 'normal', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 0, autoReload: 1, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 0, allies: 0 };
  const g = new PA.Game(st);
  g.onSound = () => {};
  g.missionNumber = 6; g.newFlight(31);
  g.mission.targets = [];
  const p = g.plane;
  const hull0 = g.hull;
  g.shells.push({ X: p.X + 10, Z: p.Z, h: p.h, vX: 0, vY: 0, vZ: 0, life: 2, dmg: 12, r: 18, flak: true });
  g.update(1 / 30);
  check('flak: a burst close by damages the airframe', g.hull < hull0 && g.hits === 1, 'hull ' + g.hull);
  check('flak: the smoke hides the view', g.dazzle > 0.3, 'dazzle ' + g.dazzle.toFixed(2));
  check('flak: the burst jolts the screen', g.shake > 0.2, 'shake ' + g.shake.toFixed(2));
  const shakeHit = g.shake;
  for (let i = 0; i < 30 * 3; i++) g.update(1 / 30);
  check('shake: it dies away after a few seconds', g.shake < shakeHit && g.shake < 0.05, 'shake ' + g.shake.toFixed(2));
  (g).takeHit(45);
  const missile = g.shake;
  (g).takeHit(4);
  check('shake: a missile shakes harder than a bullet', missile >= 0.99 && g.shake >= missile - 1e-9, 'missile ' + missile.toFixed(2) + ', after a bullet ' + g.shake.toFixed(2));
}

// 45. Light: the sun's place on the solar clock, the sky by its height, the cloud deck, and the clock.
{
  const L12 = PA.lightAt(12), L145 = PA.lightAt(14.5), L19 = PA.lightAt(19), L6 = PA.lightAt(6);
  check('light: at noon the sun is high in the south', L12.el > 32 && L12.el < 40 && L12.az > 170 && L12.az < 195, 'el ' + L12.el.toFixed(1) + ', az ' + L12.az.toFixed(0));
  check('light: mid-afternoon the sun is in the west and lower', L145.el > 20 && L145.el < 30 && L145.az > 210 && L145.az < 240, 'el ' + L145.el.toFixed(1) + ', az ' + L145.az.toFixed(0));
  check('light: at 19h it is night (below -6 degrees)', L19.el < -6 && L19.direct === 0, 'el ' + L19.el.toFixed(1));
  check('light: at 6h the sun is still below the horizon', L6.el < 0 && L6.direct === 0);
  const len = Math.hypot(...L145.sun);
  check('light: the sun vector is a unit vector pointing up when the sun is up', Math.abs(len - 1) < 1e-6 && L145.sun[1] > 0.3, 'length ' + len.toFixed(6));
  check('light: the sun sets between 17 and 18 UT in early October at 51 N', (() => {
    let h = 16; while (PA.lightAt(h).el > 0 && h < 19) h += 0.01; return h > 17 && h < 18;
  })());
  check('light: the sky is blue by day and dark at night', L12.zenith[2] > L12.zenith[0] && PA.lightAt(21).zenith[0] < 40);
  check('light: the sun is warmer near the horizon than at noon', PA.lightAt(17.3).sunCol[2] < L12.sunCol[2]);
  check('light: the ground is dark at night and bright at noon', PA.lightAt(21).ambient[1] < 0.3 && L12.ambient[1] > 0.6);
  // The cloud deck: a fair share of the sky, and never outside 0..1.
  let n = 0, m = 0, bad = 0;
  for (let x = 0; x < 6000; x += 37) for (let z = 0; z < 6000; z += 37) { const d = PA.cloudDensity(x, z, 0); m++; if (d > 0) n++; if (d < 0 || d > 1) bad++; }
  check('clouds: about 40% of the deck has cloud, and density stays in 0..1', bad === 0 && n / m > 0.3 && n / m < 0.5, 'share ' + (n / m).toFixed(2));
  let drifts = false;
  for (let x = 0; x < 3000 && !drifts; x += 50) for (let z = 0; z < 3000 && !drifts; z += 50) {
    if (Math.abs(PA.cloudDensity(x, z, 0) - PA.cloudDensity(x, z, 30)) > 0.01) drifts = true;
  }
  check('clouds: the deck drifts with the wind', drifts);
  check('clock: hours wrap past midnight', PA.wrapHours(25) === 1 && PA.wrapHours(-1) === 23);
  // Each mission starts at its own time of day, and the clock runs in real time from there.
  const st = { mode: 'jet', control: 'drag', view: 'chase', difficulty: 'normal', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 1, autoReload: 1, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 0, allies: 0 };
  const g = new PA.Game(st);
  g.onSound = () => {};
  g.missionNumber = 1; g.newFlight(5);
  check('clock: the first mission starts at dawn', g.clock === PA.MISSIONS[0].sunStart && g.clock > 5 && g.clock < 8, 'clock ' + g.clock.toFixed(2));
  const c0 = g.clock;
  for (let i = 0; i < 30 * 60; i++) g.update(1 / 30);
  check('clock: real time, a minute of flight is a minute of sun', Math.abs((g.clock - c0) - 1 / 60) < 0.001, 'moved ' + ((g.clock - c0) * 60).toFixed(3) + ' min');
  const starts = PA.MISSIONS.map(m => m.sunStart);
  check('clock: the missions start at different times, all in the day', new Set(starts).size === starts.length && starts.every(h => h >= 0 && h < 24));
  check('weather: each flight gets one, and they vary between missions', ['clear', 'scattered', 'overcast', 'rain', 'thunder', 'windy', 'dust'].includes(g.weather) && new Set(Array.from({ length: 200 }, (_, k) => PA.weatherFor(k + 1))).size >= 5);
  const coverOf = w => { let n = 0, m = 0; for (let x = 0; x < 3000; x += 37) for (let z = 0; z < 3000; z += 37) { m++; if (PA.cloudDensity(x, z, 0, PA.WEATHER[w].cover, PA.WEATHER[w].wind) > 0) n++; } return n / m; };
  check('weather: a thunderstorm is cloudier than a clear day', coverOf('thunder') > coverOf('clear') + 0.6, 'clear ' + coverOf('clear').toFixed(2) + ', thunder ' + coverOf('thunder').toFixed(2));
  check('weather: a thunderstorm flashes and rumbles now and then', (() => {
    g.weather = 'thunder'; g.flashT = 0; let flashes = 0;
    for (let i = 0; i < 30 * 60 * 2; i++) { g.update(1 / 30); if (g.flashT > 0.5) flashes++; }
    g.weather = 'clear'; return flashes > 0;
  })());
  check('tint: full day is untinted, night is dim', (() => {
    const day = PA.lightTint(PA.lightAt(12)), night = PA.lightTint(PA.lightAt(23));
    return day.every(v => v >= 0.97) && night.every(v => v < 0.3);
  })());
}

// 46. Climates and wind: each map has its own climate and wind, so the weather is not the same everywhere.
{
  const seeds = Array.from({ length: 3000 }, (_, k) => k * 7 + 3);
  const share = (cl, w) => seeds.filter(sd => PA.climateFor(sd) === cl && PA.weatherFor(sd) === w).length / Math.max(1, seeds.filter(sd => PA.climateFor(sd) === cl).length);
  check('climate: every climate is picked by some maps', Object.keys(PA.CLIMATES).every(k => seeds.some(sd => PA.climateFor(sd) === k)));
  check('climate: a stormy map has more thunder than a dry one', share('stormy', 'thunder') > share('dry', 'thunder') + 0.05, 'stormy ' + share('stormy', 'thunder').toFixed(2) + ', dry ' + share('dry', 'thunder').toFixed(2));
  check('climate: a dry map has more clear days than a wet one', share('dry', 'clear') > share('wet', 'clear') + 0.2);
  const winds = seeds.slice(0, 200).map(sd => PA.windFor(sd));
  const speeds = winds.map(w => Math.hypot(w[0], w[1]));
  check('wind: each map has its own wind, 1.5 to 4 m/s, in a random direction', speeds.every(v => v >= 1.5 - 1e-6 && v <= 4 + 1e-6) && new Set(winds.map(w => Math.round(Math.atan2(w[1], w[0]) * 10))).size > 20, 'speeds ' + Math.min(...speeds).toFixed(2) + ' to ' + Math.max(...speeds).toFixed(2));
  check('wind: the same map always has the same wind', PA.windFor(42)[0] === PA.windFor(42)[0] && PA.windFor(42)[1] === PA.windFor(42)[1]);
  const st = { mode: 'jet', control: 'drag', view: 'chase', difficulty: 'normal', sound: 0, forces: 0, showErrors: 0, safeFlight: 0, invincible: 1, autoReload: 1, volMusic: 0, volGun: 0, volTurn: 0, volWarn: 0, enemyWave: 0, allies: 0 };
  const g = new PA.Game(st);
  g.onSound = () => {};
  g.missionNumber = 5; g.newFlight(77);
  check('map: a flight carries its own climate and wind', g.climate === PA.climateFor(g.seed) && g.wind[0] === PA.windFor(g.seed)[0]);
}

// 47. Fifteen percent: a nose held 15 % up or down, with the helper off, never stalls at cruise or boost.
//     The stick at 15 % holds the nose the same way. (Idle thrust climbs can still run out of speed.)
{
  const hold15 = (stick, thr, v0) => {
    const p = new PA.Aircraft(true);
    p.assist = false;
    p.start(0, 0, 400, v0, 0, 0, thr);
    let st = 0;
    for (let i = 0; i < 30 * 60; i++) { p.step(1 / 60, { pitch: stick, yaw: 0, throttle: thr }, flat); if (p.stalled) st++; }
    return st / 60;
  };
  const nose15 = (sign, thr, v0) => {
    const p = new PA.Aircraft(true);
    p.assist = false;
    p.start(0, 0, 400, v0, 0, 0, thr);
    p.pitch = sign * Math.atan(0.15);
    let st = 0;
    for (let i = 0; i < 20 * 60; i++) { p.step(1 / 60, still, flat); if (p.stalled) st++; }
    return st / 60;
  };
  let worstStick = 0, worstNose = 0;
  for (const thr of [0.6, 1]) for (const v0 of [40, 52, 70]) {
    worstStick = Math.max(worstStick, hold15(0.15, thr, v0), hold15(-0.15, thr, v0));
    worstNose = Math.max(worstNose, nose15(1, thr, v0), nose15(-1, thr, v0));
  }
  check('15 %: the stick held up or down never stalls at cruise or boost', worstStick === 0, 'worst ' + worstStick + ' s');
  check('15 %: a nose set 15 % up or down never stalls at cruise or boost', worstNose === 0, 'worst ' + worstNose + ' s');
  // A snap to full stick is still a stall with the helper off: the 15 % fix does not take away real flying.
  const snap = new PA.Aircraft(true);
  snap.assist = false;
  snap.start(0, 0, 200, 50, 0.05, 0, 0.36);
  let snapStalled = 0;
  for (let i = 0; i < 120; i++) { snap.step(1 / 60, { pitch: 1, yaw: 0, throttle: 0.36 }, flat); if (snap.stalled) snapStalled++; }
  check('15 %: a 2 s full-stick pull still stalls with the helper off (real flying)', snapStalled > 0, 'stalled frames ' + snapStalled);
}

// 48. Tight turns: at boost speed a full-steering turn circles in about 80 m (under 90 m), not 130 m.
{
  const p = new PA.Aircraft(true);
  p.assist = true;
  p.start(0, 0, 300, 128, 0, 0, 1);
  // turn 90 degrees: the chord between the two points is R·√2 for radius R
  const x0 = p.X, z0 = p.Z;
  let t = 0;
  while (p.yaw < Math.PI / 2 && t < 10) { p.step(1 / 240, { pitch: 0, yaw: 1, throttle: 1 }, flat); t += 1 / 240; }
  const chord = Math.hypot(p.X - x0, p.Z - z0);
  const radius = chord / Math.SQRT2;
  check('turn: at boost (250 knots) a full-steering turn is under 90 m across', radius < 90, 'radius ' + radius.toFixed(0) + ' m, 90 degrees in ' + t.toFixed(2) + ' s');
}

console.log(failures === 0 ? '\nAll flight checks passed.' : '\n' + failures + ' check(s) failed.');
process.exit(failures ? 1 : 0);
