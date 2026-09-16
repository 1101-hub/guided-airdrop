/* ===========================================================================
   trajectory.js — the bridge between the model and the room.

   The paths shown in AR are not animations. They are the output of the same
   simulate() the site and the paper use, run in the browser at load time with
   the page's own default settings, so the AR reproduces the numbers already
   quoted in the video: 23.87 m uncontrolled, 2.35 m with the filter.

   The only liberty taken is scale. A 40 m drop is compressed to 3 m so it
   fits indoors, uniformly in all three axes: squashing one axis more than
   another would change the shape of the trajectory, which is the one thing
   here that must stay honest. The height ruler states the compression.
   =========================================================================== */
import { glideState, turnRadius, simulate } from '../physics.js?v=12';

export const CL = 0.80, CD = 0.27, BANK = 20;
export const TARGET = [20, 10];
export const SETTINGS = { wind: 1.6, dir: 45, height: 40, load: 1.2, bias: 6, seed: 7 };

export const REAL_H = 40;          // metres, the modelled release height
export const ROOM_H = 3.0;         // metres of actual room it is shown in
export const SCALE = ROOM_H / REAL_H;

/* ---------------------------------------------------------------------------
   Staging.

   Each scene is rotated about the vertical so the drop reads well from where
   the judge stands, and shifted so the target lands where that scene wants it.
   Rotation about vertical is a rigid motion: it moves the whole world, so no
   distance or angle in the trajectory is altered by it.

   The two scenes are anchored differently on purpose, because they are asked
   to do different jobs:

     miss   the judge is a spectator. Everything sits in front of them, the
            package flying away and overshooting into the river, so the whole
            failure is visible without turning round.

     hit    the package comes to the judge. The target sits at their feet and
            the package flies in towards them from across the room.

   That costs nothing in comparability, because the comparison happens inside
   the second scene: it carries the first scene's route as a dashed ghost, in
   its own frame, so the two are seen together rather than remembered.
   --------------------------------------------------------------------------- */
const D = Math.PI / 180;

// Bearing from release to target, in the model's own frame.
const APPROACH = Math.atan2(TARGET[1], TARGET[0]);

export const SCENES = {
  /* Side-on. The uncontrolled drop wanders nearly 6 m along its own line of
     travel, which no classroom reliably has in front of the viewer; turned
     broadside it needs that span in *sightline* instead, which costs nothing.
     A profile view is also the better way to read an arc. */
  miss: { theta: -APPROACH, anchorX: -1.19, anchorZ: -2.35, mode: 'none' },

  /* This scene shows two routes at once, and they pass on opposite sides of
     the target — which the target has to sit at the viewer's feet. So some of
     it is behind them no matter how it is turned; the only question is which
     part. Every rotation was swept and scored, and the honest trade is:

       balanced         76% / 76% visible, lands 1.50 m away
       ghost first      70% / 100%,        lands 1.48 m away
       this one        100% /  64%,        lands 0.87 m away

     The new route is the one that has to be followed end to end, and the
     landing is the beat the scene exists for, so both are kept whole. What
     falls behind the viewer is the far tail of the OLD route — after it has
     already visibly diverged — and the card carries its number anyway. */
  hit:  { theta: 117 * D, anchorX: 0, anchorZ: -0.70, mode: 'ekf' },
};

/* ------------------------------------------------------------- the model */
function design() {
  const g = glideState(SETTINGS.load, 1.0, CL, CD);
  return { vh: g.vh, vz: g.vz, R: turnRadius(g.vh, BANK) };
}

export function windVector() {
  const a = SETTINGS.dir * D;
  return [SETTINGS.wind * Math.cos(a), SETTINGS.wind * Math.sin(a)];
}

/** Run one drop. `mode` is 'none' (no wind knowledge) or 'ekf' (worked out). */
export function runDrop(mode) {
  return simulate({
    target: TARGET, windTrue: windVector(), params: design(),
    height0: SETTINGS.height, mode, headingBiasDeg: SETTINGS.bias,
    seed: SETTINGS.seed,
  });
}

/* ------------------------------------------------- model frame -> room frame
   Sim (x, y) is a horizontal plane and sim z is altitude. Room axes are
   three.js: x right, y up, z towards the viewer, so the target sits at the
   origin and negative z is in front of them. */
export function makeMapper({ theta, anchorX = 0, anchorZ = 0 }) {
  const c = Math.cos(theta), s = Math.sin(theta);
  return function toRoom(simX, simY, simZ) {
    const dx = simX - TARGET[0], dy = simY - TARGET[1];
    return {
      x: (dx * c - dy * s) * SCALE + anchorX,
      y: simZ * SCALE,
      z: (dx * s + dy * c) * SCALE + anchorZ,
    };
  };
}

/** The full descent as room-space points, plus the landing and the numbers.

    `modeOverride` runs a different drop through this scene's frame — which is
    how the second scene carries the first one's failed route as a ghost. Both
    must be mapped through the same frame or they cannot be compared. */
export function roomPath(scene, modeOverride) {
  const cfg = SCENES[scene];
  const toRoom = makeMapper(cfg);
  const run = runDrop(modeOverride || cfg.mode);

  // 525 steps is more than a tube needs; thin it but always keep the last.
  const step = Math.max(1, Math.round(run.track.length / 220));
  const pts = [];
  for (let i = 0; i < run.track.length; i += step) {
    const [t, x, y, z] = run.track[i];
    pts.push({ ...toRoom(x, y, z), t });
  }
  const last = run.track[run.track.length - 1];
  pts.push({ ...toRoom(last[1], last[2], last[3]), t: last[0] });

  return {
    points: pts,
    landing: toRoom(run.landing[0], run.landing[1], 0),
    target: toRoom(TARGET[0], TARGET[1], 0),
    release: toRoom(run.track[0][1], run.track[0][2], run.track[0][3]),
    miss: run.miss,
    duration: run.tTotal,
    toRoom,
  };
}

/* ------------------------------------------------------------------ river
   Defined in the model's frame, not the room's, so it lands in the same place
   relative to the drop in both scenes. It is laid across the overshoot: the
   uncontrolled package runs past the target and ends up in the water.

   The water is scenery. Nothing about it is modelled — the model computes the
   trajectory and stops at the ground.  */
export function riverInRoom(scene, { width = 24, length = 70 } = {}) {
  const toRoom = makeMapper(SCENES[scene]);
  const land = runDrop('none').landing;
  const along = APPROACH + Math.PI / 2;          // across the line of travel
  const corners = [];
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const ax = Math.cos(along) * (length / 2) * u;
    const ay = Math.sin(along) * (length / 2) * u;
    const bx = Math.cos(APPROACH) * (width / 2) * v;
    const by = Math.sin(APPROACH) * (width / 2) * v;
    corners.push(toRoom(land[0] + ax + bx, land[1] + ay + by, 0));
  }
  return { corners, centre: toRoom(land[0], land[1], 0) };
}
