// Boot: the page, the controls (drag or joystick, action buttons), the fading
// settings gear, the HUD, the settings drawer, opt-in errors, and the frame loop.
namespace PA {
  const SETTINGS_KEY = 'pa_warthog.settings';
  const DEFAULTS: Settings = {
    mode: 'glider', control: 'drag', view: 'chase', difficulty: 'felix', sound: 1,
    volMusic: 20, volGun: 25, volTurn: 25, volWarn: 60,
    forces: 0, flightHelp: 1, safeFlight: 1, invincible: 0, autoReload: 1,
    enemyWave: 1, allies: 1, showErrors: 0, sunClock: 1, droneKind: 'camera', stickMode: 'mode2',
  };
  const VIEW_ORDER: View[] = ['chase', 'top', 'cockpit'];
  const TUTORIAL_KEY = 'pa_warthog.tutorialSeen';
  const DEAD = 0.06;          // a small dead zone around the centre
  const GEAR_SECONDS = 2000;  // the settings gear fades after this long untouched

  const $ = <T extends HTMLElement>(id: string): T => {
    const el = document.getElementById(id);
    if (!el) throw new Error('missing #' + id);
    return el as T;
  };

  const errors: string[] = [];

  function logError(message: string): void {
    errors.push(new Date().toLocaleTimeString() + '  ' + message);
    renderErrors();
  }

  function renderErrors(): void {
    const box = $('errorsPanel');
    box.hidden = !settings.showErrors;
    box.textContent = errors.length ? errors.join('\n') : 'No problems so far.';
  }

  function loadSettings(): Settings {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
    } catch (e) {
      return { ...DEFAULTS };
    }
  }

  function saveSettings(): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      logError('Could not save settings on this device: ' + String(e));
    }
  }

  const settings: Settings = loadSettings();
  const sound = new Sound();
  sound.enabled = settings.sound === 1;
  let game: Game;

  // Input sources. The one in use wins: drag, then joystick, then keys.
  const keys = { up: false, down: false, left: false, right: false };
  let dragAxes: Axes | null = null;
  let stickAxes: Axes | null = null;
  let dragId = -1;
  let stickId = -1;

  function applyBodyClasses(): void {
    document.body.classList.toggle('glider', settings.mode === 'glider');
    document.body.classList.toggle('jet', settings.mode === 'jet');
    document.body.classList.toggle('drone', settings.mode === 'drone');
    document.body.classList.toggle('joy', settings.control === 'stick');
    document.body.classList.toggle('manual', settings.flightHelp !== 1);
  }

  // The sound sliders, as 0-1 values for the audio channels.
  function applySound(): void {
    sound.enabled = settings.sound === 1;
    sound.setVolumes({
      music: settings.volMusic / 100,
      gun: settings.volGun / 100,
      turn: settings.volTurn / 100,
      warn: settings.volWarn / 100,
    });
  }

  function renderSettings(): void {
    document.querySelectorAll<HTMLElement>('.seg').forEach(seg => {
      const key = seg.dataset.key as keyof Settings;
      const v = String(settings[key]);
      seg.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    });
    $<HTMLInputElement>('showErrors').checked = settings.showErrors === 1;
    applyBodyClasses();
    renderErrors();
    renderDroneHints();
  }

  // ---- Drone flight: settings text, two sticks, keys, best times ----------------

  const STICK_TEXT: { [k in StickMode]: string } = {
    mode2: 'Mode 2 (most common): left stick = throttle (up/down) and yaw (turn); right stick = pitch (forward/back) and roll (sideways).',
    mode1: 'Mode 1 (older, common in the UK and Japan): left stick = pitch and yaw; right stick = throttle and roll.',
    mode3: 'Mode 3 (Mode 2 the other way round, for left hands): left stick = pitch and roll; right stick = throttle and yaw.',
  };
  const ASSIST_TEXT: { [k in DroneAssist]: string } = {
    gps: 'GPS holds it still: push to fly, let go and it brakes to a hover. Throttle stick up climbs, down sinks.',
    althold: 'It holds its height; the stick tilts it. Let go and it levels out but drifts on.',
    none: 'Angle mode, no help: the throttle stays where you leave it (about a quarter holds a hover) and you fly the height yourself.',
  };

  function renderDroneHints(): void {
    const kind = settings.droneKind || 'camera';
    const spec = DRONES[kind];
    $('droneHint').textContent = spec.label + ', ' + spec.size + '. ' + ASSIST_TEXT[spec.assist] + bestText(kind);
    $('stickHint').textContent = STICK_TEXT[settings.stickMode || 'mode2'] + ' Keys: W A S D = left stick, arrows = right stick.';
    const map = sticksLabels(settings.stickMode || 'mode2');
    $('padLabelL').textContent = map[0];
    $('padLabelR').textContent = map[1];
  }

  function sticksLabels(mode: StickMode): [string, string] {
    if (mode === 'mode1') return ['pitch · yaw', 'throttle · roll'];
    if (mode === 'mode3') return ['pitch · roll', 'throttle · yaw'];
    return ['throttle · yaw', 'pitch · roll'];
  }

  function bestKey(kind: string): string {
    return 'pa_warthog.best.' + kind;
  }

  function loadBest(kind: string): number {
    try { return Number(localStorage.getItem(bestKey(kind))) || 0; } catch (e) { return 0; }
  }

  function saveBest(kind: string, t: number): void {
    try { localStorage.setItem(bestKey(kind), String(t)); } catch (e) { /* this visit only */ }
  }

  function bestText(kind: string): string {
    const b = loadBest(kind);
    return b ? ' Best race: ' + clock(b) + '.' : '';
  }

  function clock(t: number): string {
    const m = Math.floor(t / 60), s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
  }

  function ordinal(n: number): string {
    return n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
  }

  // The pads: x and y from -1 to 1. Letting go springs back to the middle, except the
  // racer's throttle, which stays where it was left (as a real throttle stick does).
  const pads: Pads = { lx: 0, ly: 0, rx: 0, ry: 0 };
  let racerThrottle = -1;     // -1 bottom … +1 top, on the throttle side
  const downKeys = new Set<string>();

  function racerMode(): boolean {
    return settings.mode === 'drone' && DRONES[settings.droneKind || 'camera'].assist === 'none';
  }

  function bindPads(): void {
    for (const side of ['L', 'R'] as const) {
      const pad = $('pad' + side);
      const knob = $('knob' + side);
      let id = -1;
      const isThrottle = () => racerMode() && throttleSide(settings.stickMode || 'mode2') === (side === 'L' ? 'left' : 'right');
      const show = () => {
        const x = side === 'L' ? pads.lx : pads.rx, y = side === 'L' ? pads.ly : pads.ry;
        const r = pad.getBoundingClientRect().width / 2;
        knob.style.transform = `translate(${x * r * 0.62}px, ${-y * r * 0.62}px)`;
      };
      const move = (e: PointerEvent) => {
        const r = pad.getBoundingClientRect();
        const x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
        const y = Math.max(-1, Math.min(1, -(e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
        if (side === 'L') { pads.lx = dz(x); pads.ly = isThrottle() ? y : dz(y); }
        else { pads.rx = dz(x); pads.ry = isThrottle() ? y : dz(y); }
        if (isThrottle()) racerThrottle = y;
        show();
      };
      pad.addEventListener('pointerdown', e => { e.preventDefault(); sound.unlock(); id = e.pointerId; capture(pad, e.pointerId); move(e); });
      pad.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
      const end = (e: PointerEvent) => {
        if (e.pointerId !== id) return;
        id = -1;
        if (side === 'L') { pads.lx = 0; pads.ly = isThrottle() ? racerThrottle : 0; }
        else { pads.rx = 0; pads.ry = isThrottle() ? racerThrottle : 0; }
        show();
      };
      pad.addEventListener('pointerup', end);
      pad.addEventListener('pointercancel', end);
    }
    window.addEventListener('keydown', e => downKeys.add(e.code));
    window.addEventListener('keyup', e => downKeys.delete(e.code));
    window.addEventListener('blur', () => downKeys.clear());
  }

  // The sticks this frame: the pads, with the keyboard added on top.
  function resolvePads(dt: number): Pads {
    const k = (c: string) => (downKeys.has(c) ? 1 : 0);
    const kl = { x: k('KeyD') - k('KeyA'), y: k('KeyW') - k('KeyS') };
    const kr = { x: k('ArrowRight') - k('ArrowLeft'), y: k('ArrowUp') - k('ArrowDown') };
    const out = { lx: pads.lx || kl.x, ly: pads.ly || kl.y, rx: pads.rx || kr.x, ry: pads.ry || kr.y };
    if (racerMode()) {
      // The racer's throttle keys move the throttle and leave it there.
      const left = throttleSide(settings.stickMode || 'mode2') === 'left';
      const ky = left ? kl.y : kr.y;
      if (ky) {
        racerThrottle = Math.max(-1, Math.min(1, racerThrottle + ky * dt * 1.2));
        if (left) pads.ly = racerThrottle; else pads.ry = racerThrottle;
      }
      if (left) out.ly = pads.ly = racerThrottle; else out.ry = pads.ry = racerThrottle;
    }
    return out;
  }

  let bestSaved = false;

  function raceHud(): void {
    const g = game;
    const r = g.race;
    const bar = $('raceBar'), cd = $('countdown');
    if (!r) { bar.hidden = true; cd.hidden = true; return; }
    bar.hidden = false;
    const gates = g.mission.hoops.length;
    bar.textContent = r.finished ? 'Finished ' + ordinal(r.place) + ' · ' + clock(r.time)
      : 'Lap ' + Math.min(r.lap, r.laps) + '/' + r.laps + ' · gate ' + (r.next + 1) + '/' + gates + ' · ' + clock(r.time) + ' · ' + ordinal(r.place) + ' of ' + (g.rivals.length + 1);
    cd.hidden = !(r.countdown > 0 || r.time < 0.8);
    cd.textContent = r.countdown > 0 ? String(Math.ceil(r.countdown)) : 'GO!';
    if (r.finished && !bestSaved && g.settings.mode === 'drone') {
      bestSaved = true;
      const kind = g.drone.kind;
      const best = loadBest(kind);
      if (!best || r.time < best) saveBest(kind, r.time);
      renderDroneHints();
    }
    if (!r.finished) bestSaved = false;
  }

  function onSeg(key: keyof Settings, value: string): void {
    if (key === 'mode' || key === 'control' || key === 'view' || key === 'difficulty' || key === 'droneKind' || key === 'stickMode') {
      (settings as unknown as Record<string, unknown>)[key] = value;
    } else {
      (settings as unknown as Record<string, number>)[key] = +value;
    }
    if (key === 'sound') applySound();
    saveSettings();
    renderSettings();
    if (key === 'mode' || key === 'droneKind') restart();
    if (key === 'control') {
      dragAxes = null;
      stickAxes = null;
      dragId = -1;
      stickId = -1;
    }
  }

  function restart(): void {
    game.settings = settings;
    racerThrottle = -1;
    pads.lx = pads.ly = pads.rx = pads.ry = 0;
    game.newFlight(Math.floor(Math.random() * 100000));
    $('overlay').hidden = true;
  }

  // Capture can fail for a pointer the browser no longer tracks; that is not a reason to stop.
  function capture(el: HTMLElement, id: number): void {
    try {
      el.setPointerCapture(id);
    } catch (e) {
      // Ignored: the pointer still reaches the element through its events.
    }
  }

  // ---- Keys -------------------------------------------------------------

  const keyMap: { [code: string]: string } = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    Space: 'fire',
    ShiftLeft: 'boost', ShiftRight: 'boost',
    KeyM: 'missile',
    KeyC: 'chaff',
    KeyV: 'view',
    KeyR: 'thrUp', KeyF: 'thrDown',
  };

  function bindKeys(): void {
    window.addEventListener('keydown', e => {
      const k = keyMap[e.code];
      if (!k) return;
      e.preventDefault();
      if (k === 'view') {
        cycleView();
      } else if (k === 'thrUp' || k === 'thrDown') {
        setThrottle(game.throttleSet + (k === 'thrUp' ? 0.1 : -0.1));
      } else if (k === 'chaff') {
        if (!e.repeat) game.fireChaff();
      } else if (k === 'fire' || k === 'boost' || k === 'missile') {
        sound.unlock();
        game.held[k] = true;
      } else {
        keys[k as 'up' | 'down' | 'left' | 'right'] = true;
      }
    });
    window.addEventListener('keyup', e => {
      const k = keyMap[e.code];
      if (!k) return;
      if (k === 'fire' || k === 'boost' || k === 'missile') game.held[k] = false;
      else if (k === 'thrUp' || k === 'thrDown' || k === 'view' || k === 'chaff') return;
      else keys[k as 'up' | 'down' | 'left' | 'right'] = false;
    });
    window.addEventListener('blur', () => {
      keys.up = keys.down = keys.left = keys.right = false;
      game.held.fire = game.held.boost = game.held.missile = false;
      dragAxes = null;
      stickAxes = null;
    });
  }

  // The camera views in turn: chase, top-down, cockpit (also the V key).
  function cycleView(): void {
    const next = VIEW_ORDER[(VIEW_ORDER.indexOf(settings.view) + 1) % VIEW_ORDER.length];
    settings.view = next;
    saveSettings();
    renderSettings();
  }

  // ---- Drag relative to the centre of the screen ------------------------

  const IGNORE = '.actions, .stick, .throttle, .pad, #gear, .gearHot, .drawer, .errorsPanel, .tutorial, button, input, label';

  function dz(v: number): number {
    if (Math.abs(v) < DEAD) return 0;
    return Math.sign(v) * (Math.abs(v) - DEAD) / (1 - DEAD);
  }

  function axesFromPoint(x: number, y: number): Axes {
    const nx = Math.max(-1, Math.min(1, (x - window.innerWidth / 2) / (window.innerWidth / 2)));
    const ny = Math.max(-1, Math.min(1, (y - window.innerHeight / 2) / (window.innerHeight / 2)));
    return { yaw: dz(nx), pitch: dz(-ny) };
  }

  function bindDrag(): void {
    const play = $('play');
    play.addEventListener('pointerdown', e => {
      if (settings.control !== 'drag' || settings.mode === 'drone') return;
      if ((e.target as Element).closest(IGNORE)) return;
      sound.unlock();
      dragId = e.pointerId;
      capture(play, e.pointerId);
      dragAxes = axesFromPoint(e.clientX, e.clientY);
    });
    play.addEventListener('pointermove', e => {
      if (e.pointerId === dragId) dragAxes = axesFromPoint(e.clientX, e.clientY);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId === dragId) {
        dragId = -1;
        dragAxes = null;
      }
    };
    play.addEventListener('pointerup', end);
    play.addEventListener('pointercancel', end);
  }

  // ---- Joystick (lower left) --------------------------------------------

  function bindStick(): void {
    const stick = $('stick');
    const knob = $('knob');
    const move = (e: PointerEvent) => {
      const r = stick.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const radius = r.width / 2;
      let dx = (e.clientX - cx) / radius, dy = (e.clientY - cy) / radius;
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      knob.style.transform = `translate(${dx * radius * 0.6}px, ${dy * radius * 0.6}px)`;
      stickAxes = { yaw: dz(dx), pitch: dz(-dy) };
    };
    stick.addEventListener('pointerdown', e => {
      sound.unlock();
      stickId = e.pointerId;
      capture(stick, e.pointerId);
      move(e);
    });
    stick.addEventListener('pointermove', e => {
      if (e.pointerId === stickId) move(e);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== stickId) return;
      stickId = -1;
      stickAxes = null;
      knob.style.transform = '';
    };
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
  }

  // ---- Throttle lever (jet with the flight helper off) -------------------

  function setThrottle(v: number): void {
    game.throttleSet = Math.max(0, Math.min(1, v));
    showThrottle();
  }

  function showThrottle(): void {
    const pct = Math.round(game.throttleSet * 100);
    $('throttleFill').style.height = pct + '%';
    $('throttleGrip').style.bottom = pct + '%';
    $('throttleLabel').textContent = pct + '%';
  }

  function bindThrottle(): void {
    const lever = $('throttle');
    let id = -1;
    const move = (e: PointerEvent) => {
      const r = lever.getBoundingClientRect();
      setThrottle(1 - (e.clientY - r.top) / r.height);
    };
    lever.addEventListener('pointerdown', e => {
      e.preventDefault();
      sound.unlock();
      id = e.pointerId;
      capture(lever, e.pointerId);
      move(e);
    });
    lever.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
    const end = (e: PointerEvent) => { if (e.pointerId === id) id = -1; };
    lever.addEventListener('pointerup', end);
    lever.addEventListener('pointercancel', end);
    showThrottle();
  }

  // ---- Action buttons (lower right) -------------------------------------

  function bindActions(): void {
    document.querySelectorAll<HTMLButtonElement>('.actions button').forEach(b => {
      const k = b.dataset.k as 'fire' | 'boost' | 'missile' | 'chaff';
      b.addEventListener('pointerdown', e => {
        e.preventDefault();
        sound.unlock();
        capture(b, e.pointerId);
        wakeGear();
        if (k === 'chaff') {
          game.fireChaff();          // one press, one burst of chaff
          return;
        }
        game.held[k] = true;
      });
      const release = () => { if (k !== 'chaff') game.held[k] = false; };
      b.addEventListener('pointerup', release);
      b.addEventListener('pointercancel', release);
      b.addEventListener('lostpointercapture', release);
    });
  }

  // ---- Settings gear: fades in the jet view, after two seconds untouched ---

  let gearTimer = 0;

  function drawerOpen(): boolean {
    return !$('drawer').hidden;
  }

  function wakeGear(): void {
    const gear = $('gear');
    gear.classList.add('awake');
    window.clearTimeout(gearTimer);
    if (!drawerOpen()) {
      gearTimer = window.setTimeout(() => gear.classList.remove('awake'), GEAR_SECONDS);
    }
  }

  function bindGear(): void {
    const gear = $('gear');
    const drawer = $('drawer');
    const setOpen = (open: boolean) => {
      drawer.hidden = !open;
      game.paused = open;
      sound.setPaused(open);
      gear.setAttribute('aria-expanded', String(open));
      if (open) {
        window.clearTimeout(gearTimer);
        gear.classList.add('awake');
      } else {
        wakeGear();
      }
    };
    gear.addEventListener('click', () => setOpen(drawer.hidden));
    $('closeDrawer').addEventListener('click', () => setOpen(false));
    // A tap in the upper-right corner brings the gear back and opens the settings in one go.
    $('gearHot').addEventListener('pointerdown', e => {
      e.preventDefault();
      wakeGear();
      if (drawer.hidden) setOpen(true);
    });
    wakeGear();
  }

  // ---- HUD and messages -------------------------------------------------

  function hud(): void {
    const g = game;
    const p = g.plane;
    $('score').textContent = String(g.score);
    $('kills').textContent = String(g.kills);
    $('hoops').textContent = g.mission.hoops.length ? g.hoopsPassed + ' / ' + g.mission.hoops.length : '—';
    $('hull').style.width = Math.max(0, g.hull) + '%';
    const stock = g.missileStock;
    $('ammo').textContent = g.felix ? '∞' : String(Math.floor(g.ammo));
    $('chaff').textContent = g.felix ? '∞' : String(g.chaff);
    $('tag').hidden = !g.tagged;
    $('tag').textContent = 'TAGGED ' + Math.round(g.tagDist) + ' m';
    const left = Math.max(0, g.objectiveGoal - g.objectiveDone);
    const card = $('missionCard');
    card.hidden = g.missionCard <= 0;
    const spec = g.missionSpec;
    $('missionTitle').textContent = 'Mission ' + g.missionNumber + ': ' + spec.name;
    $('missionBody').textContent = spec.brief + ' Arrows on the radar point to the targets.';
    $('objective').textContent = g.resupplied > 0 ? 'Mission complete! Everything restocked.' : objectiveText(g, left);
    $<HTMLButtonElement>('endMission').hidden = g.settings.mode !== 'jet' || g.phase !== 'flying';
    const cool = Math.ceil(g.resupplyCool);
    $('reloadBtn').toggleAttribute('disabled', g.felix || cool > 0);
    $('reloadHint').textContent = g.felix ? 'Felix mode never runs out, so no reload is needed.'
      : cool > 0 ? 'The reload is ready again in ' + cool + ' s.'
      : 'Gun back to full, and two missiles back.';
    $('missile').textContent = stock + '/' + MISSILE_MAX + (stock === 0 ? (settings.autoReload === 1 ? ' reloading' : ' empty') : '');
    const a = g.aim;
    $('gun').textContent = a.mode === 'air' ? 'air: straight'
      : a.mode === 'ground' ? (Math.abs(a.pitch) * 180 / Math.PI).toFixed(1) + '° down'
      : 'straight';
    $('sunTime').textContent = clockText(g.clock, g.light.el);
    $('speed').textContent = g.settings.mode === 'drone' ? Math.round(p.speed * 3.6) + ' km/h' : Math.round(p.speed * 1.94) + ' kt';
    $('alt').textContent = Math.round(p.h - groundAt(p.X, p.Z)) + ' m';
    $('aoa').textContent = (p.alpha * 180 / Math.PI).toFixed(0) + '°';
    $('stall').hidden = !p.stalled || g.phase !== 'flying';
  }

  // What the objective line says for each kind of mission.
  function objectiveText(g: Game, left: number): string {
    const goal = g.missionSpec.goal;
    if (g.settings.mode === 'glider') return '';
    if (g.race) {
      const r = g.race;
      return 'Lap ' + Math.min(r.lap, r.laps) + ' of ' + r.laps + ' · gate ' + (r.next + 1) + ' of ' + g.mission.hoops.length + ' · ' + ordinal(r.place);
    }
    if (isOrderedGoal(goal)) {
      const n = g.mission.hoops.length;
      return (goal === 'dots' ? 'Dot ' : 'Ring ') + Math.min(n, g.hoopsPassed + 1) + ' of ' + n;
    }
    return 'Mission ' + g.missionNumber + ': ' + (goal === 'air' ? 'shoot down ' : 'destroy ') + left + ' more '
      + (goal === 'air' ? 'fighter' : goal === 'ship' ? 'ship' : 'ground target') + (left === 1 ? '' : 's');
  }

  // The solar clock in the readout: the time, and what the sun is doing.
  function clockText(hours: number, el: number): string {
    const h = Math.floor(hours), m = Math.floor((hours - h) * 60);
    const word = el > 10 ? 'high sun' : el > 0 ? 'low sun, long shadows' : el > -6 ? 'dusk' : 'night';
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ' · ' + word;
  }

  function message(): string {
    const g = game;
    const p = g.plane;
    if (g.phase === 'crashed') return 'Hit! The plane blinks and carries on with a full repair.';
    if (g.phase !== 'flying') return '';
    if (g.settings.mode === 'drone') {
      const r = g.race;
      if (r && r.countdown > 0) return 'Get ready: ' + sticksLabels(settings.stickMode || 'mode2').join(' | ') + '.';
      if (r && r.crashes && r.time < 2) return 'Crashed! Back at the last gate, 3 seconds added.';
      const sp = g.drone.spec;
      if (sp.assist === 'none' && g.drone.h - groundAt(g.drone.X, g.drone.Z) < 0.3) return 'Throttle up (about a quarter holds a hover), then tilt to fly.';
      return 'Fly the lit gate. ' + (sp.assist === 'gps' ? 'Let go and the drone stops.' : sp.assist === 'althold' ? 'It holds its height.' : 'The throttle is yours.');
    }
    if (g.tagged) return 'Missile on you! Hard turn to break it, or drop CHAFF.';
    if (g.dazzle > 0.3) return 'Flak! The smoke hides the view. Keep flying straight.';
    if (g.floorActive) return 'Safe flight: pulling up off the ground.';
    if (settings.invincible === 1) return 'Invincible: nothing can hurt you.';
    if (p.stalled) return 'Too steep! Ease the nose down to get the air flowing.';
    if (g.settings.mode === 'glider') return 'Fly through the rings.';
    if (g.missionSpec.goal === 'dots') return 'Fly roughly over the lit dot. No shooting, no hurry.';
    if (g.missionSpec.goal === 'rings') return 'Fly through the lit ring. Hold height and line up.';
    if (g.race && !g.race.finished) return 'Race: keep the lit gate in the middle of the screen.';
    if (p.vy < -2 && p.h - groundAt(p.X, p.Z) < 25) return 'Losing height: nose up or hold BOOST.';
    return 'Drag from the middle to steer. FIRE the gun, MISSILE for a target ahead.';
  }

  function overlay(): void {
    const g = game;
    const box = $('overlay');
    if (g.phase !== 'landed') {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    if (g.race) {
      const r = g.race;
      const best = g.settings.mode === 'drone' ? loadBest(g.drone.kind) : 0;
      $('ovTitle').textContent = 'Race finished: ' + ordinal(r.place) + '!';
      $('ovText').textContent = 'Time ' + clock(r.time) + (r.crashes ? ' (with ' + r.crashes + ' crash' + (r.crashes > 1 ? 'es' : '') + ')' : '') + (best ? '. Best ' + clock(best) : '') + '. ' + r.results.map((x, i) => (i + 1) + '. ' + x.name + ' ' + clock(x.time)).join('  ');
      $('again').textContent = g.settings.mode === 'jet' ? 'Next mission ▸' : 'Fly again';
      return;
    }
    $('again').textContent = 'Fly again';
    $('ovTitle').textContent = 'Landed!';
    $('ovText').textContent = 'Rings flown: ' + g.hoopsPassed + ' of ' + g.mission.hoops.length + '.';
  }

  // ---- Notes for improvement (drawer) -----------------------------------

  let noteSort: NoteSort = 'time';

  function noteItem(): string {
    if (game.phase === 'crashed') return 'Hit and carried on';
    if (game.phase === 'landed') return 'Glider landed';
    if (game.plane.stalled) return 'Stalled';
    return game.settings.mode === 'glider' ? 'Gliding' : 'Flying';
  }

  function renderNotes(): void {
    const all = loadNotes();
    const list = sortNotes(all, noteSort);
    const c = statusCount(all);
    $('noteCounts').textContent = 'Open ' + c.open + ' · done ' + c.done + ' · closed ' + c.closed + ' (' + all.length + ' in all)';
    document.querySelectorAll<HTMLButtonElement>('#noteSort button').forEach(b => b.classList.toggle('on', b.dataset.sort === noteSort));
    const box = $('noteList');
    box.textContent = '';
    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'No notes yet. Write one above while you play.';
      box.appendChild(empty);
      return;
    }
    for (const n of list) {
      const row = document.createElement('div');
      row.className = 'noteRow ' + n.status;
      const head = document.createElement('div');
      head.className = 'noteHead';
      head.textContent = n.identifier + ' · ' + n.sub + ' · ' + n.item;
      const body = document.createElement('p');
      body.className = 'noteBody';
      body.textContent = n.description;
      const ids = document.createElement('p');
      ids.className = 'noteIds';
      ids.textContent = Object.keys(n.ids).map(k => k + ' ' + n.ids[k]).join(' · ');
      const seg = document.createElement('div');
      seg.className = 'seg noteStatus';
      for (const st of ['open', 'done', 'closed'] as NoteStatus[]) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = st;
        b.dataset.id = n.identifier;
        b.dataset.status = st;
        b.classList.toggle('on', n.status === st);
        seg.appendChild(b);
      }
      row.append(head, body, ids, seg);
      box.appendChild(row);
    }
  }

  function renderNoteIndex(): void {
    const box = $('noteIndex');
    box.textContent = '';
    for (const e of INDEX) {
      const p = document.createElement('p');
      p.textContent = e.code + ' · ' + e.name + ': ' + e.meaning + (e.unit ? ' (' + e.unit + ')' : '');
      box.appendChild(p);
    }
  }

  function saveNoteFromScreen(): void {
    const text = $<HTMLTextAreaElement>('noteText');
    if (!text.value.trim()) {
      $('noteHint').textContent = 'Type what should change first.';
      return;
    }
    const note = addNote(text.value, noteItem(), subProject(settings), snapshot(game, settings));
    text.value = '';
    $('noteHint').textContent = 'Saved as ' + note.identifier + ' on this device.';
    renderNotes();
  }

  async function copyNotes(): Promise<void> {
    const lines = loadNotes().map(n =>
      [n.identifier, n.status, n.project, n.sub, n.item, n.time, n.description,
        Object.keys(n.ids).map(k => k + '=' + n.ids[k]).join(' ')].join(' | '));
    const text = lines.join('\n') || 'No notes yet.';
    try {
      await navigator.clipboard.writeText(text);
      $('noteHint').textContent = 'Copied ' + lines.length + ' note(s).';
    } catch (e) {
      $('noteHint').textContent = 'Could not copy here. Select the list and copy it by hand.';
    }
  }

  // Sliders: each one sets its setting at once and shows its value.
  function bindSliders(): void {
    document.querySelectorAll<HTMLInputElement>('input[type="range"][data-key]').forEach(input => {
      const key = input.dataset.key as keyof Settings;
      const label = document.getElementById(input.id + 'Value');
      input.value = String(settings[key]);
      const show = () => { if (label) label.textContent = input.value + (input.dataset.unit || ''); };
      show();
      input.addEventListener('input', () => {
        (settings as unknown as Record<string, number>)[key] = +input.value;
        saveSettings();
        applySound();
        show();
      });
    });
  }

  function bindNotes(): void {
    $('noteSave').addEventListener('click', saveNoteFromScreen);
    $('noteCopy').addEventListener('click', () => void copyNotes());
    document.querySelectorAll<HTMLButtonElement>('#noteSort button').forEach(b => {
      b.addEventListener('click', () => {
        noteSort = b.dataset.sort as NoteSort;
        renderNotes();
      });
    });
    $('noteList').addEventListener('click', e => {
      const t = e.target as HTMLElement;
      if (t.tagName !== 'BUTTON' || !t.dataset.id) return;
      setStatus(t.dataset.id, t.dataset.status as NoteStatus);
      renderNotes();
    });
    renderNoteIndex();
    renderNotes();
    bindSliders();
  }

  // ---- Family database sign-in (drawer) ---------------------------------

  function setFamilyStatus(text: string, ok: boolean): void {
    const el = $('familyStatus');
    el.textContent = text;
    el.classList.toggle('bad', !ok);
  }

  function renderFamily(): void {
    const s = loadSession();
    $('familyIn').hidden = !!s;
    $('familyOut').hidden = !s;
    if (s) setFamilyStatus('Signed in as ' + s.email + '. Scores can be saved to the family database.', true);
    else setFamilyStatus('Not signed in: this device only.', true);
  }

  async function familySignIn(): Promise<void> {
    const email = $<HTMLInputElement>('familyEmail').value.trim();
    const password = $<HTMLInputElement>('familyPassword').value;
    $<HTMLInputElement>('familyPassword').value = '';
    if (!email || !password) {
      setFamilyStatus('Type the family email and password first.', false);
      return;
    }
    setFamilyStatus('Signing in…', true);
    try {
      await signIn(email, password);
      renderFamily();
    } catch (e) {
      setFamilyStatus(String((e as Error).message || e), false);
    }
  }

  async function familyCheck(): Promise<void> {
    setFamilyStatus('Checking…', true);
    const r = await checkSession();
    setFamilyStatus(r.message, r.ok);
  }

  // ---- First-run tutorial (shown once per device) -----------------------

  function tutorialSeen(): boolean {
    try {
      return localStorage.getItem(TUTORIAL_KEY) === '1';
    } catch (e) {
      return true;
    }
  }

  function showTutorial(): void {
    if (tutorialSeen()) return;
    const card = $('tutorial');
    card.hidden = false;
    card.addEventListener('pointerdown', () => {
      card.hidden = true;
      try {
        localStorage.setItem(TUTORIAL_KEY, '1');
      } catch (e) {
        // Not saved on this device: it may show again next time, which is fine.
      }
    }, { once: true });
  }

  // ---- Frame loop -------------------------------------------------------

  function resolveAxes(): Axes {
    if (dragAxes) return dragAxes;
    if (stickAxes) return stickAxes;
    const yaw = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const pitch = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
    return { yaw, pitch };
  }

  let last = 0;
  let hudTimer = 0;
  // The view wobbles when the plane is hit: the harder the hit, the harder the shake.
  let shaking = false;
  function shakeView(g: Game): void {
    const view = $<HTMLCanvasElement>('view');
    const s = g.shake;
    if (s <= 0.01) {
      if (shaking) { view.style.transform = ''; shaking = false; }
      return;
    }
    shaking = true;
    const amp = s * s * 12;   // screen pixels: a small hit wobbles, a missile shakes hard
    const dx = (Math.random() - 0.5) * 2 * amp, dy = (Math.random() - 0.5) * 2 * amp;
    view.style.transform = 'translate(' + dx.toFixed(1) + 'px, ' + dy.toFixed(1) + 'px) scale(1.03)';
  }

  function frame(now: number): void {
    const dt = last ? (now - last) / 1000 : 0;
    last = now;
    try {
      game.axes = resolveAxes();
      if (settings.mode === 'drone') game.pads = resolvePads(dt);
      game.update(dt);
      const ctx = $<HTMLCanvasElement>('view').getContext('2d');
      if (ctx) render(ctx, game);
      shakeView(game);
      const rc = $<HTMLCanvasElement>('radar').getContext('2d');
      if (rc) radar(rc, game, 150);
      sound.setFlight(game.held.boost, game.phase === 'flying' && game.settings.mode === 'jet', Math.abs(game.axes.yaw));
      hudTimer += dt;
      if (hudTimer > 0.1) {
        hudTimer = 0;
        hud();
        raceHud();
        overlay();
        $('msg').textContent = message();
      }
    } catch (e) {
      logError('Frame: ' + String(e));
    }
    requestAnimationFrame(frame);
  }

  function boot(): void {
    game = new Game(settings);
    game.settings = settings;
    game.onSound = name => sound.play(name);
    (window as unknown as { paGame: Game }).paGame = game;   // for the browser checks
    renderSettings();

    window.addEventListener('error', e => logError(e.message));
    window.addEventListener('unhandledrejection', e => logError('Promise: ' + String(e.reason)));

    document.querySelectorAll<HTMLButtonElement>('.seg button').forEach(b => {
      b.addEventListener('click', () => onSeg(b.parentElement!.dataset.key as keyof Settings, b.dataset.v || '0'));
    });
    $<HTMLInputElement>('showErrors').addEventListener('change', e => {
      settings.showErrors = (e.target as HTMLInputElement).checked ? 1 : 0;
      saveSettings();
      renderErrors();
    });
    $('restart').addEventListener('click', () => { restart(); $('drawer').hidden = true; });
    $('reloadBtn').addEventListener('click', () => {
      game.reloadFromSettings();
      hud();
    });
    $('familySignIn').addEventListener('click', () => void familySignIn());
    $('familyCheck').addEventListener('click', () => void familyCheck());
    $('familySignOut').addEventListener('click', () => void signOut().then(renderFamily));
    $('familyPassword').addEventListener('keydown', e => { if (e.key === 'Enter') void familySignIn(); });
    renderFamily();
    $('again').addEventListener('click', () => {
      // After a jet race the button goes on to the next mission; otherwise it flies again.
      if (game.race && game.settings.mode === 'jet') game.endMission();
      else restart();
    });
    $('endMission').addEventListener('click', () => game.endMission());
    $('version').textContent = 'Version ' + VERSION;

    applySound();
    bindKeys();
    showTutorial();
    bindDrag();
    bindStick();
    bindThrottle();
    bindPads();
    bindActions();
    bindGear();
    bindNotes();
    renderErrors();
    requestAnimationFrame(frame);
  }

  // Only start the page in a browser (the flight test loads this file in Node).
  if (typeof document !== 'undefined') boot();
}
