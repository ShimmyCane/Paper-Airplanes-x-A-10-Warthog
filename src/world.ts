// The land and the sea, and what is on them. Same seed, same start.
namespace PA {
  export type Mode = 'jet' | 'glider' | 'drone';

  // A seeded random number generator (mulberry32). Returns 0 up to 1.
  export function random(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  export const SEA_X = 1300;   // the coast runs north near here; east of it is the sea
  export const ROAD_X = -120;  // the main road runs north along this line
  export const ROAD_W = 7;     // half its width, metres
  // One gentle wind for the whole world (metres a second): smoke and flags lean with it.
  export const WIND = { X: 2.2, Z: -1.2 };
  export const RAIL_X = -320;  // the railway runs north along this line

  // The ground is flat (the land is shaped by colour, not height), so every object sits
  // exactly on what is drawn. The sea is at the same level.
  export function groundAt(_X: number, _Z: number): number {
    return 0;
  }

  // A repeatable pseudo-random number from a cell (so the same place always looks the same).
  export function cellNoise(i: number, j: number, salt: number): number {
    let h = (i * 374761393 + j * 668265263 + salt * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // Integer hash of a grid point, 0 up to 1.
  export function hash2(ix: number, iz: number): number {
    let h = (ix * 374761393 + iz * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // Smooth value noise, 0 up to 1: the same place always gives the same value.
  export function noise2(x: number, z: number): number {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
  }

  // The coastline wanders a little east and west as it runs north.
  export function coastX(Z: number): number {
    return SEA_X - 45 + 90 * noise2(Z / 380, 13.7);
  }

  export function isSea(X: number, Z = 0): boolean {
    return X > coastX(Z);
  }

  // One field shapes both lakes and forests: lakes at its peaks, forests on the slopes round them.
  export function wildValue(X: number, Z: number): number {
    return noise2(X / 300 + 31.1, Z / 300 - 7.3) * 0.72 + noise2(X / 90 + 3.7, Z / 90 + 1.9) * 0.28;
  }

  // The kind of country: farms where it is low, towns where it is high, open grass between.
  export function regionValue(X: number, Z: number): number {
    return noise2(X / 900 + 50.5, Z / 900 - 20.25);
  }

  export const LAKE_LEVEL = 0.74;      // wildValue above this is a lake
  export const FOREST_LEVEL = 0.6;     // between this and the lake level is forest

  // A small pond in the farmland: 0 none, 1 water, 2 the sandy rim. Ponds sit on a 60 m grid,
  // each one at a random spot in its cell, so they are placed the same way every flight.
  export function pondAt(X: number, Z: number): number {
    const ci = Math.floor(X / 60), cj = Math.floor(Z / 60);
    let rim = 0;
    for (let i = ci - 1; i <= ci + 1; i++) {
      for (let j = cj - 1; j <= cj + 1; j++) {
        if (cellNoise(i, j, 103) > 0.12) continue;
        const px = (i + 0.2 + 0.6 * cellNoise(i, j, 107)) * 60;
        const pz = (j + 0.2 + 0.6 * cellNoise(i, j, 109)) * 60;
        const r = 6 + 6 * cellNoise(i, j, 113);
        const d = Math.hypot(X - px, Z - pz) / r;
        if (d < 1) return 1;
        if (d < 1.25) rim = 2;
      }
    }
    return rim;
  }

  export function isLake(X: number, Z: number): boolean {
    if (isSea(X, Z) || Math.abs(X - ROAD_X) < 30 || Math.abs(X - RAIL_X) < 20) return false;
    return wildValue(X, Z) > LAKE_LEVEL;
  }

  export function isForest(X: number, Z: number): boolean {
    if (isSea(X, Z) || Math.abs(X - ROAD_X) < 16 || Math.abs(X - RAIL_X) < 10) return false;
    const w = wildValue(X, Z);
    return w > FOREST_LEVEL && w < LAKE_LEVEL - 0.02;
  }

  export function biomeAt(X: number, Z: number): 'sea' | 'lake' | 'farm' | 'town' | 'army' | 'forest' {
    if (isSea(X, Z)) return 'sea';
    if (isLake(X, Z)) return 'lake';
    if (isForest(X, Z)) return 'forest';
    const r = regionValue(X, Z);
    if (r < 0.42) return 'farm';
    if (r > 0.66) return 'town';
    return 'army';
  }

  // Where a thing is in the air, or its ground height when it is on the ground.
  export function altOf(t: { X: number; Z: number; h?: number }): number {
    return t.h !== undefined ? t.h : groundAt(t.X, t.Z);
  }

  // Every kind of thing that can be hit.
  //   r, height: the hit box in metres; hp: hits to destroy; points: score
  //   gun: it shoots at the plane (range in m, seconds between shots, shell speed), with
  //   type (mg: a machine gun, weak and scattered; flak: an anti-aircraft gun that bursts;
  //   cannon: a ship's or base turret's gun; sam: it launches a homing missile), hull damage
  //   per hit (of 100), and the highest angle it can aim up (radians). A tank's gun cannot
  //   aim up at a plane overhead; flak and SAMs can.
  export type GunType = 'mg' | 'flak' | 'cannon' | 'sam';
  export interface Gun { range: number; cool: number; speed: number; type: GunType; dmg: number; elev: number; spread: number }
  export interface KindInfo {
    r: number; height: number; hp: number; points: number;
    gun?: Gun;
    hostile?: boolean;   // an enemy unit or gun: the only things the missile can lock on to
    group: 'army' | 'farm' | 'town' | 'airfield' | 'port' | 'rail' | 'air';
  }

  export const KINDS: { [k: string]: KindInfo } = {
    tank_mbt:   { r: 2.6, height: 2.6, hp: 2, points: 100, hostile: true, group: 'army', gun: { range: 350, cool: 1.4, speed: 320, type: 'mg', dmg: 4, elev: 0.3, spread: 0.05 } },
    tank_light: { r: 2.2, height: 2.0, hp: 1, points: 60, hostile: true, group: 'army', gun: { range: 320, cool: 1.6, speed: 320, type: 'mg', dmg: 4, elev: 0.3, spread: 0.05 } },
    apc:        { r: 2.4, height: 2.2, hp: 1, points: 50, hostile: true, group: 'army', gun: { range: 320, cool: 1.2, speed: 320, type: 'mg', dmg: 4, elev: 0.6, spread: 0.06 } },
    truck:      { r: 2.0, height: 2.6, hp: 1, points: 40, group: 'farm' },
    fuel:       { r: 2.6, height: 2.6, hp: 1, points: 60, group: 'airfield' },
    sam:        { r: 3.0, height: 3.5, hp: 2, points: 150, hostile: true, group: 'army', gun: { range: 1100, cool: 10, speed: 170, type: 'sam', dmg: 45, elev: 1.5, spread: 0 } },
    flak:       { r: 2.0, height: 3.0, hp: 1, points: 80, hostile: true, group: 'army', gun: { range: 650, cool: 1.8, speed: 240, type: 'flak', dmg: 12, elev: 1.5, spread: 0.025 } },
    farm:       { r: 4.0, height: 4.0, hp: 1, points: 30, group: 'farm' },
    barn:       { r: 4.0, height: 3.5, hp: 1, points: 40, group: 'farm' },
    city:       { r: 3.0, height: 12, hp: 3, points: 120, group: 'town' },
    barracks:   { r: 5.0, height: 3.0, hp: 2, points: 120, group: 'army' },
    hangar:     { r: 6.0, height: 5.0, hp: 3, points: 200, group: 'airfield' },
    jet:        { r: 3.0, height: 2.5, hp: 1, points: 150, hostile: true, group: 'airfield' },
    ship:       { r: 6.0, height: 3.0, hp: 4, points: 250, hostile: true, group: 'port', gun: { range: 800, cool: 2.6, speed: 280, type: 'cannon', dmg: 20, elev: 1.2, spread: 0.015 } },
    rail:       { r: 2.5, height: 2.5, hp: 1, points: 40, group: 'rail' },
    fighter:    { r: 4.5, height: 3.0, hp: 1, points: 200, hostile: true, group: 'air', gun: { range: 380, cool: 2.6, speed: 330, type: 'mg', dmg: 6, elev: 1.6, spread: 0.03 } },
    ally:       { r: 3.0, height: 2.5, hp: 1, points: -300, group: 'air' },
    rival1:     { r: 0.5, height: 0.3, hp: 1, points: 0, group: 'air' },
    rival2:     { r: 0.5, height: 0.3, hp: 1, points: 0, group: 'air' },
    rival3:     { r: 0.5, height: 0.3, hp: 1, points: 0, group: 'air' },
  };

  // Which kinds drive along the road (and how fast, metres per second).
  export const DRIVES: { [k: string]: number } = { tank_mbt: 3, tank_light: 6, apc: 6, truck: 9, fuel: 7 };

  // Is this a mission target? Ground places and vehicles count; ships, rail and the air do not.
  // Is this a mission target? Enemy vehicles, guns and jets on the ground count; buildings,
  // civilians, ships and the air do not (ships have their own mission).
  export function isObjective(t: { kind: string; faction?: string }): boolean {
    if (t.faction || !KINDS[t.kind].hostile) return false;
    const group = KINDS[t.kind].group;
    return group === 'army' || group === 'airfield';
  }

  // Can the plane lock a missile on it? Only enemies: fighters, and hostile ground and sea units.
  // Buildings, farms, towns, trucks, rail, fuel, allies and rivals are neutral.
  export function isHostile(t: { kind: string; faction?: string }): boolean {
    if (t.faction) return t.faction === 'enemy';
    return !!KINDS[t.kind]?.hostile;
  }

  export interface Target {
    kind: string;
    X: number;
    Z: number;
    alive: boolean;
    points: number;
    hp: number;
    cool: number;      // gun: seconds until the next shot
    vZ?: number;       // a vehicle on the road moves this fast
    h?: number;        // in the air: the altitude (undefined on the ground)
    vX?: number;       // in the air: flight velocity
    vZa?: number;
    vH?: number;       // in the air: the path it flies (for allies: an orbit)
    orbit?: { cx: number; cz: number; r: number; ang: number; w: number };
    faction?: 'enemy' | 'ally';
    age?: number;
    state?: 'approach' | 'attack' | 'break';   // enemy fighters: the phase of their flight
    stateT?: number;                           // seconds in that phase
  }

  export interface Hoop {
    X: number;
    Z: number;
    h: number;
    r: number;
    passed: boolean;
    yaw?: number;        // drone gates face along the course (radians); glider rings face the plane
    dot?: boolean;       // a training dot: flown roughly over, height does not count
  }

  export interface Mission {
    mode: Mode;
    targets: Target[];
    hoops: Hoop[];
  }

  export function target(kind: string, X: number, Z: number, rand: () => number): Target {
    const info = KINDS[kind];
    return {
      kind, X, Z, alive: true, points: info.points, hp: info.hp,
      cool: info.gun ? 1 + rand() * info.gun.cool : 0,
    };
  }

  // A place on land for a cluster. It keeps off the road and the railway, so no house or
  // barn ends up sitting on a line.
  export function landSite(rand: () => number): number {
    let X = 0;
    for (let tries = 0; tries < 8; tries++) {
      X = (rand() - 0.5) * 900;
      if (Math.abs(X - ROAD_X) > 40 && Math.abs(X - RAIL_X) > 40) break;
    }
    return X;
  }

  // Clusters of things in front of baseZ. Each cluster is one kind of place.
  // guns: whether the army, town and coast have anti-aircraft guns (missions decide this).
  // Clusters are spread this far apart along the route, so a flight has room between them.
  export const SPACING = 220;
  export function spawnTargets(rand: () => number, baseZ: number, count: number, guns = true): Target[] {
    const out: Target[] = [];
    for (let i = 0; i < count; i++) {
      const Z = baseZ + i * SPACING + rand() * 80;
      const roll = rand();
      const landX = landSite(rand);
      // Some vehicles drive along the road, north or south.
      const driver = (kind: string, X: number, Z: number): Target => {
        const t = target(kind, X, Z, rand);
        if (DRIVES[kind] !== undefined && rand() < 0.5) t.vZ = (rand() < 0.5 ? -1 : 1) * DRIVES[kind];
        return t;
      };
      if (roll < 0.32) {
        // Army: tanks, carriers, a SAM site or a flak gun.
        const X = landX;
        out.push(driver('tank_mbt', ROAD_X + 4, Z));
        out.push(driver(rand() < 0.5 ? 'tank_light' : 'apc', ROAD_X - 6, Z + 4));
        if (!guns) continue;
        if (rand() < 0.5) out.push(target('sam', X - 10, Z + 10, rand));
        else out.push(target('flak', X + 14, Z - 6, rand));
      } else if (roll < 0.5) {
        // Farm: houses, barns and a lorry.
        const X = landX;
        out.push(target('farm', X, Z, rand));
        out.push(target('barn', X + 12, Z + 9, rand));
        out.push(driver('truck', ROAD_X + 3, Z + 6));
      } else if (roll < 0.66) {
        // Town: towers, barracks and a SAM site.
        const X = landX;
        out.push(target('city', X, Z, rand));
        out.push(target('city', X + 8, Z + 6, rand));
        out.push(target('city', X - 7, Z + 9, rand));
        if (guns) out.push(target('sam', X + 14, Z - 4, rand));
      } else if (roll < 0.78) {
        // Airfield: a hangar, parked jets and a fuel tanker.
        const X = Math.min(SEA_X - 120, landX);
        out.push(target('hangar', X, Z, rand));
        out.push(target('jet', X + 12, Z + 8, rand));
        out.push(target('jet', X + 18, Z + 8, rand));
        out.push(target('fuel', X - 10, Z + 10, rand));
      } else if (roll < 0.9) {
        // Port: a ship on the sea, with a flak gun on the coast.
        const X = SEA_X + 80 + rand() * 300;
        out.push(target('ship', X, Z, rand));
        if (guns) out.push(target('flak', SEA_X - 30, Z, rand));
      } else {
        // Railway: wagons on the line.
        const X = RAIL_X;
        out.push(target('rail', X, Z, rand));
        out.push(target('rail', X, Z + 6, rand));
        out.push(target('barracks', X + 40, Z + 12, rand));
      }
    }
    return out;
  }

  // An enemy fighter or an ally, flying in from far off.
  export function spawnAir(rand: () => number, px: number, pz: number, enemy: boolean): Target {
    const bearing = (rand() - 0.5) * 1.2;           // radians either side of the nose
    const dist = 1500 + rand() * 300;
    const X = px + Math.sin(bearing) * dist;
    const Z = pz + Math.cos(bearing) * dist;
    const h = 80 + rand() * 40;
    if (enemy) {
      return { kind: 'fighter', X, Z, h, alive: true, points: KINDS.fighter.points, hp: 1,
        cool: 1 + rand() * 2, faction: 'enemy', age: 0 };
    }
    // Allies orbit a point near the front, at a steady height.
    const cx = px + (rand() - 0.5) * 600, cz = pz + 500 + rand() * 500;
    return { kind: 'ally', X: cx + 900, Z: cz, h: 90, alive: true, points: KINDS.ally.points, hp: 1, cool: 0,
      faction: 'ally', orbit: { cx, cz, r: 900, ang: rand() * Math.PI * 2, w: 0.09 }, age: 0 };
  }

  // The missions, in order. Mission 1 is a calm range day: no fighters and no guns, so the
  // first flight is about learning the controls. Later ones add fighters, guns and ships.
  // start: 'takeoff' from the runway, or 'return': already flying home, hull down, with
  // fighters on the tail (the first wave of them is there from the start).
  // wave: fighters per wave at the normal setting (2); the setting scales it.
  export interface MissionSpec {
    name: string;
    brief: string;
    goal: 'ground' | 'air' | 'ship' | 'dots' | 'rings' | 'race';   // dots and rings: training in order; race: laps of a circuit
    count: number;      // how many to destroy
    ships: number;      // ships placed at sea (ship missions)
    guns: boolean;      // anti-aircraft guns on the ground and the coast
    start: 'takeoff' | 'return';
    firstWave: number;  // seconds before the first fighter wave
    waveEvery: number;  // seconds between waves
    wave: number;       // fighters per wave
  }

  export const MISSIONS: MissionSpec[] = [
    { name: 'Dots', brief: 'Fly roughly over each dot, in order. The next one is lit on the radar.', goal: 'dots', count: 6, ships: 0, guns: false, start: 'takeoff', firstWave: 0, waveEvery: 60, wave: 0 },
    { name: 'Rings', brief: 'Fly through each ring, in order. Nothing shoots at you on this one.', goal: 'rings', count: 8, ships: 0, guns: false, start: 'takeoff', firstWave: 0, waveEvery: 60, wave: 0 },
    { name: 'Circuit', brief: 'Two laps of the circuit against two friends and two allied planes. Hold your speed.', goal: 'race', count: 2, ships: 0, guns: false, start: 'takeoff', firstWave: 0, waveEvery: 60, wave: 0 },
    { name: 'Range Day', brief: 'Practice on the range. Three ground targets, no fighters, no guns.', goal: 'ground', count: 3, ships: 0, guns: false, start: 'takeoff', firstWave: 0, waveEvery: 60, wave: 0 },
    { name: 'First Contact', brief: 'One fighter now and then. Hold the nose on a target until it locks.', goal: 'ground', count: 4, ships: 0, guns: false, start: 'takeoff', firstWave: 90, waveEvery: 90, wave: 2 },
    { name: 'Coast Watch', brief: 'Two ships off the coast, with flak on the shore.', goal: 'ship', count: 2, ships: 2, guns: true, start: 'takeoff', firstWave: 100, waveEvery: 80, wave: 2 },
    { name: 'Armour Strike', brief: 'Tanks on the move. Six of them, with a fighter now and then.', goal: 'ground', count: 6, ships: 0, guns: true, start: 'takeoff', firstWave: 120, waveEvery: 100, wave: 2 },
    { name: 'Intercept', brief: 'Enemy fighters are coming in. Shoot down three.', goal: 'air', count: 3, ships: 0, guns: false, start: 'takeoff', firstWave: 30, waveEvery: 45, wave: 3 },
    { name: 'Heading Home', brief: 'Flying home with a fighter on your tail. Break it off, then finish the job.', goal: 'ground', count: 3, ships: 0, guns: false, start: 'return', firstWave: 40, waveEvery: 60, wave: 1 },
    { name: 'Town Watch', brief: 'The town has SAM sites. Five targets, and stay out of the missiles.', goal: 'ground', count: 5, ships: 0, guns: true, start: 'takeoff', firstWave: 120, waveEvery: 90, wave: 2 },
    { name: 'Air Superiority', brief: 'Five fighters over the sea lane. Guns and missiles both help.', goal: 'air', count: 5, ships: 0, guns: true, start: 'takeoff', firstWave: 30, waveEvery: 40, wave: 3 },
    { name: 'Port Strike', brief: 'Three ships in the harbour, with the shore guns awake.', goal: 'ship', count: 3, ships: 3, guns: true, start: 'takeoff', firstWave: 60, waveEvery: 60, wave: 2 },
    { name: 'Last Light', brief: 'Eight targets before dark, with everything they have. Coming home under fire.', goal: 'ground', count: 8, ships: 0, guns: true, start: 'return', firstWave: 30, waveEvery: 45, wave: 3 },
  ];

  // The spec for mission number n (from 1). After the list, it starts again, a little harder.
  export function missionFor(n: number): MissionSpec {
    const base = MISSIONS[(n - 1) % MISSIONS.length];
    const loop = Math.floor((n - 1) / MISSIONS.length);
    return { ...base, count: base.count + loop, wave: base.wave > 0 ? base.wave + loop : 0 };
  }

  // Training courses (jet). Dots are flown roughly over, in order; rings are flown through, in order.
  // They run north from the runway, spaced out so each one is a short climb-free glide away.
  export function trainingCourse(rand: () => number, count: number, dot: boolean): Hoop[] {
    const out: Hoop[] = [];
    for (let i = 0; i < count; i++) {
      const X = (rand() - 0.5) * 500;
      const Z = 380 + i * (dot ? 300 : 200) + rand() * 60;
      const h = dot ? 0 : 25 + rand() * 30;
      out.push({ X, Z, h: groundAt(X, Z) + h, r: dot ? 40 : 10, passed: false, dot, yaw: dot ? undefined : 0 });
    }
    return out;
  }

  // The race circuit: a loop about 3.8 km round, to the west of the runway. The plane starts
  // heading north on it, and the last gate sits on the start line, so one lap ends where it began.
  export const RACE_GATES = 8;
  export const RACE_OPTIMUM = 60;    // m/s, about 115 knots: the speed the racers' pace is set against
  export function raceCircuit(): Hoop[] {
    const R = 600, cx = -600, cz = 0;
    const out: Hoop[] = [];
    for (let i = 0; i < RACE_GATES; i++) {
      const a = ((i + 1) / RACE_GATES) * Math.PI * 2;
      const X = cx + R * Math.cos(a), Z = cz + R * Math.sin(a);
      // The gate faces along the course: the tangent of the circle at this point.
      const yaw = Math.atan2(-Math.sin(a), Math.cos(a));
      out.push({ X, Z, h: groundAt(X, Z) + 60 + 15 * Math.sin(a * 2), r: 45, passed: false, yaw });
    }
    return out;
  }

  export function makeMission(mode: Mode, seed: number, spec: MissionSpec = MISSIONS[0]): Mission {
    const rand = random(seed);
    if (mode === 'glider') {
      const hoops: Hoop[] = [];
      for (let i = 0; i < 24; i++) {
        const X = (rand() - 0.5) * 60;
        const Z = 220 + i * 110 + rand() * 30;
        hoops.push({ X, Z, h: groundAt(X, Z) + 12 + rand() * 40, r: 6, passed: false });
      }
      return { mode, targets: [], hoops };
    }
    if (mode === 'drone') return { mode, targets: [], hoops: droneCourse() };
    // The first clusters start well out, so there is room to fly before anything is in reach.
    const targets = spawnTargets(rand, 520, 12, spec.guns);
    for (let i = 0; i < spec.ships; i++) {
      targets.push(target('ship', SEA_X + 140 + rand() * 160, 620 + i * 220 + rand() * 60, rand));
    }
    const hoops = spec.goal === 'race' ? raceCircuit()
      : spec.goal === 'dots' || spec.goal === 'rings' ? trainingCourse(rand, spec.count, spec.goal === 'dots')
      : [];
    return { mode, targets, hoops };
  }

  // The drone race: a closed loop of gates over open fields, about 700 m round, low and high.
  // Gate 0 is just ahead of the start pad, which is at (0, 0) facing north.
  export const DRONE_GATES = 14;
  export function droneCourse(): Hoop[] {
    const pts: [number, number, number][] = [];
    for (let i = 0; i < DRONE_GATES; i++) {
      const a = (i / DRONE_GATES) * Math.PI * 2;
      const R = 100 + 28 * Math.sin(a * 3 + 0.6);
      // A loop that starts heading north from the pad and comes back round to it.
      const X = -Math.cos(a) * R * 1.25 + 125;
      const Z = Math.sin(a) * R + 40;
      const h = 3 + 4 * (1 + Math.sin(a * 2)) + (i % 4 === 2 ? 4 : 0);
      pts.push([X, Z, h]);
    }
    return pts.map((p, i) => {
      const prev = pts[(i + DRONE_GATES - 1) % DRONE_GATES], next = pts[(i + 1) % DRONE_GATES];
      return { X: p[0], Z: p[1], h: groundAt(p[0], p[1]) + p[2], r: 3.2, passed: false, yaw: Math.atan2(next[0] - prev[0], next[1] - prev[1]) };
    });
  }
}
