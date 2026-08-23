import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Overlap — the whole data model.
 *
 * A meeting is the unit. You sign in with Google, you answer for yourself
 * once, and that answer — timezone, working day, bedtime — lives on your
 * user and is reused by every meeting after. A participant is your row in
 * one meeting: your hours as they were when you joined, plus whatever you
 * crossed out and whatever your calendar says is already taken.
 *
 * There is no team table. "People you have met with" is a question you can
 * answer from the meetings you already share, and one fewer thing to name,
 * rename, join and leave.
 */
export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.string(),
    createdAt: v.number(),

    /* Your answer, given once. Optional because a user exists from the
       moment Google vouches for them, which is before they have said
       anything about their day. setupAt is how we know they have. */
    tz: v.optional(v.string()),
    startHour: v.optional(v.number()),
    endHour: v.optional(v.number()),
    weekends: v.optional(v.boolean()),
    sleepStart: v.optional(v.number()),
    sleepEnd: v.optional(v.number()),
    setupAt: v.optional(v.number()),
  }).index("by_email", ["email"]),

  /* opaque session tokens, checked on every call */
  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),

  meetings: defineTable({
    ownerId: v.id("users"),
    title: v.string(),
    durationMin: v.number(),
    invite: v.string(),
    createdAt: v.number(),
    /* set the moment somebody presses Create event */
    startsAt: v.optional(v.number()),
    bookedBy: v.optional(v.id("users")),
    bookedAt: v.optional(v.number()),
  })
    .index("by_invite", ["invite"])
    .index("by_owner", ["ownerId"]),

  participants: defineTable({
    meetingId: v.id("meetings"),
    userId: v.id("users"),
    name: v.string(),
    email: v.string(),
    tz: v.string(),
    startHour: v.number(),
    endHour: v.number(),
    weekends: v.boolean(),
    sleepStart: v.number(),
    sleepEnd: v.number(),
    /* hours carved out or given back by hand, as instants */
    overrides: v.optional(v.array(v.object({ ts: v.number(), free: v.boolean() }))),
    /* hours their calendar says are already taken */
    busy: v.optional(v.array(v.number())),
    /* when the calendar was last read, 0 for never */
    gcal: v.optional(v.number()),
    joinedAt: v.number(),
  })
    .index("by_meeting", ["meetingId"])
    .index("by_user", ["userId"])
    .index("by_meeting_user", ["meetingId", "userId"]),

  feedback: defineTable({
    text: v.string(),
    wants: v.array(v.string()),
    email: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    createdAt: v.number(),
  }),
});
