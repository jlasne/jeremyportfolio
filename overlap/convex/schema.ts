import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Overlap — the whole data model.
 *
 * A person signs in with an email code, lands in a team, and the team holds
 * members. A member is a row of working hours in a timezone; it may or may not
 * be attached to a signed-in user (you can add a colleague who never signs in).
 */
export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.string(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  /* one-time sign-in codes, short-lived, single use */
  codes: defineTable({
    email: v.string(),
    code: v.string(),
    expiresAt: v.number(),
    tries: v.number(),
  }).index("by_email", ["email"]),

  /* opaque session tokens, checked on every call */
  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),

  teams: defineTable({
    name: v.string(),
    ownerId: v.id("users"),
    invite: v.string(),
    createdAt: v.number(),
  }).index("by_invite", ["invite"]),

  members: defineTable({
    teamId: v.id("teams"),
    userId: v.optional(v.id("users")),
    name: v.string(),
    email: v.optional(v.string()),
    tz: v.string(),
    startHour: v.number(),
    endHour: v.number(),
    weekends: v.boolean(),
    /* hours carved out or given back by hand, as instants */
    overrides: v.optional(v.array(v.object({ ts: v.number(), free: v.boolean() }))),
  })
    .index("by_team", ["teamId"])
    .index("by_user", ["userId"]),

  meetings: defineTable({
    teamId: v.id("teams"),
    title: v.string(),
    startsAt: v.number(),
    durationMin: v.number(),
    createdBy: v.id("users"),
    createdAt: v.number(),
  }).index("by_team", ["teamId"]),

  feedback: defineTable({
    text: v.string(),
    wants: v.array(v.string()),
    email: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    createdAt: v.number(),
  }),
});
