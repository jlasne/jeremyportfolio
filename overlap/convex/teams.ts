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
/** Every team this person sits in, oldest first. A person may be in many. */
async function myMemberships(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  return await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
}
async function inTeam(ctx: QueryCtx | MutationCtx, userId: Id<"users">, teamId: Id<"teams">) {
  const mine = await myMemberships(ctx, userId);
  return mine.some((m) => m.teamId === teamId);
}
async function mustBeIn(ctx: MutationCtx, user: Doc<"users">, teamId: Id<"teams">) {
  if (!(await inTeam(ctx, user._id, teamId))) throw new Error("Not your team");
}
function invite(): string {
  const b = crypto.getRandomValues(new Uint8Array(9));
  return Array.from(b, (x) => "abcdefghijkmnpqrstuvwxyz23456789"[x % 32]).join("");
}

/**
 * Everything the app needs on load: you, every team you are in, and the
 * members of the one you are looking at. Pass teamId to look at another.
 */
export const me = query({
  args: { token: v.string(), teamId: v.optional(v.id("teams")) },
  handler: async (ctx, { token, teamId }) => {
    const user = await whoIs(ctx, token);
    if (!user) return null;

    const mine = await myMemberships(ctx, user._id);
    const teams = (
      await Promise.all(mine.map((m) => ctx.db.get(m.teamId)))
    ).filter((t): t is Doc<"teams"> => !!t);

    const shape = { user: { name: user.name, email: user.email } };
    if (!teams.length) return { ...shape, teams: [], team: null, members: [] };

    const team = (teamId && teams.find((t) => t._id === teamId)) || teams[0];
    const members = await ctx.db
      .query("members")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .collect();

    return {
      ...shape,
      teams: teams.map((t) => ({ id: t._id, name: t.name })),
      team: { id: team._id, name: team.name, invite: team.invite },
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

/** Always makes a new team, with you already in it. */
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
    return { id: teamId, invite: team.invite };
  },
});

export const rename = mutation({
  args: { token: v.string(), teamId: v.id("teams"), name: v.string() },
  handler: async (ctx, { token, teamId, name }) => {
    const user = await mustBe(ctx, token);
    await mustBeIn(ctx, user, teamId);
    await ctx.db.patch(teamId, { name: name.trim().slice(0, 60) || "Team" });
    return null;
  },
});

/** Leaving takes your seat with you; the team survives for everyone else. */
export const leave = mutation({
  args: { token: v.string(), teamId: v.id("teams") },
  handler: async (ctx, { token, teamId }) => {
    const user = await mustBe(ctx, token);
    const mine = await myMemberships(ctx, user._id);
    const seat = mine.find((m) => m.teamId === teamId);
    if (!seat) throw new Error("You're not in that team");
    await ctx.db.delete(seat._id);

    const left = await ctx.db
      .query("members")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .collect();
    if (!left.length) await ctx.db.delete(teamId);   /* nobody home, close it */
    return null;
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
    if (await inTeam(ctx, user._id, team._id)) return { id: team._id, name: team.name };

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
    return { id: team._id, name: team.name };
  },
});

export const addMember = mutation({
  args: {
    token: v.string(),
    teamId: v.id("teams"),
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
    await mustBeIn(ctx, user, args.teamId);
    return await ctx.db.insert("members", {
      teamId: args.teamId,
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
    const m = await ctx.db.get(args.memberId);
    if (!m) throw new Error("No such person");
    await mustBeIn(ctx, user, m.teamId);
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
    const m = await ctx.db.get(memberId);
    if (!m) throw new Error("No such person");
    await mustBeIn(ctx, user, m.teamId);
    if (m.userId === user._id) throw new Error("Leave the team instead");
    await ctx.db.delete(memberId);
    return null;
  },
});

/** Booked meetings, kept so a team can see what was already agreed. */
export const book = mutation({
  args: {
    token: v.string(),
    teamId: v.id("teams"),
    title: v.string(),
    startsAt: v.number(),
    durationMin: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await mustBe(ctx, args.token);
    await mustBeIn(ctx, user, args.teamId);
    return await ctx.db.insert("meetings", {
      teamId: args.teamId,
      title: args.title,
      startsAt: args.startsAt,
      durationMin: args.durationMin,
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});
