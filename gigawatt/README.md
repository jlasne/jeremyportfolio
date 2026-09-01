# Gigawatt

An island, 3 buildings and a clock. Build a grid to 1,000 MW.
[Play it here.](https://jeremylasne.com/gigawatt/) No install, no account, no
server.

## The chain

    money -> power plants -> lines -> datacenters -> tokens -> AI model -> money

Every link is capped by the one before it. **Running capacity counts the power
your datacenters use.** Spare power counts for 0, so 40 power stations and no
compute leaves the meter at zero.

Each of the 3 has 5 levels. Output triples per level while consumption doubles,
so 1 upgraded tile beats 2 new ones.

## Lines

A plant reaches nothing on its own. Drag a line from a plant to a datacenter
and power starts moving. 3 rules cover it:

| rule | number |
|---|---|
| A line reaches | 6 tiles |
| A line carries everything for | 3 tiles |
| Past 3 tiles, each tile burns | 9% |
| A building carries | 4 lines |

A plant fills its closest datacenter first, then the next, and keeps what
nobody needs. So a short line gets served and a long one lives on leftovers.

A robot that builds at the far end of every line stops at **879 MW**.

## Heat

Water and rock carry heat away. Sand throws it back. A datacenter's heat
settles instead of climbing: it rises with the work it does and falls in
proportion to how hot it already is. So the resting temperature is known
before you build, and the panel prints it.

A site that rests at 100% goes dark. A dark machine restarts once it cools to
60%, which takes 7 seconds on the coast and 34 seconds in the sand.

Of 162 buildable tiles, 19 hold a level 5 datacenter, and every one of them
sits on water or rock. A robot that stays in the desert stops at **900 MW**.

Your AI model is the fourth character. It sets the tokens per second you can
sell. Each tier also cools every datacenter on the island. Ember 4 Ultra is what
makes level 5 possible anywhere.

## The repository

    src/rules.js    every number the game runs on. Draws nothing.
    src/world.js    the island, written as the ASCII art it is
    src/game.js     state in, state out. Pure functions only.
    src/render.js   terrain, weather, lines and buildings, drawn as hard pixels
    src/ui.js       the panels in the 4 corners
    src/sprites.js  10 buildings, 12 by 12, 1 character per pixel
    src/main.js     the loop, the pointer and the celebrations
    test/           50 tests, including one that plays the whole game
    tools/          the balance harness, a map printer and a single file build

Plain ES modules, no build step. `index.html` is the whole application. Open it
and edit it.

    npm test         run the tests
    npm run balance  play a full game with a robot, and print the timeline
    npm run players  4 robots, 4 strategies, side by side
    npm run map      print the island's cooling geography
    npm run bundle   fold the modules into one page, to hand to somebody

`bundle` is a convenience. The page it writes runs the same game the browser
already runs from `src/`. It handles the 2 import forms this project uses and
throws on the rest.

## Balance

The numbers came first, and a robot tuned them. `tools/balance.js` plays the
real game through the real rules with a player who always takes the obvious
choice. It reads the 3 signals the display shows a person, then fixes the
cheapest one it can afford:

1. a datacenter is running under 98%
2. power is going spare
3. the model is dropping tokens

Run `npm run players`:

| robot | breaks | result | datacenter time lost to heat |
|---|---|---|---|
| careful | nothing | **27:23** | 0s |
| reckless | cooling | 75:24 | 73,495s |
| sprawler | distance | stops at 879 MW | 0s |
| sunbaked | stays in desert | stops at 900 MW | 259,815s |

`careful` gets there in 27 minutes with a move to make in every minute of it.
`test/balance.test.js` fails when that stops being true.

The other 3 exist to prove the rules earn their place. Breaking cooling costs
2.7 times the clock. Breaking distance walls you at 879 MW. Refusing to leave
the sand walls you at 900 MW, because no model keeps a level 5 datacenter
alive there.

At the finish `careful` makes 1,170 MW and uses 1,005. 42 MW burns in the
lines and 123 MW goes spare, across 62 buildings and 116 lines.

## The leaderboard

The clock runs in your browser. Anyone can open the console and post any
number, so the game leaves the state on `window.gigawatt` and says so. Out of
the box the board stays on your machine. Point `ENDPOINT` in
`src/leaderboard.js` at a host that takes a POST and the same board goes
public.

## Left out of version one

Offline progress, prestige, research trees, random events, sound, a map
generator, accounts, and a phone layout. One island, one sitting.
