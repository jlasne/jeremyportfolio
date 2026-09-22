# outreach

Writes Instagram DMs to the leads brandmatch already delivered.

A local Chrome, the page read as text, and a small model choosing one action
per step. No screenshots unless text alone fails and the fallback is switched
on, which it is not by default.

## What it does in one pass

1. Reads leads from the brandmatch client API, best first.
2. Opens the new-message screen in a Chrome that is already logged in.
3. Searches the handle, picks the account, opens the chat.
4. Types the message one character at a time.
5. Stops there. Sending needs `--send`, every run.
6. Moves the lead to `contacted` and logs the cost.

Step 2 used to open the profile and press its Message button. On a real
account that button changed neither the address nor anything on the page, so
`openWith` now defaults to `direct`. Set it to `profile` to use the old route.

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

**A click that does nothing loses its place in the list.** Not an argument
with the model, a removal. Shown a dead button again it answers the same way
at the same price, which is how the first real run spent four calls a profile
pressing Message. Only an empty list ends the lead.

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

Three models, and a slug is always `vendor/model`. A bare name fails the call.

| | model | in | out |
| --- | --- | --- | --- |
| Decide | `typesafe/jev-1.13` | $0.042/M | free |
| If that errors | `deepseek/deepseek-v4-flash-0731` | $0.04/M | $0.64/M |
| Vision, off | `deepseek/deepseek-v4-flash-vision-exp` | $0.22/M | $0.66/M |

Jev answers with a typed choice rather than prose, which is the shape of every
question this loop asks, and its output costs nothing. The fallback list is
walked by OpenRouter itself, so an error costs no second request.

`OPENROUTER_MODEL` and `OPENROUTER_VISION_MODEL` override them, the same two
names the backend reads.

The `priceIn` and `priceOut` numbers feed the cost log and nothing else. Copy
them off the model's page on OpenRouter so the log matches the invoice.

Log the account in once. The profile is kept between runs, so this is done
once per account, not once per run:

    npm run build
    node dist/cli.js login --account yourhandle

The agent finds the Chrome already installed and drives that. Playwright
stopped shipping a browser on install, so without one there is nothing to
drive. `node dist/cli.js status` prints which one it found.

Two ways out if it finds none: set `CHROME_PATH` to the binary, or run
`npx playwright install chromium` for a separate 150MB copy. The first is
better. The account then runs on the build, the fonts and the version it has
always logged in from.

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
