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

/* ----------------------------------------------------------- rigging lines
   `rim` are points on the canopy edge and `hang` the point on the payload they
   all converge to, both as [x, y, z]. The canopy is above the payload, so rim
   y must exceed hang y — getting that the wrong way round builds an upturned
   cone, which is how this was first written. */
function rigging(rim, hang, color = C.ink) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color });
  const b = new THREE.Vector3(...hang);
  for (const p of rim) {
    const a = new THREE.Vector3(...p);
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, len, 4), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.add(m);
  }
  return g;
}

/* --------------------------------------------------------------- parafoil
   A wing, not a dome: an arched rectangular canopy. Built from an open
   cylinder segment, which gives the span-wise arch for free. */
export function parafoil(span = 0.46, colour = C.blue) {
  const g = new THREE.Group();
  const r = span * 0.62, chord = span * 0.42, CY = 0.32;
  const HALF = Math.PI * 0.38;          // half the arc the canopy spans

  /* Rotate about X, not Z. A cylinder's axis starts along Y; about X it ends
     up along Z, which puts the arc in the XY plane — an arch ACROSS the span
     with the chord running fore and aft. About Z instead lays the arch along
     the line of flight, which renders as a slab, not a wing. */
  const canopy = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, chord, 22, 1, true, Math.PI - HALF, 2 * HALF),
    new THREE.MeshLambertMaterial({ color: colour, side: THREE.DoubleSide }),
  );
  canopy.rotation.x = Math.PI / 2;
  canopy.position.y = CY;
  /* Canopy, ribs and lines all live in one group so they can settle together.
     Collapsing the canopy alone leaves the rigging hanging in the air where
     the wing used to be, which reads as a black star over the crate. */
  const wing = new THREE.Group();
  wing.add(canopy);
  g.add(wing);

  // after that rotation a point at angle u across the arc lands here
  const ax = u => -r * Math.sin(u * HALF);
  const ay = u => CY + r * Math.cos(u * HALF);

  // cell divisions, so it reads as a ram-air wing rather than a tube
  const rib = new THREE.MeshBasicMaterial({ color: C.ink });
  for (const u of [-1, -0.5, 0, 0.5, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.007, chord * 1.01), rib);
    m.position.set(ax(u), ay(u), 0);
    m.rotation.z = -u * HALF;
    wing.add(m);
  }

  // the payload hangs from the wing tips on four lines
  const d = chord * 0.38;
  wing.add(rigging([[ax(-1), ay(-1), -d], [ax(1), ay(1), -d],
                    [ax(-1), ay(-1), d], [ax(1), ay(1), d]], [0, 0.085, 0]));
  g.add(crate(0.17));

  g.userData.collapse = f => {           // wing settling onto the payload
    wing.scale.set(1 + f * 0.22, Math.max(0.07, 1 - f * 0.93), 1 + f * 0.12);
    wing.rotation.z = f * 0.30;
  };
  return g;
}

/* ------------------------------------------------------------- helicopter
   Mostly a landmark. Without something recognisable at the release point the
   viewer has nowhere to look while the scene waits, and hunting for an empty
   patch of air is how this reads as broken. Roughly to scale — about 9 m,
   which is 0.7 m at 1:13. */
export function helicopter(len = 0.70, colour = C.ink) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(len * 0.20, len * 0.34, 6, 14),
    new THREE.MeshLambertMaterial({ color: colour }),
  );
  body.rotation.z = Math.PI / 2;
  g.add(body);

  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(len * 0.155, 16, 12),
    new THREE.MeshLambertMaterial({ color: C.blue }),
  );
  glass.position.set(len * 0.30, len * 0.02, 0);
  g.add(glass);

  const boom = new THREE.Mesh(
    new THREE.CylinderGeometry(len * 0.035, len * 0.022, len * 0.52, 8),
    new THREE.MeshLambertMaterial({ color: colour }),
  );
  boom.rotation.z = Math.PI / 2;
  boom.position.set(-len * 0.50, len * 0.06, 0);
  g.add(boom);

  const fin = new THREE.Mesh(
    new THREE.BoxGeometry(len * 0.10, len * 0.17, len * 0.02),
    new THREE.MeshLambertMaterial({ color: C.pink }),
  );
  fin.position.set(-len * 0.73, len * 0.15, 0);
  g.add(fin);

  // skids
  const skidMat = new THREE.MeshBasicMaterial({ color: colour });
  for (const dz of [-len * 0.13, len * 0.13]) {
    const s = new THREE.Mesh(
      new THREE.CylinderGeometry(len * 0.014, len * 0.014, len * 0.46, 6), skidMat);
    s.rotation.z = Math.PI / 2;
    s.position.set(len * 0.02, -len * 0.23, dz);
    g.add(s);
  }

  const rotor = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(len * 0.92, len * 0.012, len * 0.055),
      new THREE.MeshLambertMaterial({ color: colour }),
    );
    blade.rotation.y = i * Math.PI / 4;
    rotor.add(blade);
  }
  rotor.position.set(0, len * 0.26, 0);
  g.add(rotor);

  const tailRotor = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(len * 0.012, len * 0.26, len * 0.035),
      new THREE.MeshLambertMaterial({ color: colour }),
    );
    b.rotation.z = i * Math.PI / 2;
    tailRotor.add(b);
  }
  tailRotor.position.set(-len * 0.76, len * 0.15, len * 0.035);
  g.add(tailRotor);

  g.userData.spin = dt => {
    rotor.rotation.y += dt * 22;
    tailRotor.rotation.x += dt * 30;
  };
  return g;
}

/* ----------------------------------------------------------- round canopy
   The thing a parafoil is not. No forward speed, nothing to steer with. */
export function roundCanopy(radius = 0.28, colour = C.pink) {
  const g = new THREE.Group();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
    new THREE.MeshLambertMaterial({ color: colour, side: THREE.DoubleSide }),
  );
  dome.position.y = 0.30;
  // canopy and lines settle as one — see the note in parafoil()
  const wing = new THREE.Group();
  wing.add(dome);
  // the rim of an almost-hemisphere sits just below its centre height
  const k = radius * Math.sin(Math.PI * 0.52);
  const rimY = 0.30 + radius * Math.cos(Math.PI * 0.52);
  wing.add(rigging([[-k, rimY, 0], [k, rimY, 0], [0, rimY, -k], [0, rimY, k]],
                   [0, 0.085, 0]));
  g.add(wing);
  g.add(crate(0.17));
  g.userData.collapse = f => {           // f 0..1, canopy going limp on landing
    wing.scale.set(1 + f * 0.30, Math.max(0.05, 1 - f * 0.95), 1 + f * 0.30);
  };
  return g;
}

/* ------------------------------------------------------------------ water
   Scenery. Nothing about the water is modelled; the model computes the
   trajectory and stops at the ground. */
export function riverSurface(corners, { colour = C.water } = {}) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#4F86C6'; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(255,255,255,.34)';
  x.lineWidth = 3;
  for (let i = 0; i < 7; i++) {          // lazy wave lines, flat and graphic
    const y = 10 + i * 18;
    x.beginPath();
    for (let px = 0; px <= 128; px += 8) x.lineTo(px, y + Math.sin(px / 14 + i) * 3.2);
    x.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 3);
  tex.colorSpace = THREE.SRGBColorSpace;

  const geo = new THREE.BufferGeometry();
  const p = corners;
  geo.setAttribute('position', new THREE.Float32BufferAttribute([
    p[0].x, 0, p[0].z, p[1].x, 0, p[1].z, p[2].x, 0, p[2].z, p[3].x, 0, p[3].z,
  ], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity: 0.88, side: THREE.DoubleSide,
  }));
  mesh.position.y = 0.006;
  mesh.userData.tick = dt => { tex.offset.x -= dt * 0.035; };
  return mesh;
}

/* ----------------------------------------------------------------- splash */
export function splash(colour = 0xffffff) {
  const g = new THREE.Group();
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.16, 0.20, 40),
      new THREE.MeshBasicMaterial({ color: colour, transparent: true,
                                    side: THREE.DoubleSide, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.012;
    m.visible = false;
    rings.push(m); g.add(m);
  }
  let t = null;
  g.userData.play = () => { t = 0; };
  g.userData.tick = dt => {
    if (t === null) return;
    t += dt;
    rings.forEach((m, i) => {
      const u = t - i * 0.26;
      m.visible = u > 0 && u < 1.5;
      if (!m.visible) return;
      m.scale.setScalar(1 + u * 3.4);
      m.material.opacity = Math.max(0, 0.8 * (1 - u / 1.5));
    });
    if (t > 2.4) t = null;
  };
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

/** Re-draw a card's texture in place. Cheaper than rebuilding the sprite, and
    it keeps whatever position the caller has already given it. */
export function setCard(spr, title, value, accent = CSS.blue) {
  // Once billboards() owns a sprite, scale.y is its distance-scaled size, not
  // its base size — rebuild from the base and let the billboard pass rescale.
  const base = spr.userData.baseH ?? spr.scale.y;
  const fresh = card(title, value, { accent, height: base });
  spr.material.map.dispose();
  spr.material.map = fresh.material.map;
  spr.material.needsUpdate = true;
  if (spr.userData.baseH != null) {
    spr.userData.aspect = fresh.scale.x / fresh.scale.y;
  } else {
    spr.scale.copy(fresh.scale);
  }
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
    // Heights are given as apparent size at one metre; billboard() rescales
    // every card by its distance so labels stay legible near and far.
    const lab = card(`${m} M`, null, { height: 0.040, pad: 20 });
    lab.position.set(0.14, y, 0);
    g.add(lab);
  }

  // State the compression outright rather than letting the ticks imply it.
  // "40 m -> 3 m" lands faster than a centimetres-per-metre ratio does.
  const trim = v => v.toFixed(1).replace(/\.0$/, '');
  const cap = card('SCALE', `${trim(realHeight)} m → ${trim(top)} m`,
                   { accent: CSS.ink3, height: 0.058 });
  // Low, not at the top: the release point is the top of the ruler and the
  // helicopter hovers exactly there, so a card up there is behind it.
  cap.position.set(0.14, 0.30, 0);
  g.add(cap);
  return g;
}

/* ---------------------------------------------------------------- billboard
   Sprites are fixed in world units, so a card is overwhelming at arm's length
   and illegible across a room — and in this scene the same label can be both,
   since the package starts at the ceiling and finishes at the viewer's feet.
   Scaling by distance holds a card at a constant apparent size instead.

   Clamped at both ends: closer than the near limit it would keep shrinking
   into the floor, and beyond the far limit a card grows large enough to cover
   the thing it is labelling. */
export function billboards(root, { near = 0.75, far = 3.4 } = {}) {
  const list = [];
  root.traverse(o => {
    if (!o.isSprite) return;
    o.userData.baseH = o.scale.y;                       // apparent size at 1 m
    o.userData.aspect = o.scale.x / o.scale.y;
    list.push(o);
  });
  const v = new THREE.Vector3();
  return function update(camera) {
    for (const s of list) {
      s.getWorldPosition(v);
      const d = Math.min(Math.max(v.distanceTo(camera.position), near), far);
      const h = s.userData.baseH * d;
      s.scale.set(h * s.userData.aspect, h, 1);
    }
  };
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
