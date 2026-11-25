// Shared numbers for the whole game. Change a number here, rebuild, reload.
namespace PA {
  export const VERSION = '0.23.1 (2026-11-25: training dots, rings and a circuit race; flak bursts; screen shake; hostile-only lock)';

  // Internal resolution. The canvas is small on purpose: every pixel is a
  // "pixel-art pixel", and the page scales it up with no smoothing.
  // Layout and drawing use these 480×270 units. The canvas is RES times as many pixels on each
  // side (960×540 at RES 2, four times the pixels), so the ground and sky are painted finer and
  // the sprites keep their shapes.
  export const W = 480;
  export const H = 270;
  export const RES = 2;

  // Side view, 2.5D: screen pixels per metre, across and up.
  export const PPM_X = 2;
  export const PPM_Y = 1.5;
  export const GROUND_Y = 172;      // screen row of altitude 0
  export const PLANE_X = 0.3;       // the plane sits at 30% of the width

  export const GRAVITY = 9.8;
  export const INK = '#2f2d3d';

  // Pastel palette (family look: soft, with dark outlines).
  export const COL = {
    skyTop: '#ffd9c7',
    skyBottom: '#bfe6f2',
    sun: '#fff1b8',
    cloud: '#fffdfa',
    hillFar: '#d6d0f0',
    hillMid: '#bfe3c4',
    ground: '#b9dea6',
    groundDark: '#a3cd93',
    thrust: '#ffb02e',
    lift: '#2ec4a0',
    drag: '#ff6b6b',
    weight: '#3d8bff',
    hoop: '#ff9e8a',
    hoopDone: '#7bd389',
    bullet: '#fff17a',
    shell: '#ff9e4a',
  };
}
