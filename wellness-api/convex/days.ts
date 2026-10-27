import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { cleanDay, daysBetween, dateKey, isKey } from "../../wellness/spec.js";

/**
 * jeremylasne.com/wellness: one document per day, read by everyone, written
 * by one person.
 *
 * A day is the night that ended that morning (read off the watch) and the
 * sport sessions done that day. A write carries the passphrase set as
 * BIO_PASSPHRASE, the same one Exp 0 uses. What a day may contain is decided
 * by `cleanDay` in wellness/spec.js, the file the page imports too.
 *
 * Exp 0 (table `bio`, key "oct26") is left as it is. The page reads it for
 * any day this table does not have yet, so the October nights count as
 * normal from the start.
 */

function mustBeJeremy(passphrase: string) {
  const want = process.env.BIO_PASSPHRASE;
  if (!want) throw new Error("Set BIO_PASSPHRASE in the Convex dashboard first");
  if (passphrase !== want) throw new Error("Wrong passphrase");
}

const pub = (d: any) => {
  const out: Record<string, unknown> = { day: d.day, updatedAt: d.updatedAt };
  if (d.sleep) out.sleep = d.sleep;
  if (d.gf) out.gf = true;
  if (d.cold) out.cold = true;
  if (d.sessions) out.sessions = d.sessions;
  if (d.note) out.note = d.note;
  return out;
};

export const list = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("days").withIndex("by_day").collect();
    return rows.map(pub);
  },
});

export const save = mutation({
  args: {
    passphrase: v.string(),
    /* the page's local date: days after it are refused */
    today: v.string(),
    day: v.string(),
    /* Anything the page sends; `cleanDay` decides what survives. */
    entry: v.any(),
  },
  handler: async (ctx, { passphrase, today, day, entry }) => {
    mustBeJeremy(passphrase);
    if (!isKey(today)) throw new Error("Send the day as YYYY-MM-DD");
    if (Math.abs(daysBetween(today, dateKey())) > 1) throw new Error("Your clock and the server disagree by more than a day");
    const clean = cleanDay(day, entry, today);
    if (!clean) throw new Error("That day cannot be logged");
    const doc = { ...clean, updatedAt: Date.now() };
    const old = await ctx.db.query("days").withIndex("by_day", (q) => q.eq("day", day)).unique();
    if (old) await ctx.db.replace(old._id, doc);
    else await ctx.db.insert("days", doc);
    return pub(doc);
  },
});
