import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { clean, daysBetween, dateKey, isKey } from "../../bio/spec.js";

/**
 * jeremylasne.com/bio: one document, read by everyone, written by one person.
 *
 * October 2026, 31 days, one entry a day: intake and levers logged by hand,
 * sport as a list of sessions, sleep and the rest read off the watch, the
 * scale and Yazio. A write carries the passphrase
 * set as BIO_PASSPHRASE in the Convex dashboard; there are no accounts because
 * there is exactly one author. What a write may contain (days inside the
 * challenge and not after today, the known field ids, every number in range)
 * is decided by `clean` in bio/spec.js, the same file the page imports, so the
 * two sides cannot drift apart.
 *
 * The key is bumped for the new shape, so the habit log from before it sits
 * untouched under "v2" instead of being half-read as this one.
 */
const KEY = "oct26";

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
    /* Anything the page sends; `clean` decides what survives. */
    log: v.record(v.string(), v.record(v.string(), v.union(
      v.float64(), v.boolean(), v.string(),
      v.array(v.object({ s: v.string(), t: v.optional(v.float64()), e: v.optional(v.float64()), k: v.optional(v.float64()), i: v.optional(v.float64()) })),
      v.array(v.object({ t: v.optional(v.float64()), e: v.optional(v.float64()), k: v.optional(v.float64()) })),
    ))),
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
