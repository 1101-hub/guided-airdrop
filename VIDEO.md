# 2-minute video script

**Airdrop Trajectory Optimisation for Disaster Relief**
*Guiding Supply Packages to a Target in Unknown Wind*

~330 words. Read at a normal pace, don't rush. Silence during both animations.

---

### 0:00 — 0:12 · COLD OPEN
**ON SCREEN:** the uncontrolled drop animation, playing

> "A box of food, dropped to a flooded village. Nobody steering it."

*(let it land — say nothing)*

> "It missed by forty-seven metres."

---

### 0:12 — 0:33 · THE PROBLEM
**ON SCREEN:** Assam flood footage, or the 7,05,000 slide

> "This July, seven lakh people in Assam were cut off. Nine tonnes of supplies went in by
> helicopter — pushed out of the door, because there was nowhere to land.
>
> The Chief Minister said they would attempt *targeted* drops. If you have to promise that, the
> ones you're doing aren't."

---

### 0:33 — 0:52 · THE QUESTION
**ON SCREEN:** title card

> "So — what if the parachute steered itself?
>
> Armies do it, at tens of thousands of dollars a unit. Hobbyists have done it cheaply. **I'm not
> first.**
>
> But nobody writes down the thing you need before you build one: **how close can it possibly land,
> and what stops it doing better?**"

---

### 0:52 — 1:06 · HOW IT STEERS
**ON SCREEN:** round chute drifting vs parafoil gliding

> "An ordinary parachute is a leaf in a river — it goes where the air goes.
>
> A parafoil is a wing. Falling is its engine, so it moves *across* the river instead of down it.
> Pull a string, it turns."

---

### 1:06 — 1:18 · THE ROUTE
**ON SCREEN:** the two Dubins routes, 228 m vs 265 m

> "It can only turn left, turn right, or go straight. Dubins proved the shortest route is always
> three of those, in one of six orders.
>
> So it checks six, and takes the smallest."

---

### 1:18 — 1:36 · THE WIND
**ON SCREEN:** identical-then-different comparison

> "But it has no wind sensor. And flying straight, a headwind looks **identical** to just flying
> slowly.
>
> Turn — and they separate.
>
> And it's already turning, to burn off spare height. **The move that fixes the timing is the same
> one that finds the wind.**"

---

### 1:36 — 1:47 · THE PAYOFF
**ON SCREEN:** the guided drop animation

> "Same box. Same wind. Only the maths changed."

*(let it land — say nothing)*

> "Forty-seven metres, down to two."

---

### 1:47 — 1:57 · RESULTS
**ON SCREEN:** the results table

> "Across a hundred and fifty drops, the median miss halved — and it beat being *handed* the true
> wind, because a twelve-degree compass error costs more than not knowing the weather."

---

### 1:57 — 2:10 · THE FINDING
**ON SCREEN:** the design chart

> "And the finding: **accuracy is capped by the square of the wind you design for.**
>
> Build it tough for wind you'll never meet, and every single drop gets worse."

---

## Recording notes

- **Don't talk over the two animations.** The silence is the strongest part.
- Slow down on *"it missed by forty-seven metres"* and *"forty-seven metres, down to two."*
- The line to land hardest: **"the move that fixes the timing is the same one that finds the wind."**
- Say **"I'm not first"** plainly. It buys credibility for everything after it.

---

## 300-character writeup (IMRAD)

```
I: Airdropped relief supplies drift and miss. M: Modelled a self-steering parafoil — Dubins path
planning plus a Kalman filter inferring wind from GPS alone; 150 simulated drops. R: Median miss
8.6→3.9 m. D: Accuracy is capped by the square of the design wind speed.
```

**266 characters.**
