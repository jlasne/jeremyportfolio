# outreach

Writes Instagram DMs to the leads brandmatch already delivered.

A local Chrome, the page read as text, and a small model choosing one action
per step. No screenshots unless text alone fails and the fallback is switched
on, which it is not by default.

## What it does in one pass

1. Reads leads from the brandmatch client API, best first.
2. Opens each profile in a Chrome that is already logged in.
3. Asks the model where to click, from a list of what is on the page.
4. Types the message one character at a time.
5. Stops there. Sending needs `--send`, every run.
6. Moves the lead to `contacted` and logs the cost.

## Four rules built into the shape of it

**The model never writes the message.** It answers a multiple choice question
about the page, and the only two answers that act are a click and a text box
number. The text comes from your templates file. A model that cannot produce a
string cannot produce a string you did not approve.

**The model never names an element.** It picks a number from a list that was
read off the page a moment earlier. An index nobody offered is refused before
anything is clicked.

**The default does not send.** A run writes the message into the box and
leaves it there for a human to read. `--send` sends. `--send --approve` asks
in the terminal, one message at a time.

**The cap lives on disk.** 50 a day per account, counted in `logs/counters.json`,
so a crash mid run does not reset it. A draft costs nothing against the cap,
only a real send does.

## Cost, measured

The test suite runs the whole loop against a local page and a stub model.

| | measured |
| --- | --- |
| Model calls per message | 2 |
| Tokens per message | 316 in, 16 out |
| Cost per message | $0.000074 |
| Cost per 1,500 messages | $0.11 |
| Browser | $0, it runs here |

Instagram needs more steps than a test page, so budget 4 to 6 calls instead of
2. That lands around $0.30 a month at 50 messages a day. Apify costs $0.0023 a
profile for comparison, on a different job.

Every run appends to `logs/`:

- `steps-<date>.jsonl` — one line per decision: goal, url, what was picked, why
- `dms-<date>.jsonl` — one line per lead: outcome, steps, calls, seconds, cost

## Setup

    npm install
    cp config/settings.example.json config/settings.json
    cp config/templates.example.json config/templates.json

Edit both. Then the keys:

    export OPENROUTER_API_KEY=sk-or-...
    export BRANDMATCH_API_KEY=...        # the same key the app keeps under brandmatch.key

The two model slugs default to the ones the brandmatch backend already runs,
`deepseek/deepseek-v4-flash` and `google/gemini-2.5-flash`, so a first run
works before anything is tuned. A slug is always `vendor/model`: a bare name
fails the call and does not fall back.

`OPENROUTER_MODEL` and `OPENROUTER_VISION_MODEL` override them, the same two
names the backend reads.

The `priceIn` and `priceOut` numbers feed the cost log and nothing else. Copy
them off the model's page on OpenRouter so the log matches the invoice.

Log the account in once. The profile is kept between runs, so this is done
once per account, not once per run:

    npm run build
    node dist/cli.js login --account yourhandle

To drive the Chrome you already use, set `CHROME_PATH` to its binary.

## Running

    node dist/cli.js run                      # writes the message, stops
    node dist/cli.js run --send               # sends, at the configured pace
    node dist/cli.js run --send --approve     # asks before each one
    node dist/cli.js status                   # sent today, and what it cost

Flags: `--account`, `--campaign`, `--limit`, `--templates`.

## Pacing

| | default |
| --- | --- |
| Between two messages | 20 to 90 seconds, drawn each time |
| On the profile before writing | 3 to 9 seconds |
| Between two characters | 40 to 160 ms |
| Per account per day | 50 |

Two failed leads in a row stop the run. Instagram answers a run it dislikes by
changing the page, so two dead leads mean the page is not what the agent
thinks it is, and carrying on only costs the account.

## Tests

    npm test

See `test/README.md`. Nothing in the suite reaches Instagram, OpenRouter or
Convex.

## Layout

    src/core/        the loop, the browser, the decision model, the fallback, the log
    src/instagram/   the run, the cap, the pacing, the session, the templates, the leads client
    src/config/      settings and their defaults
    config/          your settings.json and templates.json, both git ignored
    logs/            steps, messages, counters
    sessions/        one logged in Chrome profile per account

## What this costs you if it goes wrong

Automated DMs are against Instagram's terms. The account sending them carries
the risk, and the cap and the pacing limit how much of it lands at once
without removing it. Run it on an account you can afford to lose before you
run it on the main one.
