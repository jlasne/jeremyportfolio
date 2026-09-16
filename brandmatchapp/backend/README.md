# brandmatch backend

Supabase project `decuztcvbfwgkudnbljk`, schema `brandmatch`.
Dashboard: https://supabase.com/dashboard/project/decuztcvbfwgkudnbljk

## The model

One creator is crawled once and belongs to everyone.

```
creators        the shared pool, one row per handle, no owner
discoveries     who found whom, and whether that find was fresh or a pool hit
creator_scores  the per campaign read of a pooled creator, written by the model
```

A brand pays for a fresh crawl, never for a read. A campaign created today
seeds itself from the pool for free, then spends credits only on profiles
nobody had crawled before. Apify bills about $0.0023 a profile on the detail
phase, measured over 262 runs, so one credit is worth roughly a quarter of a
cent of cost.

Notes, tags, rejections and done marks belong to the brand and survive every
crawl. Nothing in the schema is reachable with the project's anon key: every
read and write goes through the `api` function, which holds the service role.

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
| `crawl` | off | `x-crawl-secret` | Starts the Apify search runs for whatever agent is due |
| `apify-webhook` | off | `x-crawl-secret` | Takes the run output into the pool, then calls qualify |
| `qualify` | on | service role | Asks OpenRouter for the Niche star and writes the scores |

JWT verification is off where the function runs its own auth. That is what
keeps the project's anon key out of the browser bundle, which matters here:
six tables in `public` belonging to another app are readable with that key.

## Secrets to set

Dashboard → Project Settings → Edge Functions → Secrets.

| Name | Value |
| --- | --- |
| `APIFY_TOKEN` | From https://console.apify.com/settings/integrations |
| `OPENROUTER_API_KEY` | From https://openrouter.ai/keys |
| `OPENROUTER_MODEL` | Optional. Defaults to `google/gemini-2.5-flash` |
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
cron ─▶ crawl ─▶ Apify search run  ─▶ apify-webhook ─▶ Apify detail run
                                                    └─▶ apify-webhook
                                                          ├─▶ creators, creator_posts
                                                          ├─▶ discoveries, credits
                                                          └─▶ qualify ─▶ OpenRouter ─▶ creator_scores
```

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
| `/me` | GET | Credits and pool size |
| `/contacts` | GET | `campaign`, `scope`, `limit`, `offset` |
| `/creators/:id` | GET | Profile and its last 12 posts |
| `/campaigns` | GET POST | POST seeds from the pool before it crawls |
| `/campaigns/:id` | PATCH | Brief, filters, volume, active |
| `/campaigns/:id/agents` | POST | A searcher with its own hashtags |
| `/campaigns/:id/run` | POST | Starts a crawl now. Needs credits |
| `/stats` | GET | `days`, up to 180 |
| `/actions` | POST | `reject`, `unreject`, `done`, `undone`, `note`, `tag`, `untag` |
