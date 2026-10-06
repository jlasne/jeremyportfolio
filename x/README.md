# x.jeremylasne.com

The content manager. One person logs what happened to them during the day,
the page asks for more, and the day becomes three X posts and one 60 second
video script. Drafts only. Nothing is posted anywhere, and nothing is sent by
mail.

## The day

Two things happen by themselves, once an hour check on the Paris clock. Neither
sends mail.

| Time (Paris) | What happens |
| --- | --- |
| 17:00 | the day is written into drafts, if it has answers and no drafts yet |
| 23:00 | anything the day left unread goes into the brain |

Writing replaces the whole set of drafts, and with it every used tick, so the
17:00 write never touches drafts that already exist. You can write the day at
any time from Today.

There used to be mails: three a day of questions and a nudge at 20:00 for
unposted drafts. They are gone, along with the Resend setup and the test button.
The question bank behind them is still in `xprompts.ts`, unused.

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
| Why | why you do it that way, or the belief behind it. Feeds the brain |

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

## The brain

The daily log answers today. The brain is what the days add up to.

It is modelled on the notes-and-syntheses brain in `/brain`, and follows the
same two rules. A day is read once, and the log itself is never edited. A
position is rewritten each time a day touches it, never appended to.

A **concept** is something you do, believe or have learned: cold outreach,
why you left the bank, how you score creators. Each holds a **position**, what
is true of you now in the first person, and up to twelve pieces of **dated
evidence**, the things you actually said. Every claim traces back to the day
you said it.

Nobody presses anything to feed it, and there is no screen for it. A day is read
into the brain when it is written, by the button or at 17:00, and again
at 23:00 for anything the day left unread, so it is fed daily whether or not the
day was ever written. When the page opens it also reads any older days it has
not read, silently, five at a time, oldest first so a newer position overrides
an older one. Reading a day twice replaces what it said and never doubles it.

**A contradiction is settled by a question, not a screen.** If a day contradicts
an old position, the position is rewritten to what is true now, and one question
goes onto the feed under Why, marked **settling**, naming both sides with their
dates: "On 22 Sep you said volume wins on outreach. On 25 Sep you said replies
beat DMs. Which is true now, and why?" It comes back every day until an answer
settles it, at most two a day so a bad week does not bury the real questions.
Answering it reads the day at once, and the position is rewritten from your
answer.

The eighth beat on the feed, **Why**, is how the brain learns you. It is asked
as a follow-up to something you actually said that day, in your own words, and
it prefers concepts the brain holds thinly. There is no separate interview.

## Ideas

Type one line, like "Why I stopped cold DMing", and press Build. It builds from
the brain and nothing else: the daily log reaches it only by having been read
in. It picks up to six concepts the idea needs, then writes two things from the
same material at once:

- **A talking structure.** The angle, two ways to open, five to seven beats,
  and a close. For each beat: the point, what you have on it from your own days
  with its date, and a question that makes you tell it your way. No sentences
  to read out. A beat with nothing behind it says GAP rather than inventing.
- **A 60 second script in the daily vlog format.** Intro cuts, the five lines,
  outro, sound design. Built from what the brain holds on the idea, not from
  today.

Every GAP becomes a question on today's feed under Why. That is the loop: an
idea the brain cannot fill tells you what to answer tomorrow, and the answer
thickens the brain for the next idea. Tick an idea once it is filmed.

## The screens

- **Today.** The bar, then, once the day is written, the drafts right under
  it: three posts, sometimes a fourth, and the script. Character count
  against 280 on each post, Copy, a link that opens X or YouTube Studio with
  the text ready, and a tick to mark it posted or filmed. While the day is
  being written the screen says so and offers nothing else. If a write fails,
  the reason stays on screen above the old drafts until the next try, because
  the old drafts look exactly like a fresh set. Write again rewrites on one
  click, and asks first only when a draft is ticked used, since a rewrite
  loses the ticks. Below the drafts
  are the open questions and the day answered so far. One Write button, in
  the bar, and only once five beats are covered.
- **Ideas.** The field, the two outputs, the concepts it drew on, the
  questions it added, and every earlier idea. If the brain is still empty it
  says so before you type.
- **X-Replies.** Paste somebody else's post and get three ways in: one that
  answers with something from your own day, one that asks what they are
  building, one that takes the other side. X is a room before it is a
  stage, and a reply is cheaper than a post and lands closer to the person.
  Nothing is stored: a reply is worth something in the next ten minutes and
  nothing the day after.
- **Archive.** Every day with something in it. Days with nothing in them are not shown.
## Stack

- **`index.html`** is the page, hand written, no build step. X's own palette:
  black, one blue (`#1d9bf0`), the greys between, pill buttons, a left rail
  that becomes a bottom bar under 620px. Inter and JetBrains Mono from
  Google Fonts.
- **`config.js`** holds the Convex HTTP Actions URL, the same door
  `/overlap` and `/bio` use.
- **[`overlap/convex/x.ts`](../overlap/convex/x.ts)** is the server: the
  passphrase, the day, the feed, the generation and the schedule.
- **[`overlap/convex/xprompts.ts`](../overlap/convex/xprompts.ts)** holds
  Jeremy's two system prompts word for word, the interviewer, the reply
  voice and the question bank. They
  live on the server, so the voice is a deploy and the page source gives
  nothing away.
- **Data** is three tables on the Overlap deployment: `xDays`, one document
  per day, `xBrain`, one per concept, and `xIdeas`, one per idea. Nothing
  reads `xBrain` on screen: to look inside, use the Convex dashboard. (`xFacts` is retired and stays declared only so a deploy cannot
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

The Situation line is the one that repeats if nobody stops it. It says he is
25, then where he is right now and what he is doing, taken from the log, so it
changes every day. A city or country is named only when it is new or unusual
that day, never as a habit. The brief also shows the model the Situation lines
of the last five scripts and asks for different words and a different place or
activity, which is what actually breaks the pattern.

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

A generation failure at 17:00 is logged and nothing else happens. **Write the
day** on Today retries, and says why if it fails again.

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

## Craft, and where it comes from

The talking structure and the idea script follow rules taken from the Content
and Social brains in Octopus, read on 2026-09-30. Those rules are a snapshot in
`xprompts.ts` under `CRAFT`, used by Ideas and the video. The posts are the
exception: when `OCTOPUS_MCP_URL` is set, Write reads the brains live (see below). Each
with its source in the comment above it. Re-read the brain and update them when
it has learned something new. **The daily video does not use them.** It is
written as it was, apart from its opening sentence and one exit line.

For Ideas:

- **Hook.** The first 3 seconds make a promise and do not give the answer away.
  The hook also exists as on-screen text for people watching on silent. There
  are five kinds: a question, a surprising statement, a story, a big promise, a
  visual action. Lead with the promise, then handle the objection the viewer is
  already thinking.
- **HIDE.** The talking structure is Hook, Intrigue, Delivery, Exit, 30 to 60
  seconds. The hook, the objection, the intrigue and the exit are written word
  for word, because even a talking video needs those scripted or it rambles. The
  delivery stays as points, said your way.
- **Specific and vulnerable.** One beat is the detail you would rather not say,
  drawn from your own evidence. When the brain holds none it becomes a question.
- **Packaging and angles.** Three titles that name the exact viewer and the
  result, with the keywords. Three next angles on the same material, fastest way,
  new way and niche context, one tap from becoming the next idea.

Ideas are not part of a series. The road to a goal belongs to the daily video.

For the daily video:

- **The opening sentence is the series, and it is built in code.** "Day 14
  working towards my first $10k a month. I'm Jeremy, I'm 25, currently in Ireland
  trying to sign my second deal." Told the shape and asked to follow it, the
  model wrote its own opening and left out the day and the goal. So the model is
  now asked only for the two blanks it can fill from the log, where he is if it
  is not home and what he is trying to do today, and everything else is fixed.
  The result is written into the Situation block over whatever the model wrote,
  with its on-screen text, "Day 14: my first $10k a month". If the layout is one
  it does not recognise, the opening goes on top under its own label, so it is
  always there.
- **Where the numbers come from.** The day number is counted in code, never
  guessed. Day 1 is `X_SERIES_START` or `SERIES_START` in `xprompts.ts`, currently
  2026-09-30, or, when both are empty, the
  first day anything was logged. The goal is `SERIES_GOAL`. The place is where
  the log says he is that day, and `SERIES_HOME`, currently Ireland, when it does
  not; empty it to leave the place out.
- **One exit line** after the Result: one thing the viewer can do, or the next
  step tomorrow's video takes.
- The brief shows the model the openings of the last five scripts, so the
  opening varies from day to day.

### Writing the posts with Octopus

When `OCTOPUS_MCP_URL` is set, Write reads the founder's Octopus brains while it
prepares the posts. It asks the `x` and `content` brains what makes a strong X
post, keeps each concept's title, position and newest dated evidence, and hands
them to the post writer as reference notes: advice from studied sources, never
facts about his day. Every fact still comes from the log.

The rules for writing an answer that the brain returns with its retrieval are
left out, so the model gets notes to use and no instructions to obey.

It never blocks a day. If Octopus is unset, slow (20 seconds), down, or empty,
the posts are written without notes and the reason is logged. The drafts say
"with 9 notes from Octopus" when it worked. **Test Octopus** in the rhythm box
reads the brains once and says what happened. Only the posts use this: the
video and Ideas do not.

The address carries its own signature, so it is a secret. It lives in the Convex
dashboard, never in the repository.

### Why a call can come back empty

DeepSeek V4 Flash reasons before it answers, and the reasoning is paid out of
the same token budget as the answer. A tight budget is spent on the thinking
and the answer comes back empty, which showed up as "OpenRouter returned
nothing". Every call now asks for low reasoning effort, gets its answer budget
plus 4,000 tokens of room, and is tried once more with 12,000 if it still
comes back empty. If it fails after that, the message says why: the finish
reason, whether reasoning came back, and the budget. To leave a reasoning
model altogether, set `X_MODEL` to a plain chat model.

## Settings

Set these on the Convex deployment (Settings, then Environment Variables):

| Name | What it is |
| --- | --- |
| `OPENROUTER_API_KEY` | writes the posts and the script |
| `BIO_PASSPHRASE` | already set for /bio, and it opens this page too |
| `X_PASSPHRASE` | optional, only to give this page a password of its own |
| `X_MODEL` | optional, defaults to `deepseek/deepseek-v4-flash`, which OpenRouter lists as DeepSeek V4 Flash 0423 |
| `X_SITE_URL` | optional, defaults to `https://x.jeremylasne.com` |
| `OCTOPUS_MCP_URL` | optional, the Octopus MCP address, the same one the Octopus connector uses. Turns on live brain notes for the posts. A secret |
| `OCTOPUS_BRAINS` | optional, the brains Write reads, as slugs separated by commas. Defaults to `x,content` |
| `X_SERIES_START` | optional, the date that is Day 1, as YYYY-MM-DD. Overrides `SERIES_START` in `xprompts.ts` without a deploy |

`RESEND_API_KEY`, `X_MAIL_FROM` and `X_MAIL_TO` are no longer read. They can be
deleted from the dashboard.

If `OVERLAP_ALLOW_ORIGIN` is set, add `https://x.jeremylasne.com` to it.

## Deploy

1. Set `OPENROUTER_API_KEY` in the Convex dashboard.
2. `cd overlap && npx convex deploy`.
3. In Vercel, add a project pointing at this repository with **Root
   Directory** set to `x`, the way `brand` and `brandmatchapp` are set up,
   and give it the domain `x.jeremylasne.com`.
4. Open the page, enter the passphrase, and press **Test Octopus** if the
   Octopus address is set.

The cron runs hourly and reads the Paris clock itself, because Convex
schedules on UTC and Paris moves twice a year. Twenty two hours out of
twenty four it returns immediately.

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
