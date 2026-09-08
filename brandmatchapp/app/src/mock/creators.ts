import type { Country, Creator, Language, Signal, SignalType, Stars } from '../types'
import { avatarFor } from '../lib/images'
import { daysAgo, hoursAgo } from './time'

// 40 creators, fitness and nutrition niche.
// Spread: 8 at intent 3, 12 at 2, 14 at 1, 6 at 0. Match spread across all four levels.
// 5 new today (first seen in the last 24 hours). Saved, notes, tags and rejections live in their own files.

const SIGNAL_LABELS: Record<SignalType, string> = {
  sponsored_post: 'Ran a sponsored post',
  promoted_supplement: 'Promoted a supplement brand',
  collab_bio: 'Added collab wording to the bio',
  media_kit: 'Published a media kit',
  launched_program: 'Launched a program',
  launched_merch: 'Launched merch',
  posted_rates: 'Posted about brand deal rates',
}

function sig(type: SignalType, days: number): Signal {
  return { type, label: SIGNAL_LABELS[type], date: daysAgo(days) }
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
  signals: Signal[]
  intent: Stars
  intentWhy: string
  match: Stars
  matchWhy: string
  /** Hours since first seen. Under 24 means new today. */
  seenHoursAgo: number
}

const rows: Row[] = [
  // Intent 3. A signal fired in the last 30 days.
  {
    id: 'c01', handle: 'liftwithmaya', name: 'Maya Reyes',
    bio: 'Strength coach. 12 week program for women who want to deadlift 2x bodyweight. Technique breakdowns every Tuesday.',
    followers: 184_000, er: 0.041, reel: 62_000, ppm: 14, lastPost: 1, country: 'US', language: 'en', email: 'hello@liftwithmaya.com',
    signals: [sig('sponsored_post', 11), sig('media_kit', 48)],
    intent: 3, intentWhy: 'Ran a sponsored post 11 days ago, so she is taking paid work right now.',
    match: 3, matchWhy: 'Bio, audience, follower count and technique content all fit the brief.',
    seenHoursAgo: 900,
  },
  {
    id: 'c02', handle: 'sophie.souleve', name: 'Sophie Marchand',
    bio: 'Coach force pour femmes. Programme débutantes 8 semaines. Collabs: DM ouverts.',
    followers: 62_000, er: 0.058, reel: 29_000, ppm: 9, lastPost: 2, country: 'FR', language: 'fr', email: null,
    signals: [sig('collab_bio', 3)],
    intent: 3, intentWhy: 'Added collab wording to the bio 3 days ago, an open invitation to brands.',
    match: 2, matchWhy: 'Niche, program and beginner audience fit, but she posts in French and the filters ask for no language yet.',
    seenHoursAgo: 5,
  },
  {
    id: 'c03', handle: 'jennakstrong', name: 'Jenna Kowalski',
    bio: 'Powerlifting coach, 4x national medalist. Online coaching and the Strong Start program. Vancouver.',
    followers: 240_000, er: 0.033, reel: 88_000, ppm: 12, lastPost: 1, country: 'CA', language: 'en', email: 'team@jennakstrong.com',
    signals: [sig('promoted_supplement', 6), sig('sponsored_post', 41), sig('launched_program', 120)],
    intent: 3, intentWhy: 'Promoted a supplement brand 6 days ago, so she already works with brands in this category.',
    match: 3, matchWhy: 'Bio, audience, follower count and technique content all fit the brief.',
    seenHoursAgo: 1_300,
  },
  {
    id: 'c04', handle: 'priyalifts', name: 'Priya Nair',
    bio: 'Lifting for women who never lifted. Beginner program, 6 weeks, no gym needed. Media kit in the link.',
    followers: 91_000, er: 0.047, reel: 34_000, ppm: 10, lastPost: 3, country: 'UK', language: 'en', email: 'priya@priyalifts.co.uk',
    signals: [sig('media_kit', 19)],
    intent: 3, intentWhy: 'Published a media kit 19 days ago, which means she is pricing deals.',
    match: 2, matchWhy: 'Niche, program and beginner audience fit, but most of her content is transformations rather than technique.',
    seenHoursAgo: 400,
  },
  {
    id: 'c05', handle: 'lena.hebt', name: 'Lena Hoffmann',
    bio: 'Krafttraining für Frauen. Neues 10 Wochen Programm ist da. Berlin.',
    followers: 47_000, er: 0.062, reel: 21_000, ppm: 8, lastPost: 1, country: 'DE', language: 'de', email: null,
    signals: [sig('launched_program', 2)],
    intent: 3, intentWhy: 'Launched a program 2 days ago and is in selling mode this month.',
    match: 1, matchWhy: 'Program and follower count fit, but content is workout routines and the audience skews to competitive lifters.',
    seenHoursAgo: 11,
  },
  {
    id: 'c06', handle: 'tashtrains', name: 'Tash Coleman',
    bio: 'Strength and conditioning coach. Technique first. App with 3,200 members. Sydney.',
    followers: 315_000, er: 0.028, reel: 104_000, ppm: 16, lastPost: 1, country: 'AU', language: 'en', email: 'partnerships@tashtrains.com',
    signals: [sig('posted_rates', 27), sig('sponsored_post', 66)],
    intent: 3, intentWhy: 'Posted about brand deal rates 27 days ago, so she is open about pricing partnerships.',
    match: 3, matchWhy: 'Bio, audience, follower count and technique content all fit the brief.',
    seenHoursAgo: 2_000,
  },
  {
    id: 'c07', handle: 'dani.barbell', name: 'Danielle Ortiz',
    bio: 'Gym owner, Austin. Merch drop is live. Bench press content mostly.',
    followers: 128_000, er: 0.036, reel: 45_000, ppm: 11, lastPost: 2, country: 'US', language: 'en', email: null,
    signals: [sig('launched_merch', 14)],
    intent: 3, intentWhy: 'Launched merch 14 days ago, so she is monetising her audience now.',
    match: 1, matchWhy: 'Follower count and country fit, but she sells merch instead of a program and her audience is mostly men.',
    seenHoursAgo: 600,
  },
  {
    id: 'c08', handle: 'chloe.fit.paris', name: 'Chloé Bernard',
    bio: 'Coach sportive à Paris. Technique de squat et deadlift. Programme en ligne bientôt.',
    followers: 18_000, er: 0.081, reel: 9_400, ppm: 7, lastPost: 4, country: 'FR', language: 'fr', email: 'chloe.fit.paris@gmail.com',
    signals: [sig('sponsored_post', 22)],
    intent: 3, intentWhy: 'Ran a sponsored post 22 days ago, so she has an active deal.',
    match: 1, matchWhy: 'Technique content and follower count fit, but there is no program to sell yet and the audience is mixed.',
    seenHoursAgo: 300,
  },

  // Intent 2. Sells something: link hub, own product, affiliate links, media kit.
  {
    id: 'c09', handle: 'rachelkimfit', name: 'Rachel Kim',
    bio: 'Certified strength coach. Lift Like Her program, 40k members. Beginner friendly technique tutorials.',
    followers: 402_000, er: 0.024, reel: 120_000, ppm: 18, lastPost: 1, country: 'US', language: 'en', email: 'rachel@rachelkimfit.com',
    signals: [sig('sponsored_post', 74)],
    intent: 2, intentWhy: 'Sells her own program through a link hub, and her last brand post was 74 days ago.',
    match: 3, matchWhy: 'Bio, audience, follower count and technique content all fit the brief.',
    seenHoursAgo: 3_000,
  },
  {
    id: 'c10', handle: 'elliewlifts', name: 'Ellie Whitmore',
    bio: 'Beginner lifting ebook, 200 pages, link below. Manchester.',
    followers: 33_000, er: 0.055, reel: 14_000, ppm: 6, lastPost: 5, country: 'UK', language: 'en', email: null,
    signals: [],
    intent: 2, intentWhy: 'Sells an ebook from the bio, with no brand signal in the last 90 days.',
    match: 2, matchWhy: 'Niche, beginner audience and follower count fit, but she sells an ebook rather than a program.',
    seenHoursAgo: 1_100,
  },
  {
    id: 'c11', handle: 'amaraliftsheavy', name: 'Amara Okafor',
    bio: 'Online coaching for women new to the barbell. 3 spots open this month. Toronto.',
    followers: 76_000, er: 0.049, reel: 31_000, ppm: 9, lastPost: 2, country: 'CA', language: 'en', email: 'coach@amaraliftsheavy.com',
    signals: [],
    intent: 2, intentWhy: 'Sells one to one coaching, with no brand signal in the last 90 days.',
    match: 3, matchWhy: 'Bio, audience, follower count and technique content all fit the brief.',
    seenHoursAgo: 3,
  },
  {
    id: 'c12', handle: 'hannahbrooksfit', name: 'Hannah Brooks',
    bio: 'Strength app for women, 12k downloads. Weekly transformation features. Melbourne.',
    followers: 210_000, er: 0.031, reel: 70_000, ppm: 13, lastPost: 1, country: 'AU', language: 'en', email: 'hello@hannahbrooksfit.com',
    signals: [sig('media_kit', 95)],
    intent: 2, intentWhy: 'Sells an app and has a media kit, with the last brand signal 95 days ago.',
    match: 2, matchWhy: 'Niche, product and follower count fit, but her content is transformations rather than technique.',
    seenHoursAgo: 4_000,
  },
  {
    id: 'c13', handle: 'nadiafischer.fit', name: 'Nadia Fischer',
    bio: 'Strength coaching in English and German. Hamburg. Coaching applications open.',
    followers: 88_000, er: 0.039, reel: 35_000, ppm: 8, lastPost: 3, country: 'DE', language: 'en', email: null,
    signals: [],
    intent: 2, intentWhy: 'Sells coaching from the bio, with no brand signal in the last 90 days.',
    match: 1, matchWhy: 'Coaching and follower count fit, but her audience is competitive lifters and content is meet recaps.',
    seenHoursAgo: 1_500,
  },
  {
    id: 'c14', handle: 'camille.muscu', name: 'Camille Roux',
    bio: 'Musculation pour débutantes. Programme 12 semaines en ligne. Lyon.',
    followers: 54_000, er: 0.046, reel: 22_000, ppm: 7, lastPost: 6, country: 'FR', language: 'fr', email: 'camille@camillemuscu.fr',
    signals: [sig('launched_program', 160)],
    intent: 2, intentWhy: 'Sells a 12 week program, launched 160 days ago, with nothing newer.',
    match: 2, matchWhy: 'Niche, program and beginner audience fit, but she posts in French.',
    seenHoursAgo: 900,
  },
  {
    id: 'c15', handle: 'brookelifts', name: 'Brooke Anderson',
    bio: 'Strength coach. Technique tutorials for beginners. Program and media kit in the link.',
    followers: 640_000, er: 0.019, reel: 210_000, ppm: 20, lastPost: 1, country: 'US', language: 'en', email: 'mgmt@brookelifts.com',
    signals: [sig('sponsored_post', 58)],
    intent: 2, intentWhy: 'Sells a program and lists affiliate links, with her last sponsored post 58 days ago.',
    match: 3, matchWhy: 'Bio, audience, follower count and technique content all fit the brief.',
    seenHoursAgo: 5_000,
  },
  {
    id: 'c16', handle: 'islagrantstrong', name: 'Isla Grant',
    bio: 'Strongwoman competitor. Coaching for meet prep. Glasgow.',
    followers: 15_000, er: 0.072, reel: 6_100, ppm: 5, lastPost: 8, country: 'UK', language: 'en', email: null,
    signals: [],
    intent: 2, intentWhy: 'Sells meet prep coaching, with no brand signal in the last 90 days.',
    match: 0, matchWhy: 'Only the follower count fits. Strongwoman meet prep for competitors is a different niche and audience.',
    seenHoursAgo: 700,
  },
  {
    id: 'c17', handle: 'megdoylefit', name: 'Megan Doyle',
    bio: 'Home workouts and meal ideas. Ebook in the link. Calgary.',
    followers: 121_000, er: 0.027, reel: 38_000, ppm: 12, lastPost: 2, country: 'CA', language: 'en', email: 'megan@megdoylefit.com',
    signals: [sig('promoted_supplement', 80)],
    intent: 2, intentWhy: 'Sells an ebook and promoted a supplement 80 days ago.',
    match: 1, matchWhy: 'Follower count and country fit, but home workouts and meal content sit outside the lifting niche.',
    seenHoursAgo: 2_200,
  },
  {
    id: 'c18', handle: 'zoepham.fit', name: 'Zoe Pham',
    bio: 'Lifting for women 40+. Ebook: Start Strong at 40. Brisbane.',
    followers: 39_000, er: 0.051, reel: 15_000, ppm: 6, lastPost: 4, country: 'AU', language: 'en', email: null,
    signals: [],
    intent: 2, intentWhy: 'Sells an ebook from the bio, with no brand signal in the last 90 days.',
    match: 2, matchWhy: 'Niche, follower count and technique content fit, but her audience is women over 40 rather than beginners.',
    seenHoursAgo: 1_700,
  },
  {
    id: 'c19', handle: 'kat.mueller.strong', name: 'Kat Müller',
    bio: 'Technik zuerst. Online Programm für Anfängerinnen. München.',
    followers: 27_000, er: 0.067, reel: 12_000, ppm: 8, lastPost: 2, country: 'DE', language: 'de', email: 'kat@katmueller.de',
    signals: [sig('launched_program', 200)],
    intent: 2, intentWhy: 'Sells a program launched 200 days ago, with nothing newer.',
    match: 3, matchWhy: 'Bio, audience, follower count and technique content all fit the brief.',
    seenHoursAgo: 2_600,
  },
  {
    id: 'c20', handle: 'oliviahartfit', name: 'Olivia Hart',
    bio: 'Fitness and lifestyle. Workout routines, recipes, travel. Affiliate codes in the link. LA.',
    followers: 840_000, er: 0.012, reel: 190_000, ppm: 22, lastPost: 1, country: 'US', language: 'en', email: 'olivia@oliviahartmgmt.com',
    signals: [sig('sponsored_post', 45), sig('media_kit', 110)],
    intent: 2, intentWhy: 'Runs affiliate links and has a media kit, with her last sponsored post 45 days ago.',
    match: 1, matchWhy: 'Follower count and country fit, but the content is lifestyle routines and the audience is broad.',
    seenHoursAgo: 6_000,
  },

  // Intent 1. Reachable and active: contact available, 3+ posts a month.
  {
    id: 'c21', handle: 'graceliulifts', name: 'Grace Liu',
    bio: 'Learning to lift, sharing what works. Squat, bench, deadlift tutorials. Seattle.',
    followers: 58_000, er: 0.044, reel: 24_000, ppm: 8, lastPost: 3, country: 'US', language: 'en', email: 'grace.liu.lifts@gmail.com',
    signals: [],
    intent: 1, intentWhy: 'Has an email and posts 8 times a month, but sells nothing yet.',
    match: 2, matchWhy: 'Niche, beginner audience and technique content fit, but she has no program to sell.',
    seenHoursAgo: 800,
  },
  {
    id: 'c22', handle: 'freyalifts', name: 'Freya Nilsson',
    bio: 'Beginner lifter turned coach. Technique tips, every rep filmed. Bristol.',
    followers: 22_000, er: 0.069, reel: 9_800, ppm: 6, lastPost: 2, country: 'UK', language: 'en', email: 'freya@freyalifts.co.uk',
    signals: [],
    intent: 1, intentWhy: 'Has an email and posts 6 times a month, but sells nothing yet.',
    match: 3, matchWhy: 'Bio, audience, follower count and technique content all fit the brief.',
    seenHoursAgo: 1_200,
  },
  {
    id: 'c23', handle: 'marie.dubois.fit', name: 'Marie Dubois',
    bio: 'Prof de sport. Routines à la maison et en salle. Bordeaux.',
    followers: 44_000, er: 0.038, reel: 16_000, ppm: 5, lastPost: 4, country: 'FR', language: 'fr', email: 'contact@mariedubois.fit',
    signals: [],
    intent: 1, intentWhy: 'Has an email and posts 5 times a month, but sells nothing yet.',
    match: 1, matchWhy: 'Follower count and audience fit, but content is home routines and she posts in French.',
    seenHoursAgo: 18,
  },
  {
    id: 'c24', handle: 'saraweber.fit', name: 'Sara Weber',
    bio: 'Strength coach in training. Technique videos for women starting out. Cologne.',
    followers: 36_000, er: 0.053, reel: 15_000, ppm: 7, lastPost: 5, country: 'DE', language: 'en', email: null,
    signals: [],
    intent: 1, intentWhy: 'Reachable through Instagram DMs and posts 7 times a month, but sells nothing yet.',
    match: 2, matchWhy: 'Niche, beginner audience and technique content fit, but she has no program to sell.',
    seenHoursAgo: 2_900,
  },
  {
    id: 'c25', handle: 'emcarterfit', name: 'Emily Carter',
    bio: 'Running, hiking, and the odd gym day. Perth.',
    followers: 150_000, er: 0.021, reel: 41_000, ppm: 9, lastPost: 2, country: 'AU', language: 'en', email: 'emily@emcarterfit.com',
    signals: [],
    intent: 1, intentWhy: 'Has an email and posts 9 times a month, but sells nothing yet.',
    match: 0, matchWhy: 'Only the follower count fits. Running and hiking content is a different niche and audience.',
    seenHoursAgo: 3_300,
  },
  {
    id: 'c26', handle: 'naomibellstrong', name: 'Naomi Bell',
    bio: 'Barbell basics for women. Technique first, weight second. Ottawa.',
    followers: 29_000, er: 0.061, reel: 12_500, ppm: 7, lastPost: 1, country: 'CA', language: 'en', email: null,
    signals: [],
    intent: 1, intentWhy: 'Reachable through Instagram DMs and posts 7 times a month, but sells nothing yet.',
    match: 3, matchWhy: 'Bio, audience, follower count and technique content all fit the brief.',
    seenHoursAgo: 500,
  },
  {
    id: 'c27', handle: 'alexismoreno.fit', name: 'Alexis Moreno',
    bio: 'Bodybuilding prep and posing. Miami.',
    followers: 67_000, er: 0.035, reel: 27_000, ppm: 10, lastPost: 2, country: 'US', language: 'en', email: 'alexis@alexismoreno.fit',
    signals: [],
    intent: 1, intentWhy: 'Has an email and posts 10 times a month, but sells nothing yet.',
    match: 1, matchWhy: 'Follower count and country fit, but bodybuilding prep serves competitors rather than beginners.',
    seenHoursAgo: 1_900,
  },
  {
    id: 'c28', handle: 'tarasinghlifts', name: 'Tara Singh',
    bio: 'First pull up at 34. Now teaching women to lift. Leeds.',
    followers: 12_000, er: 0.09, reel: 6_800, ppm: 6, lastPost: 3, country: 'UK', language: 'en', email: 'tara@tarasinghlifts.com',
    signals: [],
    intent: 1, intentWhy: 'Has an email and posts 6 times a month, but sells nothing yet.',
    match: 2, matchWhy: 'Niche, beginner audience and technique content fit, but she has no program to sell.',
    seenHoursAgo: 1_000,
  },
  {
    id: 'c29', handle: 'jade.lambert.fit', name: 'Jade Lambert',
    bio: 'Pilates et yoga. Marseille.',
    followers: 71_000, er: 0.029, reel: 22_000, ppm: 8, lastPost: 2, country: 'FR', language: 'fr', email: null,
    signals: [],
    intent: 1, intentWhy: 'Reachable through Instagram DMs and posts 8 times a month, but sells nothing yet.',
    match: 0, matchWhy: 'Only the follower count fits. Pilates and yoga is a different niche, audience and format.',
    seenHoursAgo: 2_400,
  },
  {
    id: 'c30', handle: 'lisaschneider.fit', name: 'Lisa Schneider',
    bio: 'Fitness für Mamas. Rückbildung und erste Gewichte. Stuttgart.',
    followers: 19_000, er: 0.074, reel: 8_200, ppm: 5, lastPost: 6, country: 'DE', language: 'de', email: 'lisa@lisaschneider.fit',
    signals: [],
    intent: 1, intentWhy: 'Has an email and posts 5 times a month, but sells nothing yet.',
    match: 1, matchWhy: 'Niche and follower count fit, but her audience is postpartum women and she posts in German.',
    seenHoursAgo: 1_600,
  },
  {
    id: 'c31', handle: 'miathompsontrains', name: 'Mia Thompson',
    bio: 'Strength coach. Weekly workout routines for women. Gold Coast.',
    followers: 260_000, er: 0.023, reel: 72_000, ppm: 12, lastPost: 1, country: 'AU', language: 'en', email: 'mia@miathompsontrains.com',
    signals: [],
    intent: 1, intentWhy: 'Has an email and posts 12 times a month, but sells nothing yet.',
    match: 2, matchWhy: 'Niche, audience and follower count fit, but her content is routines rather than technique.',
    seenHoursAgo: 4_400,
  },
  {
    id: 'c32', handle: 'kelseywardfit', name: 'Kelsey Ward',
    bio: 'Barbell coach for beginners. Every video is a cue you can use tonight. Halifax.',
    followers: 48_000, er: 0.05, reel: 20_000, ppm: 9, lastPost: 2, country: 'CA', language: 'en', email: null,
    signals: [],
    intent: 1, intentWhy: 'Reachable through Instagram DMs and posts 9 times a month, but sells nothing yet.',
    match: 3, matchWhy: 'Bio, audience, follower count and technique content all fit the brief.',
    seenHoursAgo: 750,
  },
  {
    id: 'c33', handle: 'avamitchell.strong', name: 'Ava Mitchell',
    bio: 'CrossFit athlete. Daily WOD and comp prep. Denver.',
    followers: 95_000, er: 0.032, reel: 33_000, ppm: 15, lastPost: 1, country: 'US', language: 'en', email: 'ava@avamitchell.com',
    signals: [],
    intent: 1, intentWhy: 'Has an email and posts 15 times a month, but sells nothing yet.',
    match: 1, matchWhy: 'Follower count and country fit, but CrossFit competition content serves a different audience.',
    seenHoursAgo: 2_800,
  },
  {
    id: 'c34', handle: 'hollyfraserfit', name: 'Holly Fraser',
    bio: 'Lifting after 40. Technique and joint friendly progressions. Edinburgh.',
    followers: 37_000, er: 0.057, reel: 15_500, ppm: 6, lastPost: 4, country: 'UK', language: 'en', email: null,
    signals: [],
    intent: 1, intentWhy: 'Reachable through Instagram DMs and posts 6 times a month, but sells nothing yet.',
    match: 2, matchWhy: 'Niche, follower count and technique content fit, but her audience is women over 40 rather than beginners.',
    seenHoursAgo: 3_600,
  },

  // Intent 0. Cold: no contact, or no post in 90 days.
  {
    id: 'c35', handle: 'bethmarshall', name: 'Beth Marshall',
    bio: 'Lifting, dogs, coffee. Portland.',
    followers: 24_000, er: 0.008, reel: 4_100, ppm: 1, lastPost: 62, country: 'US', language: 'en', email: null,
    signals: [],
    intent: 0, intentWhy: 'No contact and 1 post a month, with the last one 62 days ago.',
    match: 2, matchWhy: 'Niche, audience and follower count fit, but her content is personal rather than technique.',
    seenHoursAgo: 5_500,
  },
  {
    id: 'c36', handle: 'aurelie.petit', name: 'Aurélie Petit',
    bio: 'Sport et bien-être. Nantes.',
    followers: 16_000, er: 0.004, reel: 2_300, ppm: 2, lastPost: 40, country: 'FR', language: 'fr', email: null,
    signals: [],
    intent: 0, intentWhy: 'No contact and 2 posts a month, with the last one 40 days ago.',
    match: 1, matchWhy: 'Follower count and audience fit, but the content is general wellbeing and she posts in French.',
    seenHoursAgo: 8,
  },
  {
    id: 'c37', handle: 'juliabecker.fit', name: 'Julia Becker',
    bio: 'Marathon training log. Frankfurt.',
    followers: 31_000, er: 0.011, reel: 5_600, ppm: 1, lastPost: 104, country: 'DE', language: 'de', email: 'julia.becker@web.de',
    signals: [],
    intent: 0, intentWhy: 'Last post was 104 days ago, so the account looks inactive.',
    match: 0, matchWhy: 'Only the follower count fits. Marathon training is a different niche, audience and format.',
    seenHoursAgo: 7_000,
  },
  {
    id: 'c38', handle: 'rubycollinsfit', name: 'Ruby Collins',
    bio: 'Beginner lifting coach. Technique clips. Adelaide.',
    followers: 52_000, er: 0.015, reel: 11_000, ppm: 2, lastPost: 35, country: 'AU', language: 'en', email: null,
    signals: [],
    intent: 0, intentWhy: 'No contact and 2 posts a month, with the last one 35 days ago.',
    match: 3, matchWhy: 'Bio, audience, follower count and technique content all fit the brief.',
    seenHoursAgo: 4_900,
  },
  {
    id: 'c39', handle: 'erinwalshlifts', name: 'Erin Walsh',
    bio: 'Learning the lifts. Winnipeg.',
    followers: 13_000, er: 0.009, reel: 2_900, ppm: 2, lastPost: 48, country: 'CA', language: 'en', email: null,
    signals: [],
    intent: 0, intentWhy: 'No contact and 2 posts a month, with the last one 48 days ago.',
    match: 1, matchWhy: 'Follower count and country fit, but there is little content and nothing to sell.',
    seenHoursAgo: 6_200,
  },
  {
    id: 'c40', handle: 'siennacole', name: 'Sienna Cole',
    bio: 'Fashion, fitness, and London.',
    followers: 180_000, er: 0.006, reel: 19_000, ppm: 1, lastPost: 95, country: 'UK', language: 'en', email: 'sienna@siennacole.co',
    signals: [],
    intent: 0, intentWhy: 'Last post was 95 days ago, so the account looks inactive.',
    match: 2, matchWhy: 'Audience, follower count and country fit, but fashion content is a different niche.',
    seenHoursAgo: 8_800,
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
  intent: { stars: r.intent, why: r.intentWhy },
  match: { stars: r.match, why: r.matchWhy },
  firstSeenAt: hoursAgo(r.seenHoursAgo),
  lastCrawlAt: hoursAgo(Math.min(r.seenHoursAgo, 6)),
}))
