import { action, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * One door: Google.
 *
 * The page gets an ID token from Google Identity Services and hands it here.
 * We do not trust it — Google's own tokeninfo endpoint validates the
 * signature and expiry, and we check the audience is our client, because an
 * ID token minted for some other app must not open an account here.
 *
 * That is the whole of it. No passwords, no codes, no second provider.
 */

const SESSION_TTL = 60 * 24 * 60 * 60 * 1000; /* sixty days signed in */

function opaqueToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export const google = action({
  args: { credential: v.string() },
  handler: async (
    ctx,
    { credential },
  ): Promise<{ token: string; user: { name: string; email: string } }> => {
    const clientId = process.env.OVERLAP_GOOGLE_CLIENT_ID;
    if (!clientId) throw new Error("Google sign-in is not configured");

    const res = await fetch(
      "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential),
    );
    if (!res.ok) throw new Error("Google would not vouch for that sign-in");
    const p = (await res.json()) as Record<string, string>;

    if (p.aud !== clientId) throw new Error("That sign-in was meant for another app");
    if (p.iss !== "accounts.google.com" && p.iss !== "https://accounts.google.com")
      throw new Error("Unexpected issuer");
    if (!p.email) throw new Error("No email on that Google account");
    if (p.email_verified === "false") throw new Error("Verify your Google email first");
    if (Number(p.exp) * 1000 < Date.now()) throw new Error("That sign-in expired — try again");

    return await ctx.runMutation(internal.auth.upsertGoogle, {
      email: p.email.toLowerCase(),
      name: p.name || p.given_name || p.email.split("@")[0],
    });
  },
});

export const upsertGoogle = internalMutation({
  args: { email: v.string(), name: v.string() },
  handler: async (ctx, { email, name }) => {
    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!user) {
      const id = await ctx.db.insert("users", { email, name, createdAt: Date.now() });
      user = (await ctx.db.get(id))!;
    } else if (user.name !== name && name) {
      await ctx.db.patch(user._id, { name });
      user = (await ctx.db.get(user._id))!;
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
