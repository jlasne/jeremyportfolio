# brandmatch.app — build spec v1

Date: 08/09/2026
Owner: Jeremy Lasne
Status: v1, ready to build

---

## 1. What we build

A daily feed of Instagram creators for brands, ranked by stars.

The brand describes what it wants in one sentence.
We crawl Instagram every day, score every profile we find, and deliver the list sorted best first.

Model: Gojiberry, flipped. Gojiberry finds B2B buyers showing intent. We find creators showing intent to sign a deal.

Two scores per creator, 0 to 3 stars each:
- Intent: will this creator take a brand deal now
- Match: does this audience fit the brand

Instagram only in v1.

---

## 2. The user journey

1. Brand signs up
2. Answers one question about what it is looking for
3. Answers 3 follow up questions generated from that answer
4. Sets filters
5. Sees a first batch within 10 minutes
6. Comes back every morning to a refreshed feed
7. Saves, notes, tags, rejects, exports

---

## 3. Onboarding

### 3.1 The one question

Screen shows a single text box.

Label: **Who are you looking for?**
Placeholder: `Women lifting coaches who sell their own program`
Helper line: `One sentence. We will ask for details next.`

Free text. No dropdowns. No categories to pick.

### 3.2 The follow up questions

Read the sentence, then ask 3 short questions to sharpen it. Generated from the answer, never a fixed list.

Rules:
- Maximum 3 questions
- One screen, all 3 visible
- Every question has suggested answers as chips, plus a free text option
- All 3 are skippable

Example, for `Women lifting coaches who sell their own program`:
- What do they need to already sell? → chips: online program, coaching, ebook, app, anything
- What should their content look like? → chips: technique tutorials, transformations, workout routines, food and training
- Who follows them? → chips: beginner women, competitive lifters, women 40+, postpartum

From these answers, build a search brief. The brief is stored and drives both the crawl keywords and the match score.

Show the brief back to the brand in plain words with an edit button. Example:
`Looking for: women lifting coaches, sell an online program, technique content, audience of beginner women.`

### 3.3 The filter bar

Set at the end of onboarding, editable at any time from the feed.

| Filter | Type | Default |
|---|---|---|
| Followers | min and max | 10k to 1M |
| Engagement rate | minimum | 1% |
| Median reel views | minimum | none |
| Email in bio | yes / any | any |
| Last post | within 7 / 30 / 90 days | 30 days |
| Posts per month | minimum | 3 |
| Country | multi select | none |
| Language | multi select | none |

Filters cut the volume. Stars set the order. Filters never change a score.

---

## 4. The feed

One list. Sorted by total stars, best first. Intent breaks the tie.

No tabs, no pages, infinite scroll.

Top bar shows: number of new creators today, filter button, saved list button, export button.

### 4.1 The lead row

Each row shows:
- Profile picture, name, handle
- Intent stars and Match stars, side by side, labelled
- The signal that fired, with its date. Example: `Ran a sponsored post 11 days ago`
- Followers, engagement rate, median reel views
- Country, language
- Email if found
- Bio, 2 lines
- `NEW` badge if first seen in the last 24 hours

### 4.2 The lead detail panel

Opens on click, slides from the right.

- Everything from the row
- Last 12 posts as thumbnails with view and comment counts
- All signals found, with dates
- Why these stars: one line per score, plain words
- Actions: save to list, add note, add tag, reject, copy email, open Instagram

### 4.3 Actions

| Action | Effect |
|---|---|
| Save | Goes to a named list |
| Note | Free text, private, survives every refresh |
| Tag | Free text labels, filterable |
| Reject | Leaves the feed forever, feeds the match score |
| Export | CSV of the current view or of a saved list |

Notes, tags and rejections belong to the brand account and are never overwritten by a crawl.

---

## 5. The daily job

Runs once a day per brand account.

1. Build search terms from the brief
2. Search Instagram by keyword and hashtag, collect handles
3. Pull the full profile for each new handle
4. Pull the last 12 posts per profile
5. Score intent and match
6. Deduplicate against what the brand already saw
7. Write to the feed

Sourcing runs through Apify, Instagram scraper, in two calls: keyword search first, then profile detail.

### 5.1 Numbers to hit

- 300 to 500 profiles crawled per brand per day
- First batch delivered within 10 minutes of signup
- Daily batch ready before 7am in the brand's timezone

### 5.2 One hard rule on data

Never use an aggregator's average views field. It runs up to 74 times the real number.
Engagement and views are computed from the last 12 posts we crawled ourselves.

---

## 6. Scoring

Placeholder rules for v1. To be reviewed after 2 weeks of real data.

### 6.1 Intent, 0 to 3

| Stars | Meaning | Trigger |
|---|---|---|
| 3 | Ready now | A signal fired in the last 30 days |
| 2 | Sells something | Link hub, own product, affiliate links, media kit |
| 1 | Reachable and active | Contact available, 3+ posts a month |
| 0 | Cold | No contact, or no post in 90 days |

Signals that make a 3, all dated:
- Ran a sponsored post
- Promoted a brand in the same category as the customer
- Added "DM for collab", "collabs" or a media kit to the bio
- Launched merch, a course, a membership
- Posted about brand deals, rates or partnerships

### 6.2 Match, 0 to 3

Compared against the search brief:
- Bio and captions match the described niche
- Audience country and language match the filters
- Follower band matches
- Content format matches what the brand described

3 = all four. 2 = three. 1 = two. 0 = one or none.

### 6.3 Why these stars

Store one plain sentence per score, written at scoring time, shown in the detail panel. No numbers, no jargon.

---

## 7. The refresh rule

Every crawl replaces the stored profile with the fresh version.

A creator moves back to the top of the feed only when:
- A new signal fired since the last crawl, or
- The total stars went up

A creator that returns with the same signal and the same score keeps its place. It does not get a `NEW` badge.

Reason: if the same face is at the top every morning, the feed stops meaning anything within a week.

Notes, tags and saved status survive every replacement.

---

## 8. Screens to build

1. Signup and login
2. Onboarding, one question
3. Onboarding, 3 follow ups
4. Onboarding, filter bar
5. Loading screen, first batch, with progress
6. Feed
7. Lead detail panel
8. Saved lists
9. Settings: brief, filters, timezone
10. Billing

---

## 9. What data we keep

Per brand account: the brief, the filters, the saved lists, the notes, the tags, the rejections.

Per creator: handle, name, picture, bio, followers, posts per month, last post date, engagement rate, median reel views, country, language, email, last 12 posts, all signals with dates, both scores, both explanations, first seen date, last crawl date.

One creator record is shared across brands. Scores and match are per brand.

---

## 10. Out of scope for v1

- TikTok and YouTube
- Deep search on one creator on demand
- Sending messages from the tool
- Draft outreach messages
- Team seats and shared accounts
- CRM integrations

---

## 11. Open decisions

1. Pricing. Two candidates: monthly plan with a daily scored volume, or credits. Recommended: monthly plan with included credits, extra credits on top, since cost is per profile crawled.
2. Exact star rules, reviewed after 2 weeks of real data.
3. Whether rejections train the match score globally or only for that brand.

---

## 12. Build order

1. Daily crawl and storage, no interface
2. Scoring, run on 500 real profiles, checked by hand
3. Feed and lead detail
4. Onboarding, brief and filters
5. Save, note, tag, reject, export
6. Refresh rule
7. Billing

Stop after step 2 and review the scores against real profiles before building any screen.
