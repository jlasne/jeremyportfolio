---
name: taste-states
description: "States and details for app screens: skeletons, optimistic updates, undo toasts, no layout shift, loading, empty, error and success states, AI chat patterns, onboarding before sign-up. Use when building lists, forms, AI screens or flows."
---

# TASTE: States

Apply these rules to every screen, component and animation you build. When a rule gives a number, use that number.
Part of the tasu.ai taste skill. The full file: https://www.jeremylasne.com/taste/taste.md

## 8. States and details

Sources: S4, S17, S24, S34.

### AI and chat screens (S24, S34)
- Animate between states, so a change of state never jumps. (S24)
- Recognition over recall: give people a few prompts to tap instead of an empty chat box.
- Film grain: add light noise over gradients. It removes banding stripes and looks less digital.
- Labor illusion: show the work behind a result, like a step-by-step tracker. People trust it more.
- Origin-aware popups: each popup grows out of what was tapped. Each citation opens from its number.
- Layout stability: reserve space for each paragraph first, then let the words fill in.
- Brushing and linking: hovering one item lights up everything connected to it.
- Human in the loop: the AI suggests, then asks before it changes the user's data.
- Optimistic update: show the result right away and sync in the background, like a heart that fills the second you tap it.

### Every screen

Check every screen for these:

1. Skeleton screens instead of spinners: grey shapes that hold the layout while content loads.
2. Optimistic updates: the UI changes before the server answers.
3. No layout shift: reserve space for images and async content.
4. Undo toasts instead of "Are you sure?" pop-ups.
5. Show cached data first, refresh in the background.
6. Blurred image placeholders while images load.
7. Swipe-to-dismiss sheets.
8. Predictive back gestures.
9. One-time code autofill on login.
10. Tabular numbers on prices and counters.
11. Balanced headlines.
12. A double tap never charges twice.
13. Loading, empty, error and success states for every list and form.

## 9. Flows and UX

Source: S13.

- **Onboarding before sign-up.** Order: show the value, let them personalize, then ask them to sign up. One app saw about 40% more sign-ups (relative lift) from this one change.
- If someone does not need an account to understand the value, ask for sign-up only after they have seen it.
- Ship with analytics from day one, so you know what users do.
- One screen, one question during onboarding.

## Sources

Numbers were read on Instagram on 13 and 14 November 2026: likes / comments / shares, views where given.

- **S4** @charles.unemployed: 20 design terms you should know + 5 in caption. Reel: https://www.instagram.com/reels/Dfh24cUh4KF/ (16.1K / 39 / 4,800)
- **S13** @chris.raroque (solo dev, 100K+ YouTube): Mistake 5/10: onboarding before sign-up, about +40% sign-ups. Reel: https://www.instagram.com/reels/Dfk4kZ6iCye/ (743 / 15 / 535)
- **S17** @caleb_henry01: Prompt with 20 product details to check in an AI-built app. (698 / 6 / 496)
- **S24** @charles.unemployed: Day 3 of removing AI slop: animate between states. Reel: https://www.instagram.com/reels/DfXUrcwhPq_/ (1,352 / 11 / 63)
- **S34** @charles.unemployed: Day 5 of removing AI slop: 8 design techniques for AI apps. Comment POLISH. Reel: https://www.instagram.com/reels/DffBKUZhy6B/ (446 / 270 / 77)
