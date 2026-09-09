"""
The design chart: what should you actually build?

One number decides almost everything about a parafoil: WING LOADING, the
payload mass divided by the canopy area. From it follow

    airspeed      v ~ sqrt(loading)
    turn radius   R ~ v^2 ~ loading          (rises LINEARLY)
    sink rate     ~ v ~ sqrt(loading)

and those pull in opposite directions:

  * TOO LIGHT and the parafoil is slower than the wind. It cannot fly upwind
    at all, gets blown away, and no guidance helps. Hard failure.

  * TOO HEAVY and the turn radius grows. Since you cannot correct an error
    smaller than your own turning circle in the last seconds, turn radius is
    an accuracy FLOOR. It also cuts the time aloft, leaving less room to
    manoeuvre.

Combining the two gives the result that matters:

    loading needed to beat wind W   ~  W^2
    so the best achievable radius   ~  W^2

Accuracy is capped by the square of the wind speed, and the right design is
the LIGHTEST one that still penetrates the wind you expect -- with a margin,
not with a factor of ten. Over-building for wind you will not meet costs you
accuracy on every drop.
"""

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap

import parafoil as PF
import sim as S
import ekf as K

RAMP = LinearSegmentedColormap.from_list(
    "miss", ["#F7FBFC", "#CDE8EC", "#8FCBD4", "#3E9DAC", "#1C6B7C", "#0B3742"])
INK, INK2, INK3, LINE = "#12181C", "#46545C", "#74848C", "#DDE2E4"
ACC = "#F0407A"

CL, CD, BANK = 0.80, 0.27, 20.0


def median_miss(loading, wind_speed, n=12, height=30.0, seed=0):
    """Median miss over n random drops at this loading and wind speed."""
    E, vh, vz = PF.glide_state(loading, 1.0, CL, CD)
    if vh <= wind_speed * 1.02:
        return np.nan                       # cannot penetrate: hard failure
    R = PF.turn_radius(vh, bank_deg=BANK)
    params = dict(v_h=vh, v_z=vz, R=R)
    rng = np.random.default_rng(seed)
    out = []
    for i in range(n):
        d = rng.uniform(0, 2 * np.pi)
        w = [wind_speed * np.cos(d), wind_speed * np.sin(d)]
        f = K.WindEKF(va0=vh)
        r = S.simulate((20.0, 10.0), w, params, height0=height,
                       wind_estimator=f,
                       heading_bias_deg=rng.uniform(-12, 12), seed=int(seed * 997 + i))
        out.append(r["miss"])
    return float(np.median(out))


def chart(path_out="../figures/airdrop_design.png", n_load=13, n_wind=11,
          n_drops=24, cache="_grid.npz"):
    import os
    if cache and os.path.exists(cache):
        z = np.load(cache)
        loads, winds, M = z["loads"], z["winds"], z["M"]
        print("  loaded cached grid")
    else:
        loads = np.linspace(0.25, 2.5, n_load)
        winds = np.linspace(0.0, 4.0, n_wind)
        M = np.full((n_wind, n_load), np.nan)
        for i, w in enumerate(winds):
            for j, L in enumerate(loads):
                M[i, j] = median_miss(L, w, n=n_drops, seed=i * 100 + j)
            print("  wind %.1f m/s done" % w, flush=True)
        if cache:
            np.savez(cache, loads=loads, winds=winds, M=M)

    fig, ax = plt.subplots(figsize=(9.0, 5.8), dpi=200)
    fig.patch.set_facecolor("white")

    masked = np.ma.masked_invalid(M)
    lv = np.linspace(0, min(np.nanmax(M), 16.0), 21)
    cs = ax.contourf(loads, winds, masked, levels=lv, cmap=RAMP, extend="max")
    cl = ax.contour(loads, winds, masked, levels=[2, 4, 6, 8, 12],
                    colors=INK, linewidths=.6, alpha=.45)
    ax.clabel(cl, fmt="%g m", fontsize=7.5, inline=True)

    # region the parafoil simply cannot fly in
    ax.contourf(loads, winds, np.isnan(M).astype(float),
                levels=[0.5, 1.5], colors=["#EFF2F3"])

    # the penetration boundary, airspeed == wind
    vh_of = np.array([PF.glide_state(L, 1.0, CL, CD)[1] for L in loads])
    ax.plot(loads, vh_of, color=ACC, lw=2.0, zorder=5)
    ax.set_ylim(winds[0], winds[-1])      # data range only -- the penetration
    ax.set_xlim(loads[0], loads[-1])      # curve leaves the top, which is fine
    ax.annotate("cannot fly here:\nairspeed is below wind speed",
                xy=(0.60, 3.45), xytext=(0.29, 3.60),
                color=ACC, fontsize=8.5, style="italic", zorder=6, va="top",
                arrowprops=dict(arrowstyle="->", color=ACC, lw=1.0))

    # the recommendation: lightest loading that still beats the wind with margin
    best_L = []
    for w in winds:
        ok = loads[np.array([PF.glide_state(L, 1.0, CL, CD)[1] for L in loads]) > w * 1.35]
        best_L.append(ok[0] if len(ok) else np.nan)
    ax.plot(best_L, winds, "--", color=INK, lw=1.4, zorder=5)
    ax.annotate("lightest design that still\nbeats the wind by 35%",
                xy=(best_L[3], winds[3]), xytext=(1.35, 0.95),
                fontsize=8.5, color=INK, zorder=6,
                arrowprops=dict(arrowstyle="->", color=INK, lw=1.0))

    ax.set_xlabel("Wing loading  (kg / m²)   =  payload mass ÷ canopy area",
                  fontsize=10, color=INK2, labelpad=8)
    ax.set_ylabel("Wind speed  (m/s)", fontsize=10, color=INK2, labelpad=8)
    ax.set_title("How accurately can it hit the target?",
                 fontsize=13.5, color=INK, weight="600", loc="left", pad=30)
    ax.text(0, 1.012, "median miss over %d drops per point · "
            "guidance using the EKF wind estimate · released at 30 m" % n_drops,
            transform=ax.transAxes, fontsize=8.5, color=INK3)

    cb = fig.colorbar(cs, ax=ax, pad=.02)
    cb.set_label("median miss  (m)", fontsize=9, color=INK2)
    cb.outline.set_edgecolor(LINE)
    for sp in ax.spines.values():
        sp.set_color(LINE)
    ax.tick_params(colors=INK3, labelsize=8.5)
    fig.tight_layout()
    fig.savefig(path_out, facecolor="white", bbox_inches="tight")
    print("wrote", path_out)
    return loads, winds, M


if __name__ == "__main__":
    import os
    os.makedirs("../figures", exist_ok=True)
    chart()
