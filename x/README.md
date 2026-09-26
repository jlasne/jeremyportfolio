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
| 20:00 | one mail if nothing has been posted, carrying the drafts in full |

Every mail carries the whole day back: the questions, the entries, and
whatever is still unposted. A draft you have ticked used drops out, so the
mail never buries the one that still needs sending. The inbox is the
archive, whatever happens to the database.

The evening nudge is the exception, and asks for one thing. At 20:00, three
hours after the drafts land, one mail goes out if none of them has been
ticked used, carrying the posts in full so one can go out from the phone.
Tick any draft before 20:00 and it never comes. One mail that gets read
beats six that get filtered.

The mail questions come from a bank of three sets per slot that rotates by
date, so the same three do not arrive every morning for a month. They follow
the five beats the video script needs.

## The feed

Press **Start** and the feed fills with one question per beat. They sit
there like posts, each with its own box, and you answer them in any order.

A vague answer does not pass. When an answer carries no figure, no name and
no one concrete moment, a follow-up lands on the feed underneath it, marked
**digging**, asking for the missing piece in your own words. One level deep,
because two is an interrogation about one sentence.

The bar at the top is seven marks, one per beat. A mark lights when that
beat has an answer. At five of seven the bar turns green and offers to write
the day. **More questions** tops the feed back up at any point.

### The seven beats

| Beat | What it is after |
| --- | --- |
| Situation | where you were today and what you were doing |
| Desire | what you wanted out of it |
| Conflict | what blocked it, with a number |
| Change | the decision, what you did differently |
| Result | what is true now that was not this morning, with numbers |
| The day | where you went, who you saw, what happened outside the work |
| Lesson | what a founder one month behind you could use |

The first five are the five lines of the video script, named the way the
script names them, and each card prints what its beat feeds. Change and
Result are the two worth pushing on: a day with neither makes a video that
sounds like the last one.

The sixth is the intro, eight half second cuts of ordinary life. It asks
about a meal only if you brought one up first, and otherwise asks about the
place, the people or the moving around. The seventh is what makes a post
worth saving.

Nothing about the conversation lives outside the day: each answer carries
the question that produced it, and the feed is a list on the same document.

## The screens

- **Today.** The bar, the feed of open questions, then the day answered so
  far, newest first, and the /bio tick for the 30 day challenge. One Write
  button, in the bar, and only once five beats are covered.
- **Replies.** Paste somebody else's post and get three ways in: one that
  answers with something from your own day, one that asks what they are
  building, one that takes the other side. X is a room before it is a
  stage, and a reply is cheaper than a post and lands closer to the person.
  Nothing is stored: a reply is worth something in the next ten minutes and
  nothing the day after.
- **Drafts.** Three posts, sometimes a fourth, and one script. Character count against 280 on
  each post, Copy on each, and a link that opens X or YouTube Studio with
  the text ready. A tick on each marks it posted or filmed, so tomorrow's
  archive says what actually shipped. While the day is being written the
  screen says so and offers nothing else.
- **Archive.** Every day logged, with its entries and its drafts.
## Stack

- **`index.html`** is the page, hand written, no build step. X's own palette:
  black, one blue (`#1d9bf0`), the greys between, pill buttons, a left rail
  that becomes a bottom bar under 620px. Inter and JetBrains Mono from
  Google Fonts.
- **`config.js`** holds the Convex HTTP Actions URL, the same door
  `/overlap` and `/bio` use.
- **[`overlap/convex/x.ts`](../overlap/convex/x.ts)** is the server: the
  passphrase, the day, the feed, the generation and the mails.
- **[`overlap/convex/xprompts.ts`](../overlap/convex/xprompts.ts)** holds
  Jeremy's two system prompts word for word, the interviewer, the reply
  voice and the question bank. They
  live on the server, so the voice is a deploy and the page source gives
  nothing away.
- **Data** is one table on the Overlap deployment: `xDays`, one document
  per day. (`xFacts` is retired and stays declared only so a deploy cannot
  trip over a document left in it.)
- **Auth** is a passphrase, the same `BIO_PASSPHRASE` that writes /bio,
  asked once per device and kept in `localStorage`. No accounts, because
  there is exactly one author.

## How a day gets written

Two calls to OpenRouter, because the two prompts are two voices and two
output formats:

1. The X prompt gets the transcript and the last 3 days of posts, then
   writes the story, the number, the lesson, and sometimes a milestone.
2. The video prompt gets the same brief and writes the 60 second script.

Both are about today, and neither may drift into the general. A post is one
thing that happened, named and numbered: a post that could have run on any
other day is the wrong post. The script builds its five lines out of the
same day, and leans on who Jeremy is for one line at most, because the
Change and the Result are what stop every video sounding like the last one.

Layout is specified separately from voice, because the model left alone
returns one block of prose at whatever length it lands on. A post is read on
a phone: the hook stands on its own line, two to four short blocks follow,
no line runs past twelve words, and 280 characters is a wall. Anything that
comes back over it gets one repair call that drops whole sentences rather
than shaving words off all of them.

A third prompt, `INTERVIEW_SYSTEM`, runs the feed: one call to write a batch
of questions, one call per answer to decide whether to dig. Both cooler than
the two writers.

Both prompts were written for a chat where Jeremy answers questions. One
paragraph, `RUN_NOTE`, turns them into a batch job: the log has already
answered, so write now, and mark a missing number `[X]` rather than
inventing one.

A generation failure never eats the 17:00 mail. The questions and the day go
out either way, and **Write the day** on the dashboard retries.

### The four angles

**The story** and **the number** must be new. The last three days of both
are in the brief under a line saying today's has to be different.

**The lesson** is the opposite, and is the one thing built to repeat. The
last few lessons are in the brief under RUNNING LESSON, with an instruction
to say the same point again in new words with today's evidence. A point made
once is a post. A point made ten times is a position. It starts a new one
only when the day genuinely taught something else.

**The milestone** is conditional. It is written only when the day carries a
real number worth marking: a first, a round number crossed, a personal
record, or a figure that is a multiple of what it was. Otherwise the model
answers NONE and no fourth draft appears. A manufactured milestone is what
makes a feed sound like somebody talking to himself.

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
4. Open the page, enter the passphrase, and press **Send a test mail** to
   check Resend before 10:00.

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
