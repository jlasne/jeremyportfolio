# brandmatch backend, on Convex

TypeScript end to end. The database, the crawl, the scoring, the API and MCP
all live in `convex/`.

## The model

The profile row is shared. The lead is not.

```
creators     the shared pool, one row per handle, no owner
discoveries  who was handed whom, and when
scores       the per campaign read of a pooled creator, written by the model
marks        what the brand typed: notes, tags, rejections, done
```

**A brand sees only the leads attributed to it.** Every read starts from its
own discoveries, so a handle another brand holds is unreachable, not merely
hidden.

**A lead is exclusive for 14 days.** Handing a creator over sets `claimedBy`
and `claimedUntil` on the creator itself. Postgres carried that in a join over
the discovery log; here it is two fields, so deciding whether a handle is free
is a document read. Change the window in `scoring.ts`.

**Pool first, crawl second.** Apify bills about $0.0023 a profile, measured
over 262 runs. A handle already in the database costs nothing. So every night
`pool.shortfall` fills the quota from what is free and unclaimed and returns
what is left. Zero means no run starts at all.

**One credit, one lead.** Wherever it came from. `pool.deliver` is the only
way a discovery is ever written, so no path can hand a lead over free, and
both the pool and the crawl stop at the balance.

**The model proposes, a human approves.** `propose` reads the brand's site and
writes a brief plus three agents with hashtags. They land as `proposed`, which
the crawl skips. Approving one flips it to `active`.

## The chain

```
website ─▶ propose ─▶ 3 agents, proposed ─▶ a human approves ─▶ active

cron (hourly) ─▶ crawl.run ─▶ pool fills the quota, free
                          └▶ shortfall only ─▶ Apify search
                                                └▶ /apify ─▶ Apify detail
                                                              └▶ /apify ─▶ ingest.save
                                                                            ├─▶ creators, posts
                                                                            ├─▶ claim, one credit each
                                                                            └─▶ qualify ─▶ scores
```

Nothing waits. Apify calls back when a run ends.

## Files

| File | What it holds |
| --- | --- |
| `schema.ts` | Every table and index |
| `scoring.ts` | The three stars, the claim window, the filters |
| `pool.ts` | Claim, credit, deliver, seed, shortfall |
| `leads.ts` | The feed, the detail panel, the marks |
| `brands.ts` | Brands, campaigns, agents, stats, waitlist |
| `crawl.ts` | Starts Apify runs for whatever is due |
| `ingest.ts` | Takes the run output into the pool |
| `qualify.ts` | The Niche star, through OpenRouter |
| `propose.ts` | Website in, brief and three agents out |
| `http.ts` | The REST API and the Apify callback |
| `mcp.ts` | The same leads and writes, spoken as MCP |
| `crons.ts` | Hourly, at minute 17 |

## Getting it running

```sh
cd brandmatchapp/convex
npm install
npx convex dev            # first run links the project and generates types
```

Then set the environment, in the Convex dashboard under Settings →
Environment Variables, or from the CLI:

```sh
npx convex env set APIFY_TOKEN          <from console.apify.com>
npx convex env set OPENROUTER_API_KEY   <from openrouter.ai/keys>
npx convex env set OPENROUTER_MODEL     deepseek/deepseek-v4-flash-0731
npx convex env set CRAWL_SECRET         <any long random string>
```

`CRAWL_SECRET` is what the Apify webhook signs itself with. It only has to
match itself.

## The pool

14,259 creators, carried over from the first build. 3,611 carry an email.

```sh
gunzip -k seed/creators.jsonl.gz
npx convex import --table creators seed/creators.jsonl
```

`seed/transform.mjs` is what produced that file, if it ever needs rebuilding.

## Calling it

The API lives on the deployment's `.convex.site` address.

```sh
curl https://<deployment>.convex.site/api/contacts \
  -H "Authorization: Bearer $BRANDMATCH_KEY"
```

| Route | Method | Notes |
| --- | --- | --- |
| `/api/waitlist` | POST | Public. `{ email, website? }` |
| `/api/me` | GET | Credits, and what is still free to this brand |
| `/api/contacts` | GET | `campaign`, `scope`, `limit`, `offset` |
| `/api/creators/:id` | GET | Profile and its last 12 posts |
| `/api/campaigns` | GET POST | POST seeds from the pool first, free to us |
| `/api/campaigns/:id` | PATCH | Brief, filters, volume, active |
| `/api/campaigns/:id/agents` | POST | A searcher with its own hashtags |
| `/api/campaigns/:id/propose` | POST | The model reads the site, writes three agents |
| `/api/campaigns/:id/run` | POST | Fill now. Pool first, then the shortfall |
| `/api/agents/:id/approve` | POST | A proposed agent starts running tonight |
| `/api/agents/:id/pause` | POST | Stop it without deleting it |
| `/api/agents/:id` | DELETE | Remove it |
| `/api/stats` | GET | `days`, up to 180 |
| `/api/actions` | POST | `reject`, `unreject`, `done`, `undone`, `note`, `tag`, `untag` |

## MCP

```
https://<deployment>.convex.site/mcp
```

JSON-RPC 2.0 on one POST endpoint, brand key as a bearer token. Tools:
`list_leads`, `get_lead`, `classify_lead`, `list_campaigns`, `account`.
`initialize` and `tools/list` answer without a key, since a client lists
before it authenticates. Everything else runs the same ownership checks as
the REST API, so an AI cannot read or write a lead the brand does not hold.

## Pointing the front end at it

`app/src/lib/api.ts` holds the address. Either edit `DEFAULT_API` and rebuild,
or set `brandmatch.api` in localStorage to try a deployment without one.

## A note on the generated types

`convex/_generated/` is written by `convex dev`. The copy checked in during
the move is a stand-in derived from `schema.ts`, so the code could be
typechecked before a deployment existed. The first `convex dev` overwrites it.
