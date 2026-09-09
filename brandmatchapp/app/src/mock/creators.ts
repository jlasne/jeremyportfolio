import type { Country, Creator, Language, Level, Signal, SignalType } from '../types'
import { avatarFor } from '../lib/images'
import { daysAgo, hoursAgo } from './time'

// 40 creators, fitness and nutrition niche.
//
// The score is computed, never stored. Three facts drive it: how well the
// creator fits the brief, what it sells, and what signals fired with what date.
// Niche is 1 for a fit, 0.5 for the right discipline with a different audience.
//
// 5 first seen in the last 24 hours, 3 carry a note and a tag, 2 rejected.

// Money changing hands is a strong signal. Wording and launches are softer.
const SIGNALS: Record<SignalType, { label: string; strength: Signal['strength'] }> = {
  sponsored_post: { label: 'Ran a sponsored post', strength: 'strong' },
  promoted_supplement: { label: 'Promoted a supplement brand', strength: 'strong' },
  posted_rates: { label: 'Posted about brand deal rates', strength: 'strong' },
  collab_bio: { label: 'Added collab wording to the bio', strength: 'soft' },
  media_kit: { label: 'Published a media kit', strength: 'soft' },
  launched_program: { label: 'Launched a program', strength: 'soft' },
  launched_merch: { label: 'Launched merch', strength: 'soft' },
}

function sig(type: SignalType, days: number): Signal {
  return { type, label: SIGNALS[type].label, strength: SIGNALS[type].strength, date: daysAgo(days) }
}

interface Row {
  id: string
  handle: string
  name: string
  bio: string
  followers: number
  er: number
  reel: number
  ppm: number
  lastPost: number
  country: Country
  language: Language
  email: string | null
  /** What the creator sells today. Empty means nothing yet. */
  sells: string
  niche: Level
  nicheWhy: string
  signals: Signal[]
  agent: string
  /** Hours since first seen. Under 24 means new today. */
  seen: number
}

const rows: Row[] = [
  // Three stars. Niche, selling, and a signal in the last 30 days.
  {
    id: 'c01', handle: 'liftwithmaya', name: 'Maya Reyes',
    bio: 'Strength coach. 12 week program for women who want to deadlift 2x bodyweight. Technique breakdowns every Tuesday.',
    followers: 184_000, er: 0.041, reel: 62_000, ppm: 14, lastPost: 1, country: 'US', language: 'en', email: 'hello@liftwithmaya.com',
    sells: 'an online program', niche: 1,
    nicheWhy: 'Technique content, an audience of beginner women, and a follower count inside the band.',
    signals: [sig('sponsored_post', 2), sig('media_kit', 48)], agent: 'a1', seen: 900,
  },
  {
    id: 'c02', handle: 'sophie.souleve', name: 'Sophie Marchand',
    bio: 'Coach force pour femmes. Programme débutantes 8 semaines. Collabs: DM ouverts.',
    followers: 62_000, er: 0.058, reel: 29_000, ppm: 9, lastPost: 2, country: 'FR', language: 'fr', email: null,
    sells: 'an 8 week program', niche: 1,
    nicheWhy: 'Beginner program, technique content, and an audience of women new to the barbell.',
    signals: [sig('collab_bio', 3)], agent: 'a1', seen: 5,
  },
  {
    id: 'c03', handle: 'jennakstrong', name: 'Jenna Kowalski',
    bio: 'Powerlifting coach, 4x national medalist. Online coaching and the Strong Start program. Vancouver.',
    followers: 240_000, er: 0.033, reel: 88_000, ppm: 12, lastPost: 1, country: 'CA', language: 'en', email: 'team@jennakstrong.com',
    sells: 'an online program', niche: 1,
    nicheWhy: 'Technique content, a beginner program alongside the competition posts, and 240k followers.',
    signals: [sig('promoted_supplement', 1), sig('sponsored_post', 41), sig('launched_program', 120)], agent: 'a2', seen: 1_300,
  },
  {
    id: 'c04', handle: 'priyalifts', name: 'Priya Nair',
    bio: 'Lifting for women who never lifted. Beginner program, 6 weeks, no gym needed. Media kit in the link.',
    followers: 91_000, er: 0.047, reel: 34_000, ppm: 10, lastPost: 3, country: 'UK', language: 'en', email: 'priya@priyalifts.co.uk',
    sells: 'a 6 week program', niche: 1,
    nicheWhy: 'Beginner women, a program of her own, and a follower count inside the band.',
    signals: [sig('media_kit', 7)], agent: 'a1', seen: 400,
  },
  {
    id: 'c06', handle: 'tashtrains', name: 'Tash Coleman',
    bio: 'Strength and conditioning coach. Technique first. App with 3,200 members. Sydney.',
    followers: 315_000, er: 0.028, reel: 104_000, ppm: 16, lastPost: 1, country: 'AU', language: 'en', email: 'partnerships@tashtrains.com',
    sells: 'an app', niche: 1,
    nicheWhy: 'Technique first content, 3,200 paying members, and an audience of women starting out.',
    signals: [sig('posted_rates', 9), sig('sponsored_post', 66)], agent: 'a1', seen: 2_000,
  },
  {
    id: 'c09', handle: 'rachelkimfit', name: 'Rachel Kim',
    bio: 'Certified strength coach. Lift Like Her program, 40k members. Beginner friendly technique tutorials.',
    followers: 402_000, er: 0.024, reel: 120_000, ppm: 18, lastPost: 1, country: 'US', language: 'en', email: 'rachel@rachelkimfit.com',
    sells: 'an online program', niche: 1,
    nicheWhy: 'Technique tutorials for beginners, 40k program members, and 402k followers.',
    signals: [sig('promoted_supplement', 4), sig('sponsored_post', 74)], agent: 'a2', seen: 3_000,
  },
  {
    id: 'c11', handle: 'amaraliftsheavy', name: 'Amara Okafor',
    bio: 'Online coaching for women new to the barbell. 3 spots open this month. Toronto.',
    followers: 76_000, er: 0.049, reel: 31_000, ppm: 9, lastPost: 2, country: 'CA', language: 'en', email: 'coach@amaraliftsheavy.com',
    sells: 'one to one coaching', niche: 1,
    nicheWhy: 'Coaching for women new to the barbell, which is the brief in one line.',
    signals: [sig('collab_bio', 6)], agent: 'a1', seen: 3,
  },
  {
    id: 'c12', handle: 'hannahbrooksfit', name: 'Hannah Brooks',
    bio: 'Strength app for women, 12k downloads. Weekly transformation features. Melbourne.',
    followers: 210_000, er: 0.031, reel: 70_000, ppm: 13, lastPost: 1, country: 'AU', language: 'en', email: 'hello@hannahbrooksfit.com',
    sells: 'an app', niche: 0.5,
    nicheWhy: 'Strength content for women and 12k app downloads, with transformations instead of technique.',
    signals: [sig('launched_merch', 10), sig('media_kit', 95)], agent: 'a1', seen: 4_000,
  },

  // Two stars. Niche and selling, with the last brand signal older than 30 days or none at all.
  {
    id: 'c10', handle: 'elliewlifts', name: 'Ellie Whitmore',
    bio: 'Beginner lifting ebook, 200 pages, link below. Manchester.',
    followers: 33_000, er: 0.055, reel: 14_000, ppm: 6, lastPost: 5, country: 'UK', language: 'en', email: null,
    sells: 'an ebook', niche: 1,
    nicheWhy: 'A 200 page beginner lifting ebook and an audience of women starting out.',
    signals: [], agent: 'a1', seen: 1_100,
  },
  {
    id: 'c14', handle: 'camille.muscu', name: 'Camille Roux',
    bio: 'Musculation pour débutantes. Programme 12 semaines en ligne. Lyon.',
    followers: 54_000, er: 0.046, reel: 22_000, ppm: 7, lastPost: 6, country: 'FR', language: 'fr', email: 'camille@camillemuscu.fr',
    sells: 'a 12 week program', niche: 1,
    nicheWhy: 'A 12 week beginner program and an audience of women new to the gym.',
    signals: [sig('launched_program', 160)], agent: 'a1', seen: 900,
  },
  {
    id: 'c15', handle: 'brookelifts', name: 'Brooke Anderson',
    bio: 'Strength coach. Technique tutorials for beginners. Program and media kit in the link.',
    followers: 640_000, er: 0.019, reel: 210_000, ppm: 20, lastPost: 1, country: 'US', language: 'en', email: 'mgmt@brookelifts.com',
    sells: 'an online program', niche: 1,
    nicheWhy: 'Technique tutorials for beginners, a program of her own, and 640k followers.',
    signals: [sig('sponsored_post', 8)], agent: 'a1', seen: 5_000,
  },
  {
    id: 'c18', handle: 'zoepham.fit', name: 'Zoe Pham',
    bio: 'Lifting for women 40+. Ebook: Start Strong at 40. Brisbane.',
    followers: 39_000, er: 0.051, reel: 15_000, ppm: 6, lastPost: 4, country: 'AU', language: 'en', email: null,
    sells: 'an ebook', niche: 0.5,
    nicheWhy: 'Technique content and an ebook, with an audience of women over 40 rather than beginners.',
    signals: [], agent: 'a3', seen: 1_700,
  },
  {
    id: 'c19', handle: 'kat.mueller.strong', name: 'Kat Müller',
    bio: 'Technik zuerst. Online Programm für Anfängerinnen. München.',
    followers: 27_000, er: 0.067, reel: 12_000, ppm: 8, lastPost: 2, country: 'DE', language: 'de', email: 'kat@katmueller.de',
    sells: 'an online program', niche: 1,
    nicheWhy: 'Technique first content and a program for beginners, in German.',
    signals: [sig('launched_program', 200)], agent: 'a1', seen: 2_600,
  },
  {
    id: 'c22', handle: 'freyalifts', name: 'Freya Nilsson',
    bio: 'Beginner lifter turned coach. Technique tips, every rep filmed. Coaching spots in the link. Bristol.',
    followers: 22_000, er: 0.069, reel: 9_800, ppm: 6, lastPost: 2, country: 'UK', language: 'en', email: 'freya@freyalifts.co.uk',
    sells: 'one to one coaching', niche: 1,
    nicheWhy: 'Technique tips for beginners from a coach who started as one.',
    signals: [], agent: 'a1', seen: 7,
  },
  {
    id: 'c26', handle: 'naomibellstrong', name: 'Naomi Bell',
    bio: 'Barbell basics for women. Technique first, weight second. Membership open. Ottawa.',
    followers: 29_000, er: 0.061, reel: 12_500, ppm: 7, lastPost: 1, country: 'CA', language: 'en', email: null,
    sells: 'a membership', niche: 1,
    nicheWhy: 'Barbell basics for women, technique first, with a membership of her own.',
    signals: [], agent: 'a1', seen: 500,
  },
  {
    id: 'c31', handle: 'miathompsontrains', name: 'Mia Thompson',
    bio: 'Strength coach. Weekly workout routines for women. Program in the link. Gold Coast.',
    followers: 260_000, er: 0.023, reel: 72_000, ppm: 12, lastPost: 1, country: 'AU', language: 'en', email: 'mia@miathompsontrains.com',
    sells: 'an online program', niche: 0.5,
    nicheWhy: 'Strength content for women and a program of her own, with routines instead of technique.',
    signals: [sig('sponsored_post', 88)], agent: 'a1', seen: 4_400,
  },
  {
    id: 'c32', handle: 'kelseywardfit', name: 'Kelsey Ward',
    bio: 'Barbell coach for beginners. Every video is a cue you can use tonight. Program in the link. Halifax.',
    followers: 48_000, er: 0.05, reel: 20_000, ppm: 9, lastPost: 2, country: 'CA', language: 'en', email: null,
    sells: 'an online program', niche: 1,
    nicheWhy: 'One coaching cue per video for beginners, with a program of her own.',
    signals: [], agent: 'a1', seen: 750,
  },
  {
    id: 'c34', handle: 'hollyfraserfit', name: 'Holly Fraser',
    bio: 'Lifting after 40. Technique and joint friendly progressions. Ebook in the link. Edinburgh.',
    followers: 37_000, er: 0.057, reel: 15_500, ppm: 6, lastPost: 4, country: 'UK', language: 'en', email: null,
    sells: 'an ebook', niche: 0.5,
    nicheWhy: 'Technique content and an ebook, with an audience of women over 40 rather than beginners.',
    signals: [], agent: 'a3', seen: 3_600,
  },
  {
    id: 'c38', handle: 'rubycollinsfit', name: 'Ruby Collins',
    bio: 'Beginner lifting coach. Technique clips. Coaching applications open. Adelaide.',
    followers: 52_000, er: 0.015, reel: 11_000, ppm: 4, lastPost: 22, country: 'AU', language: 'en', email: null,
    sells: 'one to one coaching', niche: 1,
    nicheWhy: 'Technique clips for beginners, with coaching she sells herself.',
    signals: [sig('sponsored_post', 140)], agent: 'a1', seen: 4_900,
  },
  {
    id: 'c40', handle: 'lisaschneider.fit', name: 'Lisa Schneider',
    bio: 'Fitness für Mamas. Rückbildung und erste Gewichte. Programm in der Bio. Stuttgart.',
    followers: 19_000, er: 0.074, reel: 8_200, ppm: 5, lastPost: 6, country: 'DE', language: 'de', email: 'lisa@lisaschneider.fit',
    sells: 'an online program', niche: 0.5,
    nicheWhy: 'First weights for postpartum women, with a program of her own, in German.',
    signals: [], agent: 'a3', seen: 1_600,
  },
  {
    id: 'c13', handle: 'nadiafischer.fit', name: 'Nadia Fischer',
    bio: 'Strength coaching in English and German. Hamburg. Coaching applications open.',
    followers: 88_000, er: 0.039, reel: 35_000, ppm: 8, lastPost: 3, country: 'DE', language: 'en', email: null,
    sells: 'one to one coaching', niche: 0.5,
    nicheWhy: 'Strength coaching for women in English, with meet recaps alongside the technique posts.',
    signals: [], agent: 'a1', seen: 1_500,
  },

  // One star. Niche, selling nothing yet.
  {
    id: 'c05', handle: 'lena.hebt', name: 'Lena Hoffmann',
    bio: 'Krafttraining für Frauen. Technik und erste Kilos. Berlin.',
    followers: 47_000, er: 0.062, reel: 21_000, ppm: 8, lastPost: 1, country: 'DE', language: 'de', email: null,
    sells: '', niche: 1,
    nicheWhy: 'Technique content for women lifting their first kilos, in German.',
    signals: [], agent: 'a1', seen: 44,
  },
  {
    id: 'c08', handle: 'chloe.fit.paris', name: 'Chloé Bernard',
    bio: 'Coach sportive à Paris. Technique de squat et deadlift pour débutantes.',
    followers: 18_000, er: 0.081, reel: 9_400, ppm: 7, lastPost: 4, country: 'FR', language: 'fr', email: 'chloe.fit.paris@gmail.com',
    sells: '', niche: 1,
    nicheWhy: 'Squat and deadlift technique for beginner women, in French.',
    signals: [], agent: 'a1', seen: 300,
  },
  {
    id: 'c21', handle: 'graceliulifts', name: 'Grace Liu',
    bio: 'Learning to lift, sharing what works. Squat, bench, deadlift tutorials. Seattle.',
    followers: 58_000, er: 0.044, reel: 24_000, ppm: 8, lastPost: 3, country: 'US', language: 'en', email: 'grace.liu.lifts@gmail.com',
    sells: '', niche: 1,
    nicheWhy: 'Squat, bench and deadlift tutorials for women starting out.',
    signals: [], agent: 'a1', seen: 800,
  },
  {
    id: 'c23', handle: 'saraweber.fit', name: 'Sara Weber',
    bio: 'Strength coach in training. Technique videos for women starting out. Cologne.',
    followers: 36_000, er: 0.053, reel: 15_000, ppm: 7, lastPost: 5, country: 'DE', language: 'en', email: null,
    sells: '', niche: 1,
    nicheWhy: 'Technique videos for women starting out, in English from Germany.',
    signals: [], agent: 'a1', seen: 2_900,
  },
  {
    id: 'c24', handle: 'tarasinghlifts', name: 'Tara Singh',
    bio: 'First pull up at 34. Now teaching women to lift. Leeds.',
    followers: 12_000, er: 0.09, reel: 6_800, ppm: 6, lastPost: 3, country: 'UK', language: 'en', email: 'tara@tarasinghlifts.com',
    sells: '', niche: 1,
    nicheWhy: 'Teaches women to lift from her own beginner story, at 9% engagement.',
    signals: [], agent: 'a1', seen: 14,
  },
  {
    id: 'c28', handle: 'jade.thomas.lifts', name: 'Jade Thomas',
    bio: 'Barbell club coach. Filming every cue I give my beginners. Bristol.',
    followers: 24_000, er: 0.063, reel: 10_400, ppm: 9, lastPost: 2, country: 'UK', language: 'en', email: null,
    sells: '', niche: 1,
    nicheWhy: 'Films every coaching cue she gives beginners at her barbell club.',
    signals: [], agent: 'a1', seen: 1_000,
  },
  {
    id: 'c30', handle: 'mel.andrews.lifts', name: 'Mel Andrews',
    bio: 'Postpartum strength. Rebuilding from week 6. Wellington born, Sydney based.',
    followers: 31_000, er: 0.058, reel: 13_200, ppm: 7, lastPost: 3, country: 'AU', language: 'en', email: 'mel@melandrews.fit',
    sells: '', niche: 0.5,
    nicheWhy: 'Postpartum strength progressions, an audience the brief names.',
    signals: [], agent: 'a3', seen: 2_100,
  },
  {
    id: 'c35', handle: 'bethmarshall', name: 'Beth Marshall',
    bio: 'Lifting, dogs, coffee. Technique threads when the mood strikes. Portland.',
    followers: 24_000, er: 0.008, reel: 4_100, ppm: 1, lastPost: 62, country: 'US', language: 'en', email: null,
    sells: '', niche: 0.5,
    nicheWhy: 'Technique posts for women lifting, buried in personal content.',
    signals: [], agent: 'a1', seen: 5_500,
  },
  {
    id: 'c36', handle: 'ines.leroy.fit', name: 'Inès Leroy',
    bio: 'Débuter la musculation sans se blesser. Technique et progressions. Nantes.',
    followers: 16_000, er: 0.047, reel: 7_300, ppm: 6, lastPost: 4, country: 'FR', language: 'fr', email: null,
    sells: '', niche: 1,
    nicheWhy: 'Starting to lift without getting hurt, aimed at beginner women, in French.',
    signals: [], agent: 'a1', seen: 52,
  },
  {
    id: 'c37', handle: 'dana.olsen.lifts', name: 'Dana Olsen',
    bio: 'Strength for women over 45. Slow progressions, filmed. Calgary.',
    followers: 21_000, er: 0.054, reel: 9_100, ppm: 5, lastPost: 6, country: 'CA', language: 'en', email: 'dana.olsen.lifts@gmail.com',
    sells: '', niche: 0.5,
    nicheWhy: 'Filmed progressions for women over 45, an audience next to the brief.',
    signals: [], agent: 'a3', seen: 7_000,
  },
  {
    id: 'c39', handle: 'erinwalshlifts', name: 'Erin Walsh',
    bio: 'Learning the lifts. Every session filmed, mistakes included. Winnipeg.',
    followers: 13_000, er: 0.041, reel: 5_900, ppm: 4, lastPost: 9, country: 'CA', language: 'en', email: null,
    sells: '', niche: 1,
    nicheWhy: 'Films her own beginner sessions, mistakes included, for other beginners.',
    signals: [], agent: 'a1', seen: 6_200,
  },

  // Zero stars. Outside the niche.
  {
    id: 'c07', handle: 'dani.barbell', name: 'Danielle Ortiz',
    bio: 'Gym owner, Austin. Merch drop is live. Bench press content mostly.',
    followers: 128_000, er: 0.036, reel: 45_000, ppm: 11, lastPost: 2, country: 'US', language: 'en', email: null,
    sells: 'merch', niche: 0,
    nicheWhy: 'Bench press content for a mostly male gym crowd, which is not the audience in the brief.',
    signals: [sig('launched_merch', 3)], agent: 'a2', seen: 600,
  },
  {
    id: 'c16', handle: 'islagrantstrong', name: 'Isla Grant',
    bio: 'Strongwoman competitor. Coaching for meet prep. Glasgow.',
    followers: 15_000, er: 0.072, reel: 6_100, ppm: 5, lastPost: 8, country: 'UK', language: 'en', email: null,
    sells: 'meet prep coaching', niche: 0.5,
    nicheWhy: 'Strongwoman meet prep serves competitors, not the beginners in the brief.',
    signals: [], agent: 'a1', seen: 700,
  },
  {
    id: 'c17', handle: 'megdoylefit', name: 'Megan Doyle',
    bio: 'Home workouts and meal ideas. Ebook in the link. Calgary.',
    followers: 121_000, er: 0.027, reel: 38_000, ppm: 12, lastPost: 2, country: 'CA', language: 'en', email: 'megan@megdoylefit.com',
    sells: 'an ebook', niche: 0,
    nicheWhy: 'Home workouts and meal ideas sit outside lifting.',
    signals: [sig('promoted_supplement', 80)], agent: 'a2', seen: 2_200,
  },
  {
    id: 'c20', handle: 'oliviahartfit', name: 'Olivia Hart',
    bio: 'Fitness and lifestyle. Workout routines, recipes, travel. Affiliate codes in the link. LA.',
    followers: 840_000, er: 0.012, reel: 190_000, ppm: 22, lastPost: 1, country: 'US', language: 'en', email: 'olivia@oliviahartmgmt.com',
    sells: 'affiliate codes', niche: 0,
    nicheWhy: 'Lifestyle content across travel and recipes reaches a broad audience, not lifting beginners.',
    signals: [sig('sponsored_post', 5), sig('media_kit', 110)], agent: 'a2', seen: 6_000,
  },
  {
    id: 'c25', handle: 'emcarterfit', name: 'Emily Carter',
    bio: 'Running, hiking, and the odd gym day. Perth.',
    followers: 150_000, er: 0.021, reel: 41_000, ppm: 9, lastPost: 2, country: 'AU', language: 'en', email: 'emily@emcarterfit.com',
    sells: '', niche: 0,
    nicheWhy: 'Running and hiking content reaches an endurance audience.',
    signals: [], agent: 'a2', seen: 3_300,
  },
  {
    id: 'c27', handle: 'alexismoreno.fit', name: 'Alexis Moreno',
    bio: 'Bodybuilding prep and posing. Miami.',
    followers: 67_000, er: 0.035, reel: 27_000, ppm: 10, lastPost: 2, country: 'US', language: 'en', email: 'alexis@alexismoreno.fit',
    sells: '', niche: 0.5,
    nicheWhy: 'Bodybuilding prep and posing serves stage competitors.',
    signals: [], agent: 'a2', seen: 1_900,
  },
  {
    id: 'c29', handle: 'jade.lambert.fit', name: 'Jade Lambert',
    bio: 'Pilates et yoga. Marseille.',
    followers: 71_000, er: 0.029, reel: 22_000, ppm: 8, lastPost: 2, country: 'FR', language: 'fr', email: null,
    sells: '', niche: 0,
    nicheWhy: 'Pilates and yoga is a different discipline, audience and format.',
    signals: [], agent: 'a1', seen: 2_400,
  },
  {
    id: 'c33', handle: 'avamitchell.strong', name: 'Ava Mitchell',
    bio: 'CrossFit athlete. Daily WOD and comp prep. Denver.',
    followers: 95_000, er: 0.032, reel: 33_000, ppm: 15, lastPost: 1, country: 'US', language: 'en', email: 'ava@avamitchell.com',
    sells: '', niche: 0,
    nicheWhy: 'CrossFit competition content serves athletes already deep in the sport.',
    signals: [], agent: 'a2', seen: 16,
  },
]

export const creators: Creator[] = rows.map((r) => ({
  id: r.id,
  handle: r.handle,
  name: r.name,
  avatar: avatarFor(r.name, r.handle),
  bio: r.bio,
  followers: r.followers,
  engagementRate: r.er,
  medianReelViews: r.reel,
  postsPerMonth: r.ppm,
  lastPostAt: daysAgo(r.lastPost, 18),
  country: r.country,
  language: r.language,
  email: r.email,
  signals: [...r.signals].sort((a, b) => b.date.localeCompare(a.date)),
  niche: r.niche,
  nicheWhy: r.nicheWhy,
  sells: r.sells,
  agentId: r.agent,
  firstSeenAt: hoursAgo(r.seen),
  lastCrawlAt: hoursAgo(Math.min(r.seen, 6)),
}))
