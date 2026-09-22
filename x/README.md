# x.jeremylasne.com

The content manager. One person logs what happened to them during the day,
three mails ask for more, and at 17:00 the day becomes three X posts and one
60 second video script. Drafts only. Nothing is posted anywhere.

## The day

| Time (Paris) | What lands |
| --- | --- |
| 10:00 | 3 questions on what you are going after, plus the /bio nudge |
| 14:00 | 3 questions on what happened since 10:00 |
| 17:00 | 3 questions, then the 3 posts and the script, written from the log |

Every mail carries the whole day back: the questions, the entries, the
drafts. The inbox is the archive, whatever happens to the database.

Nine questions a day, drawn from a bank of three sets per slot that rotates
by date, so the same three do not arrive every morning for a month. A
question you have answered drops off the dashboard. A question you skip
comes back tomorrow.

## The screens

- **Today.** A composer that opens on the next unanswered question. The /bio
  tick for the 30 day challenge. Then the day, newest first.
- **Drafts.** Three posts and one script. Character count against 280 on
  each post, Copy on each, and a link that opens X or YouTube Studio with
  the text ready.
- **Archive.** Every day logged, with its entries and its drafts.
- **Facts.** The only numbers either prompt may claim: deals signed, deals
  in negotiation, MRR. Everything else gets `[X]` rather than a guess.

## Stack

- **`index.html`** is the page, hand written, no build step. X's own palette:
  black, one blue (`#1d9bf0`), the greys between, pill buttons, a left rail
  that becomes a bottom bar under 620px. Inter and JetBrains Mono from
  Google Fonts.
- **`config.js`** holds the Convex HTTP Actions URL, the same door
  `/overlap` and `/bio` use.
- **[`overlap/convex/x.ts`](../overlap/convex/x.ts)** is the server: the
  passphrase, the day, the facts, the generation and the three mails.
- **[`overlap/convex/xprompts.ts`](../overlap/convex/xprompts.ts)** holds
  Jeremy's two system prompts word for word, plus the question bank. They
  live on the server, so the voice is a deploy and the page source gives
  nothing away.
- **Data** is two tables on the Overlap deployment: `xDays`, one document
  per day, and `xFacts`, one document.
- **Auth** is a passphrase, the same `BIO_PASSPHRASE` that writes /bio,
  asked once per device and kept in `localStorage`. No accounts, because
  there is exactly one author.

## How a day gets written

Two calls to OpenRouter, because the two prompts are two voices and two
output formats:

1. The X prompt gets the facts sheet, the day's log, and the first line of
   every post from the last 3 days, then writes 3 posts from 3 angles: the
   story, the number, the lesson.
2. The video prompt gets the same brief and writes the 60 second script.

Both prompts were written for a chat where Jeremy answers questions. One
paragraph, `RUN_NOTE`, turns them into a batch job: the log has already
answered, so write now, and mark a missing number `[X]` rather than
inventing one.

A generation failure never eats the 17:00 mail. The questions and the day go
out either way, and **Write the day** on the dashboard retries.

## Settings

Set these on the Convex deployment (Settings, then Environment Variables):

| Name | What it is |
| --- | --- |
| `OPENROUTER_API_KEY` | writes the posts and the script |
| `RESEND_API_KEY` | sends the three mails |
| `BIO_PASSPHRASE` | already set for /bio, and it opens this page too |
| `X_PASSPHRASE` | optional, only to give this page a password of its own |
| `X_MODEL` | optional, defaults to `deepseek/deepseek-v4-flash`, which OpenRouter lists as DeepSeek V4 Flash 0423 |
| `X_MAIL_FROM` | optional, defaults to `hello@kaught.app`, which must be a sender on a domain verified in Resend |
| `X_MAIL_TO` | optional, defaults to `jeremylasne0@gmail.com`, comma separated for several |
| `X_SITE_URL` | optional, defaults to `https://x.jeremylasne.com` |

Two are new. The rest are either already set or have the right answer
built in.

If `OVERLAP_ALLOW_ORIGIN` is set, add `https://x.jeremylasne.com` to it.

## Deploy

1. Set `OPENROUTER_API_KEY` and `RESEND_API_KEY` in the Convex dashboard.
2. `cd overlap && npx convex deploy`.
3. In Vercel, add a project pointing at this repository with **Root
   Directory** set to `x`, the way `brand` and `brandmatchapp` are set up,
   and give it the domain `x.jeremylasne.com`.
4. Open the page, enter the passphrase, fill the Facts screen, then press
   **Send a test mail** to check Resend before 10:00.

The cron runs hourly and reads the Paris clock itself, because Convex
schedules on UTC and Paris moves twice a year. Twenty one hours out of
twenty four it returns immediately. `mailed` on each day makes a double fire
harmless.

The folder also answers at `jeremylasne.com/x/` on the main project, since
Vercel serves the repository as it is. The passphrase covers both, and the
page carries `noindex`.

## Run locally

```bash
python -m http.server 8000
# → http://localhost:8000/x/
```

Serve from the repository root. Add `http://localhost:8000` to
`OVERLAP_ALLOW_ORIGIN` if that variable is set.
