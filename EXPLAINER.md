# What this project is, and the maths behind it

Written to be read start to finish. Assumes school algebra and trigonometry — if you can solve a
quadratic and you know what sine and cosine mean, you have enough. Everything else is built up here.

---

## The one-paragraph version

When floods cut villages off, relief supplies are dropped from helicopters that cannot land. The
packages drift with the wind and miss. Guided parafoils fix this — militaries have used them for
decades, and open-source hobbyist projects have already built cheap ones. **This project is not the
first.** What it does is derive the whole system from first principles and then work out something
the existing projects do not publish: **how accurately such a thing can possibly land, and what
decides that.** The answer comes down to one design number and a clean scaling law.

---

# Part 1 — The problem

Every monsoon, parts of Kerala, Assam and Bihar go under water. Roads disappear. Villages are cut off
for days.

Relief flies in by helicopter, but there is often nowhere dry and solid to land. So the crew pushes
the supplies out of the door and hopes.

They miss. Packages land in floodwater, in trees, on the wrong side of a river from the people who
need them. Food is ruined, medicine is lost, and someone has to wade out and risk their life
retrieving it.

The military answer is **JPADS** — a parachute with a GPS and motors that steer it to a target. It
works well and costs tens of thousands of dollars per unit, because it was built for armies.

## What this project is not

It would be tidy to write "and there is no cheap version, so I built one". **That would be false, and
I checked before publishing it.**

Cheap guided parafoils exist and are open source:

- **[ParaDrone](https://hackaday.io/project/176779-paradrone-autopilot-for-parachutes)** pulls the
  brake toggles with servos, runs on an Arduino-class chip, and plans with **Dubins paths** — the
  same mechanical and algorithmic approach used here, arrived at independently.
- **[R2Home](https://hackaday.com/2021/01/07/gps-guided-parachutes-for-high-altitude-balloons/)**
  does the same for returning high-altitude balloon payloads.
- **[NPS Snowflake](https://nps.edu/web/adsc/snowflake)** is the research platform, landing within
  3 m of target from 3,000 ft.

So the hardware idea, the algorithm and the application are all taken.

## What it is

Those projects are **devices that fly**. None of them publishes an answer to the question a designer
actually has to ask first:

> **Given a canopy this size, a payload this heavy, and this much wind — how close can it possibly
> land, and why?**

That is what this project works out. It derives the flight physics, the guidance and the wind
estimation from scratch, and then maps accuracy across the whole design space. The result is a
scaling law:

```
best achievable accuracy  ∝  (design wind speed)²
```

which says something about the *class* of systems rather than about one more instance of one. It also
says something useful and slightly counterintuitive: building for more wind than you will actually
meet makes every drop worse.

Being clear about this matters. A project that claims to be first and is not gets dismantled by the
first person who has heard of ParaDrone. A project that says "here is the prior art, and here is the
question it leaves open" does not.

---

# Part 2 — How a parafoil flies

## It glides, it does not fall

A round parachute just falls slowly. A **parafoil** is a wing made of cloth: two layers sewn into
cells that are open at the front, so air rams in and inflates them into an aerofoil shape.

Because it is a wing, it **glides**. It travels forwards as it comes down. That forward motion is
the entire reason steering is possible — something that only falls straight down cannot be aimed.

Useful fact: a foil kite *is* a parafoil. Same construction, same physics. The only difference is
that a kite is anchored to the ground and a parafoil carries its payload with it. So the thing you
buy is a small foil kite, and you hang your electronics under it.

## Glide ratio

The number that describes how good a wing is:

```
E  =  lift / drag  =  C_L / C_D
```

It is also, and this is the intuitive version, **how far forward it travels per metre it drops**. A
glide ratio of 3 means 3 metres forward for every 1 metre down. Competition sailplanes reach 50.
Small parafoils manage about 3.

So from height `h`, the furthest it can possibly reach is about `E × h`. From 30 m with E = 3, that
is 90 m of range. That circle of reachable ground is what the guidance works inside.

## Wing loading — the one number that decides everything

Here is the most important idea in the hardware design.

The wing has to hold up the weight. Lift is

```
L = ½ ρ v² S C_L
```

where ρ is air density, v is speed, S is canopy area and C_L is the lift coefficient. Setting lift
equal to weight `mg` and solving for speed:

```
v = sqrt( 2 m g / (ρ S C_L) )   =   sqrt( 2 g / (ρ C_L) )  ×  sqrt( m / S )
```

Look at what survives: **only the ratio `m/S`**. Not the mass on its own, not the area on its own.
That ratio is called **wing loading**, in kg/m².

This is a real, checkable prediction, and the model confirms it: a 1 m² canopy carrying 1.2 kg
behaves *identically* to a 0.5 m² canopy carrying 600 g. Both are 1.2 kg/m². Same speed, same sink
rate, same turn radius.

It also means you have a free choice of canopy size, as long as you pick the payload to match.

## The wind triangle

This is just vector addition, but it is worth being explicit because everything later depends on it.

```
velocity over the ground  =  velocity through the air  +  wind
```

The parafoil always moves at speed `v` through the air, in whatever direction it is pointing. The air
itself is moving. Add the two vectors and you get where it actually goes.

Consequence: **the direction it points is not the direction it travels.** Point north in a westerly
wind and you go north-east. All the guidance maths is really about handling this properly.

## Wind penetration — a hard wall

Now the constraint that decides whether the project works at all.

Fly straight into the wind. Ground speed is `v − W`, where W is the wind speed. If `W > v`, that is
**negative**. You are going backwards over the ground while pointing directly into the wind.

There is no steering strategy that fixes this. No control algorithm, no clever filter. It is
geometry: if the air is moving faster than you can move through it, you go where the air goes.

**So airspeed must exceed the wind speed, always.** And since `v ∝ sqrt(m/S)`, that sets a *minimum*
wing loading:

```
loading needed to beat wind W    ∝    W²
```

A 300 g payload on a 1 m² canopy flies at 2.3 m/s and cannot cope with a 3 m/s breeze. A 1.2 kg
payload on the same canopy flies at 4.5 m/s and can. **Heavier is better here** — which is the
opposite of most people's instinct.

---

# Part 3 — The key simplification

This is the idea that makes the whole problem tractable, and it is worth understanding properly
because everything downstream rests on it.

## Time aloft is fixed at the moment of release

A parafoil descends at a constant sink rate — it settles into steady flight almost immediately and
stays there. So

```
time to the ground  t = height / sink rate
```

and **it does not matter how it flies.** Turn, go straight, spiral, weave — it lands at the same
moment. The clock starts at release and cannot be changed.

Two large consequences follow.

## Consequence 1 — the wind stops being complicated

Over time `t`, the whole body of air slides downwind by exactly `wind × t`.

So instead of solving a hard problem with wind in it, do this: **shift the target upwind by
`wind × t`, and solve the easy no-wind problem instead.**

```
target in the air frame  =  real target  −  wind × t
```

Fly to that shifted point through the air, and the drifting air delivers you to the real target. This
is a **change of reference frame** — the same trick as describing a person walking on a moving train
from the train's point of view instead of the platform's.

What makes it clean here is that `t` is known exactly. In most guidance problems the time of flight
depends on the route you choose, so you have to guess, solve, re-guess. Here there is nothing to
iterate.

## Consequence 2 — the path length is fixed too

If time aloft is fixed and airspeed is fixed, then the distance flown *through the air* is fixed:

```
path budget  =  airspeed × t
```

You will fly exactly that far, no more and no less. And that leads somewhere genuinely surprising.

---

# Part 4 — Dubins paths

## The problem

You are at a point, pointing in some direction. You want to reach another point. You can only go
forwards, and you cannot turn tighter than some radius `R`.

What is the shortest route?

A straight line usually is not available — it would require turning on the spot at each end. So the
answer must be some mix of turning and going straight. But there are infinitely many possible curves.
How do you search them all?

## The theorem

In 1957 Lester Dubins proved you do not have to. The shortest path is **always one of exactly six
shapes**:

```
LSL    left turn,  straight, left turn
LSR    left turn,  straight, right turn
RSL    right turn, straight, left turn
RSR    right turn, straight, right turn
RLR    right, left, right      (all arcs, no straight section)
LRL    left, right, left
```

That is the complete list. Not "a curve some optimiser found" — six named shapes, each with a
closed-form formula you can write down.

So the algorithm is: compute all six, throw away the ones that are geometrically impossible for this
pair of points, take the shortest survivor.

**An infinite-dimensional problem collapses to picking the smallest of six numbers.** That is one of
the most satisfying results in the whole project.

## Why only six

The intuition: to be shortest, you should never turn when you do not have to, and you should never
turn more than you have to. That means every segment is either a maximum-rate turn or a straight
line. Then a bit of case analysis shows only these six orderings can ever win.

## How we know the implementation is right

The formulas are fiddly and easy to get wrong. So there is a test:

1. Use the closed-form formulas to get the three segment lengths.
2. Separately, *actually fly the path* — step along it in tiny increments, turning left, going
   straight, or turning right as the plan says.
3. Check that step-by-step flying finishes where the formula said it would.

If the maths and the flying agree, both are almost certainly right.

**On the first run they did not agree.** The error was 13 m in position and 120° in heading. Testing
each of the six types separately showed five were exact and **LRL** was wrong: my formula for the
final arc had dropped a term. Fixed, and all six now agree to `1e-12` m.

That is the whole argument for writing tests that *can* fail. A test that always passes tells you
nothing.

---

# Part 5 — Energy management

## You do not want the shortest path

Here is the twist that makes this more than a textbook Dubins exercise.

Suppose the direct route to the target is 60 m, but your path budget is 100 m. What happens?

You arrive over the target having flown 60 m — with 40 m of flying still left, which means you are
still up in the air. And then you drift while you come down, and you miss.

**You needed a route of exactly 100 m.** The extra 40 m must be deliberately wasted. Real precision
airdrop calls this **energy management**, because height is stored energy and you have too much of it.

## The trick: fly at an angle

Here is the neat bit. If you fly at an angle `α` off the direct line, your path is longer than the
direct line by exactly `1/cos(α)`.

Why: travelling distance `L` at angle α closes only `L·cos(α)` of the gap. To close a gap of `d` you
must fly `d / cos(α)`.

So to stretch a route of length `d` into a budget `B`, choose:

```
cos(α) = d / B          α = arccos( d / B )
```

- Need 20% more path? `cos α = 1/1.2`, so `α = 33.6°`.
- Need double? `α = 60°`.

Then weave from side to side at that angle so you stay roughly on the line while burning the excess.

The lovely part is that it is **self-correcting with no switching logic**. As height runs out, the
budget `B` shrinks, `d/B` rises toward 1, and `α` falls smoothly to zero — the weave straightens out
into a final approach all by itself.

## When weaving is not enough

If you have a *lot* of spare height, α approaches 90° — flying perpendicular, making no progress. In
practice you have to cap it, and once capped the weave still closes on the target slowly.

That caused a real failure. With the cap at 75°, the parafoil still approached at `cos(75°) = 26%` of
its speed, **reached the target at 6 seconds with 20 m of height still to lose**, sailed over the top,
and spent the rest of the flight chasing it from the far side. Consistent 19 m miss.

The fix is a second mode: when there is too much height even for the steepest weave, **orbit**. Circle
around the target, making exactly zero net progress, until the numbers come good. Then the same
inequality that put you into the orbit takes you out of it:

```
d / budget  <  cos(α_max)     →   orbit
d / budget  ≥  cos(α_max)     →   weave in
```

One comparison, two behaviours, no mode-switching code.

## One more subtlety: charge the turn

A last bug worth knowing about. The energy calculation originally used the **straight-line distance**
to the target — which pretends you are already pointing the right way.

You usually are not. If you are released facing the wrong direction you may need most of a half-circle
just to come round, and that turn is path length you have to spend.

So the calculation now uses the **Dubins length** instead, which includes the cost of turning. Before
that fix, the guidance would see a small `d/budget`, conclude it had height to burn, and weave at 63°
while *also* turning 131° to get on the bearing. By the time it was aligned the budget was gone.

## And a genuine mathematical oddity

While building this, something unexpected turned up. Plot path length against how far back you put
the final approach point, and the curve **jumps** — discontinuously, by almost exactly one full
turning circle.

The reason: as the approach point slides backwards past the vehicle, the *type* of Dubins path that
is shortest suddenly switches (LSR to LSL, say), and the new type has to fit in an extra turn.

The consequence is that **some path lengths are simply not achievable** by stretching the approach —
there are gaps. That broke the first root-finder, which bracketed across the jump and converged on the
edge of the cliff instead of a real solution. Loiter circles are what fill the gaps, since each one
shifts the whole reachable set by exactly one loop.

---

# Part 6 — The Kalman filter

This is the mathematically richest part of the project, and it is the part that produced the headline
result. Let me build it from nothing.

## The basic idea

From the wind triangle:

```
ground velocity = air velocity + wind
```

Rearrange:

```
wind = ground velocity − air velocity
```

- **Ground velocity** comes from GPS. It tells you how fast you are moving over the earth.
- **Air velocity** you know from your own design — you fly at speed `v` (from wing loading) in the
  direction the compass says you are pointing.

Subtract them and you have the wind. **No wind sensor required.**

## So why do we need a filter?

Because every term on the right is imperfect:

- **GPS velocity is noisy** — a few tenths of a m/s, jittering constantly.
- **The compass has a bias.** Magnetic declination differs from true north, and there are servos, a
  battery and wiring sitting centimetres away from it. Being 10° out is entirely normal.
- **True airspeed is not exactly the design value.** The canopy stretches, the payload is not exactly
  what you planned.
- **The wind itself gusts** and changes with height.

Subtract two noisy vectors and you get a noisy answer that jumps around uselessly. Worse, a compass
bias produces a *systematic* error that never averages out.

A **Kalman filter** blends many measurements over time — and, crucially, estimates the compass bias
and the true airspeed *at the same time* as the wind.

## What the filter holds

The **state** — the list of things it is trying to know:

```
x = [ wx, wy, va, b ]

wx, wy   the wind vector, m/s
va       true airspeed, m/s
b        compass bias, radians
```

Four unknowns, estimated from a GPS and a compass.

Alongside the state it keeps a **covariance matrix** `P`, which is its own estimate of how wrong it
might be. Large P means "I am not confident"; small P means "I am fairly sure". This is what makes a
Kalman filter different from a simple average: **it tracks its own uncertainty.**

## The two steps

A Kalman filter alternates between two steps forever.

**Predict.** Guess how the state changes over time. Here the model is "everything stays roughly the
same", so the state is unchanged — but the *uncertainty grows*, because time has passed and the wind
may have shifted:

```
P ← P + Q·dt
```

`Q` is the process noise: how fast each quantity genuinely drifts. Wind gets a large value (gusts,
wind shear); airspeed and compass bias get tiny ones, because they are essentially constant. That
choice matters — it is what lets the filter keep refining the bias instead of forgetting it.

**Update.** A GPS reading arrives. Compare it against what the current estimate *predicts* you should
see:

```
predicted ground velocity:
    h(x) = [ va·cos(θ + b) + wx ,
             va·sin(θ + b) + wy ]

innovation:   y = measured − predicted
```

The innovation is the surprise. If it is zero, your estimate already explained the measurement and
nothing changes. If it is large, something is wrong and the state must move.

**How far to move** is the Kalman gain `K`, and this is the heart of it:

```
K = P Hᵀ (H P Hᵀ + R)⁻¹
```

In words: **weigh your own uncertainty against the sensor's.** If you are very unsure (P large) and
the GPS is good (R small), K is large and you jump most of the way to the measurement. If you are
confident and the sensor is noisy, K is small and you barely move. It automatically finds the right
trade-off, and it updates that trade-off every single step.

## Why "extended"

Look at `h(x)` again. It contains `cos(θ + b)` — the state variable `b` sits inside a cosine. That is
**nonlinear**, and the standard Kalman filter assumes everything is linear.

The Extended Kalman Filter handles this by **linearising**: at each step, work out how much the
prediction would change for a small change in each state variable. That is the **Jacobian** — a
matrix of partial derivatives:

```
H = ∂h/∂x =  [ 1  0   cos(θ+b)   −va·sin(θ+b) ]
             [ 0  1   sin(θ+b)    va·cos(θ+b) ]
```

Read the first row: changing `wx` by 1 changes the predicted eastward velocity by 1. Changing `va` by
1 changes it by `cos(θ+b)`. Changing the bias `b` a little changes it by `−va·sin(θ+b)`. Each entry
is "how sensitive is this prediction to this unknown".

Then you use the ordinary Kalman equations with `H` in place of the linear model. It is an
approximation — valid because the errors are small enough that the curve looks straight nearby.

Worth being honest about: with a perfectly known heading, this problem is *linear* and a plain Kalman
filter would do. **The compass bias is what genuinely makes it an EKF** — and the bias is real.

## Observability — the most interesting idea here

Here is a question that looks like it should have an obvious answer, and does not.

Fly on a fixed heading with a 1 m/s headwind. Now instead fly the same heading with no wind, but 1 m/s
slower through the air. **What does the GPS see?**

Exactly the same thing. Ground speed 1 m/s lower than expected, in both cases.

The two explanations are **indistinguishable**. No amount of data collected on that one heading can
separate them, because they produce identical measurements. The system is *unobservable*.

Now **turn**.

The wind stays pointing the same way in the world — it does not care which way you face. But the
airspeed contribution rotates with you. After a 90° turn, a headwind has become a crosswind, while an
airspeed error is still straight ahead. **They now look completely different**, and a few seconds of
data separates all four unknowns.

This is *observability*, and it is a real and important concept in estimation: some quantities are
simply not determinable from certain trajectories, no matter how good your filter or how much data
you collect. You must move in a way that excites them.

**And here is the part that pleases me most about this project.** The parafoil is already turning
constantly — that is how the guidance burns off excess height. The manoeuvre that manages energy is
the *same manoeuvre* that makes the wind observable.

Nothing extra had to be added. The two requirements happen to want the same behaviour.

---

# Part 7 — Testing honestly

## Why one number is a bad result

"The parafoil lands 3 m from the target" is not a result. Which drop? What wind? What height? Pick
your best run and you can claim anything.

So every result here comes from a **Monte Carlo**: run the whole thing hundreds of times with randomly
drawn conditions — wind speed and direction, release height, compass bias, GPS noise — and report the
distribution.

The **median** is the honest headline. The **90th percentile** tells you how bad a bad day is.

## Comparing fairly

To claim the filter helps, you must compare it against the alternative *on identical conditions*:
same wind, same height, same random seed, same everything, changing only what the guidance believes.

There was a subtle unfairness in the first version, worth recording because it is easy to do
accidentally. The **controller was steering using the true heading**, while only the filter saw the
biased compass. That flatters the no-filter case, because it silently gave it a perfect compass it
would not have in reality. Fixed: every run now steers by the compass, as a real vehicle would.

## The result

150 drops. Wind 0–3.2 m/s from any direction, release 20–60 m, compass bias ±12°, GPS noise 0.25 m/s.

| Guidance knows… | Median miss | Within 5 m |
|---|---|---|
| Nothing (assumes still air) | 8.57 m | 34% |
| **Wind estimated by the EKF** | **3.89 m** | **56%** |
| The true wind (idealised) | 4.62 m | 53% |

**The filter beats knowing the true wind**, which looked like a bug and is not. Knowing the wind
perfectly does not help if your compass is 12° out — you will confidently fly the wrong way. The
filter fixes both. Perfect wind knowledge fixes only one.

Wind estimated to a median error of **0.10 m/s**, from a GPS and a compass.

---

# Part 8 — The design chart

## Two forces pulling opposite ways

Everything about the hardware comes down to wing loading, and it is pulled in both directions:

**Too light** and airspeed falls below wind speed. Blown away. Hard failure, no recovery.

**Too heavy** and the turn radius grows. From the standard turning result:

```
R = v² / (g·tan φ)          and     v ∝ sqrt(loading)
so                                  R ∝ loading
```

**Turn radius rises linearly with wing loading.** And turn radius is an accuracy floor, because *you
cannot correct an error smaller than your own turning circle in the final seconds*. If you are 3 m off
with 4 seconds left and your tightest turn is a 6 m circle, you cannot fix it.

## The governing result

Combine them:

```
loading needed to beat wind W    ∝  W²
therefore best achievable R      ∝  W²
```

**Accuracy is capped by the square of the wind speed you design for.**

Designing for 4 m/s instead of 3 m/s nearly doubles your turn radius — and therefore your miss
distance — on *every* drop, including the calm ones.

So the right design is **the lightest one that still penetrates the wind you actually expect**, with a
margin, not with a factor of ten. Over-building is not a safe default here; it costs accuracy.

| Expected wind | Min loading | With 40% margin | Turn radius |
|---|---|---|---|
| 2 m/s | 0.23 kg/m² | 0.32 | 1.6 m |
| 3 m/s | 0.53 | 0.74 | 3.5 m |
| 4 m/s | 0.94 | 1.32 | 6.3 m |
| 5 m/s | 1.47 | 2.06 | 9.8 m |

And the practical consequence: **wing loading is tunable on the day.** The canopy is fixed once you
buy it; ballast is not. Carry a few small weights, check the wind, set the loading to match.

---

# Part 9 — What gets built and tested

## The hardware, determined by the model

| Part | Spec | Approx. |
|---|---|---|
| Canopy | small foil kite, ~1 m² | ₹800–1,500 |
| Payload | **0.5–0.8 kg** total | — |
| Servos | 2 × MG90S, pulling the brake lines | ₹400 |
| Brain | ESP32 | ₹400 |
| GPS | NEO-6M or M8N | ₹500 |
| IMU | MPU6050 or BNO085 | ₹200–700 |
| Battery | LiPo + holder | ₹400 |

Expected turn radius 2.5–3.5 m, expected miss ~2 m, **minimum useful release height ~20 m**.

Note that these numbers were *derived*, not guessed. That is the point of doing the model first.

## Getting it up there

**Drop by hand** from a rooftop or stairwell for early testing — enough to check the canopy opens, the
servos pull hard enough, and the electronics survive landing.

**Lift it with a kite** for real altitude. Fly a kite to 50–100 m, hang the parafoil on the line with a
servo-operated release, and trigger it. Free, reusable, no regulations — and it makes the earlier kite
work part of the story rather than abandoned.

## What to measure

The model makes predictions that can be *wrong*, which is what makes this an experiment:

1. **Airspeed and sink rate** should match the wing-loading formula.
2. **Turn radius** — time a full circle, check `R = v/ω` against prediction.
3. **The wind estimate** should agree with a ground anemometer, to a few tenths of a m/s.
4. **The miss distance distribution** should look like the Monte Carlo.
5. **Guidance on versus off** should show the predicted separation.

If they disagree, that disagreement is the interesting result — it points at whichever assumption
broke, and the model says exactly which assumptions were made.

---

# Glossary

| Term | Meaning |
|---|---|
| **Parafoil** | A parachute shaped like a wing, so it glides forward instead of just falling |
| **Glide ratio E** | Lift ÷ drag. How far forward per metre down |
| **Wing loading** | Payload mass ÷ canopy area, kg/m². Sets airspeed, sink rate and turn radius |
| **Wind penetration** | Whether airspeed exceeds wind speed. If not, you are blown backwards |
| **Wind triangle** | ground velocity = air velocity + wind. Vector addition |
| **Air frame** | Reference frame moving with the air. Makes the wind vanish from the problem |
| **Path budget** | Distance flown through the air, = airspeed × time aloft. Fixed at release |
| **Energy management** | Deliberately wasting excess height so you arrive on target, not above it |
| **Dubins path** | Shortest route for a vehicle with a minimum turn radius. Always one of six shapes |
| **Kalman filter** | Estimator that blends noisy measurements while tracking its own uncertainty |
| **State** | The list of quantities being estimated |
| **Covariance P** | The filter's estimate of how wrong it might be |
| **Innovation** | Measured minus predicted. The surprise |
| **Kalman gain K** | How far to move toward a measurement, balancing your uncertainty against the sensor's |
| **Jacobian** | Matrix of partial derivatives. How sensitive each prediction is to each unknown |
| **EKF** | Kalman filter that linearises a nonlinear model using the Jacobian |
| **Observability** | Whether a quantity can be determined at all from the data you are collecting |
| **Monte Carlo** | Running many randomised trials and reporting the distribution |
| **JPADS** | The military guided-airdrop systems this is a cheap answer to |
