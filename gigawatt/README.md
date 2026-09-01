# Gigawatt

A factory site, 4 things to build and a clock. Get the grid to 1,000 MW.
[Play it here.](https://jeremylasne.com/gigawatt/) No install, no account, no
server.

A full run takes 27 minutes. The 10x button gives you it back in under 3.

## The chain

    money -> power plants -> lines -> datacenters -> tokens -> AI model -> money

Every link is capped by the one before it. **Running capacity counts the power
your datacenters use.** Spare power counts for 0, so 40 power stations and no
compute leaves the meter at zero.

The column down the left reads the same way: power made, then tokens, then
money, with the losses at each step. When a run stalls, the stalled row is the
one showing red.

Each of the 3 machines has 5 levels. Output triples per level while consumption
doubles. A robot that only ever adds tiles, never levels, stops at **29 MW**.

## Lines

A plant reaches nothing on its own. Drag a line from a plant to a datacenter
and power starts moving along it.

| rule | number |
|---|---|
| A line reaches | 6 tiles |
| A line carries everything for | 3 tiles |
| Past 3 tiles, each tile burns | 11.5% |
| A building carries | 4 lines |

A plant fills its closest datacenter first, then the next, and keeps what
nobody needs. So a short line gets served and a long one lives on leftovers.

A robot that builds at the far end of every line pays **16% of the clock**.

## Heat, and what to do about it

Coolant basins and heat sinks carry heat away. The baked yard throws it back,
and it is the cheapest ground on the site. A datacenter's heat settles instead
of climbing: it rises with the work it does and falls in proportion to how hot
it already is. So the resting temperature is known before you build, and the
panel prints it.

A site that rests at 100% goes dark. A dark machine restarts once it cools to
60%, which takes 8 seconds beside coolant and 40 seconds in the yard.

**Fans** are the answer to hot ground. A fan cools the 8 tiles around it and
costs money every second. Three chiller towers turn the worst yard on the site
into ground a level 5 datacenter survives on, and the bill runs $96 a second.

| fan | cools | costs to run |
|---|---|---|
| Box fan | +2 | $1.50/s |
| Blower | +4 | $7.00/s |
| Chiller tower | +7 | $32.00/s |

Of 148 buildable tiles, 18 hold a level 5 datacenter with no fan at all. A
robot that stays in the yard, fans and all, stops at **300 MW**.

Your AI model is the fourth character. It sets the tokens per second you can
sell. Each tier also cools every datacenter on the site.

## Moving

Drag a building onto bare ground and it moves there, free. It keeps its level.
Lines that no longer reach get cut, and the panel counts them as they go. The
clock is the only thing a misplaced building costs you, which is the currency
this game already scores.

## The site

One connected pad of 148 tiles. Fin stacks wall the north, coolant basins sit
inside the floor, and the baked yard fills the east. Every buildable bay is
ruled at the joints and pegged at the corners. Pick up a tool and every bay it
can stand on lights up. Outside the hazard stripes is bare steel deck.

## The repository

    src/rules.js    every number the game runs on. Draws nothing.
    src/world.js    the site, written as the ASCII art it is
    src/game.js     state in, state out. Pure functions only.
    src/render.js   the floor, the coolant, the lines and the machines
    src/ui.js       the production column and the panels
    src/sprites.js  13 machines, 12 by 12, 1 character per pixel
    src/main.js     the loop, the pointer, the speed control
    test/           59 tests, including one that plays the whole game
    tools/          the balance harness, a map printer and a single file build

Plain ES modules, no build step. `index.html` is the whole application. Open it
and edit it.

    npm test         run the tests
    npm run balance  play a full game with a robot, and print the timeline
    npm run players  4 robots, 4 strategies, side by side
    npm run map      print the site's cooling geography
    npm run bundle   fold the modules into one page, to hand to somebody

## Speed

1x, 3x and 10x multiply real seconds. Game seconds hold still, so a 27 minute
run reads 27 minutes on the clock and on the board at every speed. The world
steps in 0.25 second slices, so heat and money land in the same place however
fast you watch them.

## Balance

The numbers came first, and a robot tuned them. `tools/balance.js` plays the
real game through the real rules with a player who always takes the obvious
choice. It reads the signals the production column shows a person, then fixes
the cheapest one it can afford:

1. a datacenter is running under 98%
2. a datacenter is too hot to grow, so buy it a fan
3. power is going spare
4. the model is dropping tokens

Run `npm run players`:

| robot | breaks | result |
|---|---|---|
| careful | nothing | **26:50**, 29 plants, 29 datacenters, 20 fans |
| sprawler | distance | 31:12, 16% slower |
| sunbaked | cooling | stops at 300 MW |
| flat | the upgrade curve | stops at 29 MW |

`careful` gets there in 27 minutes with a move to make in every minute of it.
`test/balance.test.js` fails when that stops being true.

The other 3 exist to prove the rules earn their place. Each breaks 1 rule, and
each pays for it.

At the finish `careful` makes 1,215 MW and uses 1,005. 103 MW burns in the
lines and 107 MW goes spare, across 78 machines and 110 lines.

## The leaderboard

The clock runs in your browser. Anyone can open the console and post any
number, so the game leaves the state on `window.gigawatt` and says so. Out of
the box the board stays on your machine. Point `ENDPOINT` in
`src/leaderboard.js` at a host that takes a POST and the same board goes
public.

## Left out of version one

Offline progress, prestige, research trees, random events, sound, a map
generator, accounts, and a phone layout. One site, one sitting.
