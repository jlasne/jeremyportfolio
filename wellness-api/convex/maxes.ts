import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { cleanMaxes, daysBetween, dateKey, isKey } from "../../wellness/spec.js";

/**
 * jeremylasne.com/wellness: my max, one document holding the whole list.
 *
 * The most I did, typed by hand: a name and any of reps, weight, metres,
 * speed and time. Read by everyone, written with BIO_PASSPHRASE. What it may
 * hold is decided by `cleanMaxes` in wellness/spec.js.
 */
const KEY = "max";

function mustBeJeremy(passphrase: string) {
  const want = process.env.BIO_PASSPHRASE;
  if (!want) throw new Error("Set BIO_PASSPHRASE in the Convex dashboard first");
  if (passphrase !== want) throw new Error("Wrong passphrase");
}

const current = (ctx: { db: any }) =>
  ctx.db.query("maxes").withIndex("by_key", (q: any) => q.eq("key", KEY)).unique();

export const get = query({
  args: {},
  handler: async (ctx) => {
    const d = await current(ctx);
    return d ? d.list : [];
  },
});

export const save = mutation({
  args: {
    passphrase: v.string(),
    today: v.string(),
    /* Anything the page sends; `cleanMaxes` decides what survives. */
    list: v.any(),
  },
  handler: async (ctx, { passphrase, today, list }) => {
    mustBeJeremy(passphrase);
    if (!isKey(today)) throw new Error("Send the day as YYYY-MM-DD");
    if (Math.abs(daysBetween(today, dateKey())) > 1) throw new Error("Your clock and the server disagree by more than a day");
    const clean = cleanMaxes(list, today);
    const old = await current(ctx);
    const doc = { key: KEY, list: clean, updatedAt: Date.now() };
    if (old) await ctx.db.replace(old._id, doc);
    else await ctx.db.insert("maxes", doc);
    return clean;
  },
});
