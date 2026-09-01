# Gigawatt

A factory site, 3 buildings and a clock. Build a grid to 1,000 MW.
[Play it here.](https://jeremylasne.com/gigawatt/) No install, no account, no
server.

A full run takes 26 minutes. The 10x button gives you it back in under 3.

## The chain

    money -> power plants -> lines -> datacenters -> tokens -> AI model -> money

Every link is capped by the one before it. **Running capacity counts the power
your datacenters use.** Spare power counts for 0, so 40 power stations and no
compute leaves the meter at zero.

The panel down the left side reads the same way: power made, then tokens, then
money, with the losses at each step. When a run stalls, the stalled row is the
one showing red.

Each of the 3 has 5 levels. Output triples per level while consumption doubles.
A robot that only ever adds tiles, never levels, stops at **29 MW**.

## Lines

A plant reaches nothing on its own. Drag a line from a plant to a datacenter
and power starts moving along it.

| rule | number |
|---|---|
| A line reaches | 6 tiles |
| A line carries everything for | 3 tiles |
| Past 3 tiles, each tile burns | 9% |
| A building carries | 4 lines |

A plant fills its closest datacenter first, then the next, and keeps what
nobody needs. So a short line gets served and a long one lives on leftovers.

A robot that builds at the far end of every line stops at **864 MW**.

## Heat

Water and rock carry heat away. Sand throws it back. A datacenter's heat
settles instead of climbing: it rises with the work it does and falls in
proportion to how hot it already is. So the resting temperature is known
before you build, and the panel prints it.

A site that rests at 100% goes dark. A dark machine restarts once it cools to
60%, which takes 8 seconds beside water and 40 seconds in the sand.

Of 148 buildable tiles, 18 hold a level 5 datacenter, and every one sits on
water or rock. A robot that stays in the desert stops at **225 MW**.

Your AI model is the fourth character. It sets the tokens per second you can
sell. Each tier also cools every datacenter on the site. Ember 4 Ultra is what
makes level 5 possible anywhere.

## The site

One connected plain, 148 buildable tiles, walled by a ridge to the north and
open water to the west. A lake and 2 rock outcrops sit inside the floor, so
cooling runs from +10.5 at the waterline to -8 in the sand.

Every buildable tile is pegged at the corners and ruled at the edges, so the
factory floor reads at a glance. Pick up a tool and every tile it can stand on
lights up.

## The repository

    src/rules.js    every number the game runs on. Draws nothing.
    src/world.js    the site, written as the ASCII art it is
    src/game.js     state in, state out. Pure functions only.
    src/render.js   terrain, weather, lines and buildings, drawn as hard pixels
    src/ui.js       the production column and the panels
    src/sprites.js  10 buildings, 12 by 12, 1 character per pixel
    src/main.js     the loop, the pointer, the speed control
    test/           51 tests, including one that plays the whole game
    tools/          the balance harness, a map printer and a single file build

Plain ES modules, no build step. `index.html` is the whole application. Open it
and edit it.

    npm test         run the tests
    npm run balance  play a full game with a robot, and print the timeline
    npm run players  4 robots, 4 strategies, side by side
    npm run map      print the site's cooling geography
    npm run bundle   fold the modules into one page, to hand to somebody

## Speed

1x, 3x and 10x multiply real seconds. Game seconds hold still, so a 26 minute
run reads 26 minutes on the clock and on the board at every speed. The world
steps in 0.25 second slices, so heat and money land in the same place however
fast you watch them.

## Balance

The numbers came first, and a robot tuned them. `tools/balance.js` plays the
real game through the real rules with a player who always takes the obvious
choice. It reads the 3 signals the production column shows a person, then fixes
the cheapest one it can afford:

1. a datacenter is running under 98%
2. power is going spare
3. the model is dropping tokens

Run `npm run players`:

| robot | breaks | result |
|---|---|---|
| careful | nothing | **26:24**, 56 buildings, 107 lines |
| sprawler | distance | stops at 864 MW |
| sunbaked | cooling | stops at 225 MW |
| flat | the upgrade curve | stops at 29 MW |

`careful` gets there in 26 minutes with a move to make in every minute of it.
`test/balance.test.js` fails when that stops being true.

The other 3 exist to prove the rules earn their place. Each breaks 1 rule and
each hits a wall, so every rule is load bearing.

At the finish `careful` makes 1,170 MW and uses 1,000. 52 MW burns in the lines
and 117 MW goes spare, across 56 buildings and 107 lines.

## The leaderboard

The clock runs in your browser. Anyone can open the console and post any
number, so the game leaves the state on `window.gigawatt` and says so. Out of
the box the board stays on your machine. Point `ENDPOINT` in
`src/leaderboard.js` at a host that takes a POST and the same board goes
public.

## Left out of version one

Offline progress, prestige, research trees, random events, sound, a map
generator, accounts, and a phone layout. One site, one sitting.
