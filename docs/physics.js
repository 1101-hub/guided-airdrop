/* ===========================================================================
   physics.js — the project's model, ported line-for-line from the Python in
   ../model/ so this page and the paper cannot disagree.

     parafoil.py  -> glideState, turnRadius, canPenetrate
     dubins.py    -> dubinsSolve, dubinsSample   (all six closed forms)
     guidance.py  -> WeaveGuidance               (cos(alpha) = d / budget)
     ekf.py       -> WindEKF                     (state [wx, wy, va, b])
     sim.py       -> simulate                    (receding horizon)

   verify.js checks this port against the Python to ~1e-12.
   =========================================================================== */

export const RHO = 1.225;   // air density, kg/m^3
export const G = 9.81;

/* --------------------------------------------------------------- parafoil */

export function airspeed(mass, area, cl) {
  return Math.sqrt(2 * mass * G / (RHO * area * cl));
}

/* Steady glide. Only mass/area — the WING LOADING — actually matters. */
export function glideState(mass, area, cl, cd) {
  const E = cl / cd;
  const gamma = Math.atan2(1, E);            // glide path angle below horizontal
  const V = airspeed(mass, area, cl) * Math.sqrt(Math.cos(gamma));
  return { E, vh: V * Math.cos(gamma), vz: V * Math.sin(gamma) };
}

/* Coordinated turn: R = v^2 / (g tan phi). */
export function turnRadius(vh, bankDeg = 20) {
  return vh * vh / (G * Math.tan(bankDeg * Math.PI / 180));
}

/* The hard wall. If wind > airspeed, no guidance law can help. */
export function canPenetrate(vh, windSpeed) { return vh > windSpeed; }

/* Smallest wing loading that still flies in wind W  ->  proportional to W^2. */
export function minLoading(windSpeed, cl = 0.80, cd = 0.27) {
  let lo = 0.01, hi = 20.0;
  for (let i = 0; i < 80; i++) {
    const m = 0.5 * (lo + hi);
    if (glideState(m, 1.0, cl, cd).vh < windSpeed) lo = m; else hi = m;
  }
  return 0.5 * (lo + hi);
}

/* ----------------------------------------------------------------- dubins */

const TAU = 2 * Math.PI;
const mod2pi = x => x - TAU * Math.floor(x / TAU);
export const DUBINS_TYPES = ['LSL', 'LSR', 'RSL', 'RSR', 'RLR', 'LRL'];

function _lsl(a, b, d) {
  const tmp = Math.atan2(Math.cos(b) - Math.cos(a), d + Math.sin(a) - Math.sin(b));
  const p2 = 2 + d * d - 2 * Math.cos(a - b) + 2 * d * (Math.sin(a) - Math.sin(b));
  if (p2 < 0) return null;
  return [mod2pi(-a + tmp), Math.sqrt(p2), mod2pi(b - tmp)];
}
function _rsr(a, b, d) {
  const tmp = Math.atan2(Math.cos(a) - Math.cos(b), d - Math.sin(a) + Math.sin(b));
  const p2 = 2 + d * d - 2 * Math.cos(a - b) + 2 * d * (Math.sin(b) - Math.sin(a));
  if (p2 < 0) return null;
  return [mod2pi(a - tmp), Math.sqrt(p2), mod2pi(-b + tmp)];
}
function _lsr(a, b, d) {
  const p2 = -2 + d * d + 2 * Math.cos(a - b) + 2 * d * (Math.sin(a) + Math.sin(b));
  if (p2 < 0) return null;
  const p = Math.sqrt(p2);
  const tmp = Math.atan2(-Math.cos(a) - Math.cos(b), d + Math.sin(a) + Math.sin(b))
            - Math.atan2(-2.0, p);
  return [mod2pi(-a + tmp), p, mod2pi(-mod2pi(b) + tmp)];
}
function _rsl(a, b, d) {
  const p2 = d * d - 2 + 2 * Math.cos(a - b) - 2 * d * (Math.sin(a) + Math.sin(b));
  if (p2 < 0) return null;
  const p = Math.sqrt(p2);
  const tmp = Math.atan2(Math.cos(a) + Math.cos(b), d - Math.sin(a) - Math.sin(b))
            - Math.atan2(2.0, p);
  return [mod2pi(a - tmp), p, mod2pi(b - tmp)];
}
function _rlr(a, b, d) {
  const tmp = (6.0 - d * d + 2 * Math.cos(a - b) + 2 * d * (Math.sin(a) - Math.sin(b))) / 8.0;
  if (Math.abs(tmp) > 1.0) return null;
  const p = mod2pi(TAU - Math.acos(tmp));
  const t = mod2pi(a - Math.atan2(Math.cos(a) - Math.cos(b),
                                  d - Math.sin(a) + Math.sin(b)) + p / 2.0);
  return [t, p, mod2pi(a - b - t + p)];
}
function _lrl(a, b, d) {
  const tmp = (6.0 - d * d + 2 * Math.cos(a - b) + 2 * d * (Math.sin(b) - Math.sin(a))) / 8.0;
  if (Math.abs(tmp) > 1.0) return null;
  const p = mod2pi(TAU - Math.acos(tmp));
  const t = mod2pi(-a + Math.atan2(-Math.cos(a) + Math.cos(b),
                                   d + Math.sin(a) - Math.sin(b)) + p / 2.0);
  // The final arc closes the remaining heading change, so t is subtracted.
  // An earlier version wrote "+ 2*p" and dropped the "- t"; the endpoint
  // self-check caught it as a 15 m miss.
  return [t, p, mod2pi(mod2pi(b) - a - t + mod2pi(p))];
}
const SOLVERS = { LSL: _lsl, LSR: _lsr, RSL: _rsl, RSR: _rsr, RLR: _rlr, LRL: _lrl };

/* All six, keep the shortest that exists. */
export function dubinsSolve(start, end, R, only) {
  const [x0, y0, th0] = start, [x1, y1, th1] = end;
  const dx = x1 - x0, dy = y1 - y0;
  const d = Math.hypot(dx, dy) / R;          // normalise: everything in units of R
  const phi = Math.atan2(dy, dx);
  const a = mod2pi(th0 - phi), b = mod2pi(th1 - phi);

  let best = null;
  for (const name of (only || DUBINS_TYPES)) {
    const out = SOLVERS[name](a, b, d);
    if (!out) continue;
    const [t, p, q] = out;
    const length = (t + p + q) * R;
    if (!best || length < best.length) {
      best = { type: name, t: t * R, p: p * R, q: q * R, length, R, start, end };
    }
  }
  return best;
}

/* Every type that exists here, with its length — for the six-shapes figure. */
export function dubinsAll(start, end, R) {
  const out = {};
  for (const name of DUBINS_TYPES) {
    const p = dubinsSolve(start, end, R, [name]);
    if (p) out[name] = p;
  }
  return out;
}

export function dubinsSample(path, step = 0.5) {
  if (!path) return [];
  const R = path.R, modes = { L: +1, S: 0, R: -1 };
  const segs = [[path.type[0], path.t], [path.type[1], path.p], [path.type[2], path.q]];
  let [x, y, th] = path.start;
  const pts = [[x, y, th]];
  for (const [kind, segLen] of segs) {
    const turn = modes[kind];
    const n = Math.max(Math.ceil(segLen / step), 1), ds = segLen / n;
    for (let i = 0; i < n; i++) {
      if (turn === 0) { x += ds * Math.cos(th); y += ds * Math.sin(th); }
      else {
        const dth = turn * ds / R;
        const cx = x - turn * R * Math.sin(th), cy = y + turn * R * Math.cos(th);
        const thN = th + dth;
        x = cx + turn * R * Math.sin(thN);
        y = cy - turn * R * Math.cos(thN);
        th = mod2pi(thN);
      }
      pts.push([x, y, th]);
    }
  }
  return pts;
}

/* --------------------------------------------------------------- guidance */

const wrap = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;

/* Shift the target upwind by wind*t and the drift delivers the package. */
export function airFrameTarget(target, wind, t) {
  return [target[0] - wind[0] * t, target[1] - wind[1] * t];
}

export class WeaveGuidance {
  constructor(params, alphaMaxDeg = 70) {
    this.p = params;
    this.alphaMax = alphaMaxDeg * Math.PI / 180;
    this.side = 1.0;
  }
  command(state, target, wind, height) {
    const { vh, vz, R } = this.p;
    const [x, y, th] = state;
    const t = height / vz;
    const budget = vh * t;                       // path length still available
    const tgt = airFrameTarget(target, wind, t);

    const dx = tgt[0] - x, dy = tgt[1] - y;
    const d = Math.hypot(dx, dy);
    const bearing = Math.atan2(dy, dx);
    if (budget <= 1e-9) return { turn: 0, alpha: 0, d, budget, mode: 'down' };

    // Charge the alignment turn to the budget: use the DUBINS length, not the
    // straight line. Ignoring it made the vehicle think it had spare height.
    const turnPath = dubinsSolve([x, y, th], [tgt[0], tgt[1], bearing], R);
    const dEff = turnPath ? turnPath.length : d;
    const ratio = dEff / budget;

    let alpha, desired, mode;
    if (ratio < Math.cos(this.alphaMax)) {
      // ORBIT — too high even for the steepest weave. Make zero net progress.
      const radialErr = Math.max(-1, Math.min(1, (d - R) / Math.max(R, 1e-6)));
      desired = bearing + this.side * (Math.PI / 2 - radialErr * Math.PI / 2);
      alpha = this.alphaMax;
      mode = 'orbit';
    } else {
      // WEAVE — cos(alpha) = d / budget. Straightens out on its own.
      alpha = Math.acos(Math.max(-1, Math.min(1, ratio)));
      const err = wrap(th - bearing);
      if (this.side > 0 && err > alpha) this.side = -1;
      else if (this.side < 0 && err < -alpha) this.side = 1;
      desired = bearing + this.side * alpha;
      mode = alpha > 0.05 ? 'weave' : 'approach';
    }
    return { turn: Math.sign(wrap(desired - th)), alpha, d, budget, mode };
  }
}

/* -------------------------------------------------------------------- EKF */

const mul = (A, B) => A.map(r => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
const T = A => A[0].map((_, j) => A.map(r => r[j]));
const add = (A, B) => A.map((r, i) => r.map((v, j) => v + B[i][j]));
const sub = (A, B) => A.map((r, i) => r.map((v, j) => v - B[i][j]));
const inv2 = M => {
  const det = M[0][0] * M[1][1] - M[0][1] * M[1][0];
  return [[M[1][1] / det, -M[0][1] / det], [-M[1][0] / det, M[0][0] / det]];
};
const eye = n => Array.from({ length: n }, (_, i) =>
  Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

/* State x = [wx, wy, va, b]. Measurement: GNSS ground velocity.
   Nonlinear in b (it sits inside the heading trigonometry) -> EKF. */
export class WindEKF {
  constructor(va0, { pWind = 4.0, pVa = 0.5, pBias = 0.3,
                     qWind = 0.02, qVa = 1e-4, qBias = 1e-6, rGps = 0.25 } = {}) {
    this.x = [0, 0, va0, 0];
    const d = (a, b, c, e) => [[a * a, 0, 0, 0], [0, b * b, 0, 0],
                               [0, 0, c * c, 0], [0, 0, 0, e * e]];
    this.P = d(pWind, pWind, pVa, pBias);
    this.Q = d(qWind, qWind, qVa, qBias);
    this.R = [[rGps * rGps, 0], [0, rGps * rGps]];
    this.n = 0;
  }
  predict(dt) { this.P = this.P.map((r, i) => r.map((v, j) => v + this.Q[i][j] * dt)); }
  update(headingMeas, vGroundMeas, dt = 0.1) {
    this.predict(dt);
    const [wx, wy, va, b] = this.x;
    const th = headingMeas + b, c = Math.cos(th), s = Math.sin(th);
    const h = [va * c + wx, va * s + wy];                 // predicted ground velocity
    const H = [[1, 0, c, -va * s], [0, 1, s, va * c]];    // Jacobian dh/dx
    const y = [vGroundMeas[0] - h[0], vGroundMeas[1] - h[1]];
    const S = add(mul(mul(H, this.P), T(H)), this.R);
    const K = mul(mul(this.P, T(H)), inv2(S));
    this.x = this.x.map((v, i) => v + K[i][0] * y[0] + K[i][1] * y[1]);
    const IKH = sub(eye(4), mul(K, H));
    this.P = add(mul(mul(IKH, this.P), T(IKH)), mul(mul(K, this.R), T(K)));
    this.x[2] = Math.max(0.5, Math.min(30, this.x[2]));   // keep airspeed physical
    this.n++;
  }
  estimate() { return [this.x[0], this.x[1]]; }
  get airspeed() { return this.x[2]; }
  get bias() { return this.x[3]; }
}

/* ------------------------------------------------------------------- sim  */

/* Seeded RNG so a given set of sliders always gives the same drop. */
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  const u = () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  return {
    u,
    normal(mu = 0, sd = 1) {          // Box-Muller
      const r = Math.sqrt(-2 * Math.log(1 - u())), th = TAU * u();
      return mu + sd * r * Math.cos(th);
    },
    uniform: (lo, hi) => lo + (hi - lo) * u(),
  };
}

/* One descent. mode: 'none' | 'ekf' | 'true'.
   The guidance NEVER sees windTrue unless mode === 'true'. */
export function simulate({
  target = [20, 10], windTrue = [0, 0], params, height0 = 40,
  state0 = [0, 0, 0], mode = 'ekf', dt = 0.05,
  gpsNoise = 0.25, headingNoiseDeg = 3.0, headingBiasDeg = 0.0,
  seed = 0, straightOnly = false,
} = {}) {
  const { vh, vz, R } = params;
  const omega = vh / R;                       // max turn rate, rad/s
  let [x, y, th] = state0, z = height0, t = 0;

  const ctrl = new WeaveGuidance(params);
  const r = rng(seed);
  const hBias = headingBiasDeg * Math.PI / 180;
  const hNoise = headingNoiseDeg * Math.PI / 180;
  const ekf = mode === 'ekf' ? new WindEKF(vh) : null;

  const track = [], windHist = [];
  let guard = 0;
  while (z > 0 && guard++ < 40000) {
    const thMeas = th + hBias + r.normal(0, hNoise);
    let wGuess, thCtrl;
    if (ekf) { wGuess = ekf.estimate(); thCtrl = thMeas - ekf.bias; }
    else if (mode === 'true') { wGuess = windTrue; thCtrl = thMeas; }
    else { wGuess = [0, 0]; thCtrl = thMeas; }

    const cmd = ctrl.command([x, y, thCtrl], target, wGuess, z);

    th += (straightOnly ? 0 : cmd.turn) * omega * dt;
    const vAir = [vh * Math.cos(th), vh * Math.sin(th)];
    const vGround = [vAir[0] + windTrue[0], vAir[1] + windTrue[1]];

    if (ekf) {
      const vg = [vGround[0] + r.normal(0, gpsNoise), vGround[1] + r.normal(0, gpsNoise)];
      ekf.update(thMeas, vg, dt);
      windHist.push([t, ekf.x[0], ekf.x[1], ekf.x[3]]);
    }
    x += vGround[0] * dt; y += vGround[1] * dt; z -= vz * dt; t += dt;
    track.push([t, x, y, Math.max(z, 0), th, cmd.mode]);
  }
  const miss = Math.hypot(x - target[0], y - target[1]);
  return {
    track, windHist, miss, landing: [x, y], tTotal: t,
    windErr: ekf ? Math.hypot(ekf.x[0] - windTrue[0], ekf.x[1] - windTrue[1]) : null,
    biasEst: ekf ? ekf.bias : null,
  };
}

export const median = a => {
  const s = [...a].sort((p, q) => p - q), n = s.length;
  return n % 2 ? s[(n - 1) / 2] : 0.5 * (s[n / 2 - 1] + s[n / 2]);
};
