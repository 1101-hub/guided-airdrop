# What to say · 12 slides

Keep this on your phone. The slides show pictures — **you say the words.**

> **Hand them the link.** If a judge wants to touch it themselves:
> **1101-hub.github.io/guided-airdrop** — it works on their phone, no install.
> Letting them move a slider is worth more than anything you can say.

**Pacing:** ~30 s a slide is about 6 minutes. Slides 1 and 9 are the animations — let them play,
don't talk over them.

---

## 1 · A box of food — *say nothing while it plays*

Let it land. Then:

> "That's a box of food going to a flooded village.
> Nobody is steering it.
> It missed by forty-seven metres."

*(pause, then move on)*

---

## 2 · Assam, July

> "This July in Assam, seven lakh people were cut off. Twelve districts. No roads.
>
> The Air Force dropped nine tonnes of food and medicine in ten days — because there was nowhere
> to land.
>
> And this is what the Chief Minister said about those drops:
> *'We will try and attempt targeted drops, so people can get access to relief materials easily.'*
>
> If you have to promise targeted drops — the ones you're doing aren't."

---

## 3 · What if it steered itself?

> "So — what if the parachute steered itself?
>
> Armies already do this. It costs a fortune. A few hobbyists do it cheaply too. **So I'm not
> first**, and they do measure how well theirs land.
>
> But I wanted a different answer. Not *how good is this one*, but **what sets the limit** — what
> makes any of them accurate or not. So I built the whole thing from scratch to find out."

---

## 4 · Why it can be aimed *(point at the drawing)*

> "First — why can it be aimed at all?
>
> A normal round parachute is a **leaf in a river.** It only makes drag. It has no way to move by
> itself, so it just goes wherever the air goes. Twenty seconds of falling in a light breeze puts
> it sixty metres downwind, and it can do nothing about it.
>
> A parafoil is a **wing**. And falling is its engine — it trades height for forward speed, the way
> a bike rolling downhill picks up speed without pedalling. About three metres forward for every
> metre down.
>
> That's the whole difference: it can move **across** the river, instead of just floating down it.
>
> And steering is simple. Pull the left string, it turns left. Two small motors. That's the entire
> machine."

---

## 5 · Picking a route *(point at the circles)*

> "Now — which route does it fly?
>
> Here's the constraint: it can only do **three things.** Turn left in a fixed circle. Turn right in
> a fixed circle. Or go straight. It cannot turn gently — there's nothing in between.
>
> So every possible route is just those three moves stacked up. And a *shortest* route never wastes
> a turn — so it is **never more than three pieces long.**
>
> Three pieces, two possible turn directions. That is only **six routes** that can ever be the
> shortest one.
>
> So I don't search. I work out all six lengths and take the smallest."

**Point at the two drawn routes:**

> "Same start, same target. Go left first and it's 228 metres. Go right first and it's 265. So it
> takes the left one. It checks all six like that, every step."

---

## 6 · Finding the wind — **the best bit** *(point at the two halves)*

> "Now the hard part. It has no wind sensor. So it has to work the wind out for itself.
>
> And here is the problem." *(point at the top half)*
>
> "On the left — it's flying east into a headwind, so GPS says it's going **slower than it should be.**
>
> On the right — no wind at all, it's just flying slowly. GPS says… **slower than it should be.**
>
> **Exactly the same reading.** Two completely different situations, and it cannot tell them apart.
> No amount of data fixes that, because the readings are genuinely identical."

*(pause, then point at the bottom half)*

> "Now it turns. Same two situations, now flying north.
>
> On the left, that headwind is still blowing the same direction — so now it's shoving it
> **sideways.**
>
> On the right, flying slowly is still just… flying slowly. Straight, but short.
>
> **Now they look completely different.** So it can finally tell which one it's in.
>
> And here's the part I like: **it's already turning constantly** — that's how it burns off spare
> height. The move that fixes the timing is the same move that finds the wind. I didn't design
> that. It just fell out."

## 7 · How I tested it *(point at the two boxes)*

> "So how do I know it works? **I set it an exam.**
>
> I make up a situation on the computer — the wind is 1.6 metres per second from the west, drop it
> from 42 metres, target is over there.
>
> **I know all of that, because I typed it in.** But I never show the parachute's software any of it.
> All it gets is what the real parts would give it: a GPS reading that wobbles by a few tenths of a
> metre, and a compass that's a few degrees off — because real compasses sitting next to a battery
> and two motors always are.
>
> Then I just watch where it lands.
>
> That's the whole point. If I gave it the answer sheet, it would land perfectly and the exam would
> mean nothing.
>
> Then I make up a completely new situation — different wind, different height, different compass
> error — and set the exam again. A hundred and fifty times."

---

## 8 · The loop *(point round the circle)*

> "And here's what actually runs.
>
> Nothing is planned in advance. Every twentieth of a second it does five things: **looks** at the
> compass and GPS — **guesses** the wind — **decides** turn left, right or straight — **moves**,
> its own speed plus the wind — and **drops** a bit of height.
>
> Then it throws all of that away and does it again from wherever it now is. About eight hundred
> times on the way down.
>
> That's the important part: it never follows a stored plan. So when the wind pushes it off course,
> there's nothing to recover from — the next answer already includes it."

---

## 9 · Drop it again — *let it play*

> "Same box. Same wind. Same release point.
> The only thing that changed is the maths inside it."

*(let it land)*

> "Forty-seven metres — down to two point four."

---

## 10 · The results

> "And that's not one lucky run.
>
> A hundred and fifty drops. Each one picks a random wind, height and compass error. Then I fly
> that **exact same** situation three times over — once where the software knows nothing, once
> where it works the wind out itself, and once where I cheat and hand it the true wind.
>
> Same everything. The only thing that changes is what it knows.
>
> Knowing nothing: about eight and a half metres off. Working it out itself: under four.
>
> And this is the odd one — **it beats being handed the true wind.** Because knowing the wind
> doesn't help if your compass is twelve degrees off. Working it out fixes both."

---

## 11 · The finding

> "So — the answer to the question I started with.
>
> It's a chain of three steps.
>
> **One:** to fly against a stronger wind, it has to fly faster. Otherwise it just gets blown
> backwards.
>
> **Two:** to fly faster, it has to be heavier for its size.
>
> **Three:** heavier and faster means it turns in a much wider circle. Exactly like a car — double
> the speed and you need four times the room to turn round.
>
> And that wide circle is a **floor on how accurate it can be.** If you're two metres off target
> with a few seconds left, and the tightest turn you can make is a twenty-metre loop, you simply
> cannot fix it.
>
> So: **double the wind you build for, and your landing gets four times worse.** Which means
> building it tough for wind you'll never actually meet makes *every* drop worse — including the
> calm ones."

---

## 12 · Where it stands

> "Phase one is done. The maths specifies the build exactly — one square metre canopy, six hundred
> grams, twenty metre drop, about four thousand rupees.
>
> Phase two, building it and dropping it for real, follows on selection.
>
> That order is deliberate. The maths committed to its numbers first — so the real thing can prove
> it wrong."

---
---

# LIKELY QUESTIONS

### ⭐ "Why not just drop it straight above the target?"

**Expect this. It's the most obvious objection.**

> "Because a parachute doesn't fall straight down — it drifts. It's floating in air that's itself
> moving, so it goes wherever the wind takes it. Twenty seconds of falling in a light breeze is
> sixty metres of drift. From a real drop height it's hundreds.
>
> So to hit by aiming, you'd have to know the wind **at every height, in advance.** Militaries try
> this — they drop a wind sensor first.
>
> But that's still **one guess.** The wind changes with height and changes minute to minute, and a
> round parachute can't correct for any of it. If the guess is wrong, it's wrong all the way down."

**One-liner:** *"A round parachute is one guess with no correction. A guided one is thousands of
small corrections."*

---

### ⭐ "Surely the people who built these already know how accurate they are?"

**Concede instantly, then draw the distinction.**

> "Yes, absolutely. They all measure their own systems. But that gives you **a number for one
> build.** What I wanted was what *determines* accuracy across all of them — how it changes with
> canopy size, weight and wind.
>
> That's why my main result is a rule rather than a number: double the wind you design for and the
> landing gets four times worse, no matter whose parachute it is."

**If pushed — "is that published?"**

> "I don't know. I looked and didn't find it, but it's a big field and I could have missed it. What
> I can say is I worked it out myself and I can show you where it comes from."

---

### "Have you actually built it?"

> "Not yet — and that's deliberate. This phase is the maths and simulation, and that's the
> deliverable. The model tells me exactly what to build: one square metre canopy, six hundred gram
> payload, twenty metre release. Every number worked out, not guessed.
>
> Building first means you fit the maths to whatever you happened to build. This way round, the
> real thing can prove the model wrong."

---

### "How do you know your simulation is right?"

**Your strongest answer. Use it.**

> "I wrote tests that could fail, and two of them did.
>
> For the route planning, I compared the formula's answer against actually stepping along the path
> a centimetre at a time. They disagreed by thirteen metres. Five of the six formulas were exact
> and one had a missing term. I found it, fixed it, and now they agree to twelve decimal places.
>
> A test that always passes tells you nothing."

---

### "This is a maths category — where's the maths?"

> "Almost all of it. The route planning is a 1957 geometry theorem. The wind estimation is a Kalman
> filter — matrices and derivatives. And the main result is a scaling rule: accuracy goes as the
> square of the wind speed.
>
> The parachute is just where the maths gets tested."

---

### "What's a Kalman filter?"

> "A way of estimating something you can't measure directly, from noisy measurements of things you
> can. Mine works out the wind, its own true speed, and how wrong its compass is — from just a GPS
> and a compass.
>
> The clever part is that it tracks **how confident it is.** Very unsure and the sensor looks good?
> It moves a long way toward the reading. Confident and the sensor is noisy? It barely moves. It
> works that balance out every single step."

---

### "What happens in strong wind?"

> "It fails, and I can tell you exactly when. If the wind is faster than the parachute can fly, it
> gets carried backwards whichever way it points. Like swimming upstream in a river flowing faster
> than you can swim. No software fixes that.
>
> You beat more wind by making it heavier, which makes it faster — but heavier also means wider
> turns, and wider turns mean worse accuracy. That trade-off is exactly what my main result is
> about."

---

### "Could it carry enough to be useful?"

> "At this size, under a kilo — so no, not on its own. Real drops are tonnes.
>
> But the maths doesn't care about size, and this is where my result matters: a bigger, heavier one
> flies faster, turns wider, and lands **less** accurately. So you'd use many small accurate ones
> rather than one big inaccurate one. That comes straight out of the model."

---

### "What if the GPS fails?"

> "Then it's flying blind and becomes an ordinary parachute — it lands safely but wherever the wind
> takes it. It could guess from the compass and its known speed for a short while, but the error
> grows. That's a real limitation and I haven't solved it."

---

### "How accurate will it be in real life?"

> "Worse than the simulation — and I'd be suspicious if it weren't. My model leaves out gusts, the
> canopy flexing, and the motors not being perfect. All of those cost accuracy.
>
> That's the point of committing to numbers in advance. When I fly it, the gap between prediction
> and reality tells me which assumption broke."

---

### "What was the hardest part?"

> "Getting the steering to work. My first three attempts all failed differently — one flew straight
> over the target at six seconds with twenty metres of height still to lose, then spent the rest of
> the flight chasing it from the far side. Missed by nineteen metres every time.
>
> The fix was realising it needed to **circle** when it had too much height, instead of trying to
> weave its way in."

---

## IF YOUR MIND GOES BLANK

1. **"A box of food gets dropped and misses by forty-seven metres."**
2. **"It works out the wind itself — and to do that it has to turn, which it's already doing."**
3. **"Double the wind you build for, and the landing gets four times worse."**

---

## IF THEY WANT TO PLAY WITH IT

**1101-hub.github.io/guided-airdrop**

Set it to **wind 2.0, height 30 m, 1.20 kg/m², compass +10°**, then switch between
*Nothing at all* and *Works the wind out itself*: **7.3 m → 3.6 m**, live, in front of them.
