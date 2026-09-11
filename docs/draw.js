/* ===========================================================================
   draw.js — the drop picture: helicopter, parafoil, trajectory, two panels.

   Kept separate from app.js so the figures printed in the paper are rendered
   by exactly the same code the judges see on screen (capture.html uses this).
   =========================================================================== */

export const INK = '#141414', INK2 = '#4E4A42', INK3 = '#8C877C';
export const LINE = '#E2DCCB', GHOST = '#B4AD9C';
export const PINK = '#FF2E93', BLUE = '#3B54E8', GRN = '#4FA828', YEL = '#FFD12E';
/* Labels are sized for the screen. Print figures are placed at about a third
   of the canvas width, so capture.html scales them up to stay legible. */
let FONT_PX = 11;
let MONO = `${FONT_PX}px ui-monospace, Consolas, monospace`;
export function setFontScale(k) {
  FONT_PX = 11 * k;
  MONO = `${FONT_PX}px ui-monospace, Consolas, monospace`;
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

/* ----------------------------------------------------------------- icons */

/* Flies in, drops the package, carries on. Faces +x unless flipped. */
export function helicopter(g, x, y, s = 1, color = INK, spin = 0) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.strokeStyle = color; g.fillStyle = color;
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.ellipse(0, 0, 13, 8.5, 0, 0, 7); g.fill();          // cabin
  g.lineWidth = 4.5;
  g.beginPath(); g.moveTo(9, -2.5); g.lineTo(30, -5.5); g.stroke();    // boom
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(29, -5.5); g.lineTo(34.5, -13); g.stroke();  // fin
  g.beginPath(); g.moveTo(0, -8.5); g.lineTo(0, -13.5); g.stroke();    // mast
  // rotor: squashed by the spin phase so it reads as turning
  const rw = 21 * Math.max(0.25, Math.abs(Math.cos(spin)));
  g.lineWidth = 3.4;
  g.beginPath(); g.moveTo(-rw, -13.5); g.lineTo(rw, -13.5); g.stroke();
  g.lineWidth = 2.2;
  g.beginPath(); g.moveTo(-11, 10.5); g.lineTo(12, 10.5); g.stroke();  // skid
  g.beginPath();
  g.moveTo(-6, 8); g.lineTo(-7.5, 10.5); g.moveTo(6, 8); g.lineTo(7.5, 10.5);
  g.stroke();
  g.restore();
}

/* Side on: canopy, lines, box of supplies. */
export function parafoilSide(g, x, y, s = 1, color = PINK) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.strokeStyle = color; g.fillStyle = color;
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.lineWidth = 4.5;
  g.beginPath(); g.arc(0, 0, 13, Math.PI * 1.13, Math.PI * 1.87); g.stroke();
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(-11.4, -5.2); g.lineTo(-2.5, 7.5);
  g.moveTo(11.4, -5.2); g.lineTo(2.5, 7.5);
  g.stroke();
  g.fillRect(-4, 7.5, 8, 6.5);
  g.restore();
}

/* From above: a wing across the direction of travel, nose forward. */
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

/* A falling supply box, for the moment between release and canopy opening. */
export function box(g, x, y, s = 1, color = INK) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = color; g.fillRect(-4.5, -4, 9, 8);
  g.strokeStyle = '#fff'; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(-4.5, 0); g.lineTo(4.5, 0); g.stroke();
  g.restore();
}

export function ground(g, x0, x1, y) {
  line(g, [[x0, y], [x1, y]], INK, 3);
  g.save(); g.strokeStyle = '#C9C2AF'; g.lineWidth = 2; g.lineCap = 'round';
  for (let x = x0; x < x1; x += 11) {
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - 7, y + 9); g.stroke();
  }
  g.restore();
}

/* ------------------------------------------------------------- the scene */

export function pathDistance(track) {
  const out = [0];
  for (let i = 1; i < track.length; i++)
    out.push(out[i - 1] + Math.hypot(track[i][1] - track[i - 1][1],
                                     track[i][2] - track[i - 1][2]));
  return out;
}

const TOP_RECT = g => ({ x: 0, y: 30, w: g.W, h: 462 });
const SIDE_RECT = g => ({ x: 0, y: 536, w: g.W, h: 276 });

export const RELEASE_AT = 0.20;   // fraction of the animation spent flying in
const APPROACH_M = 46;            // how far back the helicopter starts

/* Draw the whole picture.
     runs   [{color, res}]   one entry per guidance configuration
     prev   {res, miss}      the previous attempt, drawn as a grey ghost
     frac   0..1             animation progress; >=1 is the finished state   */
export function drawDrop(g, { runs, prev = null, frac = 1, wind = [0, 0],
                              windSpeed = 0, height = 40, target = [20, 10],
                              extraBounds = [] }) {
  clear(g);
  const TOP = TOP_RECT(g), SIDE = SIDE_RECT(g);

  const flying = frac < RELEASE_AT;                       // still on approach
  const pf = flying ? 0 : Math.min(1, (frac - RELEASE_AT) / (1 - RELEASE_AT));
  // runs in from the west and holds a hover over the release point
  const hx = flying ? -APPROACH_M * (1 - frac / RELEASE_AT) : 0;

  /* ------------------------------------------- panel 1: looking straight down */
  const xs = [0, target[0], -APPROACH_M], ys = [0, target[1]];
  for (const r of runs) for (const p of r.res.track) { xs.push(p[1]); ys.push(p[2]); }
  if (prev) for (const p of prev.res.track) { xs.push(p[1]); ys.push(p[2]); }
  for (const [x, y] of extraBounds) { xs.push(x); ys.push(y); }
  const m = mapper(g, xs, ys, 52, TOP);

  g.save();
  g.beginPath(); g.rect(TOP.x, TOP.y, TOP.w, TOP.h); g.clip();
  g.strokeStyle = '#F0ECE0'; g.lineWidth = 1;
  const lo = Math.floor(Math.min(...xs) / 10) * 10, hi = Math.ceil(Math.max(...xs) / 10) * 10;
  const lo2 = Math.floor(Math.min(...ys) / 10) * 10, hi2 = Math.ceil(Math.max(...ys) / 10) * 10;
  for (let v = lo; v <= hi; v += 10) {
    g.beginPath(); g.moveTo(m.x(v), TOP.y); g.lineTo(m.x(v), TOP.y + TOP.h); g.stroke();
  }
  for (let v = lo2; v <= hi2; v += 10) {
    g.beginPath(); g.moveTo(0, m.y(v)); g.lineTo(g.W, m.y(v)); g.stroke();
  }
  g.restore();

  label(g, 'LOOKING STRAIGHT DOWN  ·  where it goes', 16, 20, INK3);

  if (windSpeed > 0.05) {
    const px = 92, py = TOP.y + 34, sc = 27;
    arrow(g, px, py, wind[0] / windSpeed * sc, -wind[1] / windSpeed * sc, INK3, 3);
    label(g, `wind ${windSpeed.toFixed(1)} m/s`, px - 34, py + 32, INK3);
  }

  // the attempt before this one, so improvement is visible
  if (prev) {
    line(g, prev.res.track.map(p => [m.x(p[1]), m.y(p[2])]), GHOST, 2, [6, 5]);
    dot(g, m.x(prev.res.landing[0]), m.y(prev.res.landing[1]), 5, GHOST);
    label(g, `last try  ${prev.res.miss.toFixed(1)} m`,
      m.x(prev.res.landing[0]) + 10, m.y(prev.res.landing[1]) + 16, GHOST);
  }

  cross(g, m.x(target[0]), m.y(target[1]), 9, INK);
  label(g, 'TARGET', m.x(target[0]) + 6 + FONT_PX * 0.75, m.y(target[1]) + 4, INK);

  if (!flying) {
    for (const r of runs) {
      const t = r.res.track, n = Math.max(2, Math.floor(t.length * pf));
      if (pf < 1) line(g, t.map(p => [m.x(p[1]), m.y(p[2])]), r.color + '2E', 2.4);
      line(g, t.slice(0, n).map(p => [m.x(p[1]), m.y(p[2])]), r.color, 2.8);
      if (pf >= 1) dot(g, m.x(r.res.landing[0]), m.y(r.res.landing[1]), 6, r.color);
      else {
        const p = t[n - 1];
        parafoilTop(g, m.x(p[1]), m.y(p[2]), p[4], 1.15, r.color);
      }
    }
  }

  if (!flying) dot(g, m.x(0), m.y(0), 4, INK, null);
  helicopter(g, m.x(hx), m.y(0), 1.0, INK, frac * 26);
  label(g, flying ? 'COMING IN TO DROP' : 'DROPPED HERE',
    m.x(hx) - (flying ? 24 : 18), m.y(0) + 32, INK);

  const barM = 20, px0 = g.W - 42 - barM * m.s, py0 = TOP.y + TOP.h - 12;
  line(g, [[px0, py0], [px0 + barM * m.s, py0]], INK3, 2.5);
  label(g, `${barM} m`, px0 + barM * m.s / 2, py0 - 8, INK3, 'center');

  /* --------------------------------------------- panel 2: from the side */
  g.save(); g.strokeStyle = LINE; g.lineWidth = 2; g.setLineDash([6, 6]);
  g.beginPath(); g.moveTo(20, SIDE.y - 16); g.lineTo(g.W - 20, SIDE.y - 16); g.stroke();
  g.restore();
  label(g, 'FROM THE SIDE  ·  it glides forward while it comes down',
    16, SIDE.y - 26, INK3);

  const pad = 52, gy = SIDE.y + SIDE.h - 40;
  const maxD = Math.max(...runs.map(r => {
    const d = pathDistance(r.res.track); return d[d.length - 1];
  }), 1);
  const X = d => pad + d / maxD * (g.W - pad - 54);
  const Y = z => gy - z / Math.max(height, 1) * (SIDE.h - 84);

  g.save(); g.strokeStyle = '#F0ECE0'; g.lineWidth = 1;
  for (let k = 1; k <= 4; k++) {
    const z = height * k / 4;
    g.beginPath(); g.moveTo(pad, Y(z)); g.lineTo(g.W - 30, Y(z)); g.stroke();
  }
  g.restore();
  for (let k = 1; k <= 4; k++)
    label(g, `${Math.round(height * k / 4)}`, pad - 10, Y(height * k / 4) + 4, INK3, 'right');

  ground(g, pad - 22, g.W - 24, gy);
  label(g, '0', pad - 10, gy + 4, INK3, 'right');
  label(g, 'HEIGHT  m', pad + 100, Y(height) - 16, INK3, 'left');
  label(g, 'DISTANCE FLOWN THROUGH THE AIR  m', g.W / 2, SIDE.y + SIDE.h - 6,
    INK3, 'center');
  label(g, `${Math.round(maxD)} m`, X(maxD), gy - 8, INK3, 'right');

  if (!flying) {
    for (const r of runs) {
      const t = r.res.track, d = pathDistance(t);
      const n = Math.max(2, Math.floor(t.length * pf));
      if (pf < 1) line(g, t.map((p, i) => [X(d[i]), Y(p[3])]), r.color + '2E', 2.4);
      line(g, t.slice(0, n).map((p, i) => [X(d[i]), Y(p[3])]), r.color, 2.8);
      if (pf >= 1) dot(g, X(d[d.length - 1]), Y(0), 5.5, r.color);
      else if (pf < 0.06) box(g, X(d[n - 1]), Y(t[n - 1][3]) - 4, 1.2);  // just let go
      else parafoilSide(g, X(d[n - 1]), Y(t[n - 1][3]) - 9, 1.15, r.color);
    }
  }

  // helicopter runs in along the release height, then holds at the left edge
  const shx = pad + (flying ? (frac / RELEASE_AT - 1) * 46 : 0);
  helicopter(g, shx, Y(height) - 11, 0.95, INK, frac * 26);
}
