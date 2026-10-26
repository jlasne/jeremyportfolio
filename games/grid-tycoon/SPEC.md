# Grid Tycoon Game Spec

Oct 26, 2026 · @Jeremy. Transcribed from the source PDF. This is the product spec: what the game is. `DESIGN.md` next to it holds the engineering decisions that fill its gaps.

## Overview

Grid Tycoon is a turn-based business sim in a web browser. You run one energy and compute company for 40 rounds, and the highest share price at round 40 wins.

- **Fantasy:** build power plants, grid links and datacenters, then sell electricity and compute to 5 client pools.
- **Inspiration:** the round-based decision loop of Cesim Global Challenge, cut to 4 decisions per round.
- **Modes:** solo against 3 simulated rivals, or multiplayer with 2 to 6 players on one shared market.
- **Session length:** about 25 minutes for 40 rounds in solo.
- **Platform:** one web app that works on desktop and phone.
- **Look:** refined pixel art, smooth and readable, with a small living map of your company.

**Core tension:** demand grows at random but in a steady way, and rivals share it. Build too little and rivals take the growth. Build too much and idle capacity earns nothing and lowers your stock.

**Out of scope for version 1:** player-set prices, a cash flow statement and balance sheet, random disaster events, and visiting rival companies on a world map (planned later).

## Round flow

One round is one quarter, and a game runs 40 rounds (10 game years). Every company decides at the same time, then the engine resolves everyone together.

**Decision phase (player input, in this order on screen):**

1. **Review:** last round revenue, profit, treasury, share price, rank, demand per pool, and your own used share per pool.
2. **Finance:** take loans, repay loans early, and either issue shares or buy back shares (never both in one round).
3. **Build:** buy or upgrade plants, datacenters and grid links with the treasury.
4. **Allocate power:** split your plant MW between your own datacenters, citizens and government, and other companies.
5. **Allocate compute:** split your datacenter MW across cloud, bitcoin mining and AI. Set how many MW to rent if your own power falls short.
6. **Lock in:** in multiplayer, the round resolves when every player locks in or the timer ends.

**Resolution phase (engine, fixed order):**

1. Advance build timers. Finished buildings come online this round.
2. Grow each demand pool by its random step.
3. Match rented power: buyers take surplus MW offered by other companies first, then the market.
4. Allocate each pool among companies with the 80% incumbent rule (see Demand pools).
5. Compute revenue, electricity cost, rent, interest and maintenance per company.
6. Profit = revenue minus all costs. Treasury = treasury + profit.
7. Handle due loans: repay, refinance, or fail (see Debt and shares).
8. If treasury is below 0, run the losing round rule.
9. Update market cap and share price for every company.
10. Publish results: rankings per pool and share price ranking for all players.

**Budget for the next round** = treasury after resolution. Cash raised from a share issue or a loan lands in treasury at once and can be spent in the same decision phase.

## Assets and building

A company owns 3 kinds of assets: plants make MW, datacenters turn MW into compute, and grid links carry MW. Every company starts with 1 small plant, 1 small datacenter, 1 internal link of 2 MW, and a treasury of 30.

**Power flow (3 grid links, 5 client pools).** Plant power reaches clients through a grid link, except sales to rivals.

- Plants (2 or 10 MW each) → **Town link** (needed for citizens) → Citizens + gov, 1.0 per MW.
- Plants → **Internal link** (own MW to own DC) → Datacenters (2 or 10 MW each) → Cloud 2.0 per MW, Bitcoin mining 1.6 per MW, AI 3.2 per MW.
- Plants → Other datacenters, 1.3 per MW, no link. Rivals' offers fill rent first.
- Rented power (rivals 1.3, market 1.6) → **Import link** (buyer pays it) → Datacenters.

The 3 highlighted links are the only paths for your MW, except power sold to the other datacenters pool, where the buyer brings the link.

| Asset | Size | Capacity | Cost | Build time | Maintenance per round |
| --- | --- | --- | --- | --- | --- |
| Plant | Small | 2 MW | 10 | 1 round | 2% of price paid |
| Plant | Big | 10 MW | 40 | 3 rounds | 2% of price paid |
| Plant upgrade | Small to big | 10 MW | 46 | 4 rounds | 2% of price paid |
| Datacenter | Small | 2 MW | 12 | 1 round | 2% of price paid |
| Datacenter | Big | 10 MW | 50 | 3 rounds | 2% of price paid |
| Datacenter upgrade | Small to big | 10 MW | 58 | 4 rounds | 2% of price paid |
| Grid link | Any | Per MW bought | 1 per MW | Next round | Included |

**Build rules**

- Cost leaves the treasury when the order is placed. The building comes online at the start of resolution once its timer reaches 0.
- Small plus upgrade costs 56 against 40 for big at once (1.4 times) and takes 1 extra round. This is the price of starting small.
- A small building keeps running at 2 MW during its upgrade.
- No limit on the number of buildings. Treasury is the only limit.

**Grid link rules**

- Each link serves exactly 1 use, like a plant or a datacenter. A link's capacity in MW caps the MW it carries.
- **Internal link:** your plants to your datacenters.
- **Town link:** your plants to citizens and government. Without one, you cannot sell to that pool.
- **Import link:** rented MW into your datacenters. The buyer pays for it, the seller needs nothing.
- Selling MW to the other datacenters pool needs no link from the seller.
- Links can grow: buy more MW on an existing link, ready next round.

**Selling a building** happens only in a losing round (see Debt and shares). The company gets back 30% of the price paid, including upgrade costs.

## Demand pools

All companies sell into 5 shared pools. Each pool's demand follows a steady random path, and companies already serving a pool keep at least 80% of what they used last round.

| Pool | Buys | Start demand | Mean growth per round | Volatility per round |
| --- | --- | --- | --- | --- |
| Citizens and government | Power | 4 MW × companies | 1.0% | 0.5% |
| Other datacenters | Power | 2 MW × companies + player rent | 3.0% | 1.5% |
| Cloud | Compute | 2 MW × companies | 3.0% | 1.0% |
| Bitcoin mining | Compute | 2 MW × companies | 2.0% | 6.0% |
| AI | Compute | 2 MW × companies | 6.0% | 3.0% |

**Growth model (per pool, per round)**

```
g_t = g_{t-1} + 0.3 (mu - g_{t-1}) + sigma * eps_t,   eps_t ~ N(0,1)
D_t = D_{t-1} (1 + g_t)
```

- g starts at the mean mu. The 0.3 pull keeps paths steady: a pool drifts, it does not jump from boom to bust in one round.
- Clamp g between −10% and +20% per round.
- All randomness comes from one seeded generator, so the same seed gives the same game for every player.
- Unserved demand is lost. It does not carry to the next round.
- The other datacenters pool also adds every player's rent request for that round.

**Expected growth (hidden before deciding, shown after)**

```
E_t = 0.7 E_{t-1} + 0.3 g_{t-1}
```

The market expects what it saw recently. When a pool slows down, expectations lag behind, and companies exposed to that pool miss.

**Allocation algorithm (per pool)**

Inputs: demand D, each company's offered MW O, and its used MW last round U.

1. Reserved R = min(O, 0.8 × U). If the sum of R exceeds D, scale every R by D / sum of R and stop.
2. Open MW = D − sum of R. Spare S = O − R.
3. If the sum of S fits in the open MW, every company gets its full S. Otherwise each gets open MW × S / sum of S.
4. Used = R + its open share. Idle = O − used.

**Worked example (use as a unit test):** AI demand grows from 10 to 14 MW.

| Company | Used last round | Offered | Reserved 80% | Spare | Open share | Used now | Idle |
| --- | --- | --- | --- | --- | --- | --- | --- |
| You | 5 | 8 | 4 | 4 | 2 | 6 | 2 |
| Rival A | 5 | 6 | 4 | 2 | 1 | 5 | 1 |
| Rival C (new) | 0 | 6 | 0 | 6 | 3 | 3 | 3 |

Open MW = 14 − 8 = 6. Spare total = 12, so each company gets half its spare.

**What players see:** last round demand per pool, their own used MW per pool, and after resolution a ranking of who leads each pool. They never see a forecast or rivals' exact MW.

## Revenue and costs

Every pool pays a fixed rate per MW used, and players set no prices. Profit per round = revenue − power cost − rent − maintenance − interest.

| Item | Per MW per round |
| --- | --- |
| Revenue: citizens and government | 1.0 |
| Revenue: other datacenters (power sold to rivals and background buyers) | 1.3 |
| Revenue: cloud | 2.0 |
| Revenue: bitcoin mining | 1.6 |
| Revenue: AI | 3.2 |
| Cost: own plant power, per MW used | 0.4 |
| Cost: rent from rival sellers | 1.3 |
| Cost: rent from the market when rivals cannot cover it | 1.6 |

**Power routing**

- Plant output = online plant capacity. The player splits it between the internal link, the town link and an offer to the other datacenters pool. Unassigned MW sits idle.
- Datacenter powered MW = internal MW received + rented MW. Rented MW is capped by the import link.
- Compute offered across cloud, bitcoin and AI cannot exceed min(datacenter capacity, powered MW).
- Own power cost applies only to MW that ends up used, sold or consumed.
- Rent is a contract: the buyer pays for every MW requested, used or not. Rival sellers fill it first at 1.3, the market fills the rest at 1.6.

**Margins that drive strategy**

| Use of 1 MW | On own power | On rented market power |
| --- | --- | --- |
| AI | 2.8 | 1.6 |
| Cloud | 1.6 | 0.4 |
| Bitcoin mining | 1.2 | 0.0 |
| Power to rivals | 0.9 | not possible |
| Power to citizens | 0.6 | not possible |

**Starting round check:** 2 MW on AI earns 6.4, minus 0.8 power and 0.44 maintenance, so 5.16 profit per round.

**Treasury** = previous treasury + profit + loans taken + share issue cash − build costs − repayments − buybacks. It earns no interest and has no penalty.

## Stock price

Share price = market cap / number of shares, and the winner has the highest share price at round 40. Every company starts at a market cap of 100 with 10 shares, so a price of 10.

**Step 1. Market return for the round**

```
r_t = 0.5 clamp(dRev, -30%, +30%) + sum_p w_p (g_p - E_p) - P_idle
```

- dRev = this round's revenue growth against last round.
- w = the share of revenue from pool p last round. g = actual growth, E = expected growth.
- P_idle = 1% for every 10 points of idle capacity above 20%. Idle = 1 − used MW / online MW, plants and datacenters counted together.

**Step 2. Business value, pulled toward fundamentals**

```
BV_t = 0.85 BV_{t-1} (1 + r_t) + 0.15 FV_t
FV_t = 20 × max(avg profit of the last 4 rounds, 0) + 0.3 × building price paid
```

The average profit of the last 4 rounds anchors value, so hype cannot drift forever.

**Step 3. Debt drag, then market cap**

```
c = min(1, (interest + principal due this round) / revenue),   f(c) = (e^{3c} − 1) / (e^3 − 1)
MC_t = max(BV_t − debt × f(c), 0.01)
```

| Debt cost against revenue | 10% | 30% | 50% | 80% | 100% |
| --- | --- | --- | --- | --- | --- |
| Share of debt taken off market cap | 2% | 8% | 18% | 52% | 100% |

Low debt costs almost nothing. In the round a loan falls due, the principal counts as cost, so the drag spikes.

**Treasury sits outside market cap.** Issuing shares lowers the price, buying back raises it.

**Worked example (unit test):** expected AI growth 7%, actual 2%. Expected cloud 3%, actual 3.5%. Revenue flat, no idle, no debt.

| Company | AI share of revenue | Cloud share | Return |
| --- | --- | --- | --- |
| A | 60% | 40% | −2.8% |
| B | 20% | 80% | −0.6% |

AI still grows, yet A falls almost 5 times more than B. A balanced mix swings less.

## Debt and shares

Loans have no limit and get cheaper when revenue comes from stable clients. Shares can be issued or bought back, up to 20% per round, never both in one round.

**Loan rate**

| Rank | Pool | Stability weight |
| --- | --- | --- |
| 1 | Citizens and government | 1.0 |
| 2 | Cloud | 0.8 |
| 3 | Other datacenters | 0.6 |
| 4 | AI | 0.3 |
| 5 | Bitcoin mining | 0.1 |

```
annual rate = 12% − 8% × sum_p w_p · stability_p   (+4 points if treasury < 0 or last profit < 0)
```

- Example: 50% citizens and 50% cloud gives a score of 0.9, so 4.8% a year. 100% bitcoin gives 11.2%.
- The rate is fixed when the loan is taken. Interest per round = principal × annual rate / 4.
- Every loan lasts 8 rounds. Interest is paid each round, the full principal at the end.
- Early repayment of any loan is allowed in any decision phase, with no fee.
- A company can hold several loans, each with its own rate and due date.
- **Refinance:** at the due date, the player can roll the principal into a new 8 round loan at the current rate. Refused if treasury is below 0.

**Risk view (shown before a loan is confirmed)**

- Estimated revenue next round = last round revenue × (1 + revenue-weighted growth seen last round).
- Interest due next round across all loans, including the new one.
- Debt cost as a share of estimated revenue, and the market cap drag it creates.
- The next due date and its principal.

**Shares**

- Issue: up to 20% of current shares at the current price. Cash lands in treasury at once. Shares go up, market cap stays, so the price drops.
- Buyback: up to 20% of current shares at the current price, paid from treasury. Shares go down, so the price rises.
- Buyback cash cannot exceed treasury minus total debt. This stops borrowing to pump the price (assumption, see open questions).

| Action | Market cap | Shares | Price | Cash |
| --- | --- | --- | --- | --- |
| Start | 100 | 10 | 10.0 | 0 |
| Issue 2 shares | 100 | 12 | 8.3 | +20 |
| Buy back 2 shares | 100 | 8 | 12.5 | −20 |

**Losing round and bankruptcy**

1. If treasury is below 0 after resolution, the next decision phase opens on a forced sale screen.
2. The player picks buildings to sell. Each returns 30% of its price paid, until treasury is 0 or above.
3. With no building left and treasury still below 0, the engine issues shares at the current price until treasury reaches 0. The 20% cap does not apply here.
4. If market cap falls to the 0.01 floor, the company is bankrupt and leaves the game. Its used MW frees up for the others next round.

## Solo and multiplayer

Both modes run the same engine and the same rules. Only the source of decisions changes: bot code or human players.

**Solo: 3 bot rivals with distinct styles**

| Bot | Builds | Sells to | Finance habit |
| --- | --- | --- | --- |
| Volta Utility | Plants first, big sizes | Citizens, cloud, rivals | Borrows little, never buys back |
| Nimbus Compute | Datacenters, rents power | AI first, then cloud | Borrows up to 50% of market cap |
| Hashfield Mining | Small plants, small datacenters | Bitcoin, then rivals | Issues shares when treasury is low |

- Bots follow simple rules: build when treasury passes 1.5 times the next build cost, shift MW toward the pool where their used share was highest last round, keep idle under 25%.
- Bots play with the same information as the player. They never see the seed or future demand.
- Bot decisions run in the resolution step before allocation, so the player and bots are resolved together.

**Multiplayer: 2 to 6 players**

- A host creates a room and shares a 6 letter code. Empty seats fill with bots if the host chooses.
- Every company starts the same. Demand pools scale with the number of companies.
- Live mode: 3 minute timer per round. When a player misses the timer, their allocations from last round repeat and no new builds or finance actions happen.
- The server holds the game state and runs resolution. Clients send decisions only.
- After each round, every player sees all share prices and a ranking of who leads each pool.
- A player who drops can rejoin with the room code and continue from the current round.

**Later (not version 1):** a world map where players visit rival companies and see their buildings, plus async mode with 1 round per day.

## Screens and interactions

The company map is home, and every decision opens as a panel over it. A full round takes under 1 minute once a player knows the game.

| Screen | Purpose | Key interactions |
| --- | --- | --- |
| Title | Start solo, host or join multiplayer, settings | Room code field, seed field for solo replays |
| Company map (home) | Your plants, links and datacenters on a small tile map | Tap a building for its card: MW, used, idle, upgrade button. Power flows as moving dots along links |
| Top bar | Always visible status | Round x of 40, treasury, share price with arrow, rank, Lock in button |
| Build panel | Buy, upgrade, extend links | Cards with cost, MW and build time. Drag a card onto an empty tile to place it. A ghost crane shows the countdown |
| Allocate panel | Split plant MW and datacenter MW | One stacked slider per building type, segments draggable. Live margin per segment. Snap to 1 MW |
| Finance panel | Loans, repay, issue or buy back | Loan amount stepper with the risk view under it. Issue and buyback share one toggle, so only one is possible |
| Market panel | Demand per pool, your used share, rankings | One small line chart per pool with past demand. Your used MW as a filled band under it |
| Round results | What happened and why | Animated sequence: demand change per pool, your revenue by pool, stock move broken into its parts, new ranking |
| Forced sale | Losing round | Buildings listed with 30% return value. Confirm when treasury reaches 0 |
| End screen | Final ranking at round 40 | Share price chart of all companies over 40 rounds, replay seed, share card image |

**Smart helpers (keep the game simple without hiding the rules)**

- **Projection line:** before locking in, the top bar shows estimated profit next round from current allocations, using last round demand.
- **Warnings as chips, never pop-ups:** idle above 20%, link capacity below assigned MW, rent above import link, loan due within 2 rounds.
- **Stock breakdown:** after each round, the share price move splits into revenue growth, demand miss per pool, idle penalty and debt drag, each as a signed bar.
- **Undo:** every decision in the current phase can be undone until lock in.
- **First game tutorial:** 5 short steps over rounds 1 to 3, one action each: allocate, build, read results, borrow, lock in.
- **Input:** mouse, touch and keyboard. Tab moves between panels, arrow keys move slider segments by 1 MW.

## Art direction

The look is hi-bit pixel art: detailed 32 px sprites drawn at 2 or 3 times scale, with smooth motion and clean UI panels. The world is pixel art, the interface is crisp and modern, so numbers stay easy to read.

**Style rules**

- **View:** 3/4 top-down, orthographic, like Stardew Valley. One company plot fills about 12 × 8 tiles.
- **Sprites:** 32 × 32 px tiles, buildings 64 × 64 px (big ones 96 × 96 px). Integer scaling only, nearest-neighbour filtering, so pixels stay sharp and never blur.
- **Detail level:** 2 to 3 shading tones per material, a 1 px dark outline on buildings only, soft ambient shadows under them. Enough pixels to feel crafted, never chunky 8-bit.
- **Motion:** sprites move on a smooth sub-pixel path (tweened), while their art stays on the pixel grid. Easing on every panel and number change.
- **UI:** flat panels with 12 px rounded corners, a soft 2 px shadow, and a cream or dark slate fill. Pixel font only for headings and big numbers. A clean sans-serif for body text and labels.
- **Fonts:** headings in a pixel face such as Silkscreen or Pixelify Sans. Body in Nunito Sans. Numbers in tabular figures.
- **Palette:** about 32 colours. Each asset type owns one hue: plant orange, grid blue, datacenter violet, town green, electricity yellow, money teal. Status colours stay separate: good green, warning amber, critical red.
- **Themes:** light and dark modes, both designed.

**The map comes alive (each tied to a rule)**

| Sprite or effect | Shows |
| --- | --- |
| Plant smoke puffs, turbine blades, solar shimmer | Plant output in use. Idle plants go still |
| Yellow dots flowing along links | MW in transit, speed scaled to MW |
| Datacenter rack lights blinking | Used compute. Idle racks turn dim |
| Crane with a floating countdown | A build or upgrade in progress |
| Small houses that multiply | Your MW share of the citizens pool |
| Coins popping over buildings at resolution | Revenue earned by that building |
| Season tint on the ground: spring, summer, autumn, winter | The quarter. 1 round = 1 season |

**Sound:** soft chiptune loop, 1 per season. Short cues for lock in, coins, crane finish, stock up, stock down. Mute toggle in the top bar.

**Accessibility:** colour is never the only signal, every status chip also carries an icon and a word. Reduced motion setting stops flow dots and tweening. Minimum text size 14 px.

**References for the artist or for asset prompts:** Stardew Valley (world), Eastward (lighting and detail), Kairosoft games such as Game Dev Story (business sim tone), Mini Motorways (clean interface).

## Tech stack and data model

The game engine is a pure TypeScript module with no UI code: one function takes a state and everyone's decisions and returns the next state. The same engine runs in the browser for solo and on the server for multiplayer.

| Layer | Choice | Why |
| --- | --- | --- |
| App | Vite, React, TypeScript | Fast build, typed rules |
| Map rendering | PixiJS 8 | GPU sprites, pixel-perfect scaling, smooth tweening |
| UI state | Zustand | Small store for panels and draft decisions |
| Engine | Pure TS package, seeded RNG (mulberry32) | Deterministic: same seed and decisions give the same game |
| Tests | Vitest | Worked examples in this spec become unit tests |
| Multiplayer | Supabase Postgres + Realtime, resolution in an Edge Function | Rooms, presence and server-side resolution without a custom server |
| Hosting | Vercel | One link to share |
| Art pipeline | Aseprite, PNG sprite sheets + JSON atlas | Standard for pixel art |

**Rules for the codebase**

- Every number from the tuning table lives in one file, `config/balance.json`. No magic numbers in engine code.
- The engine exposes `resolveRound(state, decisions, config) → state` and `validateDecision(state, companyId, decision)`.
- Money values use plain numbers rounded to 2 decimals at the end of each resolution step.
- Solo saves the full state to local storage after each round, wrapped in try and catch.

**Core data model (from the spec; DESIGN.md extends it)**

```ts
type PoolId = 'citizens' | 'otherDc' | 'cloud' | 'btc' | 'ai';

interface GameState { seed: number; round: number; pools: Record<PoolId, Pool>; companies: Company[]; }
interface Pool { demand: number; growth: number; expectedGrowth: number; lastUsed: Record<string, number>; }

interface Company {
  id: string; name: string; isBot: boolean; bankrupt: boolean;
  treasury: number; shares: number; businessValue: number; marketCap: number;
  buildings: Building[]; links: Link[]; loans: Loan[];
  history: RoundResult[];
}
interface Building { id: string; kind: 'plant' | 'dc'; size: 'small' | 'big'; mw: number;
  status: 'building' | 'online' | 'upgrading'; roundsLeft: number; pricePaid: number; tile: [number, number]; }
interface Link { id: string; use: 'internal' | 'town' | 'import'; mw: number; roundsLeft: number; }
interface Loan { id: string; principal: number; annualRate: number; dueRound: number; }

interface Decision {
  builds: { kind: 'plant' | 'dc' | 'link'; size?: 'small' | 'big'; use?: Link['use']; mw?: number; tile?: [number, number] }[];
  upgrades: string[];
  power: { internal: number; town: number; otherDc: number };
  compute: { cloud: number; btc: number; ai: number };
  rentMw: number;
  loans: { take: number; repay: Record<string, number>; refinance: string[] };
  shares: { mode: 'none' | 'issue' | 'buyback'; count: number };
  forcedSales: string[];
}
```

## Tuning table

These are the starting values for `config/balance.json`. They are first guesses, and playtests will change them.

| Key | Value | Unit |
| --- | --- | --- |
| rounds | 40 | rounds |
| start.treasury | 30 | money |
| start.shares | 10 | shares |
| start.businessValue | 100 | money |
| start.buildings | 1 small plant, 1 small datacenter, 2 MW internal link | |
| plant.small | 2 MW, cost 10, 1 round | |
| plant.big | 10 MW, cost 40, 3 rounds | |
| plant.upgrade | cost 46, 4 rounds | |
| dc.small | 2 MW, cost 12, 1 round | |
| dc.big | 10 MW, cost 50, 3 rounds | |
| dc.upgrade | cost 58, 4 rounds | |
| link.costPerMw | 1 | money per MW |
| maintenanceRate | 2% | of price paid per round |
| sellBackRate | 30% | of price paid |
| rate.citizens / otherDc / cloud / btc / ai | 1.0 / 1.3 / 2.0 / 1.6 / 3.2 | money per MW used |
| cost.ownPower | 0.4 | money per MW used |
| cost.rentRival / rentMarket | 1.3 / 1.6 | money per MW rented |
| pool.startPerCompany | 4 / 2 / 2 / 2 / 2 | MW, same pool order |
| pool.meanGrowth | 1.0 / 3.0 / 3.0 / 2.0 / 6.0 | % per round |
| pool.volatility | 0.5 / 1.5 / 1.0 / 6.0 / 3.0 | % per round |
| pool.meanReversion | 0.3 | |
| pool.growthClamp | −10 to +20 | % per round |
| expectation.weightOld / weightNew | 0.7 / 0.3 | |
| incumbentShare | 80% | of last round used MW |
| stock.revenueGrowthWeight | 0.5 | |
| stock.revenueGrowthClamp | ±30% | |
| stock.idleFree / idlePenaltyPer10 | 20% / 1% | |
| stock.fundamentalWeight | 0.15 | |
| stock.profitMultiple / bookWeight | 20 / 0.3 | |
| debt.dragSteepness | 3 | exponent k in f(c) |
| loan.baseRate / stabilitySpread / stressAdd | 12% / 8% / 4 points | per year |
| loan.termRounds | 8 | rounds |
| stability.citizens / cloud / otherDc / ai / btc | 1.0 / 0.8 / 0.6 / 0.3 / 0.1 | |
| shares.maxChangePerRound | 20% | of current shares |
| marketCap.floor | 0.01 | money |
| multiplayer.roundTimer | 180 | seconds |
| solo.bots | 3 | companies |

## Build milestones

Build the engine first and prove it with tests, then add the screens, then the art, then multiplayer. Each milestone ends with something playable or testable.

1. **Engine (headless):** data model, seeded RNG, demand growth, allocation, revenue, stock, debt, shares, bankruptcy. A command-line script plays 40 rounds with 4 bots and prints share prices.
2. **Solo with plain UI:** all panels from Screens and interactions, drawn as plain boxes, plus 3 bots, save and resume. A full game can be played start to finish.
3. **Art and map:** PixiJS company map, sprites, flow dots, crane, seasons, sound, light and dark themes, results animation.
4. **Multiplayer:** rooms with codes, 3 minute timer, server resolution, rejoin, bots in empty seats.
5. **Polish:** tutorial, balance pass from 20 bot-only games, phone layout, share card on the end screen.

**Acceptance tests (engine)**

- The allocation example in Demand pools returns used MW of 6, 5 and 3.
- When a pool shrinks below the reserved total, every company's reserved MW scales by the same factor.
- The stock example returns −2.8% for A and −0.6% for B.
- Debt drag f(c) returns 2%, 8%, 18%, 52% and 100% at c of 0.1, 0.3, 0.5, 0.8 and 1.0, within 1 point.
- Issuing 2 of 10 shares at a market cap of 100 gives a price of 8.33 and +20 cash. Buying back 2 gives 12.50 and −20.
- Issue and buyback in the same round is rejected by validateDecision.
- A loan of 20 at 8% a year charges 0.40 per round and 20 at its due round.
- Refinance is refused when treasury is below 0.
- Selling a small plant returns 3.0.
- Selling to citizens without a town link is rejected.
- Same seed and same decisions give identical states after 40 rounds.
- Round 1 with the default start gives 5.16 profit for a company putting 2 MW on AI.

## Assumptions and open questions

The rules above are decided. The items below are assumptions the spec made to fill gaps; each can change without touching the rest.

**Assumptions made in this spec**

- Buyback cash cannot exceed treasury minus total debt, to stop borrowing just to buy back shares.
- Power sold to rivals is priced at the fixed other datacenters rate of 1.3. The market rent price of 1.6 sits above it, so renting from rivals is cheaper.
- Maintenance is 2% of price paid per round.
- Business value is pulled 15% per round toward 20 times average profit, so price cannot drift away from results.
- Loan rates are yearly. Interest per round = rate / 4.
- Players who miss the multiplayer timer repeat last round's allocations.

**Open questions**

- Should bitcoin mining halve its rate at rounds 16 and 32, like a real halving?
- Do seasons change demand, for example citizens +10% in winter?
- Company names and logos: player-chosen or generated?
- Should the world map for visiting rivals reuse the company map tiles?
- Final name of the game: Grid Tycoon is a working title.

**Inspiration and context**

- Round-based decisions with results revealed together, from Cesim Global Challenge.
- Compute as a client of electricity, flexible bitcoin load and grid access as a scarce resource, from Richard Detente interviews: Le Declic par Alec Henry (2026-10-21), Grand Angle (2026-10-04), Grand Angle Nova (2026-10-11).
