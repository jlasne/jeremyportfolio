import {
  type ActionCtx,
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  POST_SYSTEM,
  SCRIPT_SYSTEM,
  RUN_NOTE,
  POST_ANGLES,
  REPLY_SYSTEM,
  REPLY_ANGLES,
  SLOTS,
  SLOT_TITLE,
  INTERVIEW_SYSTEM,
  DIGEST_SYSTEM,
  TALK_SYSTEM,
  SERIES_GOAL,
  SERIES_HOME,
  SERIES_START,
  CRAFT,
  BEATS,
  READY_AT,
  DIG_NOTE,
  questionsFor,
} from "./xprompts";

/**
 * x.jeremylasne.com — the content manager.
 *
 * One person logs what happened to them during the day. Three mails at
 * 10:00, 14:00 and 17:00 Paris ask for more, and each one carries the whole
 * day back, so the inbox is the archive whatever happens to this table. At
 * 17:00 the day turns into three X posts and one 60 second video script,
 * written by Jeremy's own two system prompts in `xprompts.ts`.
 *
 * There are no accounts. One passphrase, X_PASSPHRASE on the Convex
 * deployment, because there is exactly one author. Drafts are drafts: this
 * posts nothing to X or YouTube, ever.
 */

const MAX_ENTRY = 4000;
const MAX_ENTRIES = 200;
const KEEP_DRAFT_DAYS = 5; /* how much recent work the model is shown */
/* One nudge, at 20:00, three hours after the drafts land, and only while
   none of them has been ticked off. One mail that gets read beats six that
   get filtered. */
const NUDGE_AT = 20;
/* Whatever the day left unread goes into the brain at 23:00, so it is fed
   daily whether or not the day was ever written. */
const DIGEST_AT = 23;

/* ── the door ───────────────────────────────────────────────────────── */

/**
 * The same passphrase that writes /bio, because it is the same person and
 * one password is one thing to remember. X_PASSPHRASE splits them again if
 * that is ever wanted.
 */
function mustBeJeremy(passphrase: string) {
  const want = process.env.X_PASSPHRASE || process.env.BIO_PASSPHRASE;
  if (!want) throw new Error("Set BIO_PASSPHRASE in the Convex dashboard first");
  if (passphrase !== want) throw new Error("Wrong passphrase");
}

/* ── Paris clock ────────────────────────────────────────────────────── */

/**
 * The offset Paris is running at, from the EU rule itself rather than a
 * timezone database: summer time starts the last Sunday of March at 01:00
 * UTC and ends the last Sunday of October at 01:00 UTC.
 */
function parisOffset(ms: number): number {
  const y = new Date(ms).getUTCFullYear();
  const lastSunday = (month: number) => {
    const last = new Date(Date.UTC(y, month + 1, 0));
    return Date.UTC(y, month, last.getUTCDate() - last.getUTCDay(), 1);
  };
  return ms >= lastSunday(2) && ms < lastSunday(9) ? 2 : 1;
}

/** The date and hour it is in Paris right now. */
export function paris(ms: number = Date.now()) {
  const d = new Date(ms + parisOffset(ms) * 3_600_000);
  return { day: d.toISOString().slice(0, 10), hour: d.getUTCHours() };
}

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/* ── reading ────────────────────────────────────────────────────────── */

type DayDoc = Doc<"xDays">;

const blank = (day: string) => ({
  day,
  entries: [] as DayDoc["entries"],
  asks: [] as NonNullable<DayDoc["asks"]>,
  drafts: [] as DayDoc["drafts"],
  draftsAt: undefined as number | undefined,
  mailed: [] as string[],
  updatedAt: 0,
});

const pub = (d: DayDoc | null, day: string) =>
  d
    ? {
        day: d.day,
        entries: d.entries,
        asks: d.asks ?? [],
        drafts: d.drafts,
        draftsAt: d.draftsAt,
        mailed: d.mailed,
        updatedAt: d.updatedAt,
      }
    : blank(day);

const find = (ctx: { db: any }, day: string) =>
  ctx.db.query("xDays").withIndex("by_day", (q: any) => q.eq("day", day)).unique() as Promise<DayDoc | null>;

/** Answers before the inputs unlock, so a wrong passphrase costs nothing. */
export const unlock = query({
  args: { passphrase: v.string() },
  handler: async (_ctx, { passphrase }) => {
    mustBeJeremy(passphrase);
    return true;
  },
});

/** Everything one screen needs: the day, its feed, and the beat list. */
export const day = query({
  args: { passphrase: v.string(), day: v.optional(v.string()) },
  handler: async (ctx, a) => {
    mustBeJeremy(a.passphrase);
    const now = paris();
    const key = a.day && isDay(a.day) ? a.day : now.day;
    return {
      today: now.day,
      hour: now.hour,
      ...pub(await find(ctx, key), key),
      /* the beat list and the bar, so the page does not keep its own copy */
      beats: BEATS.map((b) => ({ id: b.id, label: b.label, hint: b.hint })),
      readyAt: READY_AT,
      questions: Object.fromEntries(SLOTS.map((s) => [s, questionsFor(s, key)])),
    };
  },
});

/** The archive: newest days first, with enough to render a row. */
export const history = query({
  args: { passphrase: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { passphrase, limit }) => {
    mustBeJeremy(passphrase);
    const n = Math.min(Math.max(limit ?? 30, 1), 120);
    /* A day exists the moment a mail is marked sent, so many are empty. The archive is for days with something in them. */
    const days = (await ctx.db.query("xDays").withIndex("by_day").order("desc").take(n * 3))
      .filter((d) => d.entries.length > 0 || d.drafts.length > 0)
      .slice(0, n);
    return days.map((d) => ({
      day: d.day,
      entries: d.entries.length,
      drafts: d.drafts.length,
      words: d.entries.reduce((n, e) => n + e.text.trim().split(/\s+/).filter(Boolean).length, 0),
      first: d.entries[0]?.text.slice(0, 160) ?? "",
      updatedAt: d.updatedAt,
    }));
  },
});

/** One past day in full, for the archive screen. */
export const readDay = query({
  args: { passphrase: v.string(), day: v.string() },
  handler: async (ctx, { passphrase, day }) => {
    mustBeJeremy(passphrase);
    if (!isDay(day)) throw new Error("Send the day as YYYY-MM-DD");
    return pub(await find(ctx, day), day);
  },
});

/* ── writing ────────────────────────────────────────────────────────── */

async function upsert(ctx: { db: any }, day: string, patch: Partial<DayDoc>) {
  const old = await find(ctx, day);
  const next = { ...(old ? {} : blank(day)), ...patch, day, updatedAt: Date.now() };
  if (old) await ctx.db.patch(old._id, next);
  else await ctx.db.insert("xDays", { ...blank(day), ...next });
  return pub(await find(ctx, day), day);
}

/** Append one entry. The only path anything takes into the day's record. */
async function append(
  ctx: { db: any },
  day: string,
  a: { text: string; slot?: string; q?: string },
) {
  if (!isDay(day)) throw new Error("Send the day as YYYY-MM-DD");
  const text = a.text.trim().slice(0, MAX_ENTRY);
  if (!text) throw new Error("Nothing to log");
  const old = await find(ctx, day);
  const entries = [
    ...(old?.entries ?? []),
    {
      at: Date.now(),
      slot: a.slot === "chat" || (a.slot && SLOTS.includes(a.slot as any)) ? a.slot : "free",
      q: a.q?.trim().slice(0, 300) || undefined,
      text,
    },
  ].slice(-MAX_ENTRIES);
  return await upsert(ctx, day, { entries });
}

/** The note box: something said without being asked. */
export const log = mutation({
  args: {
    passphrase: v.string(),
    day: v.string(),
    text: v.string(),
    slot: v.optional(v.string()),
    q: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    mustBeJeremy(a.passphrase);
    return await append(ctx, a.day, a);
  },
});

/** The same, for the feed, which answers from an action. */
export const logEntry = internalMutation({
  args: { day: v.string(), text: v.string(), slot: v.optional(v.string()), q: v.optional(v.string()) },
  handler: async (ctx, a) => {
    await append(ctx, a.day, a);
    return null;
  },
});

/** Remove one entry, found by the millisecond it was written at. */
export const unlog = mutation({
  args: { passphrase: v.string(), day: v.string(), at: v.number() },
  handler: async (ctx, a) => {
    mustBeJeremy(a.passphrase);
    const old = await find(ctx, a.day);
    if (!old) throw new Error("No such day");
    return await upsert(ctx, a.day, { entries: old.entries.filter((e) => e.at !== a.at) });
  },
});

/** Tick a draft off: posted, or filmed. */
export const useDraft = mutation({
  args: { passphrase: v.string(), day: v.string(), at: v.number(), label: v.string(), used: v.boolean() },
  handler: async (ctx, a) => {
    mustBeJeremy(a.passphrase);
    const d = await find(ctx, a.day);
    if (!d) throw new Error("No such day");
    const drafts = d.drafts.map((x) =>
      x.at === a.at && x.label === a.label ? { ...x, used: a.used } : x,
    );
    return await upsert(ctx, a.day, { drafts });
  },
});

/* ── what the model is shown ────────────────────────────────────────── */

/**
 * The brief, assembled on the server: everything logged today, and the
 * last few days of posts so the model can see what has already been said
 * and avoid saying it twice.
 */
export const context = internalQuery({
  args: { day: v.string() },
  handler: async (ctx, { day }) => {
    const today = await find(ctx, day);
    const recent = await ctx.db.query("xDays").withIndex("by_day").order("desc").take(KEEP_DRAFT_DAYS + 1);
    return {
      entries: today?.entries ?? [],
      previous: recent
        .filter((d) => d.day !== day)
        .slice(0, KEEP_DRAFT_DAYS)
        .map((d) => ({
          day: d.day,
          posts: d.drafts
            .filter((x) => x.kind === "post")
            .map((x) => ({ label: x.label, body: x.body })),
          script: d.drafts.find((x) => x.kind === "script")?.body ?? "",
        })),
    };
  },
});

export const putDrafts = internalMutation({
  args: {
    day: v.string(),
    drafts: v.array(
      v.object({
        at: v.number(),
        kind: v.string(),
        label: v.string(),
        body: v.string(),
        used: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (ctx, { day, drafts }) => {
    await upsert(ctx, day, { drafts, draftsAt: Date.now() });
    return null;
  },
});

export const markMailed = internalMutation({
  args: { day: v.string(), slot: v.string() },
  handler: async (ctx, { day, slot }) => {
    const old = await find(ctx, day);
    const mailed = Array.from(new Set([...(old?.mailed ?? []), slot]));
    await upsert(ctx, day, { mailed });
    return null;
  },
});

export const dayFor = internalQuery({
  args: { day: v.string() },
  handler: async (ctx, { day }) => pub(await find(ctx, day), day),
});

function brief(c: {
  entries: { at: number; slot: string; q?: string; text: string }[];
  previous: { day: string; posts: { label: string; body: string }[]; script?: string }[];
}, day: string) {
  const when = (at: number) => {
    const d = new Date(at + parisOffset(at) * 3_600_000);
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  };
  const lines: string[] = [];
  lines.push(`DATE: ${day}`);
  lines.push("", "TODAY'S LOG (what Jeremy said, in order):");
  if (!c.entries.length) lines.push("- (nothing logged)");
  for (const e of c.entries) {
    lines.push(e.q ? `- ${when(e.at)} Q: ${e.q}` : `- ${when(e.at)}`);
    lines.push(`  ${e.text.replace(/\n/g, "\n  ")}`);
  }
  /* Two piles, because they are read for opposite reasons. The stories and
     the numbers are there so today's are different. The lessons are there
     so today's is the same one, said again with new evidence. */
  const flat = c.previous.flatMap((p) => p.posts.map((x) => ({ ...x, day: p.day })));
  const lessons = flat.filter((x) => /lesson/i.test(x.label));
  const rest = flat.filter((x) => !/lesson/i.test(x.label));

  if (rest.length) {
    lines.push("", "ALREADY SAID IN THE LAST FEW DAYS (today's story and number must be different):");
    for (const x of rest) lines.push(`- [${x.day}] ${x.body.split("\n")[0].slice(0, 140)}`);
  }
  if (lessons.length) {
    lines.push("", "RUNNING LESSON (the point he is building. Say it again with today's evidence, in new words):");
    for (const x of lessons) lines.push(`- [${x.day}] ${x.body.split("\n")[0].slice(0, 180)}`);
  }
  return lines.join("\n");
}

/* ── OpenRouter ─────────────────────────────────────────────────────── */

/* DeepSeek V4 Flash 0423, which OpenRouter lists as `deepseek/deepseek-v4-flash`.
   Override with X_MODEL to try another. */
const MODEL = () => process.env.X_MODEL || "deepseek/deepseek-v4-flash";

async function ask(
  system: string,
  user: string,
  temperature = 0.8,
  opts: { note?: boolean; max?: number } = {},
): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("Set OPENROUTER_API_KEY in the Convex dashboard first");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.X_SITE_URL || "https://x.jeremylasne.com",
      "X-Title": "x.jeremylasne.com",
    },
    body: JSON.stringify({
      model: MODEL(),
      temperature,
      max_tokens: opts.max ?? 2000,
      messages: [
        { role: "system", content: opts.note === false ? system : system + "\n\n" + RUN_NOTE },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter said ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as any;
  const text = body?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new Error("OpenRouter returned nothing");
  return text.trim();
}

/**
 * The openings of the scripts already written: the Situation block, which now
 * begins with the hook.
 *
 * A script opens on the same line every day unless it is shown the last few,
 * and the fix for "I'm in Cork" every video is to say what the earlier ones
 * said and ask for different. Best effort: the script is free text, so the
 * line is found by its label and anything that does not parse is skipped.
 */
function situationOf(script: string): string {
  for (const m of script.matchAll(/Situation\W*([\s\S]*?)\W*Desire/gi)) {
    const line = m[1].replace(/\s+/g, " ").trim();
    if (line.length > 15) return line.slice(0, 320);
  }
  return "";
}

/**
 * How a post is laid out, which matters as much as what it says.
 *
 * Left alone the model returns one block of prose at whatever length it
 * lands on. A post is read on a phone: the hook has to stand alone and 280
 * is a wall, not a target.
 */
const FORMAT = `FORMAT. This matters as much as the words:
- 280 characters at most, counting the line breaks. This is a wall, not a target. Count before you answer.
- Never one block of prose. The hook is its own line, then a blank line, then the rest.
- Two to four short blocks, separated by blank lines.
- No line longer than twelve words.
- A list is one item per line, each starting with "- ".
- No hashtags. No emoji.

The shape, not the content:

41 creators scored before breakfast.

6 cleared the line. Last week it was 2.

The change was one line in the brief.
Score what they already sell, not follower count.`;

/** Count the way X counts, so an emoji is one character and not two. */
const len = (s: string) => [...s].length;

/** The X prompt answers in a code block. Take what is inside it. */
const unfence = (s: string) => s.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();

/**
 * Write the day: three posts from three angles in one call, then the video
 * script in a second. Two calls, because the two prompts are two voices and
 * two output formats, and mixing them loses both.
 */
export const make = internalAction({
  args: { day: v.string() },
  handler: async (ctx, { day }): Promise<{ at: number; kind: string; label: string; body: string; used: boolean }[]> => {
    const c = await ctx.runQuery(internal.x.context, { day });
    if (!c.entries.length) throw new Error("Log something first: there is nothing to write from");
    const b = brief(c, day);

    const angles = POST_ANGLES.map((a, i) => `${i + 1}. ${a.label}: ${a.ask}`).join("\n");
    const postsRaw = await ask(
      POST_SYSTEM,
      `${b}\n\nWrite ${POST_ANGLES.length} posts from today, one per angle, in this order:\n${angles}\n\n` +
        `Each post is about one specific thing that happened today. Name the tool, quote the figure, ` +
        `say what happened at what moment. A post that could have been written on any other day is the ` +
        `wrong post.\n\n${FORMAT}\n\n` +
        `Output the 3 finished posts in order, plain text, separated by a line containing only ===. ` +
        `No code block, no titles, no commentary.`,
    );
    const parts = unfence(postsRaw)
      .split(/^\s*={3,}\s*$/m)
      .map((p) => unfence(p))
      .filter(Boolean);

    /* An optional angle that answered NONE wrote nothing, and an empty
       draft is worse than a missing one. */
    const kept = POST_ANGLES.map((a, i) => ({ angle: a, body: parts[i] ?? "" })).filter(
      (x) => x.body && !(x.angle.optional && /^none\b/i.test(x.body)),
    );

    /* One repair pass on whatever came back too long. Cheap, and the
       alternative is a post he cannot send. */
    const posts = await Promise.all(
      kept.map(async ({ angle, body }) => {
        if (len(body) <= 280) return { angle, body };
        try {
          const cut = unfence(
            await ask(
              POST_SYSTEM,
              `This post is ${len(body)} characters. Cut it to 280 or fewer.\n\n` +
                `Keep the hook, keep every number, keep the line breaks. Drop whole sentences rather ` +
                `than trimming words out of all of them.\n\n${FORMAT}\n\n` +
                `Output the post alone, plain text, no commentary.\n\n---\n${body}`,
              0.4,
            ),
          );
          return { angle, body: cut && len(cut) < len(body) ? cut : body };
        } catch {
          return { angle, body };
        }
      }),
    );

    const opened = (c.previous as { script?: string }[]).map((p) => situationOf(p.script ?? "")).filter(Boolean);
    const dayNo: number = await ctx.runQuery(internal.x.seriesDay, { day });
    const script = await ask(
      SCRIPT_SYSTEM,
      `${b}\n\nWrite the 60 second script from this log.\n\n` +
        `THE SITUATION opens the talking script, in this shape: "Day ${dayNo} working towards my first ` +
        `${SERIES_GOAL}. I'm Jeremy, I'm 25, currently in ${SERIES_HOME || "[place]"}." Keep the day number, ` +
        `the goal, his name and his age exactly. Vary the wording of the words around them a little from day ` +
        `to day, for example "Day ${dayNo} of building to my first ${SERIES_GOAL}". The place is where the log ` +
        `says he is today` +
        (SERIES_HOME ? `; when the log does not say, he is in ${SERIES_HOME}` : "") +
        `. After that, one short sentence on what he is doing right now, taken from the log (a desk, a call, a ` +
        `train, a gym), which can hint at the tension of today without giving the answer away. Take it from ` +
        `the log, never invented. Never state a current figure for the road that the log does not give. Give ` +
        `the first sentence also as on-screen text, under 8 words, on its own line labelled "On screen", ` +
        `straight after it.\n\n` +
        `THE REST OF THE STORY, out of today. The Desire is what he wanted from today, the Conflict is what ` +
        `blocked it, the Change is the decision he took today, and the Result is what is true tonight that was ` +
        `not true this morning. The Change and the Result are what stops every video sounding like the last ` +
        `one, so they carry today's specifics and today's numbers. Only the Situation may lean on who Jeremy ` +
        `is. After the Result, add one exit line, under 15 words: one thing the viewer can do, or the next step ` +
        `tomorrow's video takes.` +
        (opened.length
          ? `\n\nOPENINGS ALREADY USED IN EARLIER VIDEOS. Keep the shape, but vary the wording a little ` +
            `and say something different in the second sentence.\n` + opened.map((o: string) => `- ${o}`).join("\n")
          : ""),
    );

    const at = Date.now();
    const drafts = [
      ...posts.map(({ angle, body }) => ({
        at,
        kind: "post",
        label: angle.label,
        body,
        used: false,
      })),
      { at, kind: "script", label: "60s video", body: script, used: false },
    ];
    await ctx.runMutation(internal.x.putDrafts, { day, drafts });
    return drafts;
  },
});

/* ── the feed of questions ──────────────────────────────────────────── */

const rid = () => Math.random().toString(36).slice(2, 10);

export const putAsks = internalMutation({
  args: {
    day: v.string(),
    asks: v.array(
      v.object({
        id: v.string(),
        at: v.number(),
        text: v.string(),
        beat: v.string(),
        answered: v.boolean(),
        from: v.optional(v.string()),
        concept: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { day, asks }) => {
    await upsert(ctx, day, { asks });
    return null;
  },
});

/** The day's transcript, written the way the model reads it. */
function transcriptOf(entries: { q?: string; text: string }[]) {
  return entries.length
    ? entries.map((e) => (e.q ? `Q: ${e.q}\nA: ${e.text}` : `He said: ${e.text}`)).join("\n\n")
    : "(nothing yet)";
}

/**
 * Fill the feed.
 *
 * One question per beat that has no answered question yet, written against
 * whatever he has already said. Beats that are covered are left alone, so
 * pressing this again tops the feed up rather than starting over.
 */
export const fill = action({
  args: { passphrase: v.string(), day: v.optional(v.string()) },
  handler: async (ctx, a): Promise<unknown> => {
    mustBeJeremy(a.passphrase);
    const key = a.day && isDay(a.day) ? a.day : paris().day;
    /* A contradiction the brain is still holding is the first question. */
    await ctx.runMutation(internal.x.queueConflicts, { day: key });
    const d = await ctx.runQuery(internal.x.dayFor, { day: key });
    const c = await ctx.runQuery(internal.x.context, { day: key });
    const asks: NonNullable<DayDoc["asks"]> = d.asks ?? [];

    const open = new Set(asks.filter((x) => !x.answered).map((x) => x.beat));
    const done = new Set(asks.filter((x) => x.answered).map((x) => x.beat));
    const wanted = BEATS.filter((b) => !open.has(b.id) && !done.has(b.id));
    if (!wanted.length) return await ctx.runQuery(internal.x.dayFor, { day: key });

    const held = await ctx.runQuery(internal.x.concepts, {});
    const brainNote = held.length
      ? "WHAT HIS BRAIN ALREADY HOLDS (for the 'you' beat: ask where it is thin, never where it is full):\n" +
        held.map((h: { name: string; position: string; evidence: unknown[] }) =>
          `- ${h.name} (${h.evidence.length} pieces of evidence): ${h.position.slice(0, 110)}`).join("\n")
      : "HIS BRAIN IS EMPTY. For the 'you' beat, ask about who he is: a belief, a method, or a mistake this day touched.";

    const said = await ask(
      INTERVIEW_SYSTEM,
      `DATE: ${key}\n\nTHE DAY SO FAR:\n${transcriptOf(c.entries)}\n\n${brainNote}\n\n` +
        `Write one question for each of these beats, in this order: ${wanted.map((b) => b.id).join(", ")}.\n` +
        `One per line, in the form beat|question. Nothing else, no numbering, no blank lines.`,
      0.7,
    );

    const ids = new Set(BEATS.map((b) => b.id as string));
    const fresh = said
      .split("\n")
      .map((l) => l.trim().replace(/^[-*\d.)\s]+/, ""))
      .filter(Boolean)
      .map((l) => {
        const cut = l.indexOf("|");
        if (cut < 0) return null;
        const beat = l.slice(0, cut).trim().toLowerCase();
        const text = l.slice(cut + 1).trim().replace(/^["']|["']$/g, "");
        if (!ids.has(beat) || !text) return null;
        return { id: rid(), at: Date.now(), text: text.slice(0, 300), beat, answered: false };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .filter((x, i, all) => all.findIndex((y) => y.beat === x.beat) === i);

    if (fresh.length) await ctx.runMutation(internal.x.putAsks, { day: key, asks: [...asks, ...fresh] });
    return await ctx.runQuery(internal.x.dayFor, { day: key });
  },
});

/**
 * Answer one question on the feed.
 *
 * The answer is logged against the question that produced it, the question
 * is struck off, and the model reads the pair. A vague answer earns a
 * follow-up on the same beat, which lands on the feed under it.
 */
export const reply = action({
  args: { passphrase: v.string(), day: v.string(), askId: v.string(), text: v.string() },
  handler: async (ctx, a): Promise<unknown> => {
    mustBeJeremy(a.passphrase);
    if (!isDay(a.day)) throw new Error("Send the day as YYYY-MM-DD");
    const text = a.text.trim();
    if (!text) throw new Error("Nothing to log");

    const d = await ctx.runQuery(internal.x.dayFor, { day: a.day });
    const asks: NonNullable<DayDoc["asks"]> = d.asks ?? [];
    const target = asks.find((x) => x.id === a.askId);
    if (!target) throw new Error("That question is no longer on the feed");

    await ctx.runMutation(internal.x.logEntry, {
      day: a.day,
      text: text.slice(0, MAX_ENTRY),
      slot: "chat",
      q: target.text,
    });
    let next = asks.map((x) => (x.id === a.askId ? { ...x, answered: true } : x));

    /* Dig, but never on a follow-up: one level, or it becomes an
       interrogation about one sentence. */
    if (!target.from) {
      try {
        const said = await ask(INTERVIEW_SYSTEM, `${DIG_NOTE}\n\nQUESTION: ${target.text}\nANSWER: ${text}`, 0.5);
        const line = said.split("\n")[0].trim().replace(/^["']|["']$/g, "");
        if (line && !/^ok\b/i.test(line) && line.length > 8)
          next = [
            ...next,
            { id: rid(), at: Date.now(), text: line.slice(0, 300), beat: target.beat, answered: false, from: target.id },
          ];
      } catch (e) {
        console.error("x: could not dig into that answer", e);
      }
    }

    await ctx.runMutation(internal.x.putAsks, { day: a.day, asks: next });
    /* An answer to a settling question is read at once, so the position is
       rewritten now and not at 23:00. */
    if (target.concept) await ctx.scheduler.runAfter(0, internal.x.digest, { day: a.day });
    return await ctx.runQuery(internal.x.dayFor, { day: a.day });
  },
});

/**
 * Replies.
 *
 * X is a room before it is a stage. Paste somebody's post, get three ways
 * in: one that answers with something from Jeremy's own work, one that
 * asks, one that takes the other side. Nothing is stored, because a reply
 * is worth something in the next ten minutes and nothing the day after.
 */
export const replies = action({
  args: { passphrase: v.string(), post: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, a): Promise<{ label: string; body: string }[]> => {
    mustBeJeremy(a.passphrase);
    const post = a.post.trim().slice(0, 4000);
    if (!post) throw new Error("Paste the post you want to reply to");

    /* Today's log, so a reply can carry a real number rather than an
       opinion. It is context, never the subject. */
    const c = await ctx.runQuery(internal.x.context, { day: paris().day });
    const mine = c.entries.length
      ? `\n\nWHAT HAPPENED TO JEREMY TODAY, usable as evidence but never the subject:\n` +
        c.entries.map((e: { text: string }) => `- ${e.text}`).join("\n")
      : "";
    const steer = a.note?.trim() ? `\n\nJEREMY WANTS THE REPLY TO GO HERE: ${a.note.trim().slice(0, 500)}` : "";

    const angles = REPLY_ANGLES.map((r, i) => `${i + 1}. ${r.label}: ${r.ask}`).join("\n");
    const said = await ask(
      REPLY_SYSTEM,
      `THE POST HE IS REPLYING TO:\n"""\n${post}\n"""${mine}${steer}\n\n` +
        `Write ${REPLY_ANGLES.length} replies, one per angle, in this order:\n${angles}\n\n` +
        `Each under 280 characters, two to four short lines, no preface.\n` +
        `Output them in order separated by a line containing only ===. No code block, no titles, no commentary.`,
      0.75,
    );

    const parts = unfence(said)
      .split(/^\s*={3,}\s*$/m)
      .map((p) => unfence(p))
      .filter(Boolean);
    if (!parts.length) throw new Error("Nothing came back. Try again.");
    return parts.slice(0, REPLY_ANGLES.length).map((body, i) => ({
      label: REPLY_ANGLES[i]?.label ?? `Reply ${i + 1}`,
      body,
    }));
  },
});

/** The Write button on the dashboard. */
export const generate = action({
  args: { passphrase: v.string(), day: v.optional(v.string()) },
  handler: async (ctx, a): Promise<{ at: number; kind: string; label: string; body: string; used: boolean }[]> => {
    mustBeJeremy(a.passphrase);
    const key = a.day && isDay(a.day) ? a.day : paris().day;
    const drafts = await ctx.runAction(internal.x.make, { day: key });
    /* Off to the side: the button should not wait on the brain. */
    await ctx.scheduler.runAfter(0, internal.x.digest, { day: key });
    return drafts;
  },
});

/* ── the brain ──────────────────────────────────────────────────────── */

/**
 * The brain of Jeremy, grown from the daily log.
 *
 * Same rules as the notes-and-syntheses brain it is modelled on. A day is
 * read once, so the daily log is the source and is never edited. A position
 * is rewritten each time a day touches it, never appended to. Evidence is
 * dated, so a claim can always be traced to the day he said it.
 */

const MAX_CONCEPTS = 80;
const MAX_EVIDENCE = 12;

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

/** The model is asked for JSON and sometimes fences it. Take the object. */
function parseJson(raw: string): any {
  const t = unfence(raw);
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("The model did not return anything readable");
  return JSON.parse(t.slice(a, b + 1));
}

type Concept = Doc<"xBrain">;

export const concepts = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query("xBrain").collect()) as Concept[],
});

/** Days with something in them that the brain has not read yet, oldest first. */
async function waitingDays(ctx: { db: any }) {
  const days = (await ctx.db.query("xDays").withIndex("by_day").order("desc").take(120)) as DayDoc[];
  return days
    .filter((d) => {
      if (!d.entries.length) return false;
      const last = Math.max(...d.entries.map((e) => e.at));
      return d.digestedAt == null || last > d.digestedAt;
    })
    .map((d) => d.day)
    .sort();
}

export const waiting = internalQuery({
  args: {},
  handler: async (ctx) => await waitingDays(ctx),
});

/**
 * Which day of the road a date is: Day 1 is SERIES_START, or, when that is
 * empty, the first day anything was logged. Counted here so the script says a
 * number that is true instead of one the model made up.
 */
export const seriesDay = internalQuery({
  args: { day: v.string() },
  handler: async (ctx, { day }) => {
    const first =
      SERIES_START && isDay(SERIES_START)
        ? SERIES_START
        : ((await ctx.db.query("xDays").withIndex("by_day").order("asc").take(400)) as DayDoc[]).find(
            (d) => d.entries.length,
          )?.day ?? day;
    const gap = Math.round((Date.parse(day + "T00:00:00Z") - Date.parse(first + "T00:00:00Z")) / 86_400_000);
    return Math.max(1, gap + 1);
  },
});

export const applyDigest = internalMutation({
  args: {
    day: v.string(),
    updates: v.array(
      v.object({
        slug: v.string(),
        name: v.string(),
        position: v.string(),
        evidence: v.string(),
        conflict: v.optional(v.string()),
        question: v.optional(v.string()),
        settled: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (ctx, { day, updates }) => {
    const all = (await ctx.db.query("xBrain").collect()) as Concept[];

    /* Strip this day's evidence everywhere first, so reading a day twice
       replaces what it said instead of doubling it. */
    for (const c of all) {
      if (c.evidence.some((e) => e.day === day))
        await ctx.db.patch(c._id, { evidence: c.evidence.filter((e) => e.day !== day) });
    }
    const bySlug = new Map(all.map((c) => [c.slug, c]));
    let count = all.length;

    for (const u of updates.slice(0, 6)) {
      const slug = slugify(u.slug || u.name);
      const position = u.position.trim().slice(0, 500);
      const text = u.evidence.trim().slice(0, 300);
      if (!slug || !position || !text) continue;
      const ev = { day, text };
      const hit = bySlug.get(slug);

      /* A contradiction becomes a question, and stays one until an answer
         settles it. Nothing is asked twice: a conflict already open is kept
         as it is unless a new one replaces it. */
      const said = u.conflict?.trim().slice(0, 240) || undefined;
      const conflict = u.settled === true ? undefined : said ?? hit?.conflict;
      const conflictQ =
        u.settled === true
          ? undefined
          : said
            ? (u.question?.trim() || `${said} Which is true now, and why?`).slice(0, 300)
            : hit?.conflictQ;

      if (hit) {
        const evidence = [...hit.evidence.filter((e) => e.day !== day), ev]
          .sort((a, b) => a.day.localeCompare(b.day))
          .slice(-MAX_EVIDENCE);
        await ctx.db.patch(hit._id, {
          name: u.name.trim().slice(0, 60) || hit.name,
          position,
          evidence,
          conflict,
          conflictQ,
          updatedAt: Date.now(),
        });
      } else if (count < MAX_CONCEPTS) {
        await ctx.db.insert("xBrain", {
          slug,
          name: u.name.trim().slice(0, 60) || slug,
          position,
          evidence: [ev],
          conflict: said,
          conflictQ: said ? (u.question?.trim() || `${said} Which is true now, and why?`).slice(0, 300) : undefined,
          updatedAt: Date.now(),
        });
        count++;
      }
    }

    /* A position with no evidence behind it is a claim nobody made. */
    for (const c of (await ctx.db.query("xBrain").collect()) as Concept[])
      if (!c.evidence.length) await ctx.db.delete(c._id);
    return null;
  },
});

/**
 * A contradiction in the brain is settled by asking, not by a screen.
 *
 * Every concept holding an open conflict gets its question onto the day's
 * feed under Why, at most two a day so a bad week does not bury the real
 * questions. It is idempotent, so it can run after every digest and every
 * time a feed is filled, and a question is never put on a day twice. It
 * comes back every day until an answer settles it.
 */
export const queueConflicts = internalMutation({
  args: { day: v.string() },
  handler: async (ctx, { day }) => {
    const open = ((await ctx.db.query("xBrain").collect()) as Concept[]).filter((c) => c.conflictQ);
    if (!open.length) return 0;
    const old = await find(ctx, day);
    const asks = old?.asks ?? [];
    const on = new Set(asks.filter((x) => x.concept).map((x) => x.concept));
    const room = Math.max(0, 2 - on.size);
    const fresh = open
      .filter((c) => !on.has(c.slug))
      .slice(0, room)
      .map((c) => ({ id: rid(), at: Date.now(), text: c.conflictQ as string, beat: "you", answered: false, concept: c.slug }));
    if (fresh.length) await upsert(ctx, day, { asks: [...asks, ...fresh] });
    return fresh.length;
  },
});

export const markDigested = internalMutation({
  args: { day: v.string() },
  handler: async (ctx, { day }) => {
    const d = await find(ctx, day);
    if (d) await ctx.db.patch(d._id, { digestedAt: Date.now() });
    return null;
  },
});

/** Read one day into the brain. */
export const digest = internalAction({
  args: { day: v.string() },
  handler: async (ctx, { day }): Promise<number> => {
    const c = await ctx.runQuery(internal.x.context, { day });
    const entries: { q?: string; text: string }[] = c.entries;
    if (!entries.length) return 0;

    const held: Concept[] = await ctx.runQuery(internal.x.concepts, {});
    const index = held.length
      ? held.map((h) => `- ${h.slug} | ${h.name} | ${h.position.slice(0, 300)}`).join("\n")
      : "(the brain is empty, so every concept below is new)";
    const opened = held.filter((h) => h.conflictQ);
    const conflicts = opened.length
      ? `\n\nOPEN CONFLICTS (slug | the question he was asked):\n` + opened.map((h) => `- ${h.slug} | ${h.conflictQ}`).join("\n")
      : "";

    const raw = await ask(
      DIGEST_SYSTEM,
      `DATE: ${day}\n\nTHE BRAIN NOW (slug | name | position):\n${index}${conflicts}\n\n` +
        `WHAT HE SAID THIS DAY:\n${transcriptOf(entries)}\n\nUpdate the brain.`,
      0.3,
      { note: false, max: 3000 },
    );
    const parsed = parseJson(raw);
    const list = Array.isArray(parsed?.concepts) ? parsed.concepts : [];
    const updates = list
      .filter((u: any) => u && typeof u.position === "string" && typeof u.evidence === "string")
      .map((u: any) => ({
        slug: String(u.slug ?? u.name ?? ""),
        name: String(u.name ?? u.slug ?? ""),
        position: u.position,
        evidence: u.evidence,
        conflict: typeof u.conflict === "string" && u.conflict.trim() ? u.conflict : undefined,
        question: typeof u.question === "string" && u.question.trim() ? u.question : undefined,
        settled: u.settled === true ? true : undefined,
      }));
    await ctx.runMutation(internal.x.applyDigest, { day, updates });
    await ctx.runMutation(internal.x.markDigested, { day });
    /* Whatever this day left contradictory is asked about on today's feed. */
    await ctx.runMutation(internal.x.queueConflicts, { day: paris().day });
    return updates.length;
  },
});

/**
 * Read every day the brain has not read, oldest first so a newer position
 * overrides an older one. Five at a time, so one run stays well inside how
 * long a request may take.
 */
async function readWaiting(ctx: ActionCtx) {
  const todo: string[] = await ctx.runQuery(internal.x.waiting, {});
  let fed = 0;
  let failed = 0;
  let error: string | undefined;
  for (const day of todo.slice(0, 5)) {
    try {
      await ctx.runAction(internal.x.digest, { day });
      fed++;
    } catch (e) {
      failed++;
      error = e instanceof Error ? e.message : String(e);
      console.error("x: could not read a day into the brain", day, e);
    }
  }
  return { fed, failed, left: Math.max(0, todo.length - fed), error };
}

/** The page calls this on its own when it opens with days waiting. */
export const feed = action({
  args: { passphrase: v.string() },
  handler: async (ctx, a): Promise<{ fed: number; failed: number; left: number; error?: string }> => {
    mustBeJeremy(a.passphrase);
    return await readWaiting(ctx);
  },
});

/** The night run: whatever the day left unread goes in at 23:00. */
export const catchUp = internalAction({
  args: {},
  handler: async (ctx) => {
    await readWaiting(ctx);
    return null;
  },
});

/* ── video ideas ────────────────────────────────────────────────────── */

export const putIdea = internalMutation({
  args: {
    idea: v.string(),
    structure: v.string(),
    script: v.string(),
    concepts: v.array(v.string()),
    gaps: v.array(v.string()),
    angles: v.array(v.string()),
  },
  handler: async (ctx, a) => {
    const id = await ctx.db.insert("xIdeas", { ...a, createdAt: Date.now() });
    return id;
  },
});

/** Questions the brain could not answer land on today's feed, under "You". */
export const addAsks = internalMutation({
  args: { day: v.string(), questions: v.array(v.string()) },
  handler: async (ctx, { day, questions }) => {
    const old = await find(ctx, day);
    const asks = old?.asks ?? [];
    const have = new Set(asks.map((x) => x.text));
    const fresh = questions
      .filter((q) => !have.has(q))
      .map((text) => ({ id: rid(), at: Date.now(), text: text.slice(0, 300), beat: "you", answered: false }));
    if (fresh.length) await upsert(ctx, day, { asks: [...asks, ...fresh] });
    return fresh.length;
  },
});

const ideaOut = (d: Doc<"xIdeas">) => ({
  id: d._id,
  idea: d.idea,
  structure: d.structure,
  script: d.script,
  concepts: d.concepts,
  gaps: d.gaps,
  angles: d.angles ?? [],
  used: !!d.used,
  createdAt: d.createdAt,
});

export const ideas = query({
  args: { passphrase: v.string() },
  handler: async (ctx, { passphrase }) => {
    mustBeJeremy(passphrase);
    return {
      list: (await ctx.db.query("xIdeas").order("desc").take(30)).map(ideaOut),
      concepts: (await ctx.db.query("xBrain").collect()).length,
    };
  },
});

export const useIdea = mutation({
  args: { passphrase: v.string(), id: v.id("xIdeas"), used: v.boolean() },
  handler: async (ctx, { passphrase, id, used }) => {
    mustBeJeremy(passphrase);
    await ctx.db.patch(id, { used });
    return null;
  },
});

/**
 * One idea in, two things out.
 *
 * It picks the concepts the idea needs, then writes a talking structure and a
 * script in the daily vlog format from the same material, in parallel. The
 * material is the brain and nothing else: the daily log reaches it only by
 * being read in. What the brain could not answer comes back as questions and
 * lands on today's feed, which is how a thin brain gets thicker.
 */
export const build = action({
  args: { passphrase: v.string(), idea: v.string() },
  handler: async (ctx, a): Promise<ReturnType<typeof ideaOut>> => {
    mustBeJeremy(a.passphrase);
    const idea = a.idea.trim().slice(0, 300);
    if (!idea) throw new Error("Type the idea first");

    const held: Concept[] = await ctx.runQuery(internal.x.concepts, {});
    if (!held.length)
      throw new Error("The brain is empty. It fills from your daily answers.");

    /* Which parts of the brain does this idea need? */
    let picked: Concept[] = [];
    {
      const index = held.map((c) => `${c.slug} | ${c.name} | ${c.position.slice(0, 140)}`).join("\n");
      const said = await ask(
        "You pick which parts of a person's brain a video idea needs. You answer with slugs only.",
        `IDEA: ${idea}\n\nCONCEPTS (slug | name | position):\n${index}\n\n` +
          `Reply with up to 6 slugs that hold material for this idea, comma separated, most relevant first. ` +
          `If none do, reply NONE.`,
        0.2,
        { note: false, max: 200 },
      );
      const want = said.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean);
      picked = want
        .map((w) => held.find((c) => c.slug === w))
        .filter((c): c is Concept => !!c)
        .filter((c, i, all) => all.indexOf(c) === i)
        .slice(0, 6);
    }

    const material =
      `IDEA: ${idea}\n\n` +
      (picked.length
        ? "WHAT HIS BRAIN HOLDS ON THIS:\n" +
          picked
            .map(
              (c) =>
                `## ${c.name}\nPosition: ${c.position}\n` +
                c.evidence.slice(-6).map((e) => `- [${e.day}] ${e.text}`).join("\n") +
                (c.conflict ? `\nOpen conflict: ${c.conflict}` : ""),
            )
            .join("\n\n")
        : "WHAT HIS BRAIN HOLDS ON THIS: nothing yet. Every beat is a GAP.");

    const [structure, script] = await Promise.all([
      ask(TALK_SYSTEM, `${material}\n\nBuild the talking structure.`, 0.7, { note: false, max: 2500 }),
      ask(
        SCRIPT_SYSTEM,
        `${material}\n\nWrite the 60 second script for this idea.\n\n` +
          `This video is about the idea, not about today. Build it from what his brain holds.\n\n` +
          `THE HOOK. The first sentence of the block labelled Situation is a storytelling hook for this idea: ` +
          `the open loop of the idea, taken from the Conflict or the Change in the material. It lands in 3 ` +
          `seconds, promises without giving the answer away, and is under 20 words. Give it also as on-screen ` +
          `text, under 8 words, on its own line labelled "On screen".\n\n` +
          `${CRAFT}\n\n` +
          `THE FIVE LINES. The rest of the Situation says he is 25 and where he stands on this idea, the Desire ` +
          `is what he wants from it, the Conflict is what blocks it, the Change is the decision he took, and ` +
          `the Result is what is true now. Name no city or country. The Change and the Result carry his dated ` +
          `specifics. Only the Situation may lean on who Jeremy is. After the Result, add one exit line, ` +
          `under 15 words: one thing the viewer can do. ` +
          `Where the material is thin, write [X] and list what you needed at the end.`,
        0.7,
        { max: 2500 },
      ),
    ]);

    /* The GAPS block becomes questions for tomorrow's feed. */
    const gapBlock = structure.split(/^\s*GAPS\s*$/m)[1] ?? "";
    const gaps = gapBlock
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("-"))
      .map((l) => l.replace(/^-+\s*/, "").trim())
      .filter((l) => l && !/^none\b/i.test(l))
      .slice(0, 3);
    if (gaps.length) await ctx.runMutation(internal.x.addAsks, { day: paris().day, questions: gaps });

    /* MORE ANGLES becomes three ideas he can start from with one click. */
    const angleBlock = (structure.split(/^\s*MORE ANGLES\s*$/m)[1] ?? "").split(/^\s*GAPS\s*$/m)[0];
    const angles = angleBlock
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("-"))
      .map((l) => l.replace(/^-+\s*/, "").replace(/^(fastest way|new way|niche context)\s*:\s*/i, "").trim())
      .filter((l) => l.length > 6)
      .slice(0, 3);

    const id = await ctx.runMutation(internal.x.putIdea, {
      idea,
      structure,
      script,
      concepts: picked.map((c) => c.name),
      gaps,
      angles,
    });
    return { id, idea, structure, script, concepts: picked.map((c) => c.name), gaps, angles, used: false, createdAt: Date.now() };
  },
});

/* ── the three mails ────────────────────────────────────────────────── */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const SITE = () => process.env.X_SITE_URL || "https://x.jeremylasne.com";

/* X's own colours: black, the one blue, and the grey between. */
const C = { bg: "#000000", card: "#16181c", line: "#2f3336", ink: "#e7e9ea", dim: "#71767b", blue: "#1d9bf0" };

function longDate(day: string) {
  const d = new Date(day + "T12:00:00Z");
  return d.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  });
}

function mailBody(day: string, slot: string, d: ReturnType<typeof blank> | any) {
  const qs = questionsFor(slot, day);
  const clock = (at: number) => {
    const t = new Date(at + parisOffset(at) * 3_600_000);
    return `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`;
  };
  const box = (inner: string) =>
    `<div style="background:${C.card};border:1px solid ${C.line};border-radius:16px;padding:18px 20px;margin:0 0 14px">${inner}</div>`;
  const h = (t: string) =>
    `<div style="font:600 13px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${C.dim};margin:0 0 12px">${esc(t)}</div>`;

  const parts: string[] = [];

  parts.push(
    box(
      h(SLOT_TITLE[slot] ?? slot) +
        qs
          .map(
            (q, i) =>
              `<div style="display:block;margin:0 0 ${i === qs.length - 1 ? 0 : 12}px">` +
              `<span style="color:${C.blue};font:700 15px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">${i + 1}.</span> ` +
              `<span style="color:${C.ink};font:400 15px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">${esc(q)}</span></div>`,
          )
          .join("") +
        `<div style="margin:18px 0 0"><a href="${SITE()}" style="display:inline-block;background:${C.ink};color:${C.bg};text-decoration:none;font:700 15px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:13px 22px;border-radius:9999px">Answer on the platform</a></div>`,
    ),
  );

  parts.push(
    box(
      h(`today so far · ${d.entries.length} ${d.entries.length === 1 ? "entry" : "entries"}`) +
        (d.entries.length
          ? d.entries
              .map(
                (e: any) =>
                  `<div style="margin:0 0 14px">` +
                  `<div style="font:500 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;color:${C.dim};margin:0 0 5px">${clock(e.at)}${e.q ? " · " + esc(e.q) : ""}</div>` +
                  `<div style="font:400 15px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${C.ink};white-space:pre-wrap">${esc(e.text)}</div></div>`,
              )
              .join("")
          : `<div style="font:400 15px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${C.dim}">Nothing yet. The questions above are the fastest way in.</div>`),
    ),
  );

  /* Only what is still unposted: a draft already ticked used is finished
     business, and repeating it buries the one that still needs sending. */
  const left = d.drafts.filter((x: { used?: boolean }) => !x.used);
  if (left.length)
    parts.push(
      box(
        h(`still to post · ${left.length} of ${d.drafts.length}`) +
          left
            .map(
              (x: any) =>
                `<div style="margin:0 0 16px">` +
                `<div style="font:500 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:${C.blue};margin:0 0 7px">${esc(x.label)}</div>` +
                `<div style="font:400 15px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${C.ink};white-space:pre-wrap;background:${C.bg};border:1px solid ${C.line};border-radius:12px;padding:14px 16px">${esc(x.body)}</div></div>`,
            )
            .join(""),
      ),
    );

  const html =
    `<div style="background:${C.bg};margin:0;padding:28px 16px"><div style="max-width:620px;margin:0 auto">` +
    `<div style="font:700 26px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${C.ink};margin:0 0 4px">x</div>` +
    `<div style="font:400 14px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${C.dim};margin:0 0 20px">${esc(longDate(day))} · ${esc(slot)}:00 Paris</div>` +
    parts.join("") +
    `<div style="font:400 12px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${C.dim};padding:6px 4px 0">Every mail carries the whole day, so this inbox is the archive.</div>` +
    `</div></div>`;

  const text = [
    `x · ${longDate(day)} · ${slot}:00 Paris`,
    "",
    (SLOT_TITLE[slot] ?? slot).toUpperCase(),
    ...qs.map((q, i) => `${i + 1}. ${q}`),
    "",
    SITE(),
    "",
    `TODAY SO FAR (${d.entries.length})`,
    ...(d.entries.length
      ? d.entries.map((e: any) => `[${clock(e.at)}]${e.q ? " " + e.q : ""}\n${e.text}`)
      : ["Nothing yet."]),
    ...(left.length
      ? ["", `STILL TO POST (${left.length} of ${d.drafts.length})`, ...left.map((x: any) => `--- ${x.label} ---\n${x.body}`)]
      : []),
  ].join("\n");

  return { html, text, subject: `x · ${longDate(day)} · ${SLOT_TITLE[slot] ?? slot}` };
}

/**
 * The nudge: written drafts, none of them ticked off yet.
 *
 * Shorter than the three daily mails, because it asks for one thing. Each
 * post is here in full, so it can go out from the phone without opening
 * anything else.
 */
function nudgeBody(day: string, hour: number, left: { kind: string; label: string; body: string }[]) {
  const posts = left.filter((d) => d.kind === "post").length;
  const box = (inner: string) =>
    `<div style="background:${C.card};border:1px solid ${C.line};border-radius:16px;padding:18px 20px;margin:0 0 14px">${inner}</div>`;
  const font = "-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";

  const html =
    `<div style="background:${C.bg};margin:0;padding:28px 16px"><div style="max-width:620px;margin:0 auto">` +
    `<div style="font:700 26px/1 ${font};color:${C.ink};margin:0 0 4px">x</div>` +
    `<div style="font:400 14px/1.4 ${font};color:${C.dim};margin:0 0 20px">${esc(longDate(day))} · ${hour}:00 Paris</div>` +
    box(
      `<div style="font:700 19px/1.35 ${font};color:${C.ink};margin:0 0 8px">${left.length} written, nothing posted.</div>` +
      `<div style="font:400 15px/1.5 ${font};color:${C.dim}">${posts} ${posts === 1 ? "post" : "posts"} and the script have been sitting since 17:00.</div>` +
      `<div style="margin:18px 0 0"><a href="${SITE()}" style="display:inline-block;background:${C.ink};color:${C.bg};text-decoration:none;font:700 15px/1 ${font};padding:13px 22px;border-radius:9999px">Open the drafts</a></div>`,
    ) +
    left
      .map((d) =>
        box(
          `<div style="font:500 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:${C.blue};margin:0 0 9px">${esc(d.label)}</div>` +
          `<div style="font:400 15px/1.55 ${font};color:${C.ink};white-space:pre-wrap">${esc(d.body)}</div>`,
        ),
      )
      .join("") +
    `</div></div>`;

  const text = [
    `x · ${longDate(day)} · ${hour}:00 Paris`,
    "",
    `${left.length} written, nothing posted. Sitting since 17:00.`,
    SITE(),
    "",
    ...left.map((d) => `--- ${d.label} ---\n${d.body}`),
  ].join("\n");

  return { subject: `x · ${left.length} drafts still unposted`, html, text };
}

export const sendNudge = internalAction({
  args: { day: v.string(), hour: v.number() },
  handler: async (ctx, { day, hour }) => {
    const d = await ctx.runQuery(internal.x.dayFor, { day });
    const left = d.drafts.filter((x: { used?: boolean }) => !x.used);
    if (!left.length) return null;
    const { subject, html, text } = nudgeBody(day, hour, left);
    await resend(subject, html, text);
    await ctx.runMutation(internal.x.markMailed, { day, slot: "nudge" });
    return null;
  },
});

async function resend(subject: string, html: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  /* The two addresses are settled, so they are defaults rather than setup.
     X_MAIL_FROM and X_MAIL_TO still win if either ever moves. */
  const from = process.env.X_MAIL_FROM || "hello@kaught.app";
  const to = process.env.X_MAIL_TO || "jeremylasne0@gmail.com";
  if (!key) throw new Error("Set RESEND_API_KEY in the Convex dashboard first");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: to.split(",").map((s) => s.trim()).filter(Boolean), subject, html, text }),
  });
  if (!res.ok) throw new Error(`Resend said ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/**
 * One mail. At 17:00 the day is written first, so the evening mail carries
 * the three posts and the script. A generation failure never eats the mail:
 * the questions and the day still go out.
 */
export const sendSlot = internalAction({
  args: { day: v.string(), slot: v.string(), mark: v.optional(v.boolean()) },
  handler: async (ctx, { day, slot, mark }) => {
    /* Write the day at 17:00, but never over drafts that already exist:
       writing replaces the set, and with it every used tick. */
    if (slot === "17") {
      const before = await ctx.runQuery(internal.x.dayFor, { day });
      if (!before.drafts.length) {
        try {
          await ctx.runAction(internal.x.make, { day });
        } catch (e) {
          console.error("x: could not write the drafts", e);
        }
      }
      await ctx.scheduler.runAfter(0, internal.x.digest, { day });
    }
    const d = await ctx.runQuery(internal.x.dayFor, { day });
    const { subject, html, text } = mailBody(day, slot, d);
    await resend(subject, html, text);
    if (mark !== false) await ctx.runMutation(internal.x.markMailed, { day, slot });
    return null;
  },
});

/**
 * Every hour, on the hour. Convex crons run on UTC and Paris moves twice a
 * year, so the hour is worked out here rather than written into the
 * schedule. `mailed` on the day makes a double fire harmless.
 */
export const tick = internalAction({
  args: {},
  handler: async (ctx) => {
    const { day, hour } = paris();
    const slot = String(hour);
    const d = await ctx.runQuery(internal.x.dayFor, { day });

    if (SLOTS.includes(slot as any)) {
      if (!d.mailed.includes(slot)) await ctx.runAction(internal.x.sendSlot, { day, slot });
      return null;
    }

    if (hour === DIGEST_AT) {
      await ctx.runAction(internal.x.catchUp, {});
      return null;
    }

    /* Drafts written and none of them ticked off: one nudge at 20:00. */
    if (hour !== NUDGE_AT) return null;
    if (!d.drafts.length || d.drafts.some((x: { used?: boolean }) => x.used)) return null;
    if (d.mailed.includes("nudge")) return null;
    await ctx.runAction(internal.x.sendNudge, { day, hour });
    return null;
  },
});

/** Send one of today's mails by hand, to check the wiring. */
export const testMail = action({
  args: { passphrase: v.string(), slot: v.optional(v.string()) },
  handler: async (ctx, a): Promise<string> => {
    mustBeJeremy(a.passphrase);
    const { day, hour } = paris();
    const slot = a.slot && SLOTS.includes(a.slot as any) ? a.slot : hour < 12 ? "10" : hour < 16 ? "14" : "17";
    const d = await ctx.runQuery(internal.x.dayFor, { day });
    const { subject, html, text } = mailBody(day, slot, d);
    await resend(subject, html, text);
    return `Sent the ${slot}:00 mail to ${process.env.X_MAIL_TO || "jeremylasne0@gmail.com"}`;
  },
});
