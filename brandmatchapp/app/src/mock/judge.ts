import type { CriterionScore, GateSet } from '../types'
import type { Judgement } from '../data/gates'
import { seeded } from './rand'

// What the model would answer, faked from the band a profile was generated in.
//
// Shared by the sample account and the simulator, so moving a gate and testing
// it gives the same answer as the account was built with. In production this
// whole file is one call to the model.

const KNOCKOUT_NOTES: Record<string, [string, string]> = {
  k_method: ['Names a four phase system and repeats it across posts', 'Posts results, never the method behind them'],
  k_product: ['Programme is a weekly plan and a check in, both fit a product', 'Value is hands on work, a product cannot carry it'],
  k_software: ['Programme is a weekly plan and a check in, both fit an app', 'Value is hands on gym work, an app cannot carry it'],
  k_not_built: ['Sells through a PDF and a spreadsheet today', 'Already ships the thing you would build'],
  k_no_app: ['Sells through a PDF and a spreadsheet today', 'Already ships an app on both stores'],
  k_buys: ['Cohort sold out twice this year', 'No paid offer anywhere on the account'],
  k_person: ['Face on camera in every post, answers the comments themselves', 'Theme page reposting other people, no named owner'],
  k_paid: ['Runs a paid community with a monthly fee', 'Everything published is free'],
  k_paid_offer: ['Sells a programme at a public price', 'No paid offer anywhere on the account'],
  k_decides: ['Runs everything alone, replies from the same account', 'A manager handles the inbox'],
  k_no_rival: ['Uses nothing that overlaps with your offer', 'Already pays for a direct competitor'],
  k_clear: ['Education only, and says so in the bio', 'Gives position sized recommendations, that is regulated advice'],
  k_no_platform: ['Sells through a third party course tool today', 'Already runs a platform of their own'],
  k_ran_paid: ['Three tagged partnerships in the last six months', 'No paid partnership on record'],
  k_market: ['Audience sits in your country and your price range', 'Right topic, wrong market'],
  k_safe: ['Nothing on the account you could not stand next to', 'Recurring content you cannot sit beside'],
}

const CRITERION_NOTES: Record<string, [string, string, string]> = {
  c_sells: ['No paid offer found', 'Coaching mentioned, no price in public', 'Programme sold at a public price'],
  c_revenue: ['Nothing for sale', 'An offer hinted at, no price', 'A paid offer at a public price'],
  c_stakes: ['Low stakes topic', 'Matters, but not urgently', 'Money, body or career, and it shows'],
  c_method: ['No method named', 'A loose framework, unnamed', 'Names the method and repeats it'],
  c_demand: ['Comments are compliments', 'A few asking how to start', 'People asking where to buy, every post'],
  c_proof: ['No numbers shown', 'Before and after, no dates', 'Client numbers with dates, repeatedly'],
  c_stable: ['Under a year old', 'Two years, with a long gap', 'Four years, no gap over a month'],
  c_person: ['Faceless account', 'Face sometimes, mostly reposts', 'Face on camera, first person, replies'],
  c_reach: ['Reach well under the count', 'Reach near the count', 'Median views above the follower count'],
  c_pain: ['The problem never comes up', 'Mentioned once', 'Works around it in public, repeatedly'],
  c_solo: ['An agency answers for them', 'A small team', 'Runs the whole thing alone'],
  c_replies: ['Never answers a comment', 'Answers now and then', 'Answers almost every question'],
  c_tools: ['No stack visible', 'One tool linked', 'A full stack in the bio'],
  c_fit: ['Too small for your price', 'Borderline', 'Right size to afford you and still need you'],
  c_growing: ['Reach sliding', 'Flat', 'Reach and cadence up over the year'],
  c_paid_posts: ['No partnership on record', 'One, a while ago', 'Tagged partnerships and a rate card'],
  c_buyer: ['Wrong market', 'Right topic, mixed market', 'Right country and right spending power'],
  c_steady: ['One spike, nothing since', 'Uneven', 'Median holds across twelve posts'],
  c_trust: ['Applause only', 'A few real questions', 'Questions and thanks in every thread'],
  c_sells_well: ['Past promotions fell flat', 'Engagement dipped', 'Promotions kept the engagement up'],
  c_safe: ['Hard to sit next to', 'Mostly fine', 'A tone you can stand next to'],
  c_budget: ['Likely over budget', 'Borderline', 'Size and category suggest a price you can pay'],
}

/** A deterministic answer for one profile against one gate version. */
export function judge(index: number, band: string, gates: GateSet): Judgement {
  const rand = seeded(4_400_011 + index * 104_729)
  const knockouts: Judgement['knockouts'] = {}
  // A strong profile clears the knockouts. A fair one fails roughly one in five.
  const failOdds = band === 'strong' ? 0.04 : band === 'fair' ? 0.2 : 0.4
  let failed = false
  for (const k of gates.knockouts) {
    const pass = failed ? true : rand() > failOdds
    if (!pass) failed = true
    const notes = KNOCKOUT_NOTES[k.id] ?? ['Yes', 'No']
    knockouts[k.id] = { pass, note: pass ? notes[0] : notes[1] }
  }
  const criteria: Judgement['criteria'] = {}
  for (const c of gates.criteria) {
    const roll = rand()
    const score: CriterionScore =
      band === 'strong' ? (roll > 0.22 ? 2 : 1)
        : band === 'fair' ? (roll > 0.6 ? 2 : roll > 0.24 ? 1 : 0)
          : (roll > 0.8 ? 1 : 0)
    const notes = CRITERION_NOTES[c.id] ?? ['No', 'Partly', 'Yes']
    criteria[c.id] = { score, note: notes[score] }
  }
  return { knockouts, criteria, reason: '' }
}
