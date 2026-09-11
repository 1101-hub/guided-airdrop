/* ===========================================================================
   draw.js — the drop scene.

   Two views of one flight:
     SCENE   a big side-on picture. Helicopter at altitude, package released,
             canopy opens, it glides down through the wind to a target on the
             ground. This is the one you watch.
     MAP     the same flight from above, where the miss distance is honest in
             both directions.

   Kept separate from app.js so the figures in the paper are drawn by exactly
   the same code as the page (capture.html uses this).
   =========================================================================== */

export const INK = '#141414', INK2 = '#4E4A42', INK3 = '#8C877C';
export const LINE = '#E2DCCB', GHOST = '#B4AD9C';
export const PINK = '#FF2E93', BLUE = '#3B54E8', GRN = '#4FA828', YEL = '#FFD12E';
const SKY = '#EFF3FF', EARTH = '#DFE7C8', EARTH2 = '#BFCE9C';

let FONT_PX = 11;
let MONO = `${FONT_PX}px ui-monospace, Consolas, monospace`;
let MONO_B = `bold ${FONT_PX + 1}px ui-monospace, Consolas, monospace`;
export function setFontScale(k) {
  FONT_PX = 11 * k;
  MONO = `${FONT_PX}px ui-monospace, Consolas, monospace`;
  MONO_B = `bold ${FONT_PX + 1}px ui-monospace, Consolas, monospace`;
}

/* ------------------------------------------------------------ primitives */

export function ctx2d(cv) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = cv.width, h = cv.height;
  cv.width = w * dpr; cv.height = h * dpr;
  cv.style.height = 'auto';
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  g.W = w; g.H = h;
  return g;
}
export const clear = g => g.clearRect(0, 0, g.W, g.H);

export function mapper(g, xs, ys, pad = 46, rect = null) {
  const R = rect || { x: 0, y: 0, w: g.W, h: g.H };
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const s = Math.min((R.w - 2 * pad) / ((x1 - x0) || 1),
                     (R.h - 2 * pad) / ((y1 - y0) || 1));
  return { s, x: v => R.x + R.w / 2 + (v - cx) * s,
              y: v => R.y + R.h / 2 - (v - cy) * s };
}

export function line(g, pts, color, width = 3, dash = null) {
  if (pts.length < 2) return;
  g.save(); g.strokeStyle = color; g.lineWidth = width;
  g.lineJoin = 'round'; g.lineCap = 'round';
  if (dash) g.setLineDash(dash);
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.stroke(); g.restore();
}
export function dot(g, x, y, r, fill, ring = '#fff') {
  g.save(); g.beginPath(); g.arc(x, y, r, 0, 7);
  g.fillStyle = fill; g.fill();
  if (ring) { g.lineWidth = 2; g.strokeStyle = ring; g.stroke(); }
  g.restore();
}
export function cross(g, x, y, r, color) {
  g.save(); g.strokeStyle = color; g.lineWidth = 3.5; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x - r, y - r); g.lineTo(x + r, y + r);
  g.moveTo(x + r, y - r); g.lineTo(x - r, y + r);
  g.stroke(); g.restore();
}
export function label(g, text, x, y, color = INK3, align = 'left', font = null) {
  g.save(); g.fillStyle = color; g.font = font || MONO; g.textAlign = align;
  g.fillText(text, x, y); g.restore();
}
export function arrow(g, x, y, dx, dy, color, width = 3) {
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

/* ----------------------------------------------------------------- props */

export function helicopter(g, x, y, s = 1, color = INK, spin = 0) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.strokeStyle = color; g.fillStyle = color;
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.ellipse(0, 0, 13, 8.5, 0, 0, 7); g.fill();
  g.lineWidth = 4.5;
  g.beginPath(); g.moveTo(9, -2.5); g.lineTo(30, -5.5); g.stroke();
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(29, -5.5); g.lineTo(34.5, -13); g.stroke();
  g.beginPath(); g.moveTo(0, -8.5); g.lineTo(0, -13.5); g.stroke();
  const rw = 21 * Math.max(0.25, Math.abs(Math.cos(spin)));   // rotor blur
  g.lineWidth = 3.4;
  g.beginPath(); g.moveTo(-rw, -13.5); g.lineTo(rw, -13.5); g.stroke();
  g.lineWidth = 2.2;
  g.beginPath(); g.moveTo(-11, 10.5); g.lineTo(12, 10.5); g.stroke();
  g.beginPath();
  g.moveTo(-6, 8); g.lineTo(-7.5, 10.5); g.moveTo(6, 8); g.lineTo(7.5, 10.5);
  g.stroke();
  g.restore();
}

/* Canopy open, supplies swinging underneath. */
export function parafoilSide(g, x, y, s = 1, color = PINK) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.strokeStyle = color; g.fillStyle = color;
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.lineWidth = 5;
  g.beginPath(); g.arc(0, 0, 14, Math.PI * 1.10, Math.PI * 1.90); g.stroke();
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(-12.5, -5.6); g.lineTo(-2.8, 8);
  g.moveTo(12.5, -5.6); g.lineTo(2.8, 8);
  g.stroke();
  g.fillRect(-4.5, 8, 9, 7);
  g.restore();
}

/* From above: a wing across the direction of travel. */
export function parafoilTop(g, x, y, heading, s = 1, color = PINK) {
  g.save(); g.translate(x, y); g.rotate(-heading); g.scale(s, s);
  g.strokeStyle = color; g.fillStyle = color;
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.lineWidth = 8;
  g.beginPath(); g.moveTo(-1, -8.5); g.lineTo(-1, 8.5); g.stroke();
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(-1, 0); g.lineTo(7, 0); g.stroke();
  g.beginPath(); g.moveTo(13, 0); g.lineTo(6, -3.6); g.lineTo(6, 3.6);
  g.closePath(); g.fill();
  g.restore();
}

/* A round canopy: a dome and lines, no wing. It has no airspeed of its own, so
   it goes wherever the air goes. */
export function roundCanopy(g, x, y, s = 1, color = INK3) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.strokeStyle = color; g.fillStyle = color;
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.lineWidth = 4.5;
  g.beginPath(); g.arc(0, 0, 13, Math.PI, 0); g.stroke();
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(-13, 0); g.lineTo(-2.6, 10);
  g.moveTo(13, 0); g.lineTo(2.6, 10);
  g.moveTo(-5, -0.4); g.lineTo(-1.6, 10);
  g.moveTo(5, -0.4); g.lineTo(1.6, 10);
  g.stroke();
  g.fillRect(-4.5, 10, 9, 7);
  g.restore();
}

/* The crate, in the moment after release before the canopy catches. */
export function crate(g, x, y, s = 1, color = INK) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = color; g.fillRect(-5.5, -5, 11, 10);
  g.strokeStyle = '#fff'; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(-5.5, 0); g.lineTo(5.5, 0);
  g.moveTo(0, -5); g.lineTo(0, 5); g.stroke();
  g.restore();
}

/* Where the supplies are supposed to land. */
export function flag(g, x, y, s = 1) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.strokeStyle = INK; g.lineWidth = 2.6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -26); g.stroke();
  g.fillStyle = PINK;
  g.beginPath(); g.moveTo(0, -26); g.lineTo(17, -20.5); g.lineTo(0, -15);
  g.closePath(); g.fill();
  g.restore();
}

/* --------------------------------------------------------------- helpers */

export function pathDistance(track) {
  const out = [0];
  for (let i = 1; i < track.length; i++)
    out.push(out[i - 1] + Math.hypot(track[i][1] - track[i - 1][1],
                                     track[i][2] - track[i - 1][2]));
  return out;
}

const SCENE_RECT = g => ({ x: 0, y: 0, w: g.W, h: Math.round(g.H * 0.635) });
const MAP_RECT = g => ({ x: 0, y: Math.round(g.H * 0.635) + 14,
                         w: g.W, h: g.H - Math.round(g.H * 0.635) - 14 });

export const RELEASE_AT = 0.22;    // share of the animation spent flying in
const APPROACH_M = 46;
const CANOPY_AT = 0.05;            // share of the descent before the canopy opens

/* Draw both views of one flight.
     runs   [{color, res}]  one entry per guidance configuration
     prev   {res}           the previous attempt, as a grey ghost on the map
     frac   0..1            animation progress; >= 1 is the finished state   */
export function drawDrop(g, { runs, prev = null, frac = 1, wind = [0, 0],
                              windSpeed = 0, height = 40, target = [20, 10],
                              extraBounds = [] }) {
  clear(g);
  const SC = SCENE_RECT(g), MP = MAP_RECT(g);
  const flying = frac < RELEASE_AT;
  const pf = flying ? 0 : Math.min(1, (frac - RELEASE_AT) / (1 - RELEASE_AT));

  /* ===================================================== the scene, side on */
  // Look along the release -> target line, so the flag sits at its true
  // distance and the package visibly drifts toward or past it.
  const tLen = Math.hypot(target[0], target[1]) || 1;
  const ux = target[0] / tLen, uy = target[1] / tLen;
  const along = p => p[1] * ux + p[2] * uy;

  const alongs = [0, tLen];
  for (const r of runs) for (const p of r.res.track) alongs.push(along(p));
  // leave room on the left for the helicopter's run-in, but no more than that
  const aMin = Math.min(...alongs, -16), aMax = Math.max(...alongs, tLen) + 6;
  const approachFrom = aMin + 5;

  const padL = 58, padR = 34, padT = 44, gh = 46;   // ground band height
  const X = a => padL + (a - aMin) / ((aMax - aMin) || 1) * (SC.w - padL - padR);
  const Y = z => SC.y + SC.h - gh - z / (height * 1.12) * (SC.h - gh - padT);

  // sky and ground
  g.save();
  const grad = g.createLinearGradient(0, SC.y, 0, SC.y + SC.h - gh);
  grad.addColorStop(0, '#FFFFFF'); grad.addColorStop(1, SKY);
  g.fillStyle = grad; g.fillRect(SC.x, SC.y, SC.w, SC.h - gh);
  g.fillStyle = EARTH; g.fillRect(SC.x, SC.y + SC.h - gh, SC.w, gh);
  g.restore();
  line(g, [[SC.x, SC.y + SC.h - gh], [SC.x + SC.w, SC.y + SC.h - gh]], EARTH2, 3);

  // height gridlines
  g.save(); g.strokeStyle = 'rgba(60,80,140,.10)'; g.lineWidth = 1;
  for (let k = 1; k <= 4; k++) {
    const z = height * k / 4;
    g.beginPath(); g.moveTo(padL, Y(z)); g.lineTo(SC.w - 14, Y(z)); g.stroke();
  }
  g.restore();
  for (let k = 1; k <= 4; k++)
    label(g, `${Math.round(height * k / 4)} m`, padL - 9, Y(height * k / 4) + 4,
      INK3, 'right');

  // wind, as streaks drifting the way the air is going
  const wAlong = wind[0] * ux + wind[1] * uy;
  if (windSpeed > 0.05) {
    const dir = wAlong >= 0 ? 1 : -1;
    const len = 16 + 13 * Math.min(windSpeed / 4, 1);
    g.save(); g.strokeStyle = 'rgba(59,84,232,.30)'; g.lineWidth = 2.4;
    g.lineCap = 'round';
    for (let k = 0; k < 7; k++) {
      const z = height * (0.16 + 0.13 * k);
      const span = SC.w - padL - padR - 40;
      const off = ((frac * 1.7 + k * 0.37) % 1) * span;
      const x0 = padL + 20 + (dir > 0 ? off : span - off);
      g.beginPath(); g.moveTo(x0, Y(z)); g.lineTo(x0 + dir * len, Y(z)); g.stroke();
    }
    g.restore();
    const ax = padL + 40, ay = SC.y + SC.h - gh - 30;   // low left, out of the way
    arrow(g, ax, ay, dir * 34, 0, BLUE, 3);
    label(g, `WIND ${windSpeed.toFixed(1)} m/s`, ax + (dir > 0 ? 42 : -42),
      ay + 4, BLUE, dir > 0 ? 'left' : 'right');
  }

  flag(g, X(tLen), SC.y + SC.h - gh, 1.15);
  label(g, 'TARGET', X(tLen) + 22, SC.y + SC.h - gh - 24, INK, 'left', MONO_B);

  label(g, 'WATCH IT FALL', 16, SC.y + 22, INK3, 'left', MONO_B);

  // the flight
  for (const r of runs) {
    const t = r.res.track;
    const n = flying ? 0 : Math.max(2, Math.floor(t.length * pf));
    if (!flying) {
      line(g, t.slice(0, n).map(p => [X(along(p)), Y(p[3])]), r.color, 3);
      const p = t[n - 1];
      if (pf >= 1) {
        // Only mark WHERE it stopped here. This view is a projection onto the
        // release->target line, so the visible gap is the along-track part
        // only; the exact miss is drawn on the map below, where it is honest.
        dot(g, X(along(p)), Y(0), 6, r.color);
        label(g, 'LANDED', X(along(p)), SC.y + SC.h - gh + 22, r.color,
          'center', MONO_B);
      } else if (pf < CANOPY_AT) {
        crate(g, X(along(p)), Y(p[3]), 1.2);
      } else if (r.kind === 'round') {
        roundCanopy(g, X(along(p)), Y(p[3]) - 10, 1.25, r.color);
      } else {
        parafoilSide(g, X(along(p)), Y(p[3]) - 10, 1.25, r.color);
      }
    }
  }

  // helicopter: runs in, then holds a hover over the release point
  const hAlong = flying ? approachFrom * (1 - frac / RELEASE_AT) : 0;
  helicopter(g, X(hAlong), Y(height), 1.05, INK, frac * 26);
  label(g, flying ? 'COMING IN' : 'RELEASED HERE', X(hAlong), Y(height) - 26,
    INK, 'center');

  /* ======================================================= the map, above */
  g.save(); g.strokeStyle = LINE; g.lineWidth = 2; g.setLineDash([6, 6]);
  g.beginPath(); g.moveTo(16, MP.y - 7); g.lineTo(g.W - 16, MP.y - 7); g.stroke();
  g.restore();

  const xs = [0, target[0]], ys = [0, target[1]];
  for (const r of runs) for (const p of r.res.track) { xs.push(p[1]); ys.push(p[2]); }
  if (prev) for (const p of prev.res.track) { xs.push(p[1]); ys.push(p[2]); }
  for (const [x, y] of extraBounds) { xs.push(x); ys.push(y); }
  const m = mapper(g, xs, ys, 40, MP);

  g.save();
  g.beginPath(); g.rect(MP.x, MP.y, MP.w, MP.h); g.clip();
  g.strokeStyle = '#F0ECE0'; g.lineWidth = 1;
  const lo = Math.floor(Math.min(...xs) / 10) * 10, hi = Math.ceil(Math.max(...xs) / 10) * 10;
  const lo2 = Math.floor(Math.min(...ys) / 10) * 10, hi2 = Math.ceil(Math.max(...ys) / 10) * 10;
  for (let v = lo; v <= hi; v += 10) {
    g.beginPath(); g.moveTo(m.x(v), MP.y); g.lineTo(m.x(v), MP.y + MP.h); g.stroke();
  }
  for (let v = lo2; v <= hi2; v += 10) {
    g.beginPath(); g.moveTo(MP.x, m.y(v)); g.lineTo(MP.x + MP.w, m.y(v)); g.stroke();
  }
  g.restore();

  label(g, 'SAME FLIGHT FROM ABOVE', 16, MP.y + 18, INK3, 'left', MONO_B);

  if (prev) {
    line(g, prev.res.track.map(p => [m.x(p[1]), m.y(p[2])]), GHOST, 2, [6, 5]);
    dot(g, m.x(prev.res.landing[0]), m.y(prev.res.landing[1]), 4.5, GHOST);
    label(g, `last try ${prev.res.miss.toFixed(1)} m`,
      m.x(prev.res.landing[0]) + 9, m.y(prev.res.landing[1]) + 15, GHOST);
  }

  cross(g, m.x(target[0]), m.y(target[1]), 8, INK);
  for (const r of runs) {
    const t = r.res.track;
    const n = flying ? 0 : Math.max(2, Math.floor(t.length * pf));
    if (flying) continue;
    line(g, t.slice(0, n).map(p => [m.x(p[1]), m.y(p[2])]), r.color, 2.4);
    const p = t[n - 1];
    if (pf >= 1) {
      dot(g, m.x(p[1]), m.y(p[2]), 5.5, r.color);
      const lx = m.x(p[1]), ly = m.y(p[2]), tx = m.x(target[0]), ty = m.y(target[1]);
      line(g, [[lx, ly], [tx, ty]], r.color, 2, [4, 4]);
      if (runs.length === 1)
        label(g, `${r.res.miss.toFixed(1)} m out`, (lx + tx) / 2 + 8,
          (ly + ty) / 2 - 7, r.color, 'left', MONO_B);
    } else if (r.kind === 'round') dot(g, m.x(p[1]), m.y(p[2]), 5, r.color);
    else parafoilTop(g, m.x(p[1]), m.y(p[2]), p[4], 1, r.color);
  }
  dot(g, m.x(0), m.y(0), 4, INK, null);
  label(g, 'DROPPED', m.x(0), m.y(0) + 18, INK3, 'center');

  const barM = 20, px0 = g.W - 34 - barM * m.s, py0 = MP.y + MP.h - 12;
  line(g, [[px0, py0], [px0 + barM * m.s, py0]], INK3, 2.5);
  label(g, `${barM} m`, px0 + barM * m.s / 2, py0 - 7, INK3, 'center');
}
