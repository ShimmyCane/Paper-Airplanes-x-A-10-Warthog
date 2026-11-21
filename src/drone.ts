// Drone flight: a multirotor, not a wing. The rotors push straight up out of the frame; tilting
// the frame turns part of that push sideways, which is how a drone moves. No lift from speed,
// no stall. Four kinds, from a toy to a military drone, each with the kind of help it really has:
//
//   gps      the drone holds its place: the right stick asks for a speed, and letting go brakes
//            to a hover (camera drones, military drones)
//   althold  the drone holds its height: the left stick up and down asks to climb or sink, and
//            the right stick tilts the frame (hobby drones with a barometer)
//   none     nothing is held: the left stick is the throttle and stays where it is left, and the
//            right stick tilts the frame (a racing drone in angle mode)
//
// Sizes and speeds are close to real ones (metres, seconds). Numbers live in DRONES.
namespace PA {
  export type DroneKind = 'hobby' | 'camera' | 'racer' | 'military';
  export type DroneAssist = 'gps' | 'althold' | 'none';
  export type StickMode = 'mode2' | 'mode1' | 'mode3';

  export interface DroneSpec {
    label: string;
    assist: DroneAssist;
    maxTilt: number;     // radians the frame can tilt
    tiltRate: number;    // how fast the frame follows the stick (per second)
    twr: number;         // full thrust over weight (none: the throttle; others: their reserve)
    maxSpeed: number;    // m/s, gps: the speed the stick asks for at full
    accel: number;       // m/s², gps: how hard it speeds up or brakes
    climb: number;       // m/s up at full stick (gps and althold)
    sink: number;        // m/s down at full stick
    yawRate: number;     // radians per second at full stick
    dragLin: number;     // drag per m/s
    dragQuad: number;    // drag per (m/s)²
    raceSpeed: number;   // m/s, a fair average round the course (sets the rival racers' pace)
    size: string;        // shown in ⚙️
  }

  export const DRONES: { [k in DroneKind]: DroneSpec } = {
    // A small toy quad: slow, tilts gently, holds its height.
    hobby: { label: 'Hobby quad', assist: 'althold', maxTilt: 0.42, tiltRate: 6, twr: 2.2, maxSpeed: 8, accel: 4,
      climb: 2.5, sink: 2, yawRate: 2.4, dragLin: 0.4, dragQuad: 0.02, raceSpeed: 6, size: '15 cm, about 8 m/s' },
    // A folding camera drone (DJI-style): GPS holds it still; let go and it stops.
    camera: { label: 'Camera drone (DJI-style)', assist: 'gps', maxTilt: 0.5, tiltRate: 5, twr: 2, maxSpeed: 15, accel: 6,
      climb: 5, sink: 3, yawRate: 1.75, dragLin: 0.2, dragQuad: 0.01, raceSpeed: 11, size: '35 cm, about 15 m/s' },
    // A 5-inch racing quad in angle mode: the throttle is yours, it is fast and twitchy.
    racer: { label: 'Racing quad (FPV)', assist: 'none', maxTilt: 1.2, tiltRate: 12, twr: 4, maxSpeed: 38, accel: 30,
      climb: 0, sink: 0, yawRate: 4, dragLin: 0.05, dragQuad: 0.016, raceSpeed: 20, size: '22 cm, about 38 m/s' },
    // A military quadcopter drone: heavy, steady, GPS-held, slow to speed up and to turn.
    military: { label: 'Military drone', assist: 'gps', maxTilt: 0.4, tiltRate: 2.5, twr: 1.8, maxSpeed: 26, accel: 3.5,
      climb: 6, sink: 4, yawRate: 0.9, dragLin: 0.15, dragQuad: 0.008, raceSpeed: 16, size: '1.2 m, about 26 m/s' },
  };

  // What the two sticks ask for, after the stick mode has been applied.
  export interface DroneSticks {
    throttle: number;   // none: 0 … 1 (stays put); others: -1 sink … +1 climb (springs to 0)
    yaw: number;        // -1 … 1
    pitch: number;      // -1 back … +1 forward
    roll: number;       // -1 left … +1 right
  }

  // The two pads on the screen as x and y, -1 … 1 (y up is +1).
  export interface Pads { lx: number; ly: number; rx: number; ry: number }

  // Which pad axis does what, in each of the three common transmitter layouts.
  //   Mode 2 (the most common): left = throttle and yaw, right = pitch and roll
  //   Mode 1: left = pitch and yaw, right = throttle and roll
  //   Mode 3: left = pitch and roll, right = throttle and yaw (Mode 2 the other way round)
  export function sticksFrom(p: Pads, mode: StickMode): { thr: number; yaw: number; pitch: number; roll: number } {
    if (mode === 'mode1') return { thr: p.ry, yaw: p.lx, pitch: p.ly, roll: p.rx };
    if (mode === 'mode3') return { thr: p.ry, yaw: p.rx, pitch: p.ly, roll: p.lx };
    return { thr: p.ly, yaw: p.lx, pitch: p.ry, roll: p.rx };
  }

  // Which side the throttle is on (that pad's up and down does not spring back on the racer).
  export function throttleSide(mode: StickMode): 'left' | 'right' {
    return mode === 'mode2' ? 'left' : 'right';
  }

  export class Drone extends Aircraft {
    vX = 0;             // world velocity east
    vZ = 0;             // world velocity north
    roll = 0;           // frame tilt right (radians); drawn as the bank
    crashed = false;
    sticks: DroneSticks = { throttle: 0, yaw: 0, pitch: 0, roll: 0 };

    constructor(public readonly kind: DroneKind) {
      super(true);
    }

    get spec(): DroneSpec {
      return DRONES[this.kind];
    }

    override get speed(): number {
      return Math.hypot(this.vX, this.vZ, this.vy);
    }

    // On the ground, at rest, facing yaw.
    place(X: number, Z: number, h: number, yaw: number): void {
      this.X = X; this.Z = Z; this.h = h; this.yaw = yaw;
      this.vX = this.vZ = this.vy = this.vx = 0;
      this.pitch = this.roll = this.bank = 0;
      this.crashed = false;
      this.throttle = 0;
    }

    // Moves the drone by dt seconds. Returns true only for a crash (a hard hit on the ground).
    override step(dtIn: number, _pilot: Pilot, groundAt: (X: number, Z: number) => number): boolean {
      const dt = Math.min(dtIn, 1 / 30);
      const s = this.spec;
      const st = this.sticks;
      const g = GRAVITY;
      this.yaw += st.yaw * s.yawRate * dt;
      const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
      const ground = groundAt(this.X, this.Z);
      const onGround = this.h <= ground + 0.01;
      // Velocity in the drone's own frame: forward and right.
      let fwd = this.vX * sinY + this.vZ * cosY;
      let right = this.vX * cosY - this.vZ * sinY;

      if (s.assist === 'gps') {
        // The sticks ask for a speed; the drone tilts as much as it needs to get there.
        const wantF = st.pitch * s.maxSpeed, wantR = st.roll * s.maxSpeed;
        const aF = clampAbs((wantF - fwd) * 2, s.accel), aR = clampAbs((wantR - right) * 2, s.accel);
        if (!onGround || st.throttle > 0) { fwd += aF * dt; right += aR * dt; }
        this.pitch += (-Math.atan2(aF, g) - this.pitch) * Math.min(1, s.tiltRate * dt);
        this.roll += (Math.atan2(aR, g) - this.roll) * Math.min(1, s.tiltRate * dt);
        const wantV = st.throttle >= 0 ? st.throttle * s.climb : st.throttle * s.sink;
        this.vy += clampAbs((wantV - this.vy) * 3, 8) * dt;
        this.throttle = Math.max(0, Math.min(1, (1 + this.vy / Math.max(1, s.climb) * 0.3) / s.twr));
      } else {
        // The right stick tilts the frame; the tilt turns the push sideways.
        this.pitch += (-st.pitch * s.maxTilt - this.pitch) * Math.min(1, s.tiltRate * dt);
        this.roll += (st.roll * s.maxTilt - this.roll) * Math.min(1, s.tiltRate * dt);
        let thrust: number;   // per unit mass, along the frame's up
        if (s.assist === 'althold') {
          // Push just enough to hold the height (or climb or sink as asked), tilted or not.
          const wantV = st.throttle >= 0 ? st.throttle * s.climb : st.throttle * s.sink;
          const needUp = g + clampAbs((wantV - this.vy) * 3, 6);
          thrust = Math.min(s.twr * g, needUp / Math.max(0.3, Math.cos(this.pitch) * Math.cos(this.roll)));
          this.throttle = thrust / (s.twr * g);
        } else {
          this.throttle = Math.max(0, Math.min(1, st.throttle));
          thrust = this.throttle * s.twr * g;
        }
        const aF = thrust * Math.sin(-this.pitch) * Math.cos(this.roll);
        const aR = thrust * Math.sin(this.roll);
        const aUp = thrust * Math.cos(this.pitch) * Math.cos(this.roll) - g;
        fwd += aF * dt;
        right += aR * dt;
        this.vy += aUp * dt;
      }
      // Air drag on every direction of motion.
      const v = Math.hypot(fwd, right, this.vy);
      const drag = s.dragLin + s.dragQuad * v;
      // (A GPS drone's controller already allows for the drag when it holds a speed.)
      if (s.assist !== 'gps') {
        fwd -= fwd * drag * dt;
        right -= right * drag * dt;
      }
      if (s.assist === 'none') this.vy -= this.vy * drag * dt;

      this.vX = fwd * sinY + right * cosY;
      this.vZ = fwd * cosY - right * sinY;
      this.X += this.vX * dt;
      this.Z += this.vZ * dt;
      this.h += this.vy * dt;
      this.vx = fwd;          // forward speed, for the parts of the game that read it
      this.bank = this.roll;
      this.alpha = 0;
      this.stalled = false;

      const gnd = groundAt(this.X, this.Z);
      if (this.h <= gnd) {
        const hard = this.vy < -6 || Math.hypot(this.vX, this.vZ) > 12;
        this.h = gnd;
        if (hard) {
          this.crashed = true;
          return true;
        }
        // A soft landing: it sits on its feet and slides to a stop.
        this.vy = Math.max(0, this.vy);
        this.vX *= Math.max(0, 1 - 6 * dt);
        this.vZ *= Math.max(0, 1 - 6 * dt);
      }
      return false;
    }
  }

  function clampAbs(v: number, m: number): number {
    return Math.max(-m, Math.min(m, v));
  }
}
