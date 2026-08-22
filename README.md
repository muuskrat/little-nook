# Little Nook

A Tamagotchi-style pet game with a pet that acts on its own: feed it, give it
water, keep it healthy and happy, earn its love, earn coins from mini-games,
and spend them on food, decorations, and customizing what it looks like.

A secret 🐛 button in the top-left corner of the room gives +100 coins, for
testing — it's deliberately unlabeled and low-opacity rather than a real
player-facing feature; pull it out before shipping anywhere real.

## How the pet's autonomy works

Food and water aren't used instantly — you *place* them in the room (Feed /
Water buttons → "Place in room"), and the pet decides on its own when to go
eat or drink, more eagerly the hungrier/thirstier it is (see `desireChance()`
in [js/main.js](js/main.js)).

**Some decorations are actual destinations, not just scenery.** If you've
placed a Table 🍽️, the pet doesn't just eat at the table — it walks to the
food bowl first, **picks the food up and brings it to the table** (the bowl
disappears from its own spot and travels with the pet, the same little
carried-icon treatment a glass of water gets — see `setCarryingVisual()` in
[js/room.js](js/room.js), now shared by both rather than water-only), then
eats there. If you've placed a Bed 🛏️, it walks over to the bed before
falling asleep instead of dropping off on the spot; when it picks "playing
alone" as an idle activity, it wanders over to whichever placed decoration
is around to play near — a plant, lamp, painting, candle, chair, window,
whatever's there — chosen at random if there's more than one
(`ACTIVITY_DECOR`, `findDecoration()`, and `findPlayableDecoration()` in
[js/main.js](js/main.js)). None of this needs that particular decoration
placed — every one of these falls back to the old in-place behavior (eating
right at the food, falling asleep on the spot, playing wherever it's
standing) if the room doesn't have one.

Water specifically gets **picked up and carried around**: once the pet grabs
a placed water item, it wanders with it, slowly regenerating its water meter
each tick. Every tick there's a small chance it drops the glass instead —
that creates a spill (a mess) at wherever it was standing, and stops the
regen. Messes sit in the room dragging down fun/love/health until you click
them to clean up (+love, +fun). Eating occasionally leaves crumbs behind
too. Every mess gets a small random position offset (`jitterPoint()` in
[js/main.js](js/main.js)) rather than landing exactly on the pet's current
spot — without it, a dropped glass would almost always land in the same
narrow zone, since a drop can happen on the very first tick after pickup,
before the pet has had any chance to wander with it. Each mess also wobbles
in place on its own (`.room-item.kind-mess`'s looping animation in
[css/style.css](css/style.css)); cleaning one removes just that mess's own
element (`removeRoomItem()` in [js/room.js](js/room.js)) rather than a full
`renderRoomItems()` rebuild — a rebuild would restart every *other* mess's
wobble back in perfect sync and could eat a mid-move monkey's transition
the same way any full rebuild can (see moveMonkeyTo()'s comment there),
reading as every mess suddenly resetting and the monkey teleporting.

**The more mess piles up, the worse it gets.** Each of the three penalties
scales with how many messes are on the floor at once (`messCount` in
`applyDecay()`, [js/state.js](js/state.js)) — one mess is a minor drag, a
room full of them is a real problem. Health takes the penalty hardest: its
per-mess rate (`MESS_HEALTH_PENALTY_PER_MIN`) is well above fun's and love's,
so a filthy room is a genuine health hazard, not just an unpleasant one —
and the pet's passive health regen (for a well-cared-for pet with every need
met) is suspended entirely while any mess remains, resuming once the room's
clean again.

The **interact sidebar** (docked to the right of the room, styled like the
bottom action bar) gives direct access to four interactions. None of them
fire the moment you click their button — clicking one *arms* it instead: the
cursor over the room swaps to that action's own icon as a reminder nothing
has happened yet, and it only actually triggers once you click the character
with it armed (`pendingInteraction` in [js/main.js](js/main.js)). Clicking
anything else — the floor, a room item, another button — cancels it. Arming
one also turns off Decorate/Move mode, and vice versa, the same way Decorate
and Move already cancel each other.

**Pet, Play, and Exercise all share one energy-meter mechanic** — a small
gauge shown right on each button, drained by a flat `INTERACT_ENERGY_COST`
per use and refilled on its own over time at the same rate
(`INTERACT_ENERGY_REGEN_PER_MIN` in [js/state.js](js/state.js)), tracked as
three separate stats (`petEnergy`/`playEnergy`/`exerciseEnergy`) so using one
doesn't drain another. Once one's meter is too low, its button greys out and
arming it just shows a toast telling you to wait — checked once when you arm
it and again right when it actually fires, since the meter can drain or
refill in between (`hasInteractEnergy()`/`spendInteractEnergy()` in
[js/main.js](js/main.js), the `INTERACTIONS` map driving all three
identically instead of three near-duplicate copies).

- **Pet** 💗 — a click-and-hold gesture, not a single click, and the only
  one of the three that costs its energy up front (at the start of the
  hold) rather than the moment you click, since there's no single "click" to
  hang the cost off of. The pet holds still the whole time you hold it
  (`stopWalking()`), and a *separate* meter above its head fills for as long
  as you keep holding — release to cash the hold in as love/fun (a quick tap
  barely registers; a longer hold earns more). Fill that meter all the way,
  though, and it tips into annoyed instead: the pet gets mad rather than
  more loved, so overpetting is a real risk, not just a cap. While held, a
  hand icon (reusing the Pet button's own asset) bobs slowly over its head
  and the character does a slow, happy bounce — dips and squishes slightly
  wider on each "pat," lifts and stretches slightly between them — in time
  with it, both driven by a single `.petting` class toggled via
  `setPettingVisual()` in [js/room.js](js/room.js), see the
  `#pet-wrap.petting` rules in [css/style.css](css/style.css).
- **Play** 🧸 — a single click. Raises fun a lot, a little love, and costs a
  bit of sleep (playing is tiring).
- **Exercise** 💪 — also a single click, added later alongside Play as a way
  to burn off food on purpose rather than only ever raising it — lowers food
  and water (working out costs calories and hydration) by flat
  `EXERCISE_FOOD_COST`/`EXERCISE_WATER_COST` amounts, but pays back a little
  health and fun as the fitness benefit (`EXERCISE_HEALTH_GAIN`/
  `EXERCISE_FUN_GAIN`), all in [js/main.js](js/main.js). Gated the same way
  Play is.
- **Scold** ✋ — a single click, no energy meter — lowers both love and fun
  and makes the pet mad (see "Getting mad" below). Plays a quick recoil on
  click too: it turns sideways away from you, direction randomized, and
  springs back (`playScoldFlinch()` in [js/room.js](js/room.js), the
  `.scold-flinch` rule in [css/style.css](css/style.css)) — a transient
  class layered on top of whatever face/body is already showing, separate
  from the sustained "mad" face, so there's nothing for it to clobber and
  no guard flag needed the way the tantrum/trip poses need. Oddly, it also
  turns up a little pocket change — a small random coin bonus (1–4,
  `SCOLD_MONEY_MIN`/`SCOLD_MONEY_MAX` in [js/main.js](js/main.js)), given
  two deliberately hard-to-miss cues rather than a subtle one: a bigger,
  bouncier, gold-and-outlined "+X 🪙" popup over its head
  (`showMoneyParticle()` in [js/room.js](js/room.js), its own `money-float`
  animation rather than reusing the heart particle's subtler one) *and* a
  gold flash on the topbar coin counter itself (`pulseMoneyDisplay()` in
  [js/ui.js](js/ui.js)) — added because the original single small "+X" used
  the same muted palette as the rest of the UI and was easy to miss
  entirely if you weren't looking straight at the character when it
  happened.

The fourth sidebar button, **Move** 👣, is a toggle: clicking the floor only
sends the pet walking there while Move is active (mutually exclusive with
Decorate mode, since both change what a floor click does). The pet's own
autonomous walking — going to eat, drink, or wander — is unaffected either
way; Move only gates movement *you* direct.

When there's nothing urgent to do, the pet picks a random idle activity
every so often — **resting** 💤, **sitting**, or **playing alone** 🧸 (a
small fun boost) — each held for a few seconds before it moves on, all
defined in `IDLE_ACTIVITIES` in [js/main.js](js/main.js). An urgent need
(food/water critically low) interrupts whatever it's doing. It also just
occasionally makes a mess out of boredom, on top of the water-spill and
eating-crumbs messes — small chance, checked every AI tick
(`RANDOM_MESS_CHANCE`).

**There's also a small, mess-scaled chance to trip.** Checked every AI tick
(`tripChance()` in [js/main.js](js/main.js)) — a spotless room only carries
a 0.4% baseline chance, but each mess on the floor adds another 0.8%,
capped at 15%, so a genuinely messy room still trips a lot more often
(there's more to trip over) without it happening constantly (the original
1%/2%/30% figures turned out to happen often enough to feel like a
nuisance rather than an occasional accident). It can happen anytime the
pet's up and about — mid-walk (toward food, water, its table/bed, a play
spot, or just wandering) or standing/carrying in place — but not while
it's settled into a held idle activity (resting, sitting, playing alone) or
already asleep; those are the "it's idle, leave it be" states, gated by
`!idleActivity` and the sleeping check at the top of `aiTick()` — everything
else is fair game. It plays out in two frozen phases — the AI loop pauses
entirely for both, so nothing else can happen mid-trip: first it falls sideways for
about 2 seconds (`TRIP_FALL_MS`) with a crying face, then sits back up for
another 2 seconds (`TRIP_CRY_SIT_MS`) still crying, before returning to
normal. The "fall" is just the existing standing pose's art rotated onto
its side via a CSS transition on `#pet-visual` (see the `.tripped` rules in
[css/style.css](css/style.css)) rather than a separate lying-down redraw —
removing that class at the same moment the body art swaps to the regular
"sitting" pose doubles as the "sits back up" motion, all driven by
`setTripPhase()` in [js/room.js](js/room.js).

**A trip actually hurts** — an instant hit to health and fun the moment it
happens (`TRIP_HEALTH_DAMAGE`/`TRIP_FUN_DAMAGE` in
[js/main.js](js/main.js)), not just a visual gag. If it's out carrying a
drink when it trips, the drink goes flying: several spill messes at once
(`TRIP_SPILL_COUNT`) rather than the usual single accidental-drop spill,
and the drink itself is gone for good — unlike falling asleep mid-carry,
which gently sets the glass down, this one doesn't come back. **Petting it
during the "sitting and crying" half comforts it** — a one-time gesture per
trip (`comfortDuringTrip()`) that recovers half of that trip's own
health/fun loss and gives a little love, distinct from the normal
click-and-hold petting session (no meter, no hold — just an instant
comforting pat). Petting again during the same trip does nothing further;
wait for the next one.

The walk cycle is deliberately minimal: two static tilt frames (left/right),
hard-cut rather than eased, via `walk-tilt` in [css/style.css](css/style.css)
— easy to replace with real walk-cycle frames later the same way the other
placeholder art is swapped.

**Sleep is fully autonomous — there's no manual sleep button.** Below
`SLEEP_DESIRE_THRESHOLD` (30), there's a chance each AI tick the pet just
nods off on its own (`sleepDesireChance()` in [js/main.js](js/main.js)) —
zero chance at 30 and above, climbing the lower sleep gets, up near-certain
by the time it's empty. It's a probability curve rather than a hard cutoff,
so exactly when it happens varies. Naps are also **random-length**: instead
of always sleeping until fully rested, each nap picks a random wake-up
target between `NAP_TARGET_MIN` (30) and `NAP_TARGET_MAX` (100) the moment
it falls asleep, stored as `state.sleepTarget` and checked in
`applyDecay()` in [js/state.js](js/state.js) — some naps are quick top-ups,
others go all the way to full, but it's never asleep past a full bar.

**Visually, it lies down on its side to sleep** — rotated via CSS the same
way a trip lays it sideways (reusing the standing sprite's own
transform-origin near the feet so it settles onto the floor instead of
spinning in place), combined with a gentle breathing motion. Which side it
lies on is randomized once per nap (`--sleep-dir`, set in
`setSleepingVisual()` in [js/room.js](js/room.js)) and stays put for the
whole nap — that function runs on every `store.persist()`, including many
times over the course of one nap, so it only re-rolls the side at the exact
moment sleep *starts*, not on every redundant "still asleep" call.

**Interrupting a sleeping pet backfires badly.** Attempting to Pet/Play/Scold
it, or use medicine on it, while it's asleep does *not* apply that action's
normal effect — instead it immediately wakes up mad: a flat 30-point hit to
both love and fun, a tantrum (a mess, plus a brief flailing-pose flash), and
the same sustained "mad" mood a Scold causes (see below), all via
`disturbSleep()` in [js/main.js](js/main.js). Placing food/water in the room
while it sleeps is still fine — that doesn't wake it, it'll find the food
when it wakes up on its own.

**Some food is too good to say no to.** Items flagged `irresistible: true`
in [js/items.js](js/items.js) (currently just Cake) get eaten almost
regardless of how full the pet already is (`foodDesire()` in
[js/main.js](js/main.js)), which can push food stat past the healthy range
into the `stuffed` emotion below — overfull, sluggish, and dedicated
"too full" art.

**Getting mad makes the pet stop having fun on its own.** Being scolded, or
having its sleep interrupted (see above), makes it mad for 45 seconds
(`MAD_DURATION_MS`). While mad it won't pick "play alone" as an idle activity —
only resting or sitting — and is far more likely to make a mess as a
tantrum (`TANTRUM_MESS_CHANCE`, much higher than the normal
`RANDOM_MESS_CHANCE`) instead of one of its calmer boredom-messes. A tantrum
briefly flashes a dedicated flailing pose (`playTantrum()` in
[js/room.js](js/room.js)) on top of the sustained angry face.

## Decorations with bonuses

Most decorations are purely cosmetic, but a few carry a passive bonus while
placed in the room — presence-only (owning three lamps doesn't triple the
effect), defined in `DECOR_EFFECTS` in [js/items.js](js/items.js):

- **Bed** 🛏️ — sleep regenerates 60% faster while sleeping (it also walks
  over to a placed bed before falling asleep in the first place — see "How
  the pet's autonomy works" above; that part isn't a `DECOR_EFFECTS` bonus,
  it's built into `goToSleep()` directly)
- **Window** 🪟 — fun decays 30% slower
- **Candle** 🕯️ — +15% on every *increase* to love (not decay) — petting,
  eating, cleaning a mess, etc. Routed through one `gainLove()` helper in
  [js/main.js](js/main.js) so the bonus can't accidentally get missed at
  some future call site that increases love directly. That same funnel is
  also where love is made deliberately harder to earn than the other stats
  — every gain gets scaled down by `LOVE_GAIN_MULT` (0.5) before the
  candle's bonus (if any) even applies, so raising it takes real, repeated
  care rather than a couple of quick actions.

Adding a new bonus decoration is one line in `DECOR_EFFECTS` plus whatever
multiplier it needs wired into `applyDecay()` ([js/state.js](js/state.js))
or `gainLove()` — no new mechanism required. Hovering a placed decoration
shows its name and (if it has one) its bonus as a tooltip — the same
`decorEffectDescription()` helper backs both that tooltip and the shop
card's description text, so they can't drift out of sync. Decoration icons
are real image assets under [assets/icons/decor/](assets/icons/decor/), not
emoji, same swap contract as everywhere else.

**Moving a placed item is click-to-pick-up, not press-and-hold-drag.** In
Decorate mode, click a decoration (or a placed food/water item) once to
pick it up — it then follows the pointer on plain mouse movement, no button
held — and click again, anywhere, to place it there. A small "put away" 📦
button appears at the bottom of the screen the moment you pick something
up; click it instead of the floor to remove that item from the room rather
than placing it (see `startCarrying()`/`dropCarried()`/`putCarriedAway()`
in [js/room.js](js/room.js)). An earlier press-and-hold-drag version of
this had no visual cue telling you to keep the mouse button down, so a
plain click-drag attempt would just leave the item stuck mid-air — this
click/click model doesn't have that failure mode.

**Placed decorations are resizable.** In Decorate mode, a small handle
appears on a decoration's corner (only when it isn't currently being
carried) — drag it outward to grow the item, inward to shrink it
(`startResize()` in [js/room.js](js/room.js)), clamped between
`MIN_DECOR_SCALE` (0.5×) and `MAX_DECOR_SCALE` (3.2×) and saved as
`item.scale`. It's a genuine press-and-hold drag, tracked independently
from the pick-up/drop click gesture above so the two can't be confused.
Only decorations get a handle — food/water bowls and messes are transient,
so resizing them wouldn't mean anything.

## Pets

The Monkey 🐒 (and its unlockable Beach/Ice variants) is bought and placed
the same way a decoration is, but it's kept in its own `'pet'` category in
[js/items.js](js/items.js) rather than `'decoration'` — deliberately, so
all the decoration-specific logic (`DECOR_EFFECTS`, the play-target
weighting, resizing) doesn't need itemId special-cases to exclude or handle
it, and so a new pet variant is just another catalog entry rather than more
branching. Placed pets still live in `state.roomItems` alongside
decorations/food/messes, just tagged `kind: 'pet'` instead of
`kind: 'decoration'` — same underlying system, different label.

**Beach Monkey and Ice Monkey only unlock once you own the matching room**
— the Island and Snowy Japan respectively (`requiresRoom` on the item in
[js/items.js](js/items.js), checked in [js/shop.js](js/shop.js)). Until
then their shop card shows a locked state and an "Unlock by owning &lt;room
name&gt;" hint instead of a price; `buyItem()` also refuses the purchase
directly as a backstop even if the button were somehow clicked anyway.

**A placed pet renders at the character's own exact box dimensions**, not
just a similar scale — its own art is drawn on the same 220x320 canvas as
the character's body parts (see
[assets/icons/decor/monkey.svg](assets/icons/decor/monkey.svg), a full-body
figure rather than a small square icon), and `MONKEY_BASE_SIZE` in
[js/room.js](js/room.js) is calibrated to the character's own 96px width.
Getting the *proportions* to match too (96:140, not square) took one more
step: every other room-item icon goes through `renderIcon()`, which boxes
it into a plain 1em-by-1em square — fine for a little decoration icon, but
it would have squashed/letterboxed a portrait figure. `buildItemEl()`
stretches just the pet's own `<img>` taller by `MONKEY_HEIGHT_RATIO`
(140/96) to compensate, so the rendered box ends up pixel-for-pixel the
same shape as `#pet-visual`. Once placed, it wanders to a new random spot
on its own every so often, and only rarely drops a free Banana 🍌 — a small
`MONKEY_BANANA_CHANCE` per tick (up to 2 on the floor at a time), deliberately
kept low so free food stays an occasional bonus rather than something to
farm; each banana is worth a modest 4 food, less than most bought food
items. Both the wandering and the banana drops run on their own timer,
independent of the pet's own AI loop, so it keeps doing its thing even
while the pet is asleep (see `monkeyTick()` in [js/main.js](js/main.js)). Only one placed
pet is treated as "the" active one at a time (whichever comes first in
`state.roomItems`) — if you place more than one, the rest just sit there
as oversized decoration until
removed.

Its position genuinely eases smoothly between spots — left/top/font-size
(so it still scales with room depth mid-move) all transition via CSS — and
it does the same two-frame walk-tilt wobble the character's own walk cycle
uses for the duration of each move, rather than a static icon sliding
across the floor. Getting that first part actually right took a real fix:
the naive version just called the normal full-room-rebuild render function
after updating its position, but that function tears down and recreates
every room-item element from scratch — a *freshly created* element has no
"before" position for a CSS transition to ease from, so it would just
appear already at the destination despite the transition rule being
correctly defined. `moveMonkeyTo()` in [js/room.js](js/room.js) instead
updates the pet's *existing* DOM element directly, which is what actually
lets the transition (and the walk-tilt animation layered on top of it)
play out. Movement is suspended while it's being manually carried in
Decorate mode (dragging it stays instant/responsive) and for the duration
of one of the reactions below, so an autonomous move can't land mid-flash
and cut an animation short.

Eating a banana always leaves a peel behind (`messOnEat` in
[js/items.js](js/items.js)) — unlike other food, which only has a small
chance of leaving crumbs.

A placed pet is also the pet's favorite thing to play with: when it picks
"playing alone" as an idle activity, the placed pet is weighted several
times more likely to be the thing it wanders over to than any other single
decoration (`MONKEY_PLAY_WEIGHT`, `findPlayTarget()` in
[js/main.js](js/main.js)), though it's never the *only* possible pick. What
happens once it gets there depends on how much **love** (not fun — this is a
bonding moment, not an entertainment one) the character currently has for
you (`playWithMonkey()`):

- **Below half love** — it's cranky about it: a brief tantrum
  (`playTantrum()`, the same flailing flash a mad pet's mess-making uses),
  and the monkey gets knocked onto its side for a couple of seconds, like
  it fell over (`flashMonkeyFallen()` — reusing the same rotate-the-sprite
  trick as the character's own trip/sleep visuals, no separate art needed).
  Nothing is gained — the attempt just doesn't land.
- **Half love or above** — it flops onto its side (`.watching-monkey` in
  [css/style.css](css/style.css), the same rotate-the-sprite trick sleeping/
  tripping use) to lie there transfixed for several seconds while the
  monkey slides back and forth right in front of it — a tight ±8px sway
  (the `monkey-slide` keyframes there), kept close rather than a wide swing
  so it still reads as a shared, intimate moment instead of the monkey
  wandering off mid-reaction — gains a real bump to love
  (`MONKEY_SLIDE_LOVE_GAIN`, routed through `gainLove()`
  so a placed candle's bonus still applies), swaps to a dedicated heart-eyed
  "love" face for the duration (`face-love.svg`, toggled via
  `setLoveFaceVisual()` in [js/room.js](js/room.js) — layered into
  `refreshVisual()`'s priority chain as a face-only override, so whatever
  idle pose/emotion body was already showing keeps showing underneath it),
  and says "hehehe."

An existing save with a monkey placed under the old `kind: 'decoration'`
gets corrected to `kind: 'pet'` automatically on load (see `loadState()` in
[js/state.js](js/state.js)), driven by the item's current catalog category
rather than an itemId list, so it keeps working for any future pet too.

## Character customization

Instead of hats and accessories worn on top of a fixed pet, you buy and
equip three independent parts — **Outfit**, **Hair**, and **Ears** — in
their own shop tabs. Exactly one of each is always equipped (there's no
"wear nothing" state); each category starts with one free option already
owned (Regular outfit, Long hair, Bunny ears) plus two paid alternatives.
Buying and equipping is handled generically in [js/shop.js](js/shop.js) —
the same code path for all three categories, since they all work the same
way.

**Outfit is clothes, not a body shape** — Regular, Bikini, and Snow Outfit
are all the exact same body proportions and gestures per pose; only the
clothing details differ (neckline, waist garment, footwear). The body layer
is still fully modular in the sense that matters for this: **every outfit
draws its own art for every emotion/pose**, not just one static image. The
bikini outfit has its own hungry pose, its own sleeping pose, its own
sitting pose, and so on — see `assets/character/parts/body/<outfit>/<pose>.svg`.
Picking the right file is just "equipped outfit + current pose key"
combined at render time (`bodyPath()` in [js/room.js](js/room.js)); the
emotion system and idle-activity system only ever deal in pose *keys*
(`'hungry'`, `'sitting'`, ...), never file paths, so they don't need to
know or care which outfit is equipped.

## Rooms

A fourth shop tab, **Travel** 🗺️, works exactly like Outfit/Hair/Ears —
buy a room once, then equip whichever one you own. Three exist for now:
the free starting **Cozy Room**, **Island** ($100), and **Snowy Japan**
($100). Switching rooms changes the wall/floor look (`setRoomTheme()` in
[js/room.js](js/room.js), driven by `[data-theme]` CSS overrides in
[css/style.css](css/style.css)) — the pet, its stats, and anything placed
in the room stay exactly as they were. There's no separate scene state per
room in this version; think of it as redecorating the same room's walls and
floor, not teleporting to a genuinely different place with its own layout.

Island and Snowy Japan aren't just recolors — each has an actual illustrated
wall scene: sun, clouds, ocean, and palm trees for the island
([assets/rooms/island-wall.svg](assets/rooms/island-wall.svg)); a
snow-capped mountain, a torii gate, and pines for Snowy Japan
([assets/rooms/snow-wall.svg](assets/rooms/snow-wall.svg)). They're plain
SVGs applied as a CSS `background-image` (`background-size: cover`) on
`#room-wall`, so replacing either with your own art is just swapping the
file — no code changes, any roughly-landscape image works. The Cozy Room
deliberately stays a plain gradient with no scenery, as a blank-canvas
default distinct from the two "real destinations."

## The emotion system

Every stat has a healthy band. Whichever stat is currently furthest outside
its band — too low *or* too high — becomes the pet's one visible "dominant
emotion" for that moment, computed fresh each tick in
[js/emotions.js](js/emotions.js) (`computeEmotion`). That emotion does two
things at once:

1. **Visual** — swaps the pet's face (and sometimes body pose) to match, via
   `setEmotionVisual()` in [js/room.js](js/room.js).
2. **Mechanical** — applies a gameplay penalty while it's active, e.g.:
   - `hungry` (food too low): fun & love drain faster
   - `stuffed` (food too high, usually from an irresistible treat): gets tired faster, moves slower
   - `thirsty` (water too low): extra health drain
   - `exhausted` (sleep too low): moves slower — though in practice the
     autonomous sleep decision (see above) usually kicks in before this
     shows up, since it triggers at a higher sleep value
   - `bored` (fun too low): love drains faster
   - `sad` (love/health too low, or 3+ uncleaned messes): just a visible warning sign for now

Every emotion has its own dedicated face today; only `hungry` and `stuffed`
also get a dedicated *body* pose (the rest reuse the standing `base` body,
which doesn't take anything away from how well they're wired up
mechanically). Add a body pose for one any time by drawing it into every
body-type folder under `assets/character/parts/body/` using a new pose key
and pointing that emotion's `bodyPose` at it in `EMOTIONS` in
[js/emotions.js](js/emotions.js); no other code changes needed. Separately,
"mad" (see above) isn't part of this stat-based emotion system at all — it's
a temporary flag set directly by scolding, not something any stat drifts
into on its own.

**A mood badge next to the meters shows the current mood at a glance** — an
emoji + label pill (e.g. "😟 Hungry") built by `currentMoodKey()` /
`renderMoodDisplay()` in [js/main.js](js/main.js). It mirrors
`refreshVisual()`'s priority order in [js/room.js](js/room.js) exactly —
sleeping beats tripping beats mad beats the dominant-stat emotion — so it
can never say something different from what the character's own face is
actually showing. It's a small hand-picked emoji+label map (`MOOD_INFO`)
rather than a crop of the character's own face art: those face SVGs are
laid out as one layer of the full 220×320 character composite, not
standalone icons, so they wouldn't crop into a tidy little badge — reusing
them here would need real UI-icon-sized art instead, the same way the meter
and action icons are their own separate assets from the character parts.

**Hovering a meter shows its exact value and current rate, plus exactly
what's changing that rate.** Every meter's tooltip always shows what the
stat means (authored once as its `title` attribute in `index.html`),
followed by a status line like `62/100 (-4.50/min)` — or `+4.50/min` for
something currently regenerating, like sleep while asleep, or `steady` for
a rate close enough to zero not to bother signing. That rate comes from
`meterRatePerMin()` in [js/state.js](js/state.js), which mirrors
`applyDecay()`'s own branching stat-by-stat (down to per-stat special cases
like food/water decaying slower while asleep, or fun not decaying from time
alone while asleep) so the number can never claim a rate the stat isn't
actually about to apply on the next real tick. Then — only when something's
actually active — an appended "Currently affecting this" list: the dominant
emotion's multiplier ("Hungry: fun drains 80% faster"), a relevant placed
decoration's bonus ("Bed: sleep regenerates 60% faster"), extra drain from
an uncleaned room ("3 messes: draining health"), the not-been-petted-in-a-
while penalty on love (see above), or health's passive recovery note. Built
by `meterEffectDescriptions()` in [js/state.js](js/state.js), which
deliberately re-derives the same emotion/decor/mess numbers `applyDecay()`
itself uses rather than keeping a separate description table, so the
tooltip can never drift out of sync with what the stat is actually doing —
both wired into the tooltip via `renderMeters()` in [js/ui.js](js/ui.js).

**A meter also gets a visibly different treatment when it's critically low
or maxed out**, not just a subtle color shift on the fill — a colored glow
ring around the whole track plus a faster, deeper pulse, so either state
reads as genuinely notable at a glance. The two use distinct hues on
purpose (a red-toned pulse under 25, a gold one at 90+, `METER_LOW_THRESHOLD`/
`METER_HIGH_THRESHOLD` in [js/ui.js](js/ui.js)) so a glance can tell which
direction the problem is in without reading the number — the glow itself
lives on `.meter-track` rather than `.meter-fill`, since the track's own
`overflow: hidden` (needed to clip the fill's width as it changes) would
otherwise clip a glow drawn by its own child.

**Going too long without petting makes love drain faster, on top of
everything above.** `state.lastPetAt` records the last time the Pet
interaction was actually used (set in `startPetting()` in
[js/main.js](js/main.js) — the moment a hold session begins, not when it
ends); `petNeglectMult()` in [js/state.js](js/state.js) turns "minutes since
then" into a multiplier that ramps linearly from 1x right after petting up
to 4x once `PET_NEGLECT_RAMP_MIN` (5) minutes have passed, then holds there
— it keeps getting worse the longer you neglect it, but doesn't spiral
forever if you step away for hours. Folded into `applyDecay()`'s love line
alongside the mood multiplier, and surfaced in the love meter's own tooltip
exactly like every other multiplier above ("Not petted in 6m: love drains
300% faster") — same `meterEffectDescriptions()` funnel, same
never-drifts-out-of-sync guarantee.

## Mini-games

Six self-contained mini-games, picked from a tabbed modal
(`openPlayMenu()` in [js/minigames/index.js](js/minigames/index.js)).
Every game mounts into a plain container and reports what it earned via one
`onEnd(coins, message?)` callback — `index.js` owns the shared plumbing
(applying coins, showing the toast, starting the cooldown) so an individual
game file never has to duplicate any of that.

**Playing costs a little sleep, love, and food, no matter which game or how
it goes** — a flat `MINIGAME_SLEEP_COST`/`MINIGAME_LOVE_COST`/
`MINIGAME_FOOD_COST` charged once, the moment "Start" is actually clicked
(`startGame()` in [js/minigames/index.js](js/minigames/index.js)), not per
attempt within the game and not refunded on a loss — playing takes real
effort regardless of the outcome. Applied centrally in `startGame()` rather
than each game charging it itself, so a new game gets this for free.

- **Snack Catch** 🧺 and **Match & Match** 🧩 — the original two, unchanged.
- **Lucky Spin** 🎡 — a roulette wheel that pays out food, a drink, or
  coins, and rarely the jackpot: a free cosmetic or decoration. See
  "Modular by design" below.
- **Flap Flap** 🐦 — a flappy-bird clone; flap (click/tap/space) to fly
  through gaps between pipes, 3 coins per pipe cleared. Deliberately more
  forgiving than a strict flappy-bird clone: the bird's actual hitbox is a
  few pixels smaller on every side than its visible sprite
  (`HIT_MARGIN` in [js/minigames/flappy.js](js/minigames/flappy.js), applied
  to both the pipe collision and the ceiling/floor check), so visibly
  grazing a pipe by a little doesn't end the run — it reads as a
  near-miss you got away with rather than an unfair hit.
- **Sneaky Sniff** 👃 — a "Grandma's footsteps"-style timing game: press
  and hold the stinky shoe to sniff it, but a hidden watcher flips between
  watching and not watching on a random timer, and sniffing while watched
  costs a life and some progress. Fill the meter to win before the clock
  or your 3 lives run out. Right before the watcher starts watching, they
  flash a brief "peeking" warning (🫣, a wobble animation) — the tell you
  actually get to react to; going the other way, from watching back to not
  watching, has no tell, since there's nothing to react to on that side
  (`PEEK_WARNING_MS` in [js/minigames/shoesniff.js](js/minigames/shoesniff.js)).
- **Peel Banana** 🍌 — no timer, no losing condition: the banana is drawn as
  a thin body tapering to a rounded point at both ends (not a plain
  cylinder or a curved crescent — see [assets/icons/minigames/peel-banana-
  whole.svg](assets/icons/minigames/peel-banana-whole.svg)), split into 3
  equal *vertical* thirds — left, middle, right, like the 3 strips a real
  banana peel splits into lengthwise — each independently clickable in any
  order. The wrap element's own on-screen box is sized to that art's exact
  aspect ratio rather than a generic square (`.peel-banana-wrap` in
  [css/style.css](css/style.css)) — clip-path percentages are relative to
  the *box*, not to wherever `object-fit: contain` visually centers the art
  within it, so a squarer box around art this narrow would have
  letterboxed hard enough to squeeze nearly the whole visible banana into
  just the middle clip third, leaving the left/right sections almost
  entirely empty and unclickable. Clicking a section peels *that* strip
  (sliding off sideways, away from the banana's own center — the left
  third slides left, the right slides right), revealing the banana
  underneath it right there rather than one continuous reveal, and floats
  up an immediate verdict for just that section, using the *same*
  Crap-through-Legendary tier names and colors the overall rarity uses
  (`QUALITY_TIERS`/`spawnQualityLabel()` in
  [js/minigames/peel.js](js/minigames/peel.js)) — one shared lookup table
  for both, so a section calling itself "Epic" means the same thing the
  end screen does.

  **Fresher is better, browner is worse** — every banana secretly rolls how
  browned/bruised each section is (0–100) *before* a single click happens,
  invisible until you actually peel that section, where it shows up two
  ways at once: that floating tier verdict, and a CSS `sepia()` tint scaled
  to the section's own severity (`rollBrownness()`/`buildBrownFilter()`,
  same file) — a fresher section stays close to its natural pale color, a
  browner one visibly darkens toward a bruised look. Being fresh is the
  rare roll, not the common one: `rollBrownness()` is deliberately skewed
  toward heavy browning, so a section (or a whole banana) coming up
  genuinely pristine is the standout case, keeping "Legendary" actually
  rare instead of what you'd get by simply relabeling the old high-brown-
  is-good version. An Epic section gets a soft colored glow baked right
  into its own filter, and a Legendary one glows more — both from extra
  `drop-shadow()` layers appended in `buildBrownFilter()`, since the sepia
  amount is already set via an inline `filter` style that a separate CSS
  class couldn't add to (only replace).

  Once all 3 are peeled, the *average freshness* across them — which a
  single section's own good or bad reading doesn't necessarily predict —
  decides the banana's overall rarity — Crap, Common, Rare, Epic, or
  Legendary, color-coded in the end screen — and its payout scales with
  rarity, from a token 1–3 coins for the common Crap case up to 16–25 for
  the rare Legendary one. Built the same way as Flap Flap's forgiving
  hitbox and the other games' shared plumbing: no game-specific logic
  needed elsewhere, `QUALITY_TIERS` is just a lookup table keyed by that
  one average, reused as-is for both the per-section and overall readings.

**Lucky Spin has a cooldown before it can be played again — 3 minutes**
(`cooldownMs` on its entry in the `GAMES` list in
[js/minigames/index.js](js/minigames/index.js)); the other five currently
have none and can be replayed immediately (`cooldownMs` just omitted —
`onEnd()` only starts a cooldown when the game actually has one, so this is
a one-line change per game either way). Where a game does have one, it's a
plain timestamp in `state.minigameCooldowns`, so it survives closing the
mini-games modal or reloading the page — the intro screen shows a live
countdown and keeps the Start button disabled until it elapses.

**Modular by design: Lucky Spin never hardcodes a specific prize.** The
wheel only knows about category *slices* (food / drink / coins / jackpot,
each with a weight that controls both its odds and its visual size on the
wheel); which specific item actually comes out of a slice is picked fresh
from the current catalog each spin, via the same `itemsByCategory()` used
everywhere else in the game (see [js/items.js](js/items.js)). The jackpot
slice pulls from every decoration/body/hair/ears/room item the player
doesn't already own — falling back to a flat coin bonus on the rare chance
they've collected literally everything — so adding a new food, drink,
decoration, or cosmetic item to `ITEMS` later automatically expands what
Lucky Spin can award. Nothing in [js/minigames/roulette.js](js/minigames/roulette.js)
needs to change for that.

**Each new game gets its own custom icon asset** rather than an emoji —
[assets/icons/minigames/](assets/icons/minigames/) (`roulette-wheel`,
`flappy-bird`, `stinky-shoe`, `peel-banana-whole` + `peel-banana-peeled`) —
used both as that game's tab icon in the picker and, for Flap Flap, Sneaky
Sniff, and Peel Banana, as the actual in-game sprite (the bird you fly, the
shoe you sniff, the banana you peel). Same swap contract as every other
icon in the project: replace the file, keep the filename, and it drops
right in.

## Running it

This is a plain HTML/CSS/JS site with no build step — but it uses ES module
imports, which browsers block over `file://`. Serve it locally instead:

```
# from this folder
python -m http.server 8000
# then open http://localhost:8000
```

(Any static server works — VS Code's "Live Server" extension, `npx serve`, etc.)

Progress (stats, money, inventory, room layout) is saved to the browser's
localStorage automatically, per-browser.

## Swapping in your own art

Everything visual right now is a placeholder so you can wire up your own
hand-drawn art later without touching the game logic:

- **Character** — fully modular, organized by part under
  [assets/character/parts/](assets/character/parts/): `head/`, `ears/`,
  `body/`, `face/`. The pet is composited live from 4 stacked layers, back
  to front: body, ears, head (hair/head shape, **no face** — exactly the
  split you asked for), and face (eyes/brows/mouth/blush). All parts share
  one `viewBox` (`0 0 220 320`) so any file can be swapped for your own art
  and it'll still line up — that's the whole contract, keep the same
  viewBox and canvas alignment on your replacements.
  - `head/long.svg`, `head/short.svg`, `head/curly.svg` — the 3 hair
    options (see "Character customization" above). Constant across every
    mood/pose.
  - `ears/bunny.svg`, `ears/cat.svg`, `ears/round.svg` — the 3 ear options.
    Also constant across every mood/pose.
  - `body/<outfit>/<pose>.svg` — one folder per outfit (`regular`, `bikini`,
    `snow`), each containing the *same* set of pose files: `base`
    (default/happy/standing), `hungry`, `stuffed`, `sleeping`, `sitting`,
    `resting`, `playing`, `tantrum`, `tripped`. All three keep the exact
    same body silhouette/proportions and pose gestures — `bikini` and
    `snow` only redraw the clothing details (neckline, waist garment,
    footwear) on top, since it's meant to read as "same pet, different
    clothes," not different body shapes. Replace any of the 27 files
    individually with real hand-drawn art whenever you're ready; nothing
    else needs to change as long as the new file keeps the same pose's
    silhouette meaning (e.g. `bikini/hungry.svg` should still read as
    "hungry," however you draw it — `tripped` should read as an
    off-balance stumble, since the room lays it on its side via CSS
    rotation rather than needing a lying-down redraw, see "How the pet's
    autonomy works" above).
  - `face/face-neutral.svg` — the default/happy expression (shared by every
    outfit — face art doesn't vary by outfit, only by mood).
  - `face/face-hungry.svg`, `face/face-stuffed.svg`, `face/face-sad.svg`,
    `face/face-sleeping.svg`, `face/face-mad.svg`, `face/face-crying.svg`,
    `face/face-love.svg`, `face/face-thirsty.svg`, `face/face-exhausted.svg`,
    `face/face-bored.svg` — the other expressions, all with dedicated art
    (`face-crying` is used only during a trip, `face-love` only while
    happily watching a placed pet play — see above for both). Replace any of
    these any time by drawing a new `face-<key>.svg` with the same viewBox;
    add a brand new one by filling in its entry in `EMOTIONS` in
    [js/emotions.js](js/emotions.js) — no other code changes needed.
- **Item icons** (food, clothes) — each item in [js/items.js](js/items.js)
  has an `icon` field that's currently an emoji for these. Change it to an
  image path like `"assets/items/apple.svg"` and it'll automatically render
  as an `<img>` instead (see `renderIcon()` in [js/ui.js](js/ui.js)) — no
  other code changes needed. `renderIcon()` sizes the image in `em` units,
  so it scales correctly whether it ends up in a fixed-size shop card or a
  room item that shrinks/grows with depth.
- **UI icons** (the meter row, the bottom action bar, the interact sidebar,
  mess icons, and decorations) — all real image assets already, not emoji,
  organized under [assets/icons/](assets/icons/):
  - `icons/meters/` — food, water, sleep, fun, health, love
  - `icons/actions/` — feed, water, games, shop, decorate
  - `icons/interact/` — pet, play, exercise, scold, move
  - `icons/mess/` — spill, crumbs, clutter, banana-peel
  - `icons/decor/` — plant, lamp, painting, candle, chair, window, bed, table,
    monkey, monkey-beach, monkey-ice
  - `icons/minigames/` — roulette-wheel, flappy-bird, stinky-shoe,
    peel-banana-whole, peel-banana-peeled (see "Mini-games" above)
  Same contract as everywhere else: replace a file, keep its filename and a
  roughly square canvas, and it drops right in. Meter/mess/decor icons are
  sized via `em` (so they still scale with a room item's depth);
  action/interact icons are sized directly in CSS (`.btn-icon` /
  `.meter-icon` in [css/style.css](css/style.css)).
- **Room scenery** — Island/Snowy Japan already use real illustrated
  `#room-wall` background images under [assets/rooms/](assets/rooms/) (see
  "Rooms" above); replace either file directly for your own art, same
  filename. The Cozy Room and every theme's floor are still plain CSS
  gradients (`#room[data-theme="..."]` in [css/style.css](css/style.css)) —
  swap in a background image the same way whenever you have art for those.

## Structure

- `index.html` — page layout (meters, room, action bar, modal)
- `css/style.css` — all styling, muted color palette as CSS variables at the top
- `js/state.js` — save data shape, localStorage persistence, stat decay over
  time (including the passive mess/love decay, per-emotion multipliers, and
  decoration bonuses)
- `js/emotions.js` — the dominant-emotion registry: thresholds, face asset
  paths + body pose keys, gameplay effect multipliers, speech lines
- `js/items.js` — shop catalog (food/water/medicine/decorations/outfit/hair/ears/room),
  `DECOR_EFFECTS` + `activeDecorEffects()` + `decorEffectDescription()` for
  decoration bonuses and their tooltip/description text
- `js/room.js` — pet movement/layered sprite compositing (sleeping > idle
  pose > emotion priority, see `refreshVisual()`), outfit-aware pose
  resolution (`bodyPath()`), room theme (`setRoomTheme()`), room item
  rendering (decorations, placed food/water, messes) including hover
  tooltips, drag/placement. Reports raw clicks (interact action, mess
  clicked, item removed) as DOM CustomEvents rather than deciding what they
  mean.
- `js/shop.js` — shop modal (buy consumables/decorations, place decorations,
  equip outfit/hair/ears/room)
- `js/minigames/` — the five mini-games (`catch.js`, `memory.js`,
  `roulette.js`, `flappy.js`, `shoesniff.js`) plus the picker modal and
  shared cooldown/payout plumbing (`index.js`)
- `js/ui.js` — small shared helpers (meters, toast, modal)
- `js/main.js` — wires everything together, the action bar, the dev button,
  and the autonomous pet AI loop (`aiTick()`)

## Ideas for next steps

- Real hand-drawn art for the `bikini`/`snow` outfits and a 4th+ outfit
- More decoration bonuses, and bonuses that scale with how many are placed
- Rooms with their own separate layout/placed items, not just a wall/floor
  reskin of the same room
- Aging or evolution stages for the pet
- Achievements or daily login bonuses
