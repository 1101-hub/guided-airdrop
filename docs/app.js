/* ===========================================================================
   app.js — wiring for the interactive page. Physics comes from physics.js
   (a verified port of ../model/*.py); the drop picture comes from draw.js.
   =========================================================================== */
/* ?v= is bumped on every deploy so browsers cannot serve a stale module
   alongside fresh HTML. */
import {
  glideState, turnRadius, minLoading, dubinsSolve, dubinsAll, dubinsSample,
  simulate, median, rng,
} from './physics.js?v=10';
import {
  ctx2d, clear, mapper, line, dot, cross, label, arrow,
  drawDrop, INK, INK3, LINE, PINK, BLUE, GRN, YEL,
} from './draw.js?v=10';

const CL = 0.80, CD = 0.27, BANK = 20, TARGET = [20, 10];
const $ = id => document.getElementById(id);
const fmt = (v, n = 2) => v.toFixed(n);

const MODE_COLOR = { none: PINK, ekf: BLUE, true: GRN };
const MODE_NAME = { none: 'no idea about the wind',
                    ekf: 'the wind worked out on board',
                    true: 'the wind handed to it' };

/* ------------------------------------------------------------ page state */
const S = {
  wind: 1.6, dir: 45, height: 40, load: 1.2, bias: 6,
  mode: 'ekf', straight: false,
  current: null, prev: null, lastDrop: null, attempts: [],
};
const windVec = () => {
  const a = S.dir * Math.PI / 180;
  return [S.wind * Math.cos(a), S.wind * Math.sin(a)];
};
function design(load = S.load) {
  const g = glideState(load, 1.0, CL, CD);
  return { ...g, R: turnRadius(g.vh, BANK) };
}

/* ======================================================== 01 · THE DROP === */
const gDrop = ctx2d($('cDrop'));
let anim = null;

const runDrop = (mode, seed = 7) => simulate({
  target: TARGET, windTrue: windVec(),
  params: (d => ({ vh: d.vh, vz: d.vz, R: d.R }))(design()),
  height0: S.height, mode, headingBiasDeg: S.bias, seed,
});

function paint(frac) {
  drawDrop(gDrop, {
    runs: S.current.runs, prev: S.prev, frac,
    wind: windVec(), windSpeed: S.wind, height: S.height, target: TARGET,
  });
}

function animate() {
  if (anim) cancelAnimationFrame(anim);
  const t0 = performance.now(), dur = 3000;
  const step = now => {
    const f = Math.min(1, (now - t0) / dur);
    paint(f);
    anim = f < 1 ? requestAnimationFrame(step) : null;
  };
  anim = requestAnimationFrame(step);
}

/* One attempt. `record` files it in the history so the NEXT drop can show
   whether the change the judge made actually helped. */
function refreshDrop({ animate: doAnim = false, record = false, race = false } = {}) {
  const d = design();
  const runs = race
    ? ['none', 'ekf', 'true'].map(mo => ({ mode: mo, color: MODE_COLOR[mo], res: runDrop(mo) }))
    : [{ mode: S.mode, color: MODE_COLOR[S.mode], res: runDrop(S.mode) }];

  // Compare against the last drop the user actually PRESSED, never against a
  // slider preview — otherwise changing a setting silently becomes "last try"
  // and the verdict reads 0.0 m.
  S.prev = race ? null : (S.lastDrop || null);
  S.current = { runs, race };

  if (doAnim) animate(); else paint(1);

  const miss = runs[0].res.miss;
  if (race) {
    $('roMiss').innerHTML = runs.map(r =>
      `<span style="color:${r.color}">${fmt(r.res.miss, 1)}</span>`)
      .join('<span style="color:#8C877C"> / </span>') + ' m';
  } else {
    $('roMiss').textContent = `${fmt(miss, 1)} m`;
    $('roMiss').style.color = MODE_COLOR[S.mode];
  }
  $('roAir').textContent = `${fmt(d.vh, 1)} m/s`;
  $('roTurn').textContent = `${fmt(d.R, 1)} m`;
  $('roTime').textContent = `${fmt(S.height / d.vz, 0)} s`;

  if (record && !race) {
    S.lastDrop = runs[0];
    S.attempts.push({ miss, mode: S.mode, wind: S.wind, load: S.load,
                      height: S.height, bias: S.bias });
    if (S.attempts.length > 10) S.attempts.shift();
  }
  renderVerdict(race, miss);
  renderAttempts();
  checkPenetration(d);
}

const EXPLAIN = '<strong>Top:</strong> the drop as you would see it from the side. ' +
  '<strong>Bottom:</strong> the same flight from above, where the miss is honest ' +
  'in both directions. ';

function renderVerdict(race, miss) {
  const v = $('verdict');
  if (race) {
    v.className = 'verdict';
    v.innerHTML = `<span style="color:${PINK}">pink knows nothing</span> · ` +
      `<span style="color:${BLUE}">blue estimates the wind</span> · ` +
      `<span style="color:${GRN}">green is told the wind</span> — same conditions.`;
    $('noteDrop').innerHTML = EXPLAIN + 'Three packages dropped under identical conditions.';
    return;
  }
  if (S.prev) {
    const before = S.prev.res.miss, delta = before - miss;
    const better = delta > 0;
    v.className = 'verdict ' + (better ? 'good' : 'bad');
    v.innerHTML = `<strong>${fmt(before, 1)} m</strong> last time ` +
      `<span class="ar">&rarr;</span> <strong>${fmt(miss, 1)} m</strong> now ` +
      `&nbsp;<span class="d">${better ? '&#9660;' : '&#9650;'} ` +
      `${fmt(Math.abs(delta), 1)} m ${better ? 'better' : 'worse'}</span>`;
  } else {
    v.className = 'verdict';
    v.innerHTML = 'Change something, then drop again — this line will tell you ' +
      'whether it helped.';
  }
  $('noteDrop').innerHTML = EXPLAIN +
    `Flying with <strong>${MODE_NAME[S.mode]}</strong>; the compass is ` +
    `${S.bias > 0 ? '+' : ''}${S.bias}&deg; out, which the filter must work out too.`;
}

function renderAttempts() {
  const host = $('attempts');
  if (!S.attempts.length) { host.innerHTML = ''; return; }
  const best = Math.min(...S.attempts.map(a => a.miss));
  host.innerHTML = S.attempts.map((a, i) => {
    const isBest = Math.abs(a.miss - best) < 1e-9;
    const last = i === S.attempts.length - 1;
    return `<span class="pill${isBest ? ' best' : ''}${last ? ' now' : ''}" ` +
      `style="border-color:${MODE_COLOR[a.mode]}" ` +
      `title="wind ${fmt(a.wind, 1)} m/s · loading ${fmt(a.load, 2)} · ` +
      `height ${a.height} m · bias ${a.bias}°">${fmt(a.miss, 1)} m</span>`;
  }).join('');
}

function doMany() {
  const d = design(), N = 50, r = rng(4242);
  const res = { none: [], ekf: [] }, land = { none: [], ekf: [] };
  for (let i = 0; i < N; i++) {
    const sp = r.uniform(0, Math.max(S.wind, 0.2) * 2), dn = r.uniform(0, 2 * Math.PI);
    const wt = [sp * Math.cos(dn), sp * Math.sin(dn)];
    const h = r.uniform(20, 60), hb = r.uniform(-12, 12);
    for (const mo of ['none', 'ekf']) {
      const out = simulate({
        target: TARGET, windTrue: wt, params: { vh: d.vh, vz: d.vz, R: d.R },
        height0: h, mode: mo, headingBiasDeg: hb, seed: i + 1,
      });
      res[mo].push(out.miss); land[mo].push(out.landing);
    }
  }
  const g = gDrop; clear(g);
  const xs = [TARGET[0]], ys = [TARGET[1]];
  for (const mo of ['none', 'ekf']) for (const p of land[mo]) { xs.push(p[0]); ys.push(p[1]); }
  const m = mapper(g, xs, ys, 56);
  for (const mo of ['none', 'ekf'])
    for (const p of land[mo]) dot(g, m.x(p[0]), m.y(p[1]), 4.5, MODE_COLOR[mo], '#fff');
  cross(g, m.x(TARGET[0]), m.y(TARGET[1]), 10, INK);
  label(g, `${N} drops · random wind, height and compass bias`, 16, 24, INK3);
  const mn = median(res.none), me = median(res.ekf);
  $('roMiss').innerHTML = `<span style="color:${PINK}">${fmt(mn, 1)}</span>` +
    `<span style="color:#8C877C"> / </span><span style="color:${BLUE}">${fmt(me, 1)}</span> m`;
  $('verdict').className = 'verdict';
  $('verdict').innerHTML = `Median over ${N} drops: ` +
    `<strong style="color:${PINK}">${fmt(mn, 1)} m</strong> knowing nothing, ` +
    `<strong style="color:${BLUE}">${fmt(me, 1)} m</strong> with the EKF.`;
  $('noteDrop').textContent = 'Every dot is one package on the ground.';
  S.current = null; S.prev = null;
}

function checkPenetration(d) {
  const w = $('warnPen'), can = d.vh > S.wind;
  w.classList.toggle('on', !can);
  if (!can) w.textContent =
    `Wind ${fmt(S.wind, 1)} m/s beats the airspeed ${fmt(d.vh, 1)} m/s. The package ` +
    `physically cannot fly upwind — no guidance law fixes this. Add ballast, or wait.`;
}

/* =============================== 02 · WHY NOT AN ORDINARY ROUND PARACHUTE = */
const gGlide = ctx2d($('cGlide'));
let animG = null;

/* A round canopy has no airspeed of its own: it goes exactly where the air
   goes. Given the SAME sink rate as the parafoil, which flatters it — a real
   round canopy of this size drops faster and drifts less. */
function roundChuteRun() {
  const d = design(), w = windVec(), dt = 0.05;
  const hd = Math.atan2(w[1], w[0]);
  let x = 0, y = 0, z = S.height, t = 0;
  const track = [];
  while (z > 0 && track.length < 40000) {
    x += w[0] * dt; y += w[1] * dt; z -= d.vz * dt; t += dt;
    track.push([t, x, y, Math.max(z, 0), hd, 'drift']);
  }
  return { track, landing: [x, y], tTotal: t,
           miss: Math.hypot(x - TARGET[0], y - TARGET[1]) };
}

function paintGlide(frac) {
  const round = roundChuteRun(), foil = runDrop('ekf');
  drawDrop(gGlide, {
    runs: [{ kind: 'round', color: INK3, res: round },
           { kind: 'foil', color: BLUE, res: foil }],
    frac, wind: windVec(), windSpeed: S.wind, height: S.height, target: TARGET,
  });
  $('roRound').textContent = `${fmt(round.miss, 1)} m`;
  $('roFoil').textContent = `${fmt(foil.miss, 1)} m`;
}

function animateGlide() {
  if (animG) cancelAnimationFrame(animG);
  const t0 = performance.now(), dur = 3000;
  const step = now => {
    const f = Math.min(1, (now - t0) / dur);
    paintGlide(f);
    animG = f < 1 ? requestAnimationFrame(step) : null;
  };
  animG = requestAnimationFrame(step);
}

/* ====================================================== 05 · WING LOADING = */
const gLoad = ctx2d($('cLoad'));
function drawLoad() {
  const g = gLoad; clear(g);
  const L0 = 0.25, L1 = 2.5, pad = 54;
  const X = v => pad + (v - L0) / (L1 - L0) * (g.W - pad - 58);
  const vmax = 7, Rmax = 14;
  const Yv = v => g.H - pad - v / vmax * (g.H - 2 * pad);
  const Yr = v => g.H - pad - v / Rmax * (g.H - 2 * pad);

  line(g, [[pad, pad - 14], [pad, g.H - pad], [g.W - 50, g.H - pad]], LINE, 2);

  const band = [];
  for (let L = L0; L <= L1; L += 0.01) band.push([X(L), Yv(glideState(L, 1, CL, CD).vh)]);
  const Lcrit = minLoading(S.wind);
  if (Lcrit > L0) {
    const xEnd = X(Math.min(Lcrit, L1));
    g.save(); g.fillStyle = 'rgba(255,46,147,.13)';
    g.fillRect(X(L0), pad - 14, xEnd - X(L0), g.H - pad - (pad - 14)); g.restore();
    line(g, [[xEnd, pad - 14], [xEnd, g.H - pad]], PINK, 2.5, [6, 5]);
    if (xEnd - X(L0) > 78)
      label(g, 'TOO SLOW TO FLY', (X(L0) + xEnd) / 2, pad + 4, PINK, 'center');
  }

  line(g, [[pad, Yv(S.wind)], [g.W - 50, Yv(S.wind)]], INK3, 2, [7, 6]);
  label(g, `wind ${fmt(S.wind, 1)} m/s`, g.W - 54, Yv(S.wind) - 8, INK3, 'right');

  line(g, band, BLUE, 3.5);
  const rc = [];
  for (let L = L0; L <= L1; L += 0.01)
    rc.push([X(L), Yr(turnRadius(glideState(L, 1, CL, CD).vh, BANK))]);
  line(g, rc, PINK, 3.5);

  const d = design();
  line(g, [[X(S.load), pad - 14], [X(S.load), g.H - pad]], INK, 2, [4, 5]);
  dot(g, X(S.load), Yv(d.vh), 6.5, BLUE);
  dot(g, X(S.load), Yr(d.R), 6.5, PINK);

  label(g, 'AIRSPEED  m/s', pad + 6, pad - 2, BLUE);
  label(g, 'TURN RADIUS  m', g.W - 54, pad - 2, PINK, 'right');
  for (let L = 0.5; L <= 2.5; L += 0.5) label(g, L.toFixed(1), X(L), g.H - pad + 18, INK3, 'center');
  label(g, 'WING LOADING  kg/m²', g.W / 2, g.H - 14, INK3, 'center');

  $('roL2').textContent = fmt(S.load, 2);
  $('roV2').textContent = `${fmt(d.vh, 1)} m/s`;
  $('roR2').textContent = `${fmt(d.R, 1)} m`;
}

/* ====================================================== 03 · DESIGN CHART = */
const gChart = ctx2d($('cChart'));
let GRID = null;
const RAMP = ['#F7FBFC', '#CDE8EC', '#8FCBD4', '#3E9DAC', '#1C6B7C', '#0B3742'];
function rampColor(v, vmax) {
  if (v == null) return '#EFF2F3';
  const t = Math.max(0, Math.min(1, v / vmax)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(t)), f = t - i;
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const a = hex(RAMP[i]), b = hex(RAMP[i + 1]);
  return `rgb(${a.map((v0, k) => Math.round(v0 + (b[k] - v0) * f)).join(',')})`;
}
const chartBox = g => ({ px: 62, py: 26, pw: g.W - 62 - 92, ph: g.H - 26 - 56 });

function drawChart() {
  const g = gChart; clear(g);
  if (!GRID) { label(g, 'loading design grid…', g.W / 2, g.H / 2, INK3, 'center'); return; }
  const { loads, winds, miss } = GRID;
  const { px, py, pw, ph } = chartBox(g);
  const vmax = 16, cw = pw / loads.length, ch = ph / winds.length;

  for (let j = 0; j < winds.length; j++)
    for (let i = 0; i < loads.length; i++) {
      g.fillStyle = rampColor(miss[j][i], vmax);
      g.fillRect(px + i * cw, py + ph - (j + 1) * ch, Math.ceil(cw) + .5, Math.ceil(ch) + .5);
    }

  const bd = [];
  for (let j = 0; j < 200; j++) {
    const W = winds[0] + (winds[winds.length - 1] - winds[0]) * j / 199;
    const Lm = minLoading(W);
    if (Lm >= loads[0] && Lm <= loads[loads.length - 1])
      bd.push([px + (Lm - loads[0]) / (loads[loads.length - 1] - loads[0]) * pw,
               py + ph - (W - winds[0]) / (winds[winds.length - 1] - winds[0]) * ph]);
  }
  line(g, bd, PINK, 3);

  const mx = px + (S.load - loads[0]) / (loads[loads.length - 1] - loads[0]) * pw;
  const my = py + ph - (S.wind - winds[0]) / (winds[winds.length - 1] - winds[0]) * ph;
  if (mx >= px && mx <= px + pw && my >= py && my <= py + ph) {
    g.save(); g.strokeStyle = '#fff'; g.lineWidth = 4;
    g.beginPath(); g.arc(mx, my, 9, 0, 7); g.stroke();
    g.strokeStyle = INK; g.lineWidth = 2.5; g.stroke(); g.restore();
  }

  g.save(); g.strokeStyle = INK; g.lineWidth = 2.5; g.strokeRect(px, py, pw, ph); g.restore();

  for (let i = 0; i < loads.length; i += 3)
    label(g, loads[i].toFixed(2), px + (i + .5) * cw, py + ph + 18, INK3, 'center');
  for (let j = 0; j < winds.length; j += 2)
    label(g, winds[j].toFixed(1), px - 8, py + ph - (j + .5) * ch + 4, INK3, 'right');
  label(g, 'WING LOADING  kg/m²', px + pw / 2, g.H - 14, INK3, 'center');
  g.save(); g.translate(14, py + ph / 2); g.rotate(-Math.PI / 2);
  label(g, 'WIND SPEED  m/s', 0, 0, INK3, 'center'); g.restore();

  const lx = px + pw + 22, lw = 16, lh = ph;
  for (let k = 0; k < lh; k++) {
    g.fillStyle = rampColor(vmax * (1 - k / lh), vmax);
    g.fillRect(lx, py + k, lw, 1.5);
  }
  g.save(); g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(lx, py, lw, lh); g.restore();
  label(g, `${vmax}+ m`, lx + lw + 6, py + 10, INK3);
  label(g, '0 m', lx + lw + 6, py + lh, INK3);
}

function chartPick(ev, commit) {
  if (!GRID) return;
  const g = gChart, r = $('cChart').getBoundingClientRect(), scale = g.W / r.width;
  const x = (ev.clientX - r.left) * scale, y = (ev.clientY - r.top) * scale;
  const { px, py, pw, ph } = chartBox(g);
  const { loads, winds, miss } = GRID;
  if (x < px || x > px + pw || y < py || y > py + ph) return;
  const i = Math.min(loads.length - 1, Math.floor((x - px) / (pw / loads.length)));
  const j = Math.min(winds.length - 1, Math.floor((py + ph - y) / (ph / winds.length)));
  const v = miss[j][i];
  $('roPick').textContent = v == null ? 'cannot fly' : `${v.toFixed(1)} m`;
  $('roPick').style.color = v == null ? PINK : INK;
  $('notePick').textContent =
    `loading ${loads[i].toFixed(2)} kg/m² · wind ${winds[j].toFixed(1)} m/s` +
    (v == null ? ' — wind beats airspeed, no guided descent exists' : ' — median of 24 drops');
  if (commit) {
    S.load = Math.max(0.25, Math.min(2.5, loads[i]));
    S.wind = Math.max(0, Math.min(4, winds[j]));
    $('sL').value = S.load; $('sWind').value = S.wind;
    syncLabels(); redrawAll();
    refreshDrop({ animate: true, record: true });
    document.getElementById('sec-drop').scrollIntoView({ behavior: 'smooth' });
  }
}

/* ============================================================ 04 · DUBINS = */
const gDub = ctx2d($('cDub'));
const DUB = { start: [-26, -12, 0.3], end: [22, 10, 2.2], R: 7, drag: null };

function dubMap() {
  const all = dubinsAll(DUB.start, DUB.end, DUB.R);
  const xs = [DUB.start[0], DUB.end[0]], ys = [DUB.start[1], DUB.end[1]];
  for (const p of Object.values(all))
    for (const q of dubinsSample(p, 1.5)) { xs.push(q[0]); ys.push(q[1]); }
  return { all, m: mapper(gDub, xs, ys, 52), xs, ys };
}

function drawDub() {
  const g = gDub; clear(g);
  const { all, m } = dubMap();
  const best = dubinsSolve(DUB.start, DUB.end, DUB.R);

  for (const [name, p] of Object.entries(all)) {
    if (best && name === best.type) continue;
    line(g, dubinsSample(p, 0.6).map(q => [m.x(q[0]), m.y(q[1])]), '#D8D2C2', 2);
  }
  if (best) line(g, dubinsSample(best, 0.4).map(q => [m.x(q[0]), m.y(q[1])]), PINK, 4);

  const ah = 22;
  arrow(g, m.x(DUB.start[0]), m.y(DUB.start[1]),
    ah * Math.cos(DUB.start[2]), -ah * Math.sin(DUB.start[2]), INK, 3);
  dot(g, m.x(DUB.start[0]), m.y(DUB.start[1]), 6, INK, null);
  label(g, 'START', m.x(DUB.start[0]) + 10, m.y(DUB.start[1]) + 20, INK);

  arrow(g, m.x(DUB.end[0]), m.y(DUB.end[1]),
    ah * Math.cos(DUB.end[2]), -ah * Math.sin(DUB.end[2]), BLUE, 3);
  dot(g, m.x(DUB.end[0]), m.y(DUB.end[1]), 7, BLUE);
  label(g, 'ARRIVE HERE — drag me', m.x(DUB.end[0]) + 12, m.y(DUB.end[1]) - 14, BLUE);
  const hx = m.x(DUB.end[0]) + (ah + 16) * Math.cos(DUB.end[2]);
  const hy = m.y(DUB.end[1]) - (ah + 16) * Math.sin(DUB.end[2]);
  dot(g, hx, hy, 6, YEL, INK);
  label(g, 'spin', hx + 10, hy + 4, INK3);

  const rows = Object.entries(all).sort((a, b) => a[1].length - b[1].length);
  $('tDub').querySelector('tbody').innerHTML = rows.map(([n, p]) =>
    `<tr${best && n === best.type ? ' class="key"' : ''}><td>${n}</td>` +
    `<td class="n">${p.length.toFixed(1)} m</td></tr>`).join('') +
    (rows.length < 6 ? `<tr><td colspan="2" style="color:${INK3};font-size:13px">` +
      `${6 - rows.length} shape(s) impossible for this pair</td></tr>` : '');
}

function dubPointer(ev, down) {
  const g = gDub, r = $('cDub').getBoundingClientRect(), scale = g.W / r.width;
  const x = (ev.clientX - r.left) * scale, y = (ev.clientY - r.top) * scale;
  const { m, xs, ys } = dubMap();
  const ah = 22;
  const hx = m.x(DUB.end[0]) + (ah + 16) * Math.cos(DUB.end[2]);
  const hy = m.y(DUB.end[1]) - (ah + 16) * Math.sin(DUB.end[2]);
  if (down) DUB.drag = Math.hypot(x - hx, y - hy) < 22 ? 'spin' : 'move';
  if (!DUB.drag) return;
  if (DUB.drag === 'spin') {
    DUB.end[2] = Math.atan2(-(y - m.y(DUB.end[1])), x - m.x(DUB.end[0]));
  } else {
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    DUB.end[0] = (x - g.W / 2) / m.s + cx;
    DUB.end[1] = -(y - g.H / 2) / m.s + cy;
  }
  drawDub();
}

/* =============================================================== 05 · EKF = */
const gEkf = ctx2d($('cEkf'));
function drawEkf() {
  const g = gEkf; clear(g);
  const d = design(), w = windVec();
  const out = simulate({
    target: TARGET, windTrue: w, params: { vh: d.vh, vz: d.vz, R: d.R },
    height0: S.height, mode: 'ekf', headingBiasDeg: S.bias, seed: 12,
    straightOnly: S.straight,
  });
  const H = out.windHist;
  if (!H.length) return;
  const pad = 52, T = H[H.length - 1][0];
  const lim = Math.max(2.2, Math.abs(w[0]) + 1.2, Math.abs(w[1]) + 1.2,
    ...H.map(p => Math.max(Math.abs(p[1]), Math.abs(p[2]))));
  const X = t => pad + t / T * (g.W - pad - 38);
  const Y = v => g.H / 2 - v / lim * (g.H / 2 - pad);

  line(g, [[pad, pad - 12], [pad, g.H - pad + 12]], LINE, 2);
  line(g, [[pad, Y(0)], [g.W - 34, Y(0)]], LINE, 2);
  line(g, [[pad, Y(w[0])], [g.W - 34, Y(w[0])]], BLUE, 2, [7, 6]);
  line(g, [[pad, Y(w[1])], [g.W - 34, Y(w[1])]], PINK, 2, [7, 6]);
  line(g, H.map(p => [X(p[0]), Y(p[1])]), BLUE, 3.2);
  line(g, H.map(p => [X(p[0]), Y(p[2])]), PINK, 3.2);

  label(g, 'wind east  (true, dashed)', g.W - 36, Y(w[0]) - 9, BLUE, 'right');
  label(g, 'wind north (true, dashed)', g.W - 36, Y(w[1]) + 18, PINK, 'right');
  label(g, '0', pad - 8, Y(0) + 4, INK3, 'right');
  label(g, lim.toFixed(1), pad - 8, Y(lim) + 4, INK3, 'right');
  label(g, `-${lim.toFixed(1)}`, pad - 8, Y(-lim) + 4, INK3, 'right');
  label(g, 'SECONDS AFTER RELEASE', g.W / 2, g.H - 12, INK3, 'center');
  for (let t = 0; t <= T; t += 5) label(g, `${t}`, X(t), g.H - pad + 28, INK3, 'center');

  $('roWerr').textContent = `${out.windErr.toFixed(2)} m/s`;
  $('roWerr').style.color = out.windErr > 0.6 ? PINK : GRN;
}

/* ============================================================= 07 · SCALE = */
const gScale = ctx2d($('cScale'));
function drawScale() {
  const g = gScale; clear(g);
  const pad = 56, W1 = 4.5;
  const X = v => pad + v / W1 * (g.W - pad - 54);
  const Lmax = 1.3, Rmax = 7;
  const Yl = v => g.H - pad - v / Lmax * (g.H - 2 * pad);
  const Yr = v => g.H - pad - v / Rmax * (g.H - 2 * pad);
  line(g, [[pad, pad - 14], [pad, g.H - pad], [g.W - 46, g.H - pad]], LINE, 2);

  const a = [], b = [];
  for (let W = 0.2; W <= W1; W += 0.02) {
    const Lm = minLoading(W);
    a.push([X(W), Yl(Lm)]);
    b.push([X(W), Yr(turnRadius(glideState(Lm, 1, CL, CD).vh, BANK))]);
  }
  line(g, a, BLUE, 3.5);
  line(g, b, PINK, 3.5);

  if (S.wind > 0.2 && S.wind <= W1) {
    const Lm = minLoading(S.wind);
    line(g, [[X(S.wind), pad - 14], [X(S.wind), g.H - pad]], INK, 2, [4, 5]);
    dot(g, X(S.wind), Yl(Lm), 6.5, BLUE);
    dot(g, X(S.wind), Yr(turnRadius(glideState(Lm, 1, CL, CD).vh, BANK)), 6.5, PINK);
  }
  label(g, 'LIGHTEST LOADING THAT FLIES  kg/m²', pad + 6, pad - 2, BLUE);
  label(g, 'SMALLEST TURN RADIUS  m', g.W - 48, pad - 2, PINK, 'right');
  for (let W = 1; W <= 4; W++) label(g, `${W}`, X(W), g.H - pad + 18, INK3, 'center');
  label(g, 'WIND SPEED YOU DESIGN FOR  m/s', g.W / 2, g.H - 14, INK3, 'center');
  label(g, 'both curves are W²', X(W1) - 10, Yl(Lmax) + 26, INK3, 'right');
}

/* ============================================================ wiring ===== */
function syncLabels() {
  $('vWind').textContent = `${fmt(S.wind, 1)} m/s`;
  $('vDir').textContent = `${S.dir}°`;
  $('vH').textContent = `${S.height} m`;
  $('vL').textContent = `${fmt(S.load, 2)} kg/m²`;
  $('vB').textContent = `${S.bias > 0 ? '+' : ''}${S.bias}°`;
}
function redrawAll() { drawLoad(); drawChart(); drawEkf(); drawScale(); paintGlide(1); }

const bind = (id, key) => $(id).addEventListener('input', e => {
  S[key] = parseFloat(e.target.value);
  syncLabels(); redrawAll();
  refreshDrop();                       // preview only — not a recorded attempt
});
['sWind:wind', 'sDir:dir', 'sH:height', 'sL:load', 'sB:bias']
  .forEach(p => bind(...p.split(':')));

$('modeSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  S.mode = b.dataset.mode;
  [...$('modeSeg').children].forEach(x => x.setAttribute('aria-pressed', x === b));
  refreshDrop();
});
$('obsSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  S.straight = b.dataset.straight === '1';
  [...$('obsSeg').children].forEach(x => x.setAttribute('aria-pressed', x === b));
  drawEkf();
});
$('bDrop').addEventListener('click', () => refreshDrop({ animate: true, record: true }));
$('bRace').addEventListener('click', () => refreshDrop({ animate: true, race: true }));
$('b50').addEventListener('click', doMany);
$('bGlide').addEventListener('click', animateGlide);
$('bReset').addEventListener('click', () => {
  S.attempts = []; S.prev = null; S.current = null; S.lastDrop = null;
  renderAttempts(); refreshDrop();
});

$('cChart').addEventListener('mousemove', e => chartPick(e, false));
$('cChart').addEventListener('click', e => chartPick(e, true));
$('cDub').addEventListener('pointerdown', e => {
  $('cDub').setPointerCapture(e.pointerId); dubPointer(e, true);
});
$('cDub').addEventListener('pointermove', e => { if (DUB.drag) dubPointer(e, false); });
window.addEventListener('pointerup', () => { DUB.drag = null; });

fetch('design_grid.json').then(r => r.json()).then(j => { GRID = j; drawChart(); })
  .catch(() => drawChart());

syncLabels();
drawDub();
redrawAll();
// Paint a finished drop straight away. Animating on load left the canvas
// looking empty for three seconds, which read as "nothing is happening".
refreshDrop();
