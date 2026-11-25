// Light: where the sun is, what colour the sun and the sky are, and where the cloud deck is.
// Research in research/landscape/. The solar position is the Meeus / NOAA method, ported from
// the Generate Clouds project (js/sun.js). The game's axes: X east, Y up, Z north (the start heading).
namespace PA {
  export const PLACE = { lat: 51, lon: 0 };          // a mid-latitude place, in solar time
  export const DAY_MS = Date.UTC(2026, 9, 1);        // the day: 1 October, midnight UT
  export const START_HOUR = 14.5;                    // the clock starts mid-afternoon: the sun is low

  export interface SolarPos { el: number; az: number }   // degrees; az is from north, clockwise

  // Where the sun is at a moment (ms since 1970, UT) for a place. Elevation above the horizon, and
  // the compass bearing (0 north, 90 east).
  export function solarPos(ms: number, lat: number, lon: number): SolarPos {
    const rad = Math.PI / 180;
    const d = ms / 86400000 + 2440587.5 - 2451545.0;
    const g = rad * (357.529 + 0.98560028 * d);
    const q = 280.459 + 0.98564736 * d;
    const L = rad * (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g));
    const e = rad * (23.439 - 0.00000036 * d);
    const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
    const dec = Math.asin(Math.sin(e) * Math.sin(L));
    const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
    const ha = rad * (gmst * 15 + lon) - ra;
    const la = rad * lat;
    const el = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha));
    const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(la) - Math.sin(la) * Math.cos(ha));
    return { el: el / rad, az: ((az / rad) % 360 + 360) % 360 };
  }

  // The unit vector toward the sun, in the game's axes: east is +X, north is +Z, up is +Y.
  export function sunVector(el: number, az: number): [number, number, number] {
    const rad = Math.PI / 180;
    const e = el * rad, a = az * rad;
    return [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
  }

  export type RGB = [number, number, number];

  export interface Light {
    hours: number;             // the solar clock, hours from midnight
    el: number;                // sun elevation, degrees
    az: number;                // sun bearing, degrees
    sun: RGB;                  // unit vector toward the sun (X east, Y up, Z north)
    sunCol: RGB;               // the sun's colour, 0-255
    direct: number;            // 0-1: how much direct sunlight reaches the ground (0 at night)
    zenith: RGB;               // sky colour overhead, 0-255
    horizon: RGB;              // sky colour at the horizon, 0-255 (also the haze colour)
    ambient: RGB;              // sky light on the ground, 0-1 per channel
  }

  // The sky palette, by sun elevation: [elevation, zenith, horizon]. Blended between the keys.
  const SKY_KEYS: [number, RGB, RGB][] = [
    [10, [78, 152, 222], [246, 226, 206]],     // day
    [0, [92, 140, 206], [252, 190, 128]],      // golden hour, the sun on the horizon
    [-6, [62, 88, 150], [236, 122, 104]],      // civil twilight: the orange band
    [-12, [34, 46, 92], [92, 80, 120]],        // nautical twilight
    [-18, [14, 20, 42], [30, 34, 58]],         // astronomical twilight: almost night
  ];

  function mix(a: RGB, b: RGB, t: number): RGB {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  function palette(el: number): { zenith: RGB; horizon: RGB } {
    if (el >= SKY_KEYS[0][0]) return { zenith: SKY_KEYS[0][1], horizon: SKY_KEYS[0][2] };
    for (let i = 0; i < SKY_KEYS.length - 1; i++) {
      const hi = SKY_KEYS[i], lo = SKY_KEYS[i + 1];
      if (el >= lo[0]) {
        const t = (hi[0] - el) / (hi[0] - lo[0]);
        const s = t * t * (3 - 2 * t);     // a smooth step between the keys
        return { zenith: mix(hi[1], lo[1], s), horizon: mix(hi[2], lo[2], s) };
      }
    }
    const last = SKY_KEYS[SKY_KEYS.length - 1];
    return { zenith: last[1], horizon: last[2] };
  }

  // The light at a moment on the solar clock.
  export function lightAt(hours: number): Light {
    const ms = DAY_MS + hours * 3600000;
    const p = solarPos(ms, PLACE.lat, PLACE.lon);
    const sun = sunVector(p.el, p.az);
    const pal = palette(p.el);
    // Direct sun: full above 6 degrees, fading to nothing at the horizon.
    const direct = Math.max(0, Math.min(1, p.el / 6));
    // The colour of the sun: white-gold high up, warm and deeper orange as it sinks.
    const warm = Math.max(0, Math.min(1, p.el / 10));
    const sunCol: RGB = [255, 168 + 78 * warm, 92 + 128 * warm];
    // Ambient sky light: the sky's colour (mostly overhead), with a floor so night is dim, not black.
    const sky = (k: number): number => (0.6 * pal.zenith[k] + 0.4 * pal.horizon[k]) / 255;
    const ambient: RGB = [0, 1, 2].map(k => 0.16 + 0.9 * sky(k)) as RGB;
    return { hours, el: p.el, az: p.az, sun, sunCol, direct, zenith: pal.zenith, horizon: pal.horizon, ambient };
  }

  // The solar clock: hours from midnight, wrapped to 0-24.
  export function wrapHours(h: number): number {
    return ((h % 24) + 24) % 24;
  }

  // ---- Clouds: one deck of cumulus at a height ------------------------------------------

  export const CLOUD_BASE = 520;          // metres: the flat base of the deck
  export const CLOUD_SCALE = 300;         // metres: the size of one cloud cell in the noise
  export const CLOUD_COVER = 0.42;        // the default: about 40% of the sky is cloud

  // The weather for a flight. cover: the share of sky under cloud; wind: how fast the cloud moves
  // (times the wind); storm: 0 to 1, how dark the cloud and the air are; rain, thunder and dust
  // are what the sky does on top of that.
  export type Weather = 'clear' | 'scattered' | 'overcast' | 'rain' | 'thunder' | 'windy' | 'dust';
  export interface WeatherSpec { name: string; cover: number; wind: number; storm: number; rain: boolean; thunder: boolean; dust: boolean; weight: number }
  export const WEATHER: { [k in Weather]: WeatherSpec } = {
    clear:     { name: 'Clear', cover: 0.12, wind: 1, storm: 0, rain: false, thunder: false, dust: false, weight: 3 },
    scattered: { name: 'Scattered cloud', cover: 0.42, wind: 1, storm: 0, rain: false, thunder: false, dust: false, weight: 3 },
    overcast:  { name: 'Overcast', cover: 0.85, wind: 1, storm: 0.25, rain: false, thunder: false, dust: false, weight: 1 },
    rain:      { name: 'Rain', cover: 0.9, wind: 1.5, storm: 0.6, rain: true, thunder: false, dust: false, weight: 1 },
    thunder:   { name: 'Thunderstorm', cover: 0.97, wind: 2.5, storm: 0.9, rain: true, thunder: true, dust: false, weight: 0.5 },
    windy:     { name: 'Windy', cover: 0.5, wind: 3, storm: 0, rain: false, thunder: false, dust: false, weight: 1 },
    dust:      { name: 'Dust storm', cover: 0.2, wind: 2, storm: 0.4, rain: false, thunder: false, dust: true, weight: 0.5 },
  };
  // The weather for a flight, from its seed: different in each mission, and mostly fair.
  export function weatherFor(seed: number): Weather {
    const keys = Object.keys(WEATHER) as Weather[];
    const total = keys.reduce((s, k) => s + WEATHER[k].weight, 0);
    let r = (((seed * 2654435761) >>> 0) % 100000) / 100000 * total;
    for (const k of keys) {
      r -= WEATHER[k].weight;
      if (r < 0) return k;
    }
    return 'clear';
  }

  // The cloud density at ground position (X, Z) at time t (seconds): 0 is clear, 1 is cloud.
  // Three octaves of value noise, drifting with the wind. The threshold moves with the cover, so
  // more cover means more of the noise is cloud. The ramp is soft, so the edges are soft.
  export function cloudDensity(X: number, Z: number, t: number, cover = CLOUD_COVER, windScale = 1): number {
    const u = (X - WIND.X * windScale * t) / CLOUD_SCALE, v = (Z - WIND.Z * windScale * t) / CLOUD_SCALE;
    const f = noise2(u, v) * 0.55 + noise2(u * 2.1 + 5.2, v * 2.1 + 1.3) * 0.3 + noise2(u * 4.3 + 9.1, v * 4.3 + 7.7) * 0.15;
    const th = 0.52 - (cover - CLOUD_COVER) * 0.45;
    const x = (f - th) * 6;
    return x <= 0 ? 0 : x >= 1 ? 1 : x;
  }

  // The object tint: how much of the sun's colour and the sky's light reaches things on the ground,
  // per channel (0 to 1). Full day is 1 everywhere, dusk takes on the sun's warmth, night is dim.
  export function lightTint(L: Light): RGB {
    return [0, 1, 2].map(k => Math.max(0, Math.min(1, L.ambient[k] * 0.8 + (L.sunCol[k] / 255) * 0.5 * L.direct))) as RGB;
  }

  // Where the sun's ray from ground point (X, Z) meets the deck, and how much cloud is on it.
  // Returns the cloud density at that point: the shadow on the ground is 1 minus this, times a share.
  export function cloudShadow(X: number, Z: number, t: number, sun: RGB, el: number): number {
    if (el <= 2) return 0;
    const reach = CLOUD_BASE / Math.tan(el * Math.PI / 180);
    const hz = Math.hypot(sun[0], sun[2]) || 1;
    const px = X + (sun[0] / hz) * reach, pz = Z + (sun[2] / hz) * reach;
    return cloudDensity(px, pz, t);
  }
}
