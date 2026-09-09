"""
Dubins paths -- the shortest route for something that cannot turn sharply.

The problem
-----------
You are at a point, pointing in some direction. You want to reach another
point, pointing in some direction. You can only go forwards, and you cannot
turn tighter than radius R.

What is the shortest path?

A straight line is usually not allowed -- it would need you to turn on the spot
at each end. So the answer is some combination of turning and going straight.

Dubins' theorem (1957)
----------------------
The shortest path is ALWAYS one of just six shapes:

    LSL   left turn,  straight, left turn
    LSR   left turn,  straight, right turn
    RSL   right turn, straight, left turn
    RSR   right turn, straight, right turn
    RLR   right, left, right      (all arcs, no straight bit)
    LRL   left, right, left

That is the whole answer. Not "some curve found by a computer" -- six named
shapes, each with a closed-form formula. You compute all six, discard the ones
that are geometrically impossible for this pair of points, and take the
shortest survivor.

That is a genuinely beautiful result: an infinite-dimensional problem ("what is
the best possible curve?") collapses to picking the smallest of six numbers.

Why it matters here
-------------------
A parafoil under one brake line turns at a roughly fixed radius. So "how should
it fly to the target" is exactly a Dubins problem, and the answer is exact
rather than approximate.

Everything below works in units of R by normalising first, which is the
standard trick and keeps the formulas readable.
"""

import numpy as np

TYPES = ("LSL", "LSR", "RSL", "RSR", "RLR", "LRL")


def _mod2pi(x):
    """Wrap an angle into [0, 2*pi). Turning by -30 degrees is the same as
    turning by 330, and the formulas below assume the positive version."""
    return x - 2.0 * np.pi * np.floor(x / (2.0 * np.pi))


# ---------------------------------------------------------------------------
# The six closed-form solutions
#
# Each returns (t, p, q) = the three segment lengths in units of R, or None if
# that shape cannot connect these two configurations. For the CSC families t
# and q are turn ANGLES in radians and p is a straight LENGTH; for the CCC
# families all three are angles. Working in units of R makes arc length and
# angle numerically identical, which is why one formula covers both.
# ---------------------------------------------------------------------------

def _lsl(a, b, d):
    tmp = np.arctan2(np.cos(b) - np.cos(a), d + np.sin(a) - np.sin(b))
    p_sq = 2 + d * d - 2 * np.cos(a - b) + 2 * d * (np.sin(a) - np.sin(b))
    if p_sq < 0:
        return None
    return _mod2pi(-a + tmp), np.sqrt(p_sq), _mod2pi(b - tmp)


def _rsr(a, b, d):
    tmp = np.arctan2(np.cos(a) - np.cos(b), d - np.sin(a) + np.sin(b))
    p_sq = 2 + d * d - 2 * np.cos(a - b) + 2 * d * (np.sin(b) - np.sin(a))
    if p_sq < 0:
        return None
    return _mod2pi(a - tmp), np.sqrt(p_sq), _mod2pi(-b + tmp)


def _lsr(a, b, d):
    p_sq = -2 + d * d + 2 * np.cos(a - b) + 2 * d * (np.sin(a) + np.sin(b))
    if p_sq < 0:
        return None
    p = np.sqrt(p_sq)
    tmp = (np.arctan2(-np.cos(a) - np.cos(b), d + np.sin(a) + np.sin(b))
           - np.arctan2(-2.0, p))
    return _mod2pi(-a + tmp), p, _mod2pi(-_mod2pi(b) + tmp)


def _rsl(a, b, d):
    p_sq = d * d - 2 + 2 * np.cos(a - b) - 2 * d * (np.sin(a) + np.sin(b))
    if p_sq < 0:
        return None
    p = np.sqrt(p_sq)
    tmp = (np.arctan2(np.cos(a) + np.cos(b), d - np.sin(a) - np.sin(b))
           - np.arctan2(2.0, p))
    return _mod2pi(a - tmp), p, _mod2pi(b - tmp)


def _rlr(a, b, d):
    tmp = (6.0 - d * d + 2 * np.cos(a - b) + 2 * d * (np.sin(a) - np.sin(b))) / 8.0
    if abs(tmp) > 1.0:
        return None
    p = _mod2pi(2 * np.pi - np.arccos(tmp))
    t = _mod2pi(a - np.arctan2(np.cos(a) - np.cos(b),
                               d - np.sin(a) + np.sin(b)) + p / 2.0)
    return t, p, _mod2pi(a - b - t + p)


def _lrl(a, b, d):
    tmp = (6.0 - d * d + 2 * np.cos(a - b) + 2 * d * (np.sin(b) - np.sin(a))) / 8.0
    if abs(tmp) > 1.0:
        return None
    p = _mod2pi(2 * np.pi - np.arccos(tmp))
    t = _mod2pi(-a + np.arctan2(-np.cos(a) + np.cos(b),
                                d + np.sin(a) - np.sin(b)) + p / 2.0)
    # The final arc has to close the remaining heading change, which means
    # subtracting the first arc t. An earlier version wrote "+ 2*p" here and
    # omitted the "- t"; the endpoint self-check caught it as a 15 m miss.
    return t, p, _mod2pi(_mod2pi(b) - a - t + _mod2pi(p))


_SOLVERS = {"LSL": _lsl, "LSR": _lsr, "RSL": _rsl,
            "RSR": _rsr, "RLR": _rlr, "LRL": _lrl}


# ---------------------------------------------------------------------------

def solve(start, end, R, only=None):
    """Shortest Dubins path from `start` to `end`.

    start, end : (x, y, heading_radians)
    R          : minimum turn radius
    only       : restrict to a subset of the six types (used by the energy
                 management search, which sometimes wants a LONGER path)

    Returns a dict with the type, the three segment lengths in metres, and the
    total length -- or None if nothing connects them (which cannot actually
    happen for R > 0, but we guard anyway).
    """
    x0, y0, th0 = start
    x1, y1, th1 = end

    dx, dy = x1 - x0, y1 - y0
    D = np.hypot(dx, dy)
    d = D / R                        # normalise: everything in units of R

    phi = np.arctan2(dy, dx)
    a = _mod2pi(th0 - phi)           # start heading, relative to the line
    b = _mod2pi(th1 - phi)           # end heading, relative to the line

    best = None
    for name in (only or TYPES):
        out = _SOLVERS[name](a, b, d)
        if out is None:
            continue
        t, p, q = out
        length = (t + p + q) * R
        if best is None or length < best["length"]:
            best = {"type": name, "t": t * R, "p": p * R, "q": q * R,
                    "length": length, "R": R, "start": start, "end": end}
    return best


def sample(path, step=0.5):
    """Turn a solved path into (x, y, heading) points for plotting or flying.

    Walks along the path in small steps, turning left, going straight, or
    turning right according to which segment we are in.
    """
    if path is None:
        return np.empty((0, 3))

    R = path["R"]
    modes = {"L": +1.0, "S": 0.0, "R": -1.0}
    segs = list(zip(path["type"], (path["t"], path["p"], path["q"])))

    x, y, th = path["start"]
    pts = [(x, y, th)]

    for kind, seg_len in segs:
        turn = modes[kind]
        n = max(int(np.ceil(seg_len / step)), 1)
        ds = seg_len / n
        for _ in range(n):
            if turn == 0.0:
                x += ds * np.cos(th)
                y += ds * np.sin(th)
            else:
                dth = turn * ds / R          # arc length = R * angle
                # exact arc step, not a straight-line approximation
                cx = x - turn * R * np.sin(th)
                cy = y + turn * R * np.cos(th)
                th_new = th + dth
                x = cx + turn * R * np.sin(th_new)
                y = cy - turn * R * np.cos(th_new)
                th = _mod2pi(th_new)
            pts.append((x, y, th))

    return np.array(pts)


def endpoint_error(path):
    """How far the sampled path finishes from where it was supposed to.

    A self-check. If the closed-form maths and the step-by-step flying agree,
    this is essentially zero. If it is not, one of them is wrong -- and a test
    that can fail is worth more than one that cannot.
    """
    pts = sample(path, step=0.05)
    if len(pts) == 0:
        return np.inf
    x1, y1, th1 = path["end"]
    dx = pts[-1][0] - x1
    dy = pts[-1][1] - y1
    dth = abs(_mod2pi(pts[-1][2] - th1))
    dth = min(dth, 2 * np.pi - dth)
    return np.hypot(dx, dy), dth
