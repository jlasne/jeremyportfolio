# Gigawatt

A small island, three things to build, and one number to push to a thousand.
Open [the page](https://jeremylasne.com/gigawatt/) and play — no install, no
account, no server.

## The chain

    money → power plants → electricity → datacenters → tokens → AI model → money

Every link is capped by the one before it, and **running capacity is whichever
side of the grid is smaller** — the electricity your plants make, or the
electricity your datacenters actually draw. Build nothing but power stations
and the meter does not move. That single rule is the whole game: to reach a
gigawatt you have to grow both halves together, and the clock is running.

Each of the three has five levels. Output roughly triples per level while
consumption roughly doubles, so a bigger building always beats another
building once the island runs out of room. It has 81 places to put something.
A winning run uses about 56 of them.

## The two land rules

**Distance.** Electricity travels two tiles for free, then loses 7% of itself
per tile after that. Build the compute near the power.

**Cooling.** Water and rock carry heat away; sand throws it back. A
datacenter's temperature *settles* rather than climbing forever — it rises
with the work it does and falls in proportion to how hot it already is — so
the resting temperature is knowable before you build, and the panel tells you.
Anything that would rest at 100% goes dark, and a dark machine has to cool to
60% before it will turn over again. On the coast that takes seconds. In the
desert it takes half a minute, every time.

Good land costs more to build on, cheap land bakes, and the top tier of
datacenter cannot survive on sand at any model. That is the choice you keep
making.

Your AI model is the fourth character. It sets how many tokens a second you
can turn into money, and each tier also cools every datacenter on the island —
which is what makes the biggest machines possible anywhere at all.

## The repository

    src/rules.js    every number the game runs on. Knows nothing about screens.
    src/world.js    the island, written as the ASCII art it is
    src/game.js     state in, state out. No canvas, no DOM, no timers.
    src/render.js   terrain, weather and buildings, drawn as hard pixels
    src/ui.js       the panels round the edge
    src/sprites.js  ten buildings, twelve by twelve, one character per pixel
    src/main.js     the loop, the pointer and the celebrations
    test/           44 tests, including one that plays the whole game
    tools/          the balance harness, a map printer and a single-file build

Plain ES modules and no build step. `index.html` is the whole application;
open it and edit it.

    npm test         run the tests
    npm run balance  play a full game with a robot, and print the timeline
    npm run players  four robots, four strategies, side by side
    npm run map      print the island's cooling geography
    npm run bundle   fold the modules into one page, for handing to somebody

`bundle` is a convenience, not a build step — the game it produces is the same
game the browser already runs straight from `src/`. It understands the two
import forms this project uses and throws rather than guesses on anything
else.

## Balance

The numbers came first, and they were tuned by a robot rather than by feel.
`tools/balance.js` plays the real game through the real rules with a player
who always takes the obvious choice: it reads the same three signals the
heads-up display shows a person — *the lights are dim*, *there is spare
power*, *tokens are going to waste* — and fixes whichever it can afford.

    npm run players

    careful   27:04   56 buildings   0 seconds lost to heat
    reckless  27:34   57 buildings   1,363 seconds lost to heat
    sprawler  28:34   62 buildings   0 seconds lost to heat
    sunbaked  never   41 buildings   88,673 seconds lost to heat

`careful` obeys both land rules and gets there in about twenty-seven minutes,
with something worth doing in every single minute of it — that is what the
tuning was for, and `test/balance.test.js` fails if it stops being true.

The other three exist to prove the rules earn their keep. `reckless` chases
cheap land and pays for it in downtime, coming out roughly even — which is the
trade working as intended. `sprawler` ignores distance and loses about a
minute and a half. `sunbaked` refuses to leave the desert and **never reaches
a gigawatt at all**, because no model in the game can keep a top-tier
datacenter alive on sand. Cooling is not decoration.

## About the leaderboard

The clock runs in your browser. Anyone who wants to can open the console and
hand it any number they like — in fact the game leaves the board, the rules
and the island on `window.gigawatt` rather than pretending otherwise. There are no anti-cheat
measures because none of them would work here, and the board says so where you
post to it. Out of the box it is your own machine only and nothing leaves it;
point `ENDPOINT` in `src/leaderboard.js` at anything that takes a POST and the
same board goes public.

## Deliberately not here

Offline progress, prestige, research trees, random events, sound, a map
generator, accounts, and a phone layout. One hand-drawn island, one sitting.
