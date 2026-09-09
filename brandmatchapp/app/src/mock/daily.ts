import type { DailyStat } from '../types'
import { agents } from './agents'
import { daysAgo } from './time'

// 14 days per agent, newest last. Every lead shows in the list; roughly 1 in 10
// comes back qualified, which is 2 stars or more.

const SHAPE = [0.98, 0.92, 1.03, 0.85, 0.96, 1.14, 0.88, 0.94, 1.05, 1.0, 0.78, 1.1, 0.97, 1.0]
const RATE = [0.092, 0.088, 0.109, 0.081, 0.102, 0.109, 0.084, 0.091, 0.1, 0.096, 0.079, 0.106, 0.096, 0.102]

export const dailyStats: DailyStat[] = agents.flatMap((agent) =>
  SHAPE.map((shape, i) => {
    const leads = agent.active ? Math.round(agent.leadsPerDay * shape) : 0
    return {
      date: daysAgo(SHAPE.length - 1 - i, 7),
      agentId: agent.id,
      gathered: leads,
      leads,
      qualified: Math.round(leads * RATE[i]),
    }
  }),
)
