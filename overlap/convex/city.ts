import { mutation, query, internalMutation, internalQuery, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";

/**
 * Founder City. A tower is an app; the numbers come from RevenueCat.
 *
 * The page reads the six numbers once in the founder's browser and sends them
 * here with the key. The key stays in this table for the daily pull and goes
 * nowhere else: `towers` strips it before anything leaves. Nobody removes a
 * tower from the page; that is an email to hey@jeremylasne.com.
 */

const RC_API = "https://api.revenuecat.com/v2";
const DAY = 86_400_000;

const numbers = {
  users: v.number(),
  trials: v.number(),
  subs: v.number(),
  mrr: v.number(),
  rev28: v.number(),
  newCustomers: v.number(),
};

/** What a page may see. Same shape as the demo towers, no key. */
function pub(t: Doc<"towers">) {
  return {
    id: t._id,
    name: t.name,
    tag: t.tag,
    founders: t.founders,
    ios: t.ios,
    play: t.play,
    anonFounder: t.anonFounder,
    anonApp: t.anonApp,
    seed: t.seed,
    logo: t.logo,
    joined: Math.max(0, Math.floor((Date.now() - t.createdAt) / DAY)),
    users: t.users,
    trials: t.trials,
    subs: t.subs,
    mrr: t.mrr,
    rev28: t.rev28,
    newCustomers: t.newCustomers,
    currency: t.currency,
    history: t.history,
    curve: "exact" as const,
    server: true,
  };
}

export const towers = query({
  args: {},
  handler: async (ctx) => (await ctx.db.query("towers").collect()).map(pub),
});

export const breakGround = mutation({
  args: {
    name: v.optional(v.string()),
    founders: v.array(v.string()),
    ios: v.optional(v.string()),
    play: v.optional(v.string()),
    anonFounder: v.optional(v.boolean()),
    anonApp: v.optional(v.boolean()),
    seed: v.number(),
    logo: v.optional(v.string()),
    rcKey: v.string(),
    rcProject: v.string(),
    currency: v.optional(v.string()),
    ...numbers,
  },
  handler: async (ctx, a) => {
    const founders = a.founders.map((f) => f.trim().replace(/^@/, "").slice(0, 40)).filter(Boolean).slice(0, 6);
    if (!founders.length) throw new Error("A founder handle on X is required");
    if (!/^sk_/.test(a.rcKey) || a.rcKey.length > 200) throw new Error("That does not look like a RevenueCat V2 key");
    if (!a.rcProject.trim()) throw new Error("The project ID is required");
    if (a.logo && (a.logo.length > 8000 || !/^data:image\/png;base64,/.test(a.logo))) throw new Error("The logo must be a small PNG");
    const link = (s?: string) => (s && /^https:\/\//.test(s) ? s.slice(0, 300) : undefined);
    const now = Date.now();
    const id = await ctx.db.insert("towers", {
      name: (a.name ?? "").trim().slice(0, 40) || "Unnamed",
      tag: "Read from RevenueCat",
      founders,
      ios: link(a.ios),
      play: link(a.play),
      anonFounder: !!a.anonFounder,
      anonApp: !!a.anonApp,
      seed: a.seed,
      logo: a.logo,
      rcKey: a.rcKey,
      rcProject: a.rcProject.trim().slice(0, 100),
      users: a.users, trials: a.trials, subs: a.subs, mrr: a.mrr, rev28: a.rev28, newCustomers: a.newCustomers,
      currency: a.currency ?? "USD",
      history: [{ at: now, users: a.users, trials: a.trials, subs: a.subs, mrr: a.mrr }],
      createdAt: now,
      refreshedAt: now,
    });
    return pub((await ctx.db.get(id))!);
  },
});

/* ── the daily pull ─────────────────────────────────────────────────────── */

export const keys = internalQuery({
  args: {},
  handler: async (ctx) =>
    (await ctx.db.query("towers").collect()).map((t) => ({ id: t._id, rcKey: t.rcKey, rcProject: t.rcProject })),
});

export const record = internalMutation({
  args: { id: v.id("towers"), currency: v.optional(v.string()), error: v.optional(v.string()), ...numbers },
  handler: async (ctx, { id, error, currency, ...n }) => {
    const t = await ctx.db.get(id);
    if (!t) return;
    if (error) { await ctx.db.patch(id, { error }); return; }
    const history = [...t.history, { at: Date.now(), users: n.users, trials: n.trials, subs: n.subs, mrr: n.mrr }].slice(-30);
    await ctx.db.patch(id, { ...n, currency: currency ?? t.currency, history, refreshedAt: Date.now(), error: undefined });
  },
});

export const refreshAll = internalAction({
  args: {},
  handler: async (ctx) => {
    const list = await ctx.runQuery(internal.city.keys, {});
    for (const t of list) {
      try {
        const r = await fetch(`${RC_API}/projects/${encodeURIComponent(t.rcProject)}/metrics/overview`, {
          headers: { Authorization: `Bearer ${t.rcKey}`, Accept: "application/json" },
        });
        if (!r.ok) throw new Error(`RevenueCat answered ${r.status}`);
        const j = await r.json();
        const m: Record<string, number> = {};
        for (const x of j.metrics ?? []) m[x.id] = +x.value || 0;
        await ctx.runMutation(internal.city.record, {
          id: t.id,
          users: m.active_users ?? 0, trials: m.active_trials ?? 0, subs: m.active_subscriptions ?? 0,
          mrr: m.mrr ?? 0, rev28: m.revenue ?? 0, newCustomers: m.new_customers ?? 0,
          currency: j.currency ?? undefined,
        });
      } catch (e) {
        await ctx.runMutation(internal.city.record, {
          id: t.id, users: 0, trials: 0, subs: 0, mrr: 0, rev28: 0, newCustomers: 0,
          error: e instanceof Error ? e.message.slice(0, 200) : "failed",
        });
      }
    }
    return null;
  },
});
