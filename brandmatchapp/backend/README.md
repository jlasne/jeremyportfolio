# brandmatch backend

Supabase project `decuztcvbfwgkudnbljk`, schema `brandmatch`.
Dashboard: https://supabase.com/dashboard/project/decuztcvbfwgkudnbljk

## The model

The profile row is shared. The lead is not.

```
creators        the shared pool, one row per handle, no owner
discoveries     who holds which lead, and when it was handed over
creator_scores  the per campaign read of a pooled creator, written by the model
```

**A brand sees only the leads attributed to it.** The feed joins on the brand,
and `/creators/:id` and `/actions` both check the brand holds the lead, so a
handle someone else holds is unreachable by id, not merely hidden.

**A lead is exclusive for 14 days.** Handing a creator to a brand claims it.
Inside `brandmatch.claim_window()` no other brand can be given the same
handle. After that it is free again, by which time its Signal star has long
expired (strong at 4 days, gone at 10), so whoever gets it next gets it
re-crawled. Change the window in one place, that function.

**Pool first, crawl second.** Apify bills about $0.0023 a profile on the
detail phase, measured over 262 runs. A handle already in the database costs
nothing to hand out. So every night `brandmatch.shortfall()` fills the
campaign's quota from what is free and unclaimed, and returns what is left.
Zero means no run starts at all. Only the shortfall is ever crawled.

**One credit, one lead.** A lead costs a credit wherever it came from. A
handle out of the pool costs us nothing to hand over and earns the same
credit as one we crawled, which is where the margin sits: the bigger the
pool, the fewer crawls a credit has to pay for. The charge is a trigger on
`discoveries`, so no code path can hand a lead over for free, and both the
pool and the crawl stop at the balance.

**The model proposes, a human approves.** `propose` reads the brand's own
site and writes the brief plus three agents, each with the hashtags it would
search. They land as `status = 'proposed'`, which the crawl skips. Approving
one flips it to `active`, and only then does it spend anything.

Notes, tags, rejections and done marks belong to the brand and survive every
crawl. Nothing in the schema is reachable with the project's anon key: every
read and write goes through the `api` function, which holds the service role.

### A note on embeds

`discoveries`, `daily_stats` and `apify_runs` each carry a `campaign_id` and
an `agent_id`, so PostgREST reads them as junction tables and any
campaigns-to-agents embed comes back ambiguous. Both places that needed one
use two plain reads instead. Worth knowing before adding a third.

### The functions that carry it

| Function | What it answers |
| --- | --- |
| `claim_window()` | How long a lead stays exclusive. 14 days |
| `credits_left(brand)` | The balance, which caps every delivery path |
| `delivered_today(campaign)` | How much of today's quota is already filled |
| `is_free(creator, brand)` | Is this handle unheld by anyone else |
| `claim(creator, campaign, agent, brand, fresh)` | Take it, or say no |
| `seed_from_pool(campaign, limit)` | Hand over free leads, best signal first |
| `shortfall(agent)` | Fill from the pool, return what must be crawled |
| `free_pool(brand)` | How much of the pool this brand could still be given |

## The three stars

| Star | Where it comes from | Scope |
| --- | --- | --- |
| Niche | the model, against the campaign brief | per campaign |
| Selling | `creators.sells`, read off the pool | shared |
| Signal | `creators.signals`, dated, read off the pool | shared |

The three are independent, so a creator that sells and fired a signal scores 2
before any model has read it. `brandmatch.feed()` adds them up in SQL, the
front end adds them up the same way in `app/src/data/score.ts`.

## Functions

| Function | JWT | Auth | What it does |
| --- | --- | --- | --- |
| `api` | off | brand api key | Everything the front end and a customer's code call |
| `crawl` | off | `x-crawl-secret` | Fills from the pool, crawls only the shortfall |
| `apify-webhook` | off | `x-crawl-secret` | Takes the run output into the pool, then calls qualify |
| `qualify` | on | service role | Asks OpenRouter for the Niche star and writes the scores |
| `propose` | on | service role | Reads the brand's site, writes a brief and three agents |

JWT verification is off where the function runs its own auth. That is what
keeps the project's anon key out of the browser bundle, which matters here:
six tables in `public` belonging to another app are readable with that key.

## Secrets to set

Dashboard → Project Settings → Edge Functions → Secrets.

| Name | Value |
| --- | --- |
| `APIFY_TOKEN` | From https://console.apify.com/settings/integrations |
| `OPENROUTER_API_KEY` | From https://openrouter.ai/keys |
| `OPENROUTER_MODEL` | Optional. Defaults to `deepseek/deepseek-v4-flash-0731` |
| `CRAWL_SECRET` | `select decrypted_secret from vault.decrypted_secrets where name = 'brandmatch_crawl_secret'` |

`CRAWL_SECRET` already exists in the vault, where pg_cron reads it. Paste the
same value into the function secrets so both ends match.

## The daily job

`cron.schedule('brandmatch_hourly_crawl', '17 * * * *')` calls
`brandmatch.kick_crawl()`, which posts to `crawl` with the vault secret. The
function picks every active agent whose last run is over 20 hours old, so one
hourly job covers every timezone without a job per brand.

## The chain

```
website ─▶ propose ─▶ 3 agents, proposed ─▶ a human approves ─▶ active

cron ─▶ crawl ─▶ pool fills the quota, free
             └▶ shortfall only ─▶ Apify search run ─▶ apify-webhook ─▶ Apify detail run
                                                                                  └─▶ apify-webhook
                                                                                        ├─▶ creators, creator_posts
                                                                                        ├─▶ claim, one credit each
                                                                                        └─▶ qualify ─▶ creator_scores
```

A model costs about half a cent to read 500 profiles, against the $1.15 the
same 500 cost to crawl. Judgment is what to buy there, not tokens.

Nothing waits. Apify calls back when a run ends, which is why no function
holds a connection open for the minutes a crawl takes.

## Layout

```
migrations/   the schema, applied in order
functions/    one folder per function, _shared/lib.ts is the source of truth
functions/build.mjs   copies _shared/lib.ts next to each entrypoint for deploy
```

## Calling it

```sh
curl https://decuztcvbfwgkudnbljk.supabase.co/functions/v1/api/contacts \
  -H "Authorization: Bearer $BRANDMATCH_KEY"
```

| Route | Method | Notes |
| --- | --- | --- |
| `/waitlist` | POST | Public. `{ email, website? }` |
| `/me` | GET | Credits, pool size, and what is still free to this brand |
| `/contacts` | GET | `campaign`, `scope`, `limit`, `offset` |
| `/creators/:id` | GET | Profile and its last 12 posts |
| `/campaigns` | GET POST | POST seeds from the pool first, free, and says how many |
| `/campaigns/:id` | PATCH | Brief, filters, volume, active |
| `/campaigns/:id/agents` | POST | A searcher with its own hashtags |
| `/campaigns/:id/propose` | POST | The model reads the site and writes three agents |
| `/agents/:id/approve` | POST | A proposed agent starts running tonight |
| `/agents/:id/pause` | POST | Stop it without deleting it |
| `/agents/:id` | DELETE | Remove it |
| `/campaigns/:id/run` | POST | Starts a crawl now. Needs credits |
| `/stats` | GET | `days`, up to 180 |
| `/actions` | POST | `reject`, `unreject`, `done`, `undone`, `note`, `tag`, `untag` |
