import {
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
  SLOTS,
  SLOT_TITLE,
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

const FACTS_KEY = "facts";
const MAX_ENTRY = 4000;
const MAX_ENTRIES = 200;
const KEEP_DRAFT_DAYS = 3; /* how much recent work the model is shown */

/* ── the door ───────────────────────────────────────────────────────── */

function mustBeJeremy(passphrase: string) {
  const want = process.env.X_PASSPHRASE;
  if (!want) throw new Error("Set X_PASSPHRASE in the Convex dashboard first");
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
  bioDone: false,
  entries: [] as DayDoc["entries"],
  drafts: [] as DayDoc["drafts"],
  draftsAt: undefined as number | undefined,
  mailed: [] as string[],
  updatedAt: 0,
});

const pub = (d: DayDoc | null, day: string) =>
  d
    ? {
        day: d.day,
        bioDone: d.bioDone,
        entries: d.entries,
        drafts: d.drafts,
        draftsAt: d.draftsAt,
        mailed: d.mailed,
        updatedAt: d.updatedAt,
      }
    : blank(day);

const find = (ctx: { db: any }, day: string) =>
  ctx.db.query("xDays").withIndex("by_day", (q: any) => q.eq("day", day)).unique() as Promise<DayDoc | null>;

async function facts(ctx: { db: any }) {
  const d = await ctx.db
    .query("xFacts")
    .withIndex("by_key", (q: any) => q.eq("key", FACTS_KEY))
    .unique();
  return (d?.items ?? []) as { label: string; value: string }[];
}

/** Answers before the inputs unlock, so a wrong passphrase costs nothing. */
export const unlock = query({
  args: { passphrase: v.string() },
  handler: async (_ctx, { passphrase }) => {
    mustBeJeremy(passphrase);
    return true;
  },
});

/** Everything one screen needs: the day, the facts, and the questions due. */
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
      facts: await facts(ctx),
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
    const days = await ctx.db.query("xDays").withIndex("by_day").order("desc").take(n);
    return days.map((d) => ({
      day: d.day,
      bioDone: d.bioDone,
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

/** Log something. `q` is set when the text answers one of the questions. */
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
    if (!isDay(a.day)) throw new Error("Send the day as YYYY-MM-DD");
    const text = a.text.trim().slice(0, MAX_ENTRY);
    if (!text) throw new Error("Nothing to log");
    const old = await find(ctx, a.day);
    const entries = [
      ...(old?.entries ?? []),
      {
        at: Date.now(),
        slot: a.slot && SLOTS.includes(a.slot as any) ? a.slot : "free",
        q: a.q?.trim().slice(0, 300) || undefined,
        text,
      },
    ].slice(-MAX_ENTRIES);
    return await upsert(ctx, a.day, { entries });
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

/** The 30 day /bio challenge, ticked on the dashboard. */
export const bio = mutation({
  args: { passphrase: v.string(), day: v.string(), done: v.boolean() },
  handler: async (ctx, a) => {
    mustBeJeremy(a.passphrase);
    if (!isDay(a.day)) throw new Error("Send the day as YYYY-MM-DD");
    return await upsert(ctx, a.day, { bioDone: a.done });
  },
});

/** The facts sheet both prompts read. */
export const setFacts = mutation({
  args: {
    passphrase: v.string(),
    items: v.array(v.object({ label: v.string(), value: v.string() })),
  },
  handler: async (ctx, { passphrase, items }) => {
    mustBeJeremy(passphrase);
    const clean = items
      .map((i) => ({ label: i.label.trim().slice(0, 80), value: i.value.trim().slice(0, 120) }))
      .filter((i) => i.label && i.value)
      .slice(0, 20);
    const old = await ctx.db
      .query("xFacts")
      .withIndex("by_key", (q: any) => q.eq("key", FACTS_KEY))
      .unique();
    const doc = { key: FACTS_KEY, items: clean, updatedAt: Date.now() };
    if (old) await ctx.db.replace(old._id, doc);
    else await ctx.db.insert("xFacts", doc);
    return clean;
  },
});

/* ── what the model is shown ────────────────────────────────────────── */

/**
 * The brief, assembled on the server: the facts sheet, everything logged
 * today, and the last few days of posts so the model can see what has
 * already been said and avoid saying it twice.
 */
export const context = internalQuery({
  args: { day: v.string() },
  handler: async (ctx, { day }) => {
    const today = await find(ctx, day);
    const recent = await ctx.db.query("xDays").withIndex("by_day").order("desc").take(KEEP_DRAFT_DAYS + 1);
    return {
      facts: await facts(ctx),
      entries: today?.entries ?? [],
      previous: recent
        .filter((d) => d.day !== day)
        .slice(0, KEEP_DRAFT_DAYS)
        .map((d) => ({ day: d.day, posts: d.drafts.filter((x) => x.kind === "post").map((x) => x.body) })),
    };
  },
});

export const putDrafts = internalMutation({
  args: {
    day: v.string(),
    drafts: v.array(v.object({ at: v.number(), kind: v.string(), label: v.string(), body: v.string() })),
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
  facts: { label: string; value: string }[];
  entries: { at: number; slot: string; q?: string; text: string }[];
  previous: { day: string; posts: string[] }[];
}, day: string) {
  const when = (at: number) => {
    const d = new Date(at + parisOffset(at) * 3_600_000);
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  };
  const lines: string[] = [];
  lines.push(`DATE: ${day}`);
  if (c.facts.length) {
    lines.push("", "FACTS SHEET (current, use these numbers and no others):");
    for (const f of c.facts) lines.push(`- ${f.label}: ${f.value}`);
  }
  lines.push("", "TODAY'S LOG (what Jeremy said, in order):");
  if (!c.entries.length) lines.push("- (nothing logged)");
  for (const e of c.entries) {
    lines.push(e.q ? `- ${when(e.at)} Q: ${e.q}` : `- ${when(e.at)}`);
    lines.push(`  ${e.text.replace(/\n/g, "\n  ")}`);
  }
  const said = c.previous.filter((p) => p.posts.length);
  if (said.length) {
    lines.push("", "ALREADY POSTED IN THE LAST FEW DAYS (do not repeat these angles):");
    for (const p of said) for (const body of p.posts) lines.push(`- [${p.day}] ${body.split("\n")[0].slice(0, 140)}`);
  }
  return lines.join("\n");
}

/* ── OpenRouter ─────────────────────────────────────────────────────── */

/* DeepSeek V4 Flash 0423, which OpenRouter lists as `deepseek/deepseek-v4-flash`.
   Override with X_MODEL to try another. */
const MODEL = () => process.env.X_MODEL || "deepseek/deepseek-v4-flash";

async function ask(system: string, user: string): Promise<string> {
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
      temperature: 0.8,
      max_tokens: 2000,
      messages: [
        { role: "system", content: system + "\n\n" + RUN_NOTE },
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

/** The X prompt answers in a code block. Take what is inside it. */
const unfence = (s: string) => s.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();

/**
 * Write the day: three posts from three angles in one call, then the video
 * script in a second. Two calls, because the two prompts are two voices and
 * two output formats, and mixing them loses both.
 */
export const make = internalAction({
  args: { day: v.string() },
  handler: async (ctx, { day }): Promise<{ at: number; kind: string; label: string; body: string }[]> => {
    const c = await ctx.runQuery(internal.x.context, { day });
    if (!c.entries.length) throw new Error("Log something first: there is nothing to write from");
    const b = brief(c, day);

    const angles = POST_ANGLES.map((a, i) => `${i + 1}. ${a.label}: ${a.ask}`).join("\n");
    const postsRaw = await ask(
      POST_SYSTEM,
      `${b}\n\nWrite 3 posts from today, one per angle:\n${angles}\n\n` +
        `Output the 3 finished posts in order, plain text, separated by a line containing only ===. ` +
        `No code block, no titles, no commentary.`,
    );
    const parts = unfence(postsRaw)
      .split(/^\s*={3,}\s*$/m)
      .map((p) => unfence(p))
      .filter(Boolean);

    const script = await ask(SCRIPT_SYSTEM, `${b}\n\nWrite today's 60 second script from this log.`);

    const at = Date.now();
    const drafts = [
      ...parts.slice(0, POST_ANGLES.length).map((body, i) => ({
        at,
        kind: "post",
        label: POST_ANGLES[i]?.label ?? `Post ${i + 1}`,
        body,
      })),
      { at, kind: "script", label: "60s video", body: script },
    ];
    await ctx.runMutation(internal.x.putDrafts, { day, drafts });
    return drafts;
  },
});

/** The Write button on the dashboard. */
export const generate = action({
  args: { passphrase: v.string(), day: v.optional(v.string()) },
  handler: async (ctx, a): Promise<{ at: number; kind: string; label: string; body: string }[]> => {
    mustBeJeremy(a.passphrase);
    const key = a.day && isDay(a.day) ? a.day : paris().day;
    return await ctx.runAction(internal.x.make, { day: key });
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

  if (!d.bioDone)
    parts.push(
      box(
        `<div style="font:400 15px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${C.ink}">` +
          `<b>/bio is not filled today.</b> 30 day challenge. ` +
          `<a href="https://www.jeremylasne.com/bio/" style="color:${C.blue};text-decoration:none">Fill it now</a>.</div>`,
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

  if (d.drafts.length)
    parts.push(
      box(
        h("today's drafts") +
          d.drafts
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
    ...(d.bioDone ? [] : ["", "/bio is not filled today. 30 day challenge. https://www.jeremylasne.com/bio/"]),
    "",
    `TODAY SO FAR (${d.entries.length})`,
    ...(d.entries.length
      ? d.entries.map((e: any) => `[${clock(e.at)}]${e.q ? " " + e.q : ""}\n${e.text}`)
      : ["Nothing yet."]),
    ...(d.drafts.length ? ["", "TODAY'S DRAFTS", ...d.drafts.map((x: any) => `--- ${x.label} ---\n${x.body}`)] : []),
  ].join("\n");

  return { html, text, subject: `x · ${longDate(day)} · ${SLOT_TITLE[slot] ?? slot}` };
}

async function resend(subject: string, html: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  /* The two addresses are settled, so they are defaults rather than setup.
     X_MAIL_FROM and X_MAIL_TO still win if either ever moves. */
  const from = process.env.X_MAIL_FROM || "hey@jeremylasne.com";
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
    if (slot === "17") {
      try {
        await ctx.runAction(internal.x.make, { day });
      } catch (e) {
        console.error("x: could not write the drafts", e);
      }
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
    if (!SLOTS.includes(slot as any)) return null;
    const d = await ctx.runQuery(internal.x.dayFor, { day });
    if (d.mailed.includes(slot)) return null;
    await ctx.runAction(internal.x.sendSlot, { day, slot });
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
