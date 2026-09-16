/* ===========================================================================
   models.js — the things that appear in the room. Everything is built in code;
   there are no asset files to fail to load in a hall with bad wifi.

   The look follows the site: cream paper, heavy ink outlines, flat colour.
   Outlines are done the cheap way — a slightly larger copy of the mesh drawn
   back-faces-only behind the real one — which suits these convex shapes and
   costs nothing.
   =========================================================================== */
import * as THREE from './vendor/three.module.min.js';

export const C = {
  paper: 0xF7F3E6, ink: 0x141414, ink2: 0x4E4A42, ink3: 0x8C877C, line: 0xE2DCCB,
  blue: 0x3B54E8, pink: 0xFF2E93, green: 0x79D64B, grn: 0x4FA828, yellow: 0xFFD12E,
  wood: 0xC9A227, water: 0x4F86C6,
};
const CSS = {
  paper: '#F7F3E6', ink: '#141414', ink2: '#4E4A42', ink3: '#8C877C', line: '#E2DCCB',
  blue: '#3B54E8', pink: '#FF2E93', grn: '#4FA828', yellow: '#FFD12E',
};
const MONO = 'ui-monospace,"Cascadia Mono",Consolas,monospace';
const SANS = '"Segoe UI",Inter,system-ui,-apple-system,Roboto,sans-serif';

/* --------------------------------------------------------------- outlining */
export function outlined(mesh, { color = C.ink, width = 0.045 } = {}) {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(
    mesh.geometry,
    new THREE.MeshBasicMaterial({ color, side: THREE.BackSide }),
  );
  // Scale the shell by a constant *thickness*, not a constant ratio, so small
  // parts do not end up with hairlines and big parts with slabs.
  mesh.geometry.computeBoundingSphere();
  const r = mesh.geometry.boundingSphere.radius || 1;
  shell.scale.setScalar(1 + width / r);
  g.add(shell, mesh);
  return g;
}

/* ------------------------------------------------------------------ crate */
export function crate(size = 0.42) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(size, size * 0.78, size * 0.86),
    new THREE.MeshLambertMaterial({ color: C.wood }),
  );
  g.add(outlined(body, { width: 0.02 }));

  // two straps, so the crate reads as cargo rather than a plain cube
  const strapMat = new THREE.MeshLambertMaterial({ color: C.ink });
  for (const dx of [-size * 0.22, size * 0.22]) {
    const s = new THREE.Mesh(
      new THREE.BoxGeometry(size * 0.1, size * 0.8, size * 0.88), strapMat);
    s.position.x = dx;
    g.add(s);
  }
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(size * 1.02, size * 0.1, size * 0.88), strapMat);
  g.add(band);
  return g;
}

/* ------------------------------------------------- shadow cast on the floor */
export function contactShadow(radius = 0.5) {
  const n = 64, c = document.createElement('canvas');
  c.width = c.height = n;
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  grd.addColorStop(0, 'rgba(0,0,0,.45)');
  grd.addColorStop(0.55, 'rgba(0,0,0,.20)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = grd; x.fillRect(0, 0, n, n);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.002;
  return m;
}

/* --------------------------------------------------------- target on floor */
export function targetRing(radius = 0.5, color = C.pink) {
  const g = new THREE.Group();
  for (const [r0, r1, op] of [[radius * 0.94, radius, 1], [radius * 0.5, radius * 0.56, .8]]) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r0, r1, 64),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide,
                                    transparent: true, opacity: op }),
    );
    ring.rotation.x = -Math.PI / 2;
    g.add(ring);
  }
  // cross-hairs, so the exact centre is unambiguous
  const bar = new THREE.MeshBasicMaterial({ color });
  for (const rot of [0, Math.PI / 2]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2.1, radius * 0.035), bar);
    m.rotation.x = -Math.PI / 2; m.rotation.z = rot;
    g.add(m);
  }
  g.position.y = 0.004;
  return g;
}

/* ------------------------------------------------------------ floor grid */
export function floorGrid(size = 8, step = 0.5) {
  const grid = new THREE.GridHelper(size, size / step, C.ink3, C.ink3);
  grid.material.transparent = true;
  grid.material.opacity = 0.28;
  grid.material.depthWrite = false;
  return grid;
}

/* --------------------------------------------------------------- text card
   A Kivicube-style floating label: cream card, ink border, mono caption above
   a bold value. Drawn to a canvas and shown on a Sprite so it always faces the
   viewer, whatever they do with the phone. */
export function card(title, value, { accent = CSS.blue, height = 0.22, pad = 26 } = {}) {
  const S = 3;                                   // supersample for crisp text
  const c = document.createElement('canvas');
  const x = c.getContext('2d');

  const tFont = `800 ${22 * S}px ${MONO}`;
  const vFont = `800 ${46 * S}px ${SANS}`;
  x.font = tFont; const tw = x.measureText(title).width;
  x.font = vFont; const vw = value ? x.measureText(value).width : 0;

  const w = Math.max(tw, vw) + pad * 2 * S;
  const h = (value ? 104 : 56) * S;
  c.width = Math.ceil(w); c.height = Math.ceil(h);

  const r = 18 * S, bw = 5 * S;
  x.fillStyle = CSS.paper;
  x.strokeStyle = CSS.ink;
  x.lineWidth = bw;
  x.beginPath();
  x.roundRect(bw / 2, bw / 2, c.width - bw, c.height - bw, r);
  x.fill(); x.stroke();

  // accent stripe down the left edge, the way the site tags its sections
  x.save();
  x.beginPath();
  x.roundRect(bw / 2, bw / 2, c.width - bw, c.height - bw, r);
  x.clip();
  x.fillStyle = accent;
  x.fillRect(0, 0, 10 * S, c.height);
  x.restore();

  x.textBaseline = 'middle';
  x.fillStyle = CSS.ink3;
  x.font = tFont;
  x.fillText(title, pad * S, (value ? 30 : 28) * S);
  if (value) {
    x.fillStyle = CSS.ink;
    x.font = vFont;
    x.fillText(value, pad * S, 72 * S);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthTest: false, depthWrite: false,
  }));
  spr.renderOrder = 10;
  spr.scale.set(height * (c.width / c.height), height, 1);
  spr.userData.setText = null;
  return spr;
}

/* ------------------------------------------------- vertical height ruler
   The whole point of the ruler: the drop is compressed to fit a room, so the
   compression has to be visible rather than hidden. Ticks are labelled in
   REAL metres while the geometry is in room metres. */
export function heightRuler(realHeight, scale, { every = 10, color = C.ink } = {}) {
  const g = new THREE.Group();
  const top = realHeight * scale;

  const line = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.009, top, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }),
  );
  line.position.y = top / 2;
  g.add(line);

  for (let m = every; m <= realHeight + 0.001; m += every) {
    const y = m * scale;
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.014, 0.014),
      new THREE.MeshBasicMaterial({ color }),
    );
    tick.position.set(0.065, y, 0);
    g.add(tick);
    // Read at arm's length on a phone, so it has to be a good deal larger
    // than it looks reasonable at desk distance.
    const lab = card(`${m} M`, null, { height: 0.135, pad: 20 });
    lab.position.set(0.135 + lab.scale.x / 2, y, 0);
    g.add(lab);
  }

  // State the compression outright rather than letting the ticks imply it.
  // "40 m -> 3 m" lands faster than a centimetres-per-metre ratio does.
  const trim = v => v.toFixed(1).replace(/\.0$/, '');
  const cap = card('SCALE', `${trim(realHeight)} m → ${trim(top)} m`,
                   { accent: CSS.ink3, height: 0.17 });
  cap.position.set(0.135 + cap.scale.x / 2, top + 0.16, 0);
  g.add(cap);
  return g;
}

/* ------------------------------------------------------------ path ribbon */
export function pathLine(points, color = C.blue, width = 0.012) {
  // TubeGeometry rather than Line: GPU line width is 1px on almost every
  // platform, which vanishes on a phone screen.
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, Math.min(points.length * 2, 900), width, 6, false);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
  mesh.userData.curve = curve;
  return mesh;
}

/* ------------------------------------------------------- ghost of a path
   Used in the second scene to hold the first scene's failed route beside the
   new one, so the two are compared rather than merely both seen.

   The dashes are a repeating alpha texture along the tube's length rather than
   a chain of separate meshes: TubeGeometry lays u out along the curve, so one
   texture with one draw call gives an arbitrary number of dashes. */
export function dashedPathLine(points, color = C.pink, {
  width = 0.010, dashes = 90, duty = 0.55,
} = {}) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 4;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 64, 4);
  x.fillStyle = '#fff';
  x.fillRect(0, 0, Math.round(64 * duty), 4);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(dashes, 1);
  tex.colorSpace = THREE.SRGBColorSpace;

  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, Math.min(points.length * 2, 900), width, 6, false);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color, alphaMap: tex, transparent: true,
    alphaTest: 0.5,            // hard edges, and it still writes depth
    side: THREE.DoubleSide,
  }));
  mesh.userData.curve = curve;
  return mesh;
}
