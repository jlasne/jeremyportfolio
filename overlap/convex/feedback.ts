import { mutation } from "./_generated/server";
import { v } from "convex/values";

/** "What would you like to see?" — the whole point of the third step. */
export const send = mutation({
  args: {
    text: v.optional(v.string()),
    wants: v.optional(v.array(v.string())),
    email: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, { text, wants, email, token }) => {
    const body = (text ?? "").trim().slice(0, 2000);
    const picked = (wants ?? []).slice(0, 20);
    if (!body && !picked.length) throw new Error("Nothing to send");

    let userId = undefined;
    if (token) {
      const s = await ctx.db
        .query("sessions")
        .withIndex("by_token", (q) => q.eq("token", token))
        .unique();
      if (s && s.expiresAt > Date.now()) userId = s.userId;
    }
    await ctx.db.insert("feedback", {
      text: body,
      wants: picked,
      email: email ? email.trim().slice(0, 200) : undefined,
      userId,
      createdAt: Date.now(),
    });
    return null;
  },
});
