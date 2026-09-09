"""
Estimating the wind in flight, with no wind sensor.

The idea
--------
The parafoil knows roughly how fast it moves THROUGH THE AIR -- that comes from
its glide model, and it is set by wing loading. GPS tells it how fast it is
moving OVER THE GROUND. The difference is the wind:

        ground velocity  =  air velocity  +  wind

so                wind  =  ground velocity  -  air velocity

That is the whole principle, and it needs nothing but a GPS and a compass.

So why a filter?
----------------
Because every term on the right is imperfect:

  * GPS velocity is noisy, a few tenths of a m/s
  * the compass has a BIAS -- magnetic declination, and the servos, battery
    and wiring sitting centimetres away from it
  * the true airspeed is not exactly the design value; the canopy stretches,
    the payload is not exactly as planned
  * the wind itself gusts, and changes with height

Subtracting two noisy vectors gives a noisy answer that jumps around. A filter
blends many measurements over time and, crucially, estimates the compass bias
and the true airspeed AT THE SAME TIME as the wind.

The state
---------
        x = [ wx, wy, va, b ]

        wx, wy   wind vector, m/s
        va       true airspeed, m/s
        b        compass bias, radians

The measurement is the GPS ground velocity, and the model is

        z = [ va*cos(theta_meas + b) + wx ,
              va*sin(theta_meas + b) + wy ]

which is NONLINEAR in b -- hence Extended Kalman Filter rather than a plain
one. (Worth being honest about: with a perfectly known heading and airspeed
this problem is linear and a plain Kalman filter would do. The bias term is
what genuinely makes it an EKF, and the bias is real.)

Why turning is essential
------------------------
Sitting on one heading, wind and airspeed error are indistinguishable -- a
headwind of 1 m/s looks exactly like flying 1 m/s slower. You cannot separate
them.

Turn, though, and they behave completely differently: the wind stays pointing
the same way in the world while the airspeed contribution rotates with you. A
few seconds of turning makes all four states observable.

And the parafoil is already turning constantly, because that is how the
guidance burns off excess height. The manoeuvre that manages energy is the
same manoeuvre that makes the wind observable. Nothing extra is needed.
"""

import numpy as np


class WindEKF:
    """Extended Kalman filter estimating [wx, wy, airspeed, compass bias]."""

    def __init__(self, va0, wind0=(0.0, 0.0), bias0=0.0,
                 p_wind=4.0, p_va=0.5, p_bias=0.3,
                 q_wind=0.02, q_va=1e-4, q_bias=1e-6,
                 r_gps=0.25):
        # ---- state ------------------------------------------------------
        self.x = np.array([wind0[0], wind0[1], va0, bias0], dtype=float)

        # ---- covariance: how wrong we think we might be, squared --------
        # Wind starts very uncertain (we know nothing). Airspeed starts fairly
        # well known (we have a glide model). Bias is somewhere in between.
        self.P = np.diag([p_wind, p_wind, p_va, p_bias]) ** 2

        # ---- process noise: how much each state drifts per second -------
        # Wind genuinely changes -- gusts, and shear as it descends -- so it
        # gets the largest value. Airspeed and bias are near-constant, so tiny
        # values, which lets the filter keep refining them instead of forgetting.
        self.Q = np.diag([q_wind, q_wind, q_va, q_bias]) ** 2

        # ---- measurement noise: GPS velocity accuracy -------------------
        self.R = np.eye(2) * r_gps ** 2

        self.n_updates = 0

    # -----------------------------------------------------------------
    def predict(self, dt):
        """Time update. The model is 'everything stays roughly the same',
        so the state is unchanged and only the uncertainty grows."""
        self.P = self.P + self.Q * dt

    def update(self, heading_meas, v_ground_meas, dt=0.1):
        """Measurement update from one GPS velocity reading."""
        self.predict(dt)

        wx, wy, va, b = self.x
        th = heading_meas + b
        c, s = np.cos(th), np.sin(th)

        # Predicted ground velocity given the current state estimate
        h = np.array([va * c + wx, va * s + wy])

        # Jacobian dh/dx -- how each state would change the prediction
        H = np.array([
            [1.0, 0.0, c, -va * s],
            [0.0, 1.0, s,  va * c],
        ])

        y = np.asarray(v_ground_meas, float) - h        # innovation
        S = H @ self.P @ H.T + self.R                   # innovation covariance
        K = self.P @ H.T @ np.linalg.inv(S)             # Kalman gain

        self.x = self.x + K @ y
        I = np.eye(4)
        self.P = (I - K @ H) @ self.P @ (I - K @ H).T + K @ self.R @ K.T

        # Keep airspeed physical -- it cannot be negative or absurd
        self.x[2] = float(np.clip(self.x[2], 0.5, 30.0))
        self.n_updates += 1

    # -----------------------------------------------------------------
    def estimate(self):
        """Best guess at the wind vector."""
        return (float(self.x[0]), float(self.x[1]))

    @property
    def airspeed(self):
        return float(self.x[2])

    @property
    def bias(self):
        return float(self.x[3])

    def wind_sigma(self):
        """One-sigma uncertainty on the wind estimate, m/s. Useful for knowing
        when to start trusting it."""
        return float(np.sqrt(self.P[0, 0] + self.P[1, 1]))
