import { mutation, internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const CODE_TTL = 10 * 60 * 1000;        /* ten minutes to type six digits */
const SESSION_TTL = 60 * 24 * 60 * 60 * 1000;  /* sixty days signed in */
const MAX_TRIES = 5;

function sixDigits(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(n).padStart(6, "0");
}
function opaqueToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * Ask for a code. Always answers the same way whether or not the address is
 * known — no account enumeration.
 *
 * OVERLAP_DEV_CODES=1 returns the code in the response so you can sign in
 * before wiring an email provider. NEVER set it once real people can reach
 * the deployment: it hands anyone a login for any address.
 */
export const requestCode = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const addr = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) throw new Error("That email looks off");

    const recent = await ctx.db
      .query("codes")
      .withIndex("by_email", (q) => q.eq("email", addr))
      .collect();
    for (const r of recent) await ctx.db.delete(r._id);

    const code = sixDigits();
    await ctx.db.insert("codes", {
      email: addr,
      code,
      expiresAt: Date.now() + CODE_TTL,
      tries: 0,
    });
    await ctx.scheduler.runAfter(0, internal.auth.deliverCode, { email: addr, code });
    return process.env.OVERLAP_DEV_CODES === "1" ? { sent: true, devCode: code } : { sent: true };
  },
});

/** Sends the code with Resend when RESEND_API_KEY is set; logs it otherwise. */
export const deliverCode = internalAction({
  args: { email: v.string(), code: v.string() },
  handler: async (_ctx, { email, code }) => {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.OVERLAP_FROM_EMAIL ?? "Overlap <onboarding@resend.dev>";
    if (!key) {
      console.log(`[overlap] no RESEND_API_KEY — sign-in code for ${email} is ${code}`);
      return;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: email,
        subject: `${code} — your Overlap code`,
        text: `Your code is ${code}. It expires in ten minutes.`,
      }),
    });
    if (!res.ok) console.error("[overlap] resend failed", res.status, await res.text());
  },
});

export const verify = mutation({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, { email, code }) => {
    const addr = email.trim().toLowerCase();
    const row = (
      await ctx.db.query("codes").withIndex("by_email", (q) => q.eq("email", addr)).collect()
    )[0];
    if (!row) throw new Error("Ask for a new code");
    if (row.expiresAt < Date.now()) {
      await ctx.db.delete(row._id);
      throw new Error("That code expired");
    }
    if (row.tries >= MAX_TRIES) {
      await ctx.db.delete(row._id);
      throw new Error("Too many tries — ask for a new code");
    }
    if (row.code !== code.trim()) {
      await ctx.db.patch(row._id, { tries: row.tries + 1 });
      throw new Error("Not that code");
    }
    await ctx.db.delete(row._id);

    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", addr))
      .unique();
    if (!user) {
      const id = await ctx.db.insert("users", {
        email: addr,
        name: addr.split("@")[0],
        createdAt: Date.now(),
      });
      user = (await ctx.db.get(id))!;
    }

    const token = opaqueToken();
    await ctx.db.insert("sessions", {
      userId: user._id,
      token,
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL,
    });
    return { token, user: { name: user.name, email: user.email } };
  },
});

export const signOut = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const s = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (s) await ctx.db.delete(s._id);
    return null;
  },
});
