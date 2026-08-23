import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";

/**
 * Meetings, and the people in them.
 *
 * The whole API is: tell me who I am and what I am looking at (`me`), save
 * my hours (`profile`, `hours`), start a meeting (`create`), walk into one
 * (`join`), and write down the hour that won (`book`).
 */

const overrideShape = v.array(v.object({ ts: v.number(), free: v.boolean() }));
const hoursShape = {
  tz: v.string(),
  startHour: v.number(),
  endHour: v.number(),
  weekends: v.boolean(),
  sleepStart: v.number(),
  sleepEnd: v.number(),
};

async function whoIs(ctx: QueryCtx | MutationCtx, token: string): Promise<Doc<"users"> | null> {
  if (!token) return null;
  const s = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!s || s.expiresAt < Date.now()) return null;
  return await ctx.db.get(s.userId);
}
async function mustBe(ctx: QueryCtx | MutationCtx, token: string): Promise<Doc<"users">> {
  const u = await whoIs(ctx, token);
  if (!u) throw new Error("Sign in first");
  return u;
}
function inviteCode(): string {
  const b = crypto.getRandomValues(new Uint8Array(9));
  return Array.from(b, (x) => "abcdefghijkmnpqrstuvwxyz23456789"[x % 32]).join("");
}

/** Your seat in a meeting, or null. Being in it is the only permission there is. */
async function seatIn(
  ctx: QueryCtx | MutationCtx,
  meetingId: Id<"meetings">,
  userId: Id<"users">,
) {
  return await ctx.db
    .query("participants")
    .withIndex("by_meeting_user", (q) => q.eq("meetingId", meetingId).eq("userId", userId))
    .unique();
}
async function mustSit(ctx: MutationCtx, meetingId: Id<"meetings">, userId: Id<"users">) {
  const seat = await seatIn(ctx, meetingId, userId);
  if (!seat) throw new Error("You're not in that meeting");
  return seat;
}

/** What the profile answers when nobody has said otherwise. */
function defaults(user: Doc<"users">, tz: string) {
  return {
    tz: user.tz ?? tz,
    startHour: user.startHour ?? 9,
    endHour: user.endHour ?? 18,
    weekends: user.weekends ?? false,
    sleepStart: user.sleepStart ?? 23,
    sleepEnd: user.sleepEnd ?? 7,
  };
}

function shapeSeat(p: Doc<"participants">, meId: Id<"users">) {
  return {
    _id: p._id,
    name: p.name,
    email: p.email,
    tz: p.tz,
    startHour: p.startHour,
    endHour: p.endHour,
    weekends: p.weekends,
    sleepStart: p.sleepStart,
    sleepEnd: p.sleepEnd,
    overrides: p.overrides ?? [],
    busy: p.busy ?? [],
    gcal: p.gcal ?? 0,
    isYou: p.userId === meId,
  };
}

/**
 * Everything the page needs on load: you, your saved answer, the meeting you
 * are looking at with everyone in it, your other meetings, and the people you
 * have met with before — which is what a team turned out to be.
 */
export const me = query({
  args: { token: v.string(), meetingId: v.optional(v.id("meetings")) },
  handler: async (ctx, { token, meetingId }) => {
    const user = await whoIs(ctx, token);
    if (!user) return null;

    const seats = await ctx.db
      .query("participants")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const mine = (await Promise.all(seats.map((s) => ctx.db.get(s.meetingId))))
      .filter((m): m is Doc<"meetings"> => !!m)
      .sort((a, b) => b.createdAt - a.createdAt);

    /* tz is null until they have actually said — the page then keeps the
       timezone the browser detected rather than dropping them in UTC. */
    const profile = {
      ready: !!user.setupAt,
      ...defaults(user, "UTC"),
      tz: user.tz ?? null,
    };
    const shape = {
      user: { name: user.name, email: user.email },
      profile,
      meetings: mine.map((m) => ({
        id: m._id,
        title: m.title,
        startsAt: m.startsAt ?? null,
        createdAt: m.createdAt,
      })),
    };

    const meeting = (meetingId && mine.find((m) => m._id === meetingId)) || mine[0];
    if (!meeting)
      return {
        ...shape,
        meeting: null,
        participants: [],
        contacts: await gather(ctx, user, mine, new Set()),
      };

    const participants = await ctx.db
      .query("participants")
      .withIndex("by_meeting", (q) => q.eq("meetingId", meeting._id))
      .collect();

    const here = new Set(participants.map((p) => p.userId));
    const contacts = await gather(ctx, user, mine, here);

    return {
      ...shape,
      meeting: {
        id: meeting._id,
        title: meeting.title,
        durationMin: meeting.durationMin,
        invite: meeting.invite,
        startsAt: meeting.startsAt ?? null,
        isOwner: meeting.ownerId === user._id,
      },
      participants: participants.map((p) => shapeSeat(p, user._id)),
      contacts,
    };
  },
});

/**
 * Everyone you have ever shared a meeting with — whether you invited them,
 * they invited you, or you both just turned up. Nobody types a contact in
 * and nobody maintains a list: having met is the whole of the relationship,
 * so the meetings already know it.
 *
 * `here` marks the ones sitting in the meeting on screen, so the page can
 * grey them rather than offer to invite somebody who has already arrived.
 */
async function gather(
  ctx: QueryCtx,
  user: Doc<"users">,
  mine: Doc<"meetings">[],
  here: Set<Id<"users">>,
) {
  const seen = new Map<
    string,
    { name: string; email: string; at: number; met: number; here: boolean }
  >();
  for (const m of mine.slice(0, 60)) {
    const others = await ctx.db
      .query("participants")
      .withIndex("by_meeting", (q) => q.eq("meetingId", m._id))
      .collect();
    for (const o of others) {
      if (o.userId === user._id || !o.email) continue;
      const prev = seen.get(o.email);
      if (prev) {
        prev.met += 1;
        if (o.joinedAt > prev.at) {
          prev.at = o.joinedAt;
          prev.name = o.name;
        }
      } else {
        seen.set(o.email, {
          name: o.name,
          email: o.email,
          at: o.joinedAt,
          met: 1,
          here: here.has(o.userId),
        });
      }
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.at - a.at);
}

/** The answer you give once. Everything after this reuses it. */
export const profile = mutation({
  args: { token: v.string(), ...hoursShape },
  handler: async (ctx, args) => {
    const user = await mustBe(ctx, args.token);
    await ctx.db.patch(user._id, {
      tz: args.tz,
      startHour: args.startHour,
      endHour: args.endHour,
      weekends: args.weekends,
      sleepStart: args.sleepStart,
      sleepEnd: args.sleepEnd,
      setupAt: user.setupAt ?? Date.now(),
    });
    return null;
  },
});

export const create = mutation({
  args: {
    token: v.string(),
    title: v.string(),
    durationMin: v.optional(v.number()),
    tz: v.optional(v.string()),
  },
  handler: async (ctx, { token, title, durationMin, tz }) => {
    const user = await mustBe(ctx, token);
    const meetingId = await ctx.db.insert("meetings", {
      ownerId: user._id,
      title: title.trim().slice(0, 80) || "Meeting",
      durationMin: durationMin ?? 60,
      invite: inviteCode(),
      createdAt: Date.now(),
    });
    const d = defaults(user, tz ?? "UTC");
    await ctx.db.insert("participants", {
      meetingId,
      userId: user._id,
      name: user.name,
      email: user.email,
      ...d,
      overrides: [],
      busy: [],
      gcal: 0,
      joinedAt: Date.now(),
    });
    const m = (await ctx.db.get(meetingId))!;
    return { id: meetingId, invite: m.invite };
  },
});

/** What a share link can say before you have signed in: just enough to want to. */
export const peek = query({
  args: { invite: v.string() },
  handler: async (ctx, { invite }) => {
    const m = await ctx.db
      .query("meetings")
      .withIndex("by_invite", (q) => q.eq("invite", invite))
      .unique();
    if (!m) return null;
    const people = await ctx.db
      .query("participants")
      .withIndex("by_meeting", (q) => q.eq("meetingId", m._id))
      .collect();
    return { title: m.title, count: people.length, booked: !!m.startsAt };
  },
});

/**
 * Walk into a meeting from its link. Idempotent — opening the link twice
 * lands you in the same seat, and your saved answer fills it in, which is
 * what makes the second meeting nothing but a tap.
 */
export const join = mutation({
  args: { token: v.string(), invite: v.string(), tz: v.optional(v.string()) },
  handler: async (ctx, { token, invite, tz }) => {
    const user = await mustBe(ctx, token);
    const m = await ctx.db
      .query("meetings")
      .withIndex("by_invite", (q) => q.eq("invite", invite))
      .unique();
    if (!m) throw new Error("That link has expired");

    const seat = await seatIn(ctx, m._id, user._id);
    if (seat) return { id: m._id, title: m.title };

    const people = await ctx.db
      .query("participants")
      .withIndex("by_meeting", (q) => q.eq("meetingId", m._id))
      .collect();
    if (people.length >= 24) throw new Error("That meeting is full");

    await ctx.db.insert("participants", {
      meetingId: m._id,
      userId: user._id,
      name: user.name,
      email: user.email,
      ...defaults(user, tz ?? "UTC"),
      overrides: [],
      busy: [],
      gcal: 0,
      joinedAt: Date.now(),
    });
    return { id: m._id, title: m.title };
  },
});

/** Your own row, and only ever your own. */
export const hours = mutation({
  args: {
    token: v.string(),
    meetingId: v.id("meetings"),
    ...hoursShape,
    overrides: v.optional(overrideShape),
    busy: v.optional(v.array(v.number())),
    gcal: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await mustBe(ctx, args.token);
    const seat = await mustSit(ctx, args.meetingId, user._id);
    await ctx.db.patch(seat._id, {
      tz: args.tz,
      startHour: args.startHour,
      endHour: args.endHour,
      weekends: args.weekends,
      sleepStart: args.sleepStart,
      sleepEnd: args.sleepEnd,
      overrides: args.overrides ?? [],
      busy: args.busy ?? [],
      gcal: args.gcal ?? 0,
    });
    return null;
  },
});

export const rename = mutation({
  args: {
    token: v.string(),
    meetingId: v.id("meetings"),
    title: v.optional(v.string()),
    durationMin: v.optional(v.number()),
  },
  handler: async (ctx, { token, meetingId, title, durationMin }) => {
    const user = await mustBe(ctx, token);
    await mustSit(ctx, meetingId, user._id);
    const patch: Partial<Doc<"meetings">> = {};
    if (title !== undefined) patch.title = title.trim().slice(0, 80) || "Meeting";
    if (durationMin !== undefined) patch.durationMin = durationMin;
    await ctx.db.patch(meetingId, patch);
    return null;
  },
});

/** Leaving takes your row with you; the meeting survives for everyone else. */
export const leave = mutation({
  args: { token: v.string(), meetingId: v.id("meetings") },
  handler: async (ctx, { token, meetingId }) => {
    const user = await mustBe(ctx, token);
    const seat = await mustSit(ctx, meetingId, user._id);
    await ctx.db.delete(seat._id);
    const left = await ctx.db
      .query("participants")
      .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
      .collect();
    if (!left.length) await ctx.db.delete(meetingId); /* nobody home, close it */
    return null;
  },
});

/** The hour that won, written down so everyone who opens the link sees it. */
export const book = mutation({
  args: { token: v.string(), meetingId: v.id("meetings"), startsAt: v.number() },
  handler: async (ctx, { token, meetingId, startsAt }) => {
    const user = await mustBe(ctx, token);
    await mustSit(ctx, meetingId, user._id);
    await ctx.db.patch(meetingId, {
      startsAt,
      bookedBy: user._id,
      bookedAt: Date.now(),
    });
    return null;
  },
});
