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
    group: 'army' | 'farm' | 'town' | 'airfield' | 'port' | 'rail' | 'air';
  }

  export const KINDS: { [k: string]: KindInfo } = {
    tank_mbt:   { r: 2.6, height: 2.6, hp: 2, points: 100, group: 'army', gun: { range: 350, cool: 1.4, speed: 320, type: 'mg', dmg: 4, elev: 0.3, spread: 0.05 } },
    tank_light: { r: 2.2, height: 2.0, hp: 1, points: 60, group: 'army', gun: { range: 320, cool: 1.6, speed: 320, type: 'mg', dmg: 4, elev: 0.3, spread: 0.05 } },
    apc:        { r: 2.4, height: 2.2, hp: 1, points: 50, group: 'army', gun: { range: 320, cool: 1.2, speed: 320, type: 'mg', dmg: 4, elev: 0.6, spread: 0.06 } },
    truck:      { r: 2.0, height: 2.6, hp: 1, points: 40, group: 'farm' },
    fuel:       { r: 2.6, height: 2.6, hp: 1, points: 60, group: 'airfield' },
    sam:        { r: 3.0, height: 3.5, hp: 2, points: 150, group: 'army', gun: { range: 1100, cool: 10, speed: 170, type: 'sam', dmg: 45, elev: 1.5, spread: 0 } },
    flak:       { r: 2.0, height: 3.0, hp: 1, points: 80, group: 'army', gun: { range: 650, cool: 1.8, speed: 240, type: 'flak', dmg: 12, elev: 1.5, spread: 0.025 } },
    farm:       { r: 4.0, height: 4.0, hp: 1, points: 30, group: 'farm' },
    barn:       { r: 4.0, height: 3.5, hp: 1, points: 40, group: 'farm' },
    city:       { r: 3.0, height: 12, hp: 3, points: 120, group: 'town' },
    barracks:   { r: 5.0, height: 3.0, hp: 2, points: 120, group: 'army' },
    hangar:     { r: 6.0, height: 5.0, hp: 3, points: 200, group: 'airfield' },
    jet:        { r: 3.0, height: 2.5, hp: 1, points: 150, group: 'airfield' },
    ship:       { r: 6.0, height: 3.0, hp: 4, points: 250, group: 'port', gun: { range: 800, cool: 2.6, speed: 280, type: 'cannon', dmg: 20, elev: 1.2, spread: 0.015 } },
    rail:       { r: 2.5, height: 2.5, hp: 1, points: 40, group: 'rail' },
    fighter:    { r: 4.5, height: 3.0, hp: 1, points: 200, group: 'air', gun: { range: 380, cool: 2.6, speed: 330, type: 'mg', dmg: 6, elev: 1.6, spread: 0.03 } },
    ally:       { r: 3.0, height: 2.5, hp: 1, points: -300, group: 'air' },
    rival1:     { r: 0.5, height: 0.3, hp: 1, points: 0, group: 'air' },
    rival2:     { r: 0.5, height: 0.3, hp: 1, points: 0, group: 'air' },
    rival3:     { r: 0.5, height: 0.3, hp: 1, points: 0, group: 'air' },
  };

  // Which kinds drive along the road (and how fast, metres per second).
  export const DRIVES: { [k: string]: number } = { tank_mbt: 3, tank_light: 6, apc: 6, truck: 9, fuel: 7 };

  // Is this a mission target? Ground places and vehicles count; ships, rail and the air do not.
  export function isObjective(t: { kind: string; faction?: string }): boolean {
    if (t.faction) return false;
    const group = KINDS[t.kind].group;
    return group === 'army' || group === 'farm' || group === 'town';
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

  // Clusters of things in front of baseZ. Each cluster is one kind of place.
  export function spawnTargets(rand: () => number, baseZ: number, count: number): Target[] {
    const out: Target[] = [];
    for (let i = 0; i < count; i++) {
      const Z = baseZ + i * 120 + rand() * 60;
      const roll = rand();
      const landX = (rand() - 0.5) * 900;
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
        out.push(target('sam', X + 14, Z - 4, rand));
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
        out.push(target('flak', SEA_X - 30, Z, rand));
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
    const dist = 1100 + rand() * 200;
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

  export function makeMission(mode: Mode, seed: number): Mission {
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
    return { mode, targets: spawnTargets(rand, 260, 10), hoops: [] };
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
