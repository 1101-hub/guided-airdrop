/* ===========================================================================
   scene.js — the two things a judge scans for.

     miss  a supply drop with no idea what the wind is doing. Seen side-on so
           the whole wandering route is readable, it overshoots the target by
           23.87 m and ends up in the water.

     hit   the same drop, same wind, same seed, with the wind worked out on
           board. It comes in towards the viewer and lands at their feet, and
           it carries the first route beside it as a dashed ghost so the two
           are compared rather than remembered.

   Both replay real output from simulate(). Only the playback rate is altered:
   the descent takes 26.3 s and is shown at SPEED times that, which is why the
   result card states the true flight time.
   =========================================================================== */
import * as THREE from './vendor/three.module.min.js';
import {
  C, crate, parafoil, roundCanopy, riverSurface, splash, contactShadow, helicopter,
  targetRing, floorGrid, card, setCard, heightRuler, pathLine, dashedPathLine,
  billboards,
} from './models.js?v=2';
import { roomPath, riverInRoom, REAL_H, ROOM_H, SCALE } from './trajectory.js?v=2';

const SPEED = 2.0;                 // playback multiplier; 26.3 s becomes ~13 s
const GHOST_DRAW = 2.0;            // seconds to trace the old route in
const V = (p) => new THREE.Vector3(p.x, p.y, p.z);

/* Draw a prefix of a tube. TubeGeometry is indexed as tubularSegments *
   radialSegments * 6, so a fraction of the indices is a fraction of the run. */
function drawFraction(mesh, f) {
  const g = mesh.geometry;
  const total = g.index.count;
  const per = g.parameters.radialSegments * 6;
  const n = Math.max(per, Math.floor(total * Math.min(Math.max(f, 0), 1) / per) * per);
  g.setDrawRange(0, n);
}

export function buildScene(which) {
  const isHit = which === 'hit';
  const run = roomPath(which);
  const river = riverInRoom(which);
  const pts = run.points.map(V);
  const group = new THREE.Group();

  /* ---------------------------------------------------------- the ground */
  group.add(floorGrid(8, 0.5));
  const water = riverSurface(river.corners);
  group.add(water);

  const ring = targetRing(0.30, isHit ? C.grn : C.pink);
  ring.position.set(run.target.x, 0.004, run.target.z);
  group.add(ring);

  /* The ruler belongs at the release point, but planted exactly there the
     trajectory wraps around it and the whole thing reads as clutter. Push it
     directly away from the middle of the route so it stands clear. */
  const mid = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(pts.length);
  const away = new THREE.Vector3(run.release.x - mid.x, 0, run.release.z - mid.z);
  if (away.lengthSq() < 1e-6) away.set(1, 0, 0);
  away.normalize().multiplyScalar(0.42);

  const ruler = heightRuler(REAL_H, SCALE, { every: 10 });
  ruler.position.set(run.release.x + away.x, 0, run.release.z + away.z);
  group.add(ruler);

  /* ------------------------------------------------------------ the paths */
  let ghost = null, ghostRun = null;
  if (isHit) {
    // The failed drop mapped through THIS scene's frame, not its own: the two
    // routes have to share one coordinate system to be worth comparing.
    ghostRun = roomPath('hit', 'none');
    ghost = dashedPathLine(ghostRun.points.map(V), C.pink, { width: 0.009, dashes: 110 });
    ghost.visible = false;
    group.add(ghost);
  }

  const trail = pathLine(pts, isHit ? C.blue : C.pink, 0.011);
  group.add(trail);

  /* ------------------------------------------------------- the helicopter
     Sits at the release point and hovers there. It is what the viewer looks
     for before anything happens, and what `aim` points them at. */
  const heli = helicopter(0.70);
  heli.position.set(run.release.x, run.release.y, run.release.z);
  group.add(heli);

  /* ------------------------------------------------------------ the flyer */
  const flyer = isHit ? parafoil(0.44, C.blue) : roundCanopy(0.26, C.pink);
  group.add(flyer);
  const shadow = contactShadow(0.46);
  group.add(shadow);
  const spl = splash();
  spl.position.set(run.landing.x, 0, run.landing.z);
  group.add(spl);

  /* ------------------------------------------------------------- the cards */
  const alt = card('ALTITUDE', `${REAL_H} m`, { accent: '#3B54E8', height: 0.055 });
  group.add(alt);

  const result = card('', '', { accent: '#FF2E93', height: 0.078 });
  result.visible = false;
  result.position.set(run.landing.x, 0.62, run.landing.z);
  group.add(result);

  const note = card('', '', { accent: '#8C877C', height: 0.045 });
  note.visible = false;
  note.position.set(run.landing.x, 0.38, run.landing.z);
  group.add(note);

  const ghostLab = card('LAST TIME', `missed by ${ghostRun ? ghostRun.miss.toFixed(1) : '23.9'} m`,
                        { accent: '#FF2E93', height: 0.052 });
  ghostLab.visible = false;
  if (isHit) {
    // on the GHOST, not on the new route — it is the ghost it names
    const gp = ghostRun.points[Math.floor(ghostRun.points.length * 0.62)];
    ghostLab.position.set(gp.x, gp.y + 0.22, gp.z);
    group.add(ghostLab);
  }

  /* The water is set dressing and says so, once, quietly. Offset along the
     river rather than across it: the package lands at the river's centre, so
     anything placed there collides with the wreck. */
  if (!isHit) {
    const edge = river.corners[0];
    const disc = card('NOTE', 'terrain is illustrative', { accent: '#8C877C', height: 0.040 });
    disc.position.set((river.centre.x + edge.x) / 2, 0.14, (river.centre.z + edge.z) / 2);
    group.add(disc);
  }

  /* Register every label for distance-scaling. Must come after the last card
     is added, since it snapshots what is in the group. */
  const updateCards = billboards(group);

  /* ------------------------------------------------------- the choreography */
  const FLIGHT = run.duration / SPEED;
  let t = 0, phase = 'idle', hoverT = 0;

  /* Back to the helicopter hovering with nothing dropped yet. The scene
     waits here instead of playing on load, so the viewer can find the
     helicopter first and start the drop when they are actually looking. */
  function reset() {
    t = 0;
    phase = 'ready';
    result.visible = note.visible = false;
    ghostLab.visible = false;
    alt.visible = false;
    trail.visible = false;
    flyer.visible = false;
    shadow.visible = false;
    drawFraction(trail, 0);
    if (ghost) { ghost.visible = false; drawFraction(ghost, 0); }
    if (flyer.userData.collapse) flyer.userData.collapse(0);
    place(0);                 // park the package under the helicopter
  }

  function drop() {
    t = 0;
    phase = isHit ? 'ghost' : 'fly';
    result.visible = note.visible = false;
    ghostLab.visible = false;
    trail.visible = true;
    flyer.visible = true;
    shadow.visible = true;
    alt.visible = true;
    drawFraction(trail, 0);
    if (ghost) { ghost.visible = true; drawFraction(ghost, 0); }
    if (flyer.userData.collapse) flyer.userData.collapse(0);
    place(0);
  }

  /* Position the flyer off the SAME curve the tube is built from, using
     getPointAt as TubeGeometry does. Indexing the raw point array instead
     looks equivalent and is not: getPointAt is parameterised by arc length,
     so a tube drawn to fraction f ends somewhere the array's f-th point is
     not, and the package drifts away from the end of its own trail. */
  const curve = trail.userData.curve;
  const _p = new THREE.Vector3(), _t = new THREE.Vector3();

  function place(f) {
    const u = Math.min(Math.max(f, 0), 1);
    const p = curve.getPointAt(u, _p);
    curve.getTangentAt(u, _t);
    flyer.position.copy(p);
    // face the direction of travel, so the wing banks through the weave
    if (_t.lengthSq() > 1e-9) flyer.rotation.y = Math.atan2(_t.x, _t.z);

    shadow.position.set(p.x, 0.003, p.z);
    const k = 1 - p.y / ROOM_H;
    shadow.scale.setScalar(0.45 + 0.55 * k);
    shadow.material.opacity = 0.18 + 0.72 * k;

    alt.position.set(p.x + 0.30, p.y + 0.26, p.z);
    const m = Math.round(REAL_H * (p.y / ROOM_H));
    if (alt.userData.m !== m) {
      alt.userData.m = m;
      setCard(alt, 'ALTITUDE', `${m} m`, '#3B54E8');
    }
  }

  function tick(dt, camera) {
    if (camera) updateCards(camera);
    water.userData.tick(dt);
    spl.userData.tick(dt);
    heli.userData.spin(dt);
    hoverT += dt;
    heli.position.y = run.release.y + Math.sin(hoverT * 1.3) * 0.012;

    if (phase === 'ready' || phase === 'idle') return;
    t += dt;

    if (phase === 'ghost') {
      drawFraction(ghost, t / GHOST_DRAW);
      ghostLab.visible = t > GHOST_DRAW * 0.45;
      place(0);
      if (t >= GHOST_DRAW) { phase = 'fly'; t = 0; }
      return;
    }

    if (phase === 'fly') {
      const f = Math.min(t / FLIGHT, 1);
      drawFraction(trail, f);
      place(f);
      if (f >= 1) {
        phase = 'land'; t = 0;
        alt.visible = false;
        spl.userData.play();
        result.visible = note.visible = true;
        if (isHit) {
          setCard(result, 'LANDED', `${run.miss.toFixed(2)} m from target`, '#4FA828');
          setCard(note, 'WITH THE WIND WORKED OUT', '26 s of flight, no wind sensor', '#8C877C');
        } else {
          setCard(result, 'MISSED BY', `${run.miss.toFixed(1)} m`, '#FF2E93');
          setCard(note, 'NO IDEA WHAT THE WIND WAS', 'supplies lost in the water', '#8C877C');
        }
      }
      return;
    }

    if (phase === 'land') {
      // the round canopy goes limp and the crate drifts off downstream
      if (!isHit) {
        flyer.userData.collapse(Math.min(t / 1.1, 1));
        const drift = Math.min(t, 14) * 0.012;
        flyer.position.x = run.landing.x + drift * 0.9;
        flyer.position.z = run.landing.z + drift * 0.45;
        flyer.position.y = Math.sin(t * 1.7) * 0.012;
        shadow.material.opacity = 0.0;
      } else {
        // wing settles onto the target rather than hovering over the crate
        flyer.userData.collapse(Math.min(t / 1.0, 1));
        ring.rotation.y += dt * 0.6;
        flyer.position.y = 0;
      }
    }
  }

  reset();

  return {
    group, tick, reset, drop,
    get phase() { return phase; },
    get ready() { return phase === 'ready'; },
    get done() { return phase === 'land'; },
    miss: run.miss,
    flight: run.duration,
    landing: run.landing,
    release: run.release,
    /* What the on-screen pointer should aim at: the helicopter while waiting,
       the package once it is falling, the wreck or delivery once it is down. */
    focus: () => (phase === 'ready' ? heli : flyer),
    /* Yaw that puts the helicopter straight ahead of someone standing at the
       origin. A rotation about the viewer keeps every distance from them
       unchanged, so the landing stays exactly as close to their feet. */
    aim: Math.atan2(run.release.x, -run.release.z),
    // exposed for the dev harness only
    _debug: { flyer, trail, ghost, pts, FLIGHT, get t() { return t; } },
  };
}
