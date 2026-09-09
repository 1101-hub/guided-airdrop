"""
Guidance: where should the parafoil fly, given wind and remaining height?

The key simplification
----------------------
A parafoil sinks at a constant rate. So the moment it is released, the time it
has left is FIXED:

        t = height / sink_rate

It does not matter how it flies -- turning, straight, spiralling -- it lands at
the same moment. Two very useful things follow.

1.  THE WIND STOPS BEING COMPLICATED.
    In time t the whole air mass slides downwind by exactly wind*t. So instead
    of solving a hard problem with wind in it, shift the target UPWIND by
    wind*t and solve the easy no-wind problem in the "air frame". The parafoil
    flies a clean Dubins path through the air; the air carries it downwind; it
    arrives over the real target. No iteration, no approximation.

2.  THE PATH LENGTH IS FIXED TOO.
        budget = airspeed * t
    And this is the interesting part: we do NOT want the shortest path. We
    want a path whose length is EXACTLY the budget.

Why "exactly"
-------------
If the direct route is 60 m but the parafoil has 100 m of flying left in it, it
arrives over the target still high, then drifts away while it comes down. The
extra 40 m has to be deliberately wasted. Real precision airdrop calls this
ENERGY MANAGEMENT.

We waste it in two ways, in this order:
  * full loiter circles, each worth exactly 2*pi*R
  * lengthening the final approach, by putting the approach point further back

and we solve for the approach distance with a one-dimensional root find.

Landing into wind
-----------------
The final heading is chosen so the parafoil flies INTO the wind at touchdown.
Ground speed = airspeed + wind, so flying upwind makes the ground speed as
small as possible. That means a slow, soft landing -- which matters when there
is something fragile in the box.
"""

import numpy as np

import dubins as DB
import parafoil as PF


# ---------------------------------------------------------------------------
# The fixed quantities, known the instant it is released
# ---------------------------------------------------------------------------

def time_aloft(height, sink_rate):
    """Seconds until touchdown. Independent of how it flies."""
    return height / sink_rate


def air_frame_target(target_xy, wind_vec, t):
    """Where to aim, in the frame of the drifting air mass.

    The air carries the parafoil downwind by wind*t during the descent, so aim
    that far UPWIND of the real target and the drift delivers it.
    """
    return np.asarray(target_xy, float) - np.asarray(wind_vec, float) * t


def into_wind_heading(wind_vec):
    """Heading that points into the wind, for the slowest possible touchdown."""
    w = np.asarray(wind_vec, float)
    if np.linalg.norm(w) < 1e-6:
        return 0.0
    return np.arctan2(-w[1], -w[0])


# ---------------------------------------------------------------------------
# Path construction
# ---------------------------------------------------------------------------

def approach_point(target_air, final_heading, D):
    """Point D metres back along the final approach line.

    The last D metres are flown straight, on the final heading, into the
    target. Making D bigger lengthens the path -- that is the knob we turn to
    burn off excess height.
    """
    return np.array([target_air[0] - D * np.cos(final_heading),
                     target_air[1] - D * np.sin(final_heading)])


def total_length(state, target_air, final_heading, R, D):
    """Length of (Dubins path to the approach point) + (straight run D)."""
    ap = approach_point(target_air, final_heading, D)
    path = DB.solve(state, (ap[0], ap[1], final_heading), R)
    if path is None:
        return np.inf, None
    return path["length"] + D, path


def plan(state, target_xy, wind_vec, height, params, d_max=None, n_scan=160):
    """Work out the whole descent plan.

    state   : (x, y, heading) now
    target  : (x, y) on the ground
    wind    : (wx, wy) m/s
    height  : metres remaining
    params  : dict with v_h, v_z, R

    Returns a dict describing the plan, including whether the target is
    reachable at all.
    """
    v_h, v_z, R = params["v_h"], params["v_z"], params["R"]

    t = time_aloft(height, v_z)
    budget = v_h * t
    tgt_air = air_frame_target(target_xy, wind_vec, t)
    heading_f = into_wind_heading(wind_vec)

    L_direct, direct_path = total_length(state, tgt_air, heading_f, R, 0.0)

    if L_direct > budget:
        return {
            "reachable": False,
            "t": t, "budget": budget, "needed": L_direct,
            "shortfall": L_direct - budget,
            "target_air": tgt_air, "final_heading": heading_f,
            "path": direct_path, "D": 0.0, "loiters": 0,
        }

    loop = 2.0 * np.pi * R
    if d_max is None:
        d_max = max(2.0 * loop, budget * 0.8)

    Ds = np.linspace(0.0, d_max, n_scan)
    vals = np.array([total_length(state, tgt_air, heading_f, R, d)[0] for d in Ds])

    # total_length(D) is DISCONTINUOUS. As the approach point slides backwards
    # past the vehicle, the optimal Dubins type switches (LSR -> LSL, say) and
    # the length JUMPS -- by very nearly one full loop, 2*pi*R, because the
    # new type has to fit in an extra turn.
    #
    # So there are gaps: whole ranges of path length that simply cannot be
    # flown by stretching the approach. A sign change in the scan is therefore
    # NOT proof of a root -- it may just be the cliff. Every candidate is
    # bisected and then VERIFIED against the target length, and anything that
    # landed inside a gap is thrown away.
    #
    # Loiter circles are what fill the gaps: each one shifts the whole
    # reachable set by exactly one loop, so between them the two mechanisms
    # cover the range.
    max_loiters = max(int(np.floor((budget - L_direct) / loop)), 0)
    best = None

    for n_l in range(max_loiters, -1, -1):
        target_len = budget - n_l * loop
        for i in range(len(Ds) - 1):
            lo_v, hi_v = min(vals[i], vals[i + 1]), max(vals[i], vals[i + 1])
            if not (lo_v <= target_len <= hi_v):
                continue
            lo, hi = Ds[i], Ds[i + 1]
            for _ in range(60):
                mid = 0.5 * (lo + hi)
                v, _ = total_length(state, tgt_air, heading_f, R, mid)
                if v < target_len:
                    lo = mid
                else:
                    hi = mid
            d_try = 0.5 * (lo + hi)
            v_try, _ = total_length(state, tgt_air, heading_f, R, d_try)
            err = abs(v_try + n_l * loop - budget)
            if best is None or err < best[0]:
                best = (err, d_try, n_l)
        if best is not None and best[0] < 1e-3:
            break

    if best is None:
        D, loiters = 0.0, 0
    else:
        _, D, loiters = best

    L_final, path = total_length(state, tgt_air, heading_f, R, D)

    return {
        "reachable": True,
        "t": t, "budget": budget,
        "planned_length": L_final + loiters * loop,
        "error": abs(L_final + loiters * loop - budget),
        "target_air": tgt_air, "final_heading": heading_f,
        "path": path, "D": D, "loiters": loiters,
    }


def sample_plan(p, step=0.5):
    """Ground track of the plan, for plotting."""
    if p["path"] is None:
        return np.empty((0, 3))
    pts = DB.sample(p["path"], step=step)
    if p["D"] > 0 and len(pts):
        x, y, th = pts[-1]
        n = max(int(np.ceil(p["D"] / step)), 1)
        ds = p["D"] / n
        extra = [(x + ds * (i + 1) * np.cos(th),
                  y + ds * (i + 1) * np.sin(th), th) for i in range(n)]
        pts = np.vstack([pts, np.array(extra)])
    return pts


# ---------------------------------------------------------------------------
# The actual flight controller
# ---------------------------------------------------------------------------

def steer(state, target_xy, wind_vec, height, params, margin=0.02):
    """One steering command, recomputed every control step.

    The planner above is useful for drawing pictures and for understanding the
    problem, but flying a precomputed route open-loop does not work: the wind
    pushes you off it and the errors accumulate.

    This is the feedback version, and it is deliberately simple:

        budget   = how much flying you have left   = airspeed * height / sink
        needed   = length of the direct route to the target (a Dubins path)

        if needed >= budget:   fly the route -- you need every metre
        else:                  you are TOO HIGH. Turn, and burn off the excess.

    That is a bang-bang energy controller. Circle while you have height to
    spare, and the moment the numbers match, roll out and fly at the target.
    Because `needed` is recomputed from the actual position each step, wind
    drift is corrected automatically instead of accumulating.

    Returns (turn, path, state_name) with turn in {+1 left, 0 straight, -1 right}.
    """
    v_h, v_z, R = params["v_h"], params["v_z"], params["R"]

    t = height / v_z
    budget = v_h * t
    tgt_air = air_frame_target(target_xy, wind_vec, t)
    heading_f = into_wind_heading(wind_vec)

    path = DB.solve(state, (tgt_air[0], tgt_air[1], heading_f), R)
    if path is None:
        return 0.0, None, "no-solution"

    if path["length"] >= budget * (1.0 - margin):
        # On or behind schedule: fly the route.
        return _first_turn(path, v_h * 0.2), path, "approach"

    # Ahead of schedule -- too much height for the distance left. Spend it.
    # Turning is the only way to add path length without adding distance.
    return 1.0, path, "loiter"


def _first_turn(path, ds):
    """Turn command from the first non-trivial segment of a Dubins path."""
    for k, L in zip(path["type"], (path["t"], path["p"], path["q"])):
        if L > ds:
            return {"L": 1.0, "S": 0.0, "R": -1.0}[k]
    return 0.0


# ---------------------------------------------------------------------------
# Weaving energy management -- the version that actually flies well
# ---------------------------------------------------------------------------

class WeaveGuidance:
    """Burn excess height by flying at an ANGLE to the target, not by circling.

    The idea in one line
    --------------------
    If you fly at angle alpha off the direct line, your path is longer than the
    direct line by exactly 1/cos(alpha). So to stretch a route of length d into
    a budget B, choose

            cos(alpha) = d / B      ->      alpha = arccos(d / B)

    and weave from side to side at that angle. Need 20% more path? Fly 33.6
    degrees off. Need double? Fly 60 degrees off. The geometry does the
    arithmetic for you, and it is continuous -- as height runs out, d/B rises
    to 1, alpha falls smoothly to zero, and the weave straightens out into a
    final approach without any switching logic.

    Why not just circle
    -------------------
    Circling also burns length, but it takes you away from the target and the
    moment you leave the circle matters enormously -- exit at the wrong point
    and you are pointing the wrong way with no height left to fix it. That
    showed up in testing as a bimodal miss distance: most drops within a metre,
    the rest about 22 m out. Weaving has no exit moment to get wrong.

    The only state is which way we are currently weaving, flipped when the
    heading error grows past the weave angle.
    """

    def __init__(self, params, alpha_max_deg=70.0):
        self.p = params
        self.alpha_max = np.radians(alpha_max_deg)
        self.side = 1.0

    def estimate_wind(self):
        return (0.0, 0.0)

    def command(self, state, target_xy, wind_vec, height):
        """Return (turn, alpha, distance_left, budget).

        Two regimes, and which one you are in is decided by a single
        comparison -- how much path you have left versus how far away you are.

            d / budget >= cos(alpha_max)   ->  WEAVE in at angle arccos(d/budget)
            d / budget <  cos(alpha_max)   ->  too high even for the steepest
                                               weave, so ORBIT and wait

        The orbit phase is not decoration. Without it, a vehicle with lots of
        spare height weaves at its maximum angle, still closes on the target at
        cos(alpha_max) of its speed, sails straight over the top and then has
        to chase the target from the far side. In testing that produced a
        near-constant 19 m miss: it reached the target at 6 s with 20 m of
        height still to lose, and spent the rest of the flight running away
        from it.

        Orbiting makes ZERO net progress, which is exactly what you want when
        you are early. As height bleeds off, budget shrinks, d/budget rises,
        and the vehicle rolls out of the orbit into the weave and then into a
        straight final approach all on its own -- no mode-switching logic, just
        one inequality.
        """
        v_h, v_z, R = self.p["v_h"], self.p["v_z"], self.p["R"]
        x, y, th = state

        t = height / v_z
        budget = v_h * t
        tgt_air = air_frame_target(target_xy, wind_vec, t)

        dx, dy = tgt_air[0] - x, tgt_air[1] - y
        d = np.hypot(dx, dy)
        bearing = np.arctan2(dy, dx)

        if budget <= 1e-9:
            return 0.0, 0.0, d, budget

        # Use the DUBINS length, not the straight-line distance, to decide how
        # much spare path we have. The straight line pretends the vehicle is
        # already pointing at the target; in reality it may need most of a
        #half circle just to come round, and that turn is path it has to spend.
        #
        # Ignoring it caused a specific failure: released pointing the wrong
        # way, the guidance saw a small d/budget, concluded it had height to
        # burn, and weaved at 63 degrees while ALSO turning 131 degrees to get
        # on the bearing. By the time it was aligned the budget was gone and it
        # landed 16 m short. Charging the turn to the budget removes the
        # illusion of spare height.
        turn_path = DB.solve((x, y, th), (tgt_air[0], tgt_air[1], bearing), R)
        d_eff = turn_path["length"] if turn_path is not None else d

        ratio = d_eff / budget

        if ratio < np.cos(self.alpha_max):
            # ---- ORBIT: hold station until the numbers come good ----------
            # Tangential heading, pulled in or pushed out to settle on a circle
            # of radius R about the target.
            radial_err = np.clip((d - R) / max(R, 1e-6), -1.0, 1.0)
            desired = bearing + self.side * (np.pi / 2.0
                                             - radial_err * np.pi / 2.0)
            alpha = self.alpha_max
        else:
            # ---- WEAVE: cos(alpha) = d / budget ---------------------------
            alpha = np.arccos(np.clip(ratio, -1.0, 1.0))
            err = _wrap(th - bearing)
            if self.side > 0 and err > alpha:
                self.side = -1.0
            elif self.side < 0 and err < -alpha:
                self.side = 1.0
            desired = bearing + self.side * alpha

        turn = np.sign(_wrap(desired - th))
        return float(turn), float(alpha), float(d), float(budget)


def _wrap(a):
    """Wrap an angle to (-pi, pi]."""
    return (a + np.pi) % (2.0 * np.pi) - np.pi
