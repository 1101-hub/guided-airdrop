/* ===========================================================================
   app.js — wiring for the interactive page. All physics comes from
   physics.js, which is a verified port of the Python in ../model/.
   =========================================================================== */
import {
  glideState, turnRadius, minLoading, dubinsSolve, dubinsAll, dubinsSample,
  DUBINS_TYPES, simulate, median, rng, G,
} from './physics.js';

const INK = '#141414', INK3 = '#8C877C', LINE = '#E2DCCB';
const PINK = '#FF2E93', BLUE = '#3B54E8', GRN = '#4FA828', YEL = '#FFD12E';
const MONO = '11px ui-monospace, Consolas, monospace';
const CL = 0.80, CD = 0.27, BANK = 20, TARGET = [20, 10];

const $ = id => document.getElementById(id);

/* Canvas helper: device-pixel-ratio aware, plus a world->screen mapper. */
function ctx2d(cv) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = cv.width, h = cv.height;
  cv.width = w * dpr; cv.height = h * dpr;
  cv.style.height = 'auto';
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  g.W = w; g.H = h;
  return g;
}
function clear(g) { g.clearRect(0, 0, g.W, g.H); }

/* Equal-aspect map from world metres to canvas pixels. */
function mapper(g, xs, ys, pad = 46) {
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let sx = (x1 - x0) || 1, sy = (y1 - y0) || 1;
  const s = Math.min((g.W - 2 * pad) / sx, (g.H - 2 * pad) / sy);
  return {
    s,
    x: v => g.W / 2 + (v - cx) * s,
    y: v => g.H / 2 - (v - cy) * s,
  };
}
function line(g, pts, color, width = 3, dash = null) {
  if (pts.length < 2) return;
  g.save(); g.strokeStyle = color; g.lineWidth = width;
  g.lineJoin = 'round'; g.lineCap = 'round';
  if (dash) g.setLineDash(dash);
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.stroke(); g.restore();
}
function dot(g, x, y, r, fill, ring = '#fff') {
  g.save(); g.beginPath(); g.arc(x, y, r, 0, 7);
  g.fillStyle = fill; g.fill();
  if (ring) { g.lineWidth = 2; g.strokeStyle = ring; g.stroke(); }
  g.restore();
}
function cross(g, x, y, r, color) {
  g.save(); g.strokeStyle = color; g.lineWidth = 3.5; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x - r, y - r); g.lineTo(x + r, y + r);
  g.moveTo(x + r, y - r); g.lineTo(x - r, y + r);
  g.stroke(); g.restore();
}
function label(g, text, x, y, color = INK3, align = 'left', font = MONO) {
  g.save(); g.fillStyle = color; g.font = font; g.textAlign = align;
  g.fillText(text, x, y); g.restore();
}
function arrow(g, x, y, dx, dy, color, width = 3) {
  const len = Math.hypot(dx, dy); if (len < 1) return;
  const ux = dx / len, uy = dy / len;
  line(g, [[x, y], [x + dx, y + dy]], color, width);
  const hx = x + dx, hy = y + dy, a = 7;
  g.save(); g.fillStyle = color; g.beginPath();
  g.moveTo(hx, hy);
  g.lineTo(hx - a * ux + a * 0.55 * uy, hy - a * uy - a * 0.55 * ux);
  g.lineTo(hx - a * ux - a * 0.55 * uy, hy - a * uy + a * 0.55 * ux);
  g.closePath(); g.fill(); g.restore();
}

/* ------------------------------------------------------------ shared state */
const S = {
  wind: 1.6, dir: 45, height: 40, load: 1.2, bias: 6,
  mode: 'ekf', straight: false,
};
const windVec = () => {
  const a = S.dir * Math.PI / 180;
  return [S.wind * Math.cos(a), S.wind * Math.sin(a)];
};
function design(load = S.load) {
  const g = glideState(load, 1.0, CL, CD);
  return { ...g, R: turnRadius(g.vh, BANK) };
}
const fmt = (v, n = 2) => v.toFixed(n);

/* ======================================================== 01 · THE DROP === */
const gDrop = ctx2d($('cDrop'));
let anim = null;

function runDrop(mode, seed = 7) {
  const d = design();
  return simulate({
    target: TARGET, windTrue: windVec(),
    params: { vh: d.vh, vz: d.vz, R: d.R },
    height0: S.height, mode, headingBiasDeg: S.bias, seed,
  });
}

function drawDrop(runs, frac = 1) {
  const g = gDrop; clear(g);
  const xs = [0, TARGET[0]], ys = [0, TARGET[1]];
  for (const r of runs) for (const p of r.res.track) { xs.push(p[1]); ys.push(p[2]); }
  const m = mapper(g, xs, ys);

  // grid every 10 m
  g.save(); g.strokeStyle = '#F0ECE0'; g.lineWidth = 1;
  const lo = Math.floor(Math.min(...xs) / 10) * 10, hi = Math.ceil(Math.max(...xs) / 10) * 10;
  const lo2 = Math.floor(Math.min(...ys) / 10) * 10, hi2 = Math.ceil(Math.max(...ys) / 10) * 10;
  for (let v = lo; v <= hi; v += 10) { g.beginPath(); g.moveTo(m.x(v), 0); g.lineTo(m.x(v), g.H); g.stroke(); }
  for (let v = lo2; v <= hi2; v += 10) { g.beginPath(); g.moveTo(0, m.y(v)); g.lineTo(g.W, m.y(v)); g.stroke(); }
  g.restore();

  // wind arrow
  const w = windVec();
  if (S.wind > 0.05) {
    const px = 78, py = 52, sc = 26;
    arrow(g, px, py, w[0] / S.wind * sc, -w[1] / S.wind * sc, INK3, 3);
    label(g, `wind ${fmt(S.wind, 1)} m/s`, px - 26, py + 30, INK3);
  }

  cross(g, m.x(TARGET[0]), m.y(TARGET[1]), 9, INK);
  label(g, 'TARGET', m.x(TARGET[0]) + 14, m.y(TARGET[1]) + 4, INK);

  for (const r of runs) {
    const t = r.res.track, n = Math.max(2, Math.floor(t.length * frac));
    const pts = t.slice(0, n).map(p => [m.x(p[1]), m.y(p[2])]);
    line(g, pts, r.color, 2.6);
    if (frac >= 1) {
      const L = r.res.landing;
      dot(g, m.x(L[0]), m.y(L[1]), 6, r.color);
    } else if (pts.length) {
      const p = pts[pts.length - 1];
      dot(g, p[0], p[1], 5.5, r.color);
    }
  }
  dot(g, m.x(0), m.y(0), 5, INK, null);
  label(g, 'RELEASE', m.x(0) + 12, m.y(0) - 10, INK);

  // scale bar
  const barM = 20, px0 = g.W - 40 - barM * m.s, py0 = g.H - 26;
  line(g, [[px0, py0], [px0 + barM * m.s, py0]], INK3, 2.5);
  label(g, `${barM} m`, px0 + barM * m.s / 2, py0 - 8, INK3, 'center');
}

const MODE_COLOR = { none: PINK, ekf: BLUE, true: GRN };
const MODE_NAME = { none: 'no estimate', ekf: 'EKF', true: 'true wind' };

function animateDrop(runs) {
  if (anim) cancelAnimationFrame(anim);
  const t0 = performance.now(), dur = 1500;
  const step = now => {
    const f = Math.min(1, (now - t0) / dur);
    drawDrop(runs, f);
    if (f < 1) anim = requestAnimationFrame(step);
    else anim = null;
  };
  anim = requestAnimationFrame(step);
}

function doDrop() {
  const d = design();
  const runs = [{ mode: S.mode, color: MODE_COLOR[S.mode], res: runDrop(S.mode) }];
  animateDrop(runs);
  $('roMiss').textContent = `${fmt(runs[0].res.miss, 1)} m`;
  $('roMiss').style.color = MODE_COLOR[S.mode];
  $('roAir').textContent = `${fmt(d.vh, 1)} m/s`;
  $('roTurn').textContent = `${fmt(d.R, 1)} m`;
  $('roTime').textContent = `${fmt(S.height / d.vz, 0)} s`;
  $('noteDrop').textContent =
    `Flying with ${MODE_NAME[S.mode]}. The compass is ${S.bias > 0 ? '+' : ''}${S.bias}° out, ` +
    `which the filter has to work out too.`;
  checkPenetration(d);
}

function doRace() {
  const runs = ['none', 'ekf', 'true'].map(mo =>
    ({ mode: mo, color: MODE_COLOR[mo], res: runDrop(mo) }));
  animateDrop(runs);
  const d = design();
  $('roMiss').innerHTML = runs.map(r =>
    `<span style="color:${r.color}">${fmt(r.res.miss, 1)}</span>`).join('<span style="color:#8C877C"> / </span>') + ' m';
  $('roAir').textContent = `${fmt(d.vh, 1)} m/s`;
  $('roTurn').textContent = `${fmt(d.R, 1)} m`;
  $('roTime').textContent = `${fmt(S.height / d.vz, 0)} s`;
  $('noteDrop').innerHTML =
    `<span style="color:${PINK}">pink</span> no estimate &middot; ` +
    `<span style="color:${BLUE}">blue</span> EKF &middot; ` +
    `<span style="color:${GRN}">green</span> true wind supplied &mdash; same conditions, same seed.`;
  checkPenetration(d);
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
  const m = mapper(g, xs, ys);
  for (const mo of ['none', 'ekf'])
    for (const p of land[mo]) dot(g, m.x(p[0]), m.y(p[1]), 4.5, MODE_COLOR[mo], '#fff');
  cross(g, m.x(TARGET[0]), m.y(TARGET[1]), 10, INK);
  label(g, `${N} drops, random wind / height / compass bias`, 16, 22, INK3);
  const mn = median(res.none), me = median(res.ekf);
  $('roMiss').innerHTML = `<span style="color:${PINK}">${fmt(mn, 1)}</span>` +
    `<span style="color:#8C877C"> / </span><span style="color:${BLUE}">${fmt(me, 1)}</span> m`;
  $('noteDrop').innerHTML = `Median miss over ${N} drops: ` +
    `<span style="color:${PINK}">${fmt(mn, 1)} m</span> with no estimate, ` +
    `<span style="color:${BLUE}">${fmt(me, 1)} m</span> with the EKF. ` +
    `Each dot is where one package landed.`;
}

function checkPenetration(d) {
  const w = $('warnPen'), can = d.vh > S.wind;
  w.classList.toggle('on', !can);
  if (!can) w.textContent =
    `Wind ${fmt(S.wind, 1)} m/s beats the airspeed ${fmt(d.vh, 1)} m/s. ` +
    `The package physically cannot fly upwind — no guidance law fixes this. ` +
    `Add ballast (more loading) or wait for calmer air.`;
}

/* ====================================================== 02 · WING LOADING = */
const gLoad = ctx2d($('cLoad'));
function drawLoad() {
  const g = gLoad; clear(g);
  const L0 = 0.25, L1 = 2.5, pad = 54;
  const X = v => pad + (v - L0) / (L1 - L0) * (g.W - pad - 58);
  const vmax = 7, Rmax = 14;
  const Yv = v => g.H - pad - v / vmax * (g.H - 2 * pad);
  const Yr = v => g.H - pad - v / Rmax * (g.H - 2 * pad);

  // axes
  line(g, [[pad, pad - 14], [pad, g.H - pad], [g.W - 50, g.H - pad]], LINE, 2);

  // infeasible band: airspeed below the current wind
  const band = [];
  for (let L = L0; L <= L1; L += 0.01) band.push([X(L), Yv(glideState(L, 1, CL, CD).vh)]);
  g.save();
  g.beginPath(); g.moveTo(X(L0), g.H - pad);
  for (const [x, y] of band) g.lineTo(x, Math.min(y, Yv(S.wind)));
  g.lineTo(X(L1), g.H - pad); g.closePath();
  g.fillStyle = 'rgba(255,46,147,.10)'; g.fill(); g.restore();

  line(g, [[pad, Yv(S.wind)], [g.W - 50, Yv(S.wind)]], PINK, 2.5, [7, 6]);
  label(g, `wind ${fmt(S.wind, 1)} m/s — below this it cannot fly upwind`,
    g.W - 54, Yv(S.wind) - 8, PINK, 'right');

  // curves
  line(g, band, BLUE, 3.5);
  const rc = [];
  for (let L = L0; L <= L1; L += 0.01) rc.push([X(L), Yr(turnRadius(glideState(L, 1, CL, CD).vh, BANK))]);
  line(g, rc, PINK, 3.5);

  // current point
  const d = design();
  line(g, [[X(S.load), pad - 14], [X(S.load), g.H - pad]], INK, 2, [4, 5]);
  dot(g, X(S.load), Yv(d.vh), 6.5, BLUE);
  dot(g, X(S.load), Yr(d.R), 6.5, PINK);

  label(g, 'AIRSPEED  m/s', pad + 6, pad - 2, BLUE);
  label(g, 'TURN RADIUS  m', g.W - 54, pad - 2, PINK, 'right');
  for (let L = 0.5; L <= 2.5; L += 0.5) label(g, L.toFixed(1), X(L), g.H - pad + 18, INK3, 'center');
  label(g, 'WING LOADING  kg/m²', (g.W) / 2, g.H - 14, INK3, 'center');

  $('roL2').textContent = `${fmt(S.load, 2)}`;
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
  const vmax = 16;
  const cw = pw / loads.length, ch = ph / winds.length;

  for (let j = 0; j < winds.length; j++)
    for (let i = 0; i < loads.length; i++) {
      g.fillStyle = rampColor(miss[j][i], vmax);
      g.fillRect(px + i * cw, py + ph - (j + 1) * ch, Math.ceil(cw) + .5, Math.ceil(ch) + .5);
    }

  // v = W boundary
  const bd = [];
  for (let j = 0; j < 200; j++) {
    const W = winds[0] + (winds[winds.length - 1] - winds[0]) * j / 199;
    const Lm = minLoading(W);
    if (Lm >= loads[0] && Lm <= loads[loads.length - 1])
      bd.push([px + (Lm - loads[0]) / (loads[loads.length - 1] - loads[0]) * pw,
               py + ph - (W - winds[0]) / (winds[winds.length - 1] - winds[0]) * ph]);
  }
  line(g, bd, PINK, 3);

  // current design marker
  const mx = px + (S.load - loads[0]) / (loads[loads.length - 1] - loads[0]) * pw;
  const my = py + ph - (S.wind - winds[0]) / (winds[winds.length - 1] - winds[0]) * ph;
  if (mx >= px && mx <= px + pw && my >= py && my <= py + ph) {
    g.save(); g.strokeStyle = '#fff'; g.lineWidth = 4;
    g.beginPath(); g.arc(mx, my, 9, 0, 7); g.stroke();
    g.strokeStyle = INK; g.lineWidth = 2.5; g.stroke(); g.restore();
  }

  g.save(); g.strokeStyle = INK; g.lineWidth = 2.5;
  g.strokeRect(px, py, pw, ph); g.restore();

  for (let i = 0; i < loads.length; i += 3)
    label(g, loads[i].toFixed(2), px + (i + .5) * cw, py + ph + 18, INK3, 'center');
  for (let j = 0; j < winds.length; j += 2)
    label(g, winds[j].toFixed(1), px - 8, py + ph - (j + .5) * ch + 4, INK3, 'right');
  label(g, 'WING LOADING  kg/m²', px + pw / 2, g.H - 14, INK3, 'center');
  g.save(); g.translate(14, py + ph / 2); g.rotate(-Math.PI / 2);
  label(g, 'WIND SPEED  m/s', 0, 0, INK3, 'center'); g.restore();

  // legend
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
  const g = gChart, r = $('cChart').getBoundingClientRect();
  const scale = g.W / r.width;
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
    syncLabels(); redrawAll(); doDrop();
    document.querySelector('section:nth-of-type(2)').scrollIntoView({ behavior: 'smooth' });
  }
}

/* ============================================================ 04 · DUBINS = */
const gDub = ctx2d($('cDub'));
const DUB = { start: [-26, -12, 0.3], end: [22, 10, 2.2], R: 7, drag: null };

function drawDub() {
  const g = gDub; clear(g);
  const all = dubinsAll(DUB.start, DUB.end, DUB.R);
  const best = dubinsSolve(DUB.start, DUB.end, DUB.R);
  const xs = [DUB.start[0], DUB.end[0]], ys = [DUB.start[1], DUB.end[1]];
  for (const p of Object.values(all))
    for (const q of dubinsSample(p, 1.5)) { xs.push(q[0]); ys.push(q[1]); }
  const m = mapper(g, xs, ys, 52);

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
  // rotation handle
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
  const all = dubinsAll(DUB.start, DUB.end, DUB.R);
  const xs = [DUB.start[0], DUB.end[0]], ys = [DUB.start[1], DUB.end[1]];
  for (const p of Object.values(all))
    for (const q of dubinsSample(p, 1.5)) { xs.push(q[0]); ys.push(q[1]); }
  const m = mapper(g, xs, ys, 52);
  const ah = 22;
  const hx = m.x(DUB.end[0]) + (ah + 16) * Math.cos(DUB.end[2]);
  const hy = m.y(DUB.end[1]) - (ah + 16) * Math.sin(DUB.end[2]);
  if (down) DUB.drag = Math.hypot(x - hx, y - hy) < 22 ? 'spin' : 'move';
  if (!DUB.drag) return;
  if (DUB.drag === 'spin') {
    DUB.end[2] = Math.atan2(-(y - m.y(DUB.end[1])), x - m.x(DUB.end[0]));
  } else {
    const inv = (px, py) => [(px - g.W / 2) / m.s + (Math.min(...xs) + Math.max(...xs)) / 2,
                             -(py - g.H / 2) / m.s + (Math.min(...ys) + Math.max(...ys)) / 2];
    const [wx, wy] = inv(x, y);
    DUB.end[0] = wx; DUB.end[1] = wy;
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
  label(g, `${lim.toFixed(1)}`, pad - 8, Y(lim) + 4, INK3, 'right');
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
function redrawAll() { drawLoad(); drawChart(); drawEkf(); drawScale(); }

const bind = (id, key, parse = parseFloat) => $(id).addEventListener('input', e => {
  S[key] = parse(e.target.value);
  syncLabels(); redrawAll(); doDrop();
});
bind('sWind', 'wind'); bind('sDir', 'dir'); bind('sH', 'height');
bind('sL', 'load'); bind('sB', 'bias');

$('modeSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  S.mode = b.dataset.mode;
  [...$('modeSeg').children].forEach(x => x.setAttribute('aria-pressed', x === b));
  doDrop();
});
$('obsSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  S.straight = b.dataset.straight === '1';
  [...$('obsSeg').children].forEach(x => x.setAttribute('aria-pressed', x === b));
  drawEkf();
});
$('bDrop').addEventListener('click', doDrop);
$('bRace').addEventListener('click', doRace);
$('b50').addEventListener('click', doMany);

$('cChart').addEventListener('mousemove', e => chartPick(e, false));
$('cChart').addEventListener('click', e => chartPick(e, true));

$('cDub').addEventListener('pointerdown', e => { $('cDub').setPointerCapture(e.pointerId); dubPointer(e, true); });
$('cDub').addEventListener('pointermove', e => { if (DUB.drag) dubPointer(e, false); });
window.addEventListener('pointerup', () => { DUB.drag = null; });

fetch('design_grid.json').then(r => r.json()).then(j => { GRID = j; drawChart(); })
  .catch(() => drawChart());

syncLabels();
drawDub();
redrawAll();
doDrop();
