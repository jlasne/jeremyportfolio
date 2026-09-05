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
    /* A working day is allowed to be two stretches — a morning here and an
       evening that catches somebody else's morning. Absent means one. */
    startHour2: v.optional(v.number()),
    endHour2: v.optional(v.number()),
    weekends: v.optional(v.boolean()),
    sleepStart: v.optional(v.number()),
    sleepEnd: v.optional(v.number()),
    setupAt: v.optional(v.number()),

    /* Your booking link. One handle, permanent, and the only thing anybody
       needs to take an hour off you: /overlap/book/#jeremy */
    handle: v.optional(v.string()),
    /* The three numbers that make a public link usable rather than a way
       for strangers to appear in your morning. */
    minNoticeMin: v.optional(v.number()),
    windowDays: v.optional(v.number()),
    bufferMin: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_handle", ["handle"]),

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
    /* "team" is the one everybody answers; "call" is the one somebody took
       off your booking link. A call is booked the moment it exists. */
    kind: v.optional(v.string()),
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
    startHour2: v.optional(v.number()),
    endHour2: v.optional(v.number()),
    weekends: v.boolean(),
    sleepStart: v.number(),
    sleepEnd: v.number(),
    /* hours carved out or given back by hand, as instants */
    overrides: v.optional(v.array(v.object({ ts: v.number(), free: v.boolean() }))),
    /* hours their calendar says are already taken */
    busy: v.optional(v.array(v.number())),
    /* when the calendar was last read, 0 for never */
    gcal: v.optional(v.number()),
    /* which calendar said so — "google" or "outlook" — and the stretch of
       days it was actually asked about. A reading covers the week it was
       taken for and no other, and a row nobody read is a row that will
       happily show free at an hour that is already gone. */
    cal: v.optional(v.string()),
    calFrom: v.optional(v.number()),
    calTo: v.optional(v.number()),
    joinedAt: v.number(),
  })
    .index("by_meeting", ["meetingId"])
    .index("by_user", ["userId"])
    .index("by_meeting_user", ["meetingId", "userId"]),

  /* Founder City — one tower per app. The RevenueCat key is kept here so
     the daily pull can refresh the numbers; it is never returned to a page.
     Only Charts metrics read keys are expected: nothing else is asked of it. */
  towers: defineTable({
    name: v.string(),
    tag: v.string(),
    founders: v.array(v.string()),
    ios: v.optional(v.string()),
    play: v.optional(v.string()),
    anonFounder: v.boolean(),
    anonApp: v.boolean(),
    seed: v.number(),
    /* 16x16 pixel logo as a data URL, about a kilobyte */
    logo: v.optional(v.string()),
    /* absent on the demo tower, which is never refreshed */
    rcKey: v.optional(v.string()),
    rcProject: v.string(),
    users: v.number(),
    trials: v.number(),
    subs: v.number(),
    mrr: v.number(),
    rev28: v.number(),
    newCustomers: v.number(),
    currency: v.string(),
    /* one row per daily pull, newest last, thirty kept */
    history: v.array(v.object({ at: v.number(), users: v.number(), trials: v.number(), subs: v.number(), mrr: v.number() })),
    createdAt: v.number(),
    refreshedAt: v.number(),
    /* set when a pull failed, cleared when one succeeds */
    error: v.optional(v.string()),
  }),

  feedback: defineTable({
    text: v.string(),
    wants: v.array(v.string()),
    email: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    createdAt: v.number(),
  }),

  /* jeremylasne.com/bio — one document, the numbers on the page. Written
     only with the passphrase in BIO_PASSPHRASE; what it may contain is
     decided in bio/spec.js, which the page imports too. */
  bio: defineTable({
    key: v.string(),
    values: v.record(v.string(), v.number()),
    /* one entry per logged day, keyed YYYY-MM-DD */
    log: v.record(v.string(), v.object({ habits: v.record(v.string(), v.boolean()), sleep: v.optional(v.number()) })),
    /* the page's local date at the last save */
    today: v.string(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
});
