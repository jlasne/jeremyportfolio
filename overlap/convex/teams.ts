import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";

const overrideShape = v.array(v.object({ ts: v.number(), free: v.boolean() }));

/** Resolves a session token to its user, or null. Every call goes through here. */
async function whoIs(ctx: QueryCtx | MutationCtx, token: string): Promise<Doc<"users"> | null> {
  if (!token) return null;
  const s = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!s || s.expiresAt < Date.now()) return null;
  return await ctx.db.get(s.userId);
}
async function mustBe(ctx: MutationCtx, token: string): Promise<Doc<"users">> {
  const u = await whoIs(ctx, token);
  if (!u) throw new Error("Sign in first");
  return u;
}
/** The team this user belongs to, via their own member row. */
async function teamOf(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const mine = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return mine ? await ctx.db.get(mine.teamId) : null;
}
/** Throws unless the user is in the team that owns this member row. */
async function mustShareTeam(ctx: MutationCtx, user: Doc<"users">, memberId: Id<"members">) {
  const m = await ctx.db.get(memberId);
  if (!m) throw new Error("No such person");
  const team = await teamOf(ctx, user._id);
  if (!team || team._id !== m.teamId) throw new Error("Not your team");
  return m;
}
function invite(): string {
  const b = crypto.getRandomValues(new Uint8Array(9));
  return Array.from(b, (x) => "abcdefghijkmnpqrstuvwxyz23456789"[x % 32]).join("");
}

/** Everything the app needs on load: you, your team, and who is in it. */
export const me = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await whoIs(ctx, token);
    if (!user) return null;
    const team = await teamOf(ctx, user._id);
    if (!team) return { user: { name: user.name, email: user.email }, team: null, members: [] };
    const members = await ctx.db
      .query("members")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .collect();
    return {
      user: { name: user.name, email: user.email },
      team: { name: team.name, invite: team.invite },
      members: members.map((m) => ({
        _id: m._id,
        name: m.name,
        email: m.email ?? "",
        tz: m.tz,
        startHour: m.startHour,
        endHour: m.endHour,
        weekends: m.weekends,
        overrides: m.overrides ?? [],
        isYou: m.userId === user._id,
      })),
    };
  },
});

/** Signing in with no team gets you one, with you already in it. */
export const create = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    tz: v.string(),
    startHour: v.optional(v.number()),
    endHour: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await mustBe(ctx, args.token);
    const existing = await teamOf(ctx, user._id);
    if (existing) return { invite: existing.invite };

    const teamId = await ctx.db.insert("teams", {
      name: args.name.trim() || `${user.name}'s team`,
      ownerId: user._id,
      invite: invite(),
      createdAt: Date.now(),
    });
    await ctx.db.insert("members", {
      teamId,
      userId: user._id,
      name: user.name,
      email: user.email,
      tz: args.tz,
      startHour: args.startHour ?? 9,
      endHour: args.endHour ?? 18,
      weekends: false,
      overrides: [],
    });
    const team = (await ctx.db.get(teamId))!;
    return { invite: team.invite };
  },
});

export const join = mutation({
  args: { token: v.string(), invite: v.string(), tz: v.optional(v.string()) },
  handler: async (ctx, { token, invite: code, tz }) => {
    const user = await mustBe(ctx, token);
    const team = await ctx.db
      .query("teams")
      .withIndex("by_invite", (q) => q.eq("invite", code))
      .unique();
    if (!team) throw new Error("That invite has expired");

    const mine = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (mine) {
      if (mine.teamId === team._id) return { name: team.name };
      throw new Error("You're already in a team — leave it first");
    }
    /* an empty seat left by whoever invited you, matched on email */
    const seats = await ctx.db
      .query("members")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .collect();
    const seat = seats.find((m) => !m.userId && m.email && m.email.toLowerCase() === user.email);
    if (seat) await ctx.db.patch(seat._id, { userId: user._id, name: user.name });
    else
      await ctx.db.insert("members", {
        teamId: team._id,
        userId: user._id,
        name: user.name,
        email: user.email,
        tz: tz ?? "UTC",
        startHour: 9,
        endHour: 18,
        weekends: false,
        overrides: [],
      });
    return { name: team.name };
  },
});

export const addMember = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    tz: v.string(),
    email: v.optional(v.string()),
    startHour: v.number(),
    endHour: v.number(),
    weekends: v.boolean(),
    overrides: v.optional(overrideShape),
  },
  handler: async (ctx, args) => {
    const user = await mustBe(ctx, args.token);
    const team = await teamOf(ctx, user._id);
    if (!team) throw new Error("Make a team first");
    return await ctx.db.insert("members", {
      teamId: team._id,
      name: args.name,
      email: args.email || undefined,
      tz: args.tz,
      startHour: args.startHour,
      endHour: args.endHour,
      weekends: args.weekends,
      overrides: args.overrides ?? [],
    });
  },
});

export const updateMember = mutation({
  args: {
    token: v.string(),
    memberId: v.id("members"),
    name: v.string(),
    tz: v.string(),
    email: v.optional(v.string()),
    startHour: v.number(),
    endHour: v.number(),
    weekends: v.boolean(),
    overrides: v.optional(overrideShape),
  },
  handler: async (ctx, args) => {
    const user = await mustBe(ctx, args.token);
    await mustShareTeam(ctx, user, args.memberId);
    await ctx.db.patch(args.memberId, {
      name: args.name,
      email: args.email || undefined,
      tz: args.tz,
      startHour: args.startHour,
      endHour: args.endHour,
      weekends: args.weekends,
      overrides: args.overrides ?? [],
    });
    return null;
  },
});

export const removeMember = mutation({
  args: { token: v.string(), memberId: v.id("members") },
  handler: async (ctx, { token, memberId }) => {
    const user = await mustBe(ctx, token);
    const m = await mustShareTeam(ctx, user, memberId);
    if (m.userId === user._id) throw new Error("You can't remove yourself");
    await ctx.db.delete(memberId);
    return null;
  },
});

/** Booked meetings, kept so a team can see what was already agreed. */
export const book = mutation({
  args: {
    token: v.string(),
    title: v.string(),
    startsAt: v.number(),
    durationMin: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await mustBe(ctx, args.token);
    const team = await teamOf(ctx, user._id);
    if (!team) throw new Error("Make a team first");
    return await ctx.db.insert("meetings", {
      teamId: team._id,
      title: args.title,
      startsAt: args.startsAt,
      durationMin: args.durationMin,
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});
