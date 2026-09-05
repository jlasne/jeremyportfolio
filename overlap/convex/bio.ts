import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { clean, daysBetween, dateKey, isKey } from "../../bio/spec.js";

/**
 * jeremylasne.com/bio: one document, read by everyone, written by one person.
 *
 * The page renders the fallbacks from bio/spec.js and then patches in what is
 * here. A write carries the passphrase set as BIO_PASSPHRASE in the Convex
 * dashboard; there are no accounts because there is exactly one author. What
 * a write may contain (days up to today, the known habits, number ranges) is
 * decided by `clean` in the same spec file the page uses. One entry per day:
 * the habit checks, hours slept, and the result of each training session.
 */
const KEY = "v2";

function mustBeJeremy(passphrase: string) {
  const want = process.env.BIO_PASSPHRASE;
  if (!want) throw new Error("Set BIO_PASSPHRASE in the Convex dashboard first");
  if (passphrase !== want) throw new Error("Wrong passphrase");
}

const pub = (d: Omit<Doc<"bio">, "_id" | "_creationTime">) => ({
  log: d.log, today: d.today, updatedAt: d.updatedAt,
});
const current = (ctx: { db: any }) =>
  ctx.db.query("bio").withIndex("by_key", (q: any) => q.eq("key", KEY)).unique() as Promise<Doc<"bio"> | null>;

export const get = query({
  args: {},
  handler: async (ctx) => {
    const d = await current(ctx);
    return d ? pub(d) : null;
  },
});

/* Answers before the inputs unlock, so a wrong passphrase is a shake, not
   a lost edit. */
export const unlock = query({
  args: { passphrase: v.string() },
  handler: async (_ctx, { passphrase }) => { mustBeJeremy(passphrase); return true; },
});

export const save = mutation({
  args: {
    passphrase: v.string(),
    /* the page's local date: days after it are refused */
    today: v.string(),
    log: v.record(v.string(), v.object({
      habits: v.record(v.string(), v.boolean()),
      sleep: v.optional(v.number()),
      train: v.optional(v.record(v.string(), v.number())),
      note: v.optional(v.string()),
    })),
  },
  handler: async (ctx, { passphrase, today, ...input }) => {
    mustBeJeremy(passphrase);
    if (!isKey(today)) throw new Error("Send the day as YYYY-MM-DD");
    if (Math.abs(daysBetween(today, dateKey())) > 1) throw new Error("Your clock and the server disagree by more than a day");
    const doc = { key: KEY, ...clean(input, today), today, updatedAt: Date.now() };
    const old = await current(ctx);
    if (old) await ctx.db.replace(old._id, doc);
    else await ctx.db.insert("bio", doc);
    return pub(doc);
  },
});
