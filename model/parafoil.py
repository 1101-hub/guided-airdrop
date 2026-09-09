"""
Steady descent physics for a guided parafoil.

The whole project rests on one idea: a parafoil does not fall, it GLIDES. That
means from height h it can reach anywhere within roughly E*h of the release
point, where E is the glide ratio -- and "anywhere within a circle" is what
makes steering to a target possible at all.

Everything here follows from three numbers:

    E   glide ratio          how far forward per metre down
    V   airspeed             how fast it moves through the air
    R   min turn radius      how tightly it can turn

and the single most important derived quantity, which decides whether the
project works at all:

    WIND PENETRATION.  If the wind is faster than the parafoil's airspeed, it
    physically cannot fly upwind. It gets blown backwards no matter what the
    guidance says. Everything downstream depends on V > wind speed.

That constraint is what sizes the hardware, and it is the reason wing loading
matters more than anything else you can choose.
"""

import numpy as np

RHO = 1.225      # air density, kg/m^3
G = 9.81


# ---------------------------------------------------------------------------
# Steady glide
# ---------------------------------------------------------------------------

def airspeed(mass, area, cl):
    """Speed along the glide path, from the lift equation.

        L = 1/2 rho V^2 S C_L  must support the weight, so

        V = sqrt( 2 m g / (rho S C_L) )

    Note what this depends on: mass over area. That ratio is WING LOADING, and
    it is the single most important design choice you make.

      * light loading  -> slow flight -> lots of time to steer, but the thing
                          gets blown around by any breeze
      * heavy loading  -> fast flight -> punches through wind, but less time
                          in the air and a harder landing

    A skydiving canopy runs 5-8 kg/m^2. A toy parafoil with a 0.5 kg payload on
    1 m^2 runs 0.5 kg/m^2, which is TEN TIMES lighter -- and correspondingly
    slow. That is the central hardware trade-off in this project.
    """
    return np.sqrt(2.0 * mass * G / (RHO * area * cl))


def glide_state(mass, area, cl, cd):
    """Return (glide ratio E, horizontal speed, sink rate), all steady-state.

    In a steady glide the flight path is tilted below horizontal by an angle
    gamma with tan(gamma) = 1/E. So:

        horizontal speed = V cos(gamma)
        sink rate        = V sin(gamma)

    For E of 3 or more, gamma is small and these are close to V and V/E, but
    we do it properly because small parafoils have low E where it matters.
    """
    E = cl / cd
    gamma = np.arctan2(1.0, E)          # glide path angle below horizontal
    V = airspeed(mass, area, cl) * np.sqrt(np.cos(gamma))
    return E, V * np.cos(gamma), V * np.sin(gamma)


def turn_radius(v_horizontal, bank_deg=None, turn_rate_deg_s=None):
    """Minimum turn radius, from either a bank angle or a measured turn rate.

    Two ways to get this:

      * from bank angle:  R = v^2 / (g tan(phi))   -- the standard coordinated
        turn result. A parafoil under brake input banks modestly, maybe 15-25
        degrees.

      * from a measured turn rate:  R = v / omega  -- better, because for a
        real parafoil you just time a 360 and divide.

    Measure it once you have hardware; until then estimate from bank.
    """
    if turn_rate_deg_s is not None:
        return v_horizontal / np.radians(turn_rate_deg_s)
    if bank_deg is None:
        bank_deg = 20.0
    return v_horizontal ** 2 / (G * np.tan(np.radians(bank_deg)))


# ---------------------------------------------------------------------------
# Wind
# ---------------------------------------------------------------------------

def can_penetrate(v_horizontal, wind_speed):
    """Can it make ANY headway against the wind?

    This is a hard yes/no, and it is the first thing to check for any design.
    Ground speed flying straight upwind is (V - W). If that is negative the
    parafoil moves backwards relative to the ground however it is steered.
    No guidance law fixes this. It is geometry.
    """
    return v_horizontal > wind_speed


def ground_velocity(v_horizontal, heading_rad, wind_vec):
    """Velocity over the ground = velocity through the air + wind.

    The 'wind triangle'. heading is the direction the parafoil is POINTED;
    the direction it actually travels is generally different.
    """
    air = np.array([v_horizontal * np.cos(heading_rad),
                    v_horizontal * np.sin(heading_rad)])
    return air + np.asarray(wind_vec, dtype=float)


# ---------------------------------------------------------------------------
# What ground can it actually reach?
# ---------------------------------------------------------------------------

def reachable_set(height, v_horizontal, sink_rate, wind_vec, n=200):
    """The set of ground points reachable from a release at `height`.

    Geometry: time aloft is t = height / sink_rate, fixed. In that time the air
    mass itself moves by wind*t, and within that moving air the parafoil can
    reach anywhere inside a circle of radius V*t.

    So the reachable region is a CIRCLE OF RADIUS V*t, whose centre is
    DISPLACED DOWNWIND by wind*t.

    That is a genuinely useful picture:
      * no wind -> circle centred on the release point
      * wind    -> circle slides downwind
      * when wind*t exceeds V*t (i.e. wind > V) the release point is no longer
        inside its own reachable set -- you cannot get back to where you
        started, which is the penetration failure above, drawn.

    Returns (centre_xy, radius, boundary_points).  Ignores turn radius, so it
    is an upper bound -- the true set is slightly smaller. Good enough for
    sizing.
    """
    t = height / sink_rate
    centre = np.asarray(wind_vec, dtype=float) * t
    radius = v_horizontal * t

    a = np.linspace(0, 2 * np.pi, n)
    boundary = centre[None, :] + radius * np.stack([np.cos(a), np.sin(a)], axis=1)
    return centre, radius, boundary


def target_reachable(height, v_horizontal, sink_rate, wind_vec, target_xy):
    """Is a target at target_xy (relative to release) reachable?"""
    centre, radius, _ = reachable_set(height, v_horizontal, sink_rate, wind_vec)
    return np.linalg.norm(np.asarray(target_xy, float) - centre) <= radius


# ---------------------------------------------------------------------------
# The question that sizes the whole project
# ---------------------------------------------------------------------------

def minimum_height(v_horizontal, sink_rate, R, wind_speed, margin_turns=2.0):
    """Roughly how high do you have to drop from for guidance to mean anything?

    Two separate requirements, and you need whichever is larger:

    1. TIME TO MANOEUVRE. If the parafoil cannot complete a couple of turns
       before it lands, guidance is pointless -- it will hit the ground still
       pointing wherever it happened to start. Needing `margin_turns` full
       circles gives

           t_needed = margin_turns * (2 pi R / V)

    2. WIND DRIFT RECOVERY. Drifting downwind at (wind) for time t, it must be
       able to fly back. Being able to cover its own drift needs V > wind,
       which is the penetration condition again.

    Returns the height in metres. This is THE number that decides whether a
    stairwell is enough or whether you need the kite.
    """
    t_turns = margin_turns * (2.0 * np.pi * R / v_horizontal)
    return t_turns * sink_rate


def describe(mass, area, cl, cd, wind_speed, bank_deg=20.0):
    """Human-readable summary of one design. Print this while choosing parts."""
    E, vh, vz = glide_state(mass, area, cl, cd)
    R = turn_radius(vh, bank_deg=bank_deg)
    load = mass / area
    ok = can_penetrate(vh, wind_speed)

    lines = [
        "  wing loading      %.2f kg/m^2" % load,
        "  glide ratio E     %.2f" % E,
        "  airspeed          %.2f m/s  (horizontal)" % vh,
        "  sink rate         %.2f m/s" % vz,
        "  turn radius       %.1f m  at %.0f deg bank" % (R, bank_deg),
        "  time per 360      %.1f s" % (2 * np.pi * R / vh),
        "  wind %.1f m/s     %s" % (
            wind_speed,
            "CAN penetrate (margin %.1f m/s)" % (vh - wind_speed) if ok
            else "CANNOT penetrate -- blown downwind, guidance is useless"),
        "  min drop height   %.0f m  (for 2 full turns)" % minimum_height(
            vh, vz, R, wind_speed),
    ]
    return "\n".join(lines)
