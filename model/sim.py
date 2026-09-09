"""
Full descent simulation: fly the plan and see where it actually lands.

This is where the pieces meet. The planner (guidance.py) says what route to
fly; this steps the parafoil along, second by second, under a wind that may not
be the wind the planner was told about -- and reports the miss distance.

Receding horizon
----------------
The plan is not computed once and blindly followed. It is recomputed every
control step from wherever the parafoil actually is, and only the FIRST
instruction ("turn left", "go straight") is obeyed before replanning.

That sounds wasteful but it is the standard approach in real guidance, and it
matters here because it makes the system self-correcting: if wind pushes it off
the intended route, the next plan simply starts from the new position and works
out a fresh route. Errors do not accumulate.

The honest experiment
---------------------
`wind_true` is what the air actually does. `wind_assumed` is what the guidance
believes. Setting them differently is the whole point -- it measures how much
accuracy is lost by not knowing the wind, which is exactly the error the
Kalman filter is meant to remove.
"""

import numpy as np

import dubins as DB
import guidance as G


def steer_command(path, ds):
    """Which way to turn right now: +1 left, -1 right, 0 straight.

    Reads the first segment of the Dubins plan. If that segment is almost
    finished, look at the next one instead, so the controller does not dither
    on a segment boundary.
    """
    if path is None:
        return 0.0
    kinds = path["type"]
    lens = (path["t"], path["p"], path["q"])
    for k, L in zip(kinds, lens):
        if L > ds * 0.5:
            return {"L": 1.0, "S": 0.0, "R": -1.0}[k]
    return 0.0


def simulate(target, wind_true, params, height0=30.0, state0=(0.0, 0.0, 0.0),
             wind_assumed=None, dt=0.1, replan_every=1.0, wind_estimator=None,
             gps_noise=0.25, heading_noise_deg=3.0, heading_bias_deg=0.0,
             seed=0):
    """Fly one descent. Returns a dict with the track and the miss distance.

    wind_estimator : optional object with .update(...) and .estimate() used to
                     infer the wind in flight (see ekf.py). When given, the
                     guidance uses the ESTIMATE rather than `wind_assumed`.
    """
    v_h, v_z, R = params["v_h"], params["v_z"], params["R"]
    omega = v_h / R                      # max turn rate, rad/s

    if wind_assumed is None:
        wind_assumed = (0.0, 0.0)

    x, y, th = state0
    z = height0
    wind_true = np.asarray(wind_true, float)

    ctrl = G.WeaveGuidance(params)
    rng = np.random.default_rng(seed)
    h_bias = np.radians(heading_bias_deg)
    h_noise = np.radians(heading_noise_deg)
    track = []
    t = 0.0

    while z > 0.0:
        # What the compass says. Every run has the same physical bias; only
        # a run with the EKF can work out what it is and subtract it.
        th_meas = th + h_bias + rng.normal(0.0, h_noise)

        if wind_estimator is not None:
            w_guess = np.asarray(wind_estimator.estimate(), float)
            th_ctrl = th_meas - wind_estimator.bias      # bias-corrected
        else:
            w_guess = np.asarray(wind_assumed, float)
            th_ctrl = th_meas                            # stuck with the bias

        turn, alpha, d_left, budget = ctrl.command((x, y, th_ctrl), target, w_guess, z)
        mode = "weave" if alpha > 0.05 else "approach"

        # --- integrate one step ------------------------------------------
        th = th + turn * omega * dt
        v_air = np.array([v_h * np.cos(th), v_h * np.sin(th)])
        v_ground = v_air + wind_true

        if wind_estimator is not None:
            # The filter only ever sees what a real vehicle can measure: a
            # compass reading (biased and noisy) and a GPS velocity (noisy).
            # It never sees wind_true, and it is not told the true airspeed.
            vg_meas = v_ground + rng.normal(0.0, gps_noise, 2)
            wind_estimator.update(th_meas, vg_meas, dt)

        x += v_ground[0] * dt
        y += v_ground[1] * dt
        z -= v_z * dt
        t += dt

        track.append((t, x, y, max(z, 0.0), th,
                      w_guess[0], w_guess[1],
                      1.0 if mode == "loiter" else 0.0))

        if t > 10000:
            break

    track = np.array(track)
    miss = float(np.hypot(x - target[0], y - target[1]))
    return {"track": track, "miss": miss, "landing": (x, y), "t_total": t}
