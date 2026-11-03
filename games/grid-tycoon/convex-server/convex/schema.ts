// Grid Tycoon rooms. The game state is stored as a JSON string: it can reach a few hundred KB late in
// a game, and a string keeps optional engine fields out of Convex's value validation.
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  rooms: defineTable({
    code: v.string(),
    seed: v.number(),
    status: v.string(),
    hostSeat: v.number(),
    round: v.number(),
    deadline: v.union(v.number(), v.null()),
    seats: v.number(),
    fillBots: v.boolean(),
    state: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_code', ['code'])
    .index('by_updated', ['updatedAt']),
  players: defineTable({
    roomCode: v.string(),
    seat: v.number(),
    companyId: v.string(),
    name: v.string(),
    isBot: v.boolean(),
    lockedRound: v.number(),
    lastSeen: v.number(),
  }).index('by_room_seat', ['roomCode', 'seat']),
  secrets: defineTable({ roomCode: v.string(), seat: v.number(), tokenHash: v.string() })
    .index('by_room_seat', ['roomCode', 'seat'])
    .index('by_room_hash', ['roomCode', 'tokenHash']),
  decisions: defineTable({ roomCode: v.string(), round: v.number(), seat: v.number(), decision: v.string() }).index('by_room_round_seat', ['roomCode', 'round', 'seat']),
})
