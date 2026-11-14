---
name: taste-layout
description: "Layout and hierarchy rules for app screens: one main button, spacing groups on a 4 or 8 pt scale, one card style, inner radius = outer minus padding, 44 pt touch targets, bold mobile screens. Use when laying out or restructuring a screen."
---

# TASTE: Layout

Apply these rules to every screen, component and animation you build. When a rule gives a number, use that number.
Part of the tasu.ai taste skill. The full file: https://www.jeremylasne.com/taste/taste.md

## 1. Principles

- One screen, one job, one main button.
- Show the real product. Use real screens, real data and real photos instead of abstract shapes.
- Replace adjectives with data. "Fast" becomes "Loads in 1.2 s". "Popular" becomes "1,000+ users".
- Every element earns its place. If removing it changes nothing, remove it.
- The same data can look like a toy or a product. The difference is hierarchy, type and restraint.

## 4. Layout and hierarchy

Sources: S2, S14, S15, S16.

- Group with spacing first. Related items sit close together. Groups sit far apart. Use a 4 or 8 pt spacing scale.
- Flatten nested cards. Avoid a card inside a card inside a card.
- One card style for the whole app: same radius, same padding, same shadow or border.
- **Inner radius = outer radius minus padding.** Example: card radius 24, padding 8, inner button radius 16.
- Match corner radii across elements of the same level. Use smooth continuous corners (squircle style) on iOS.
- Enlarge the main feature. The most important thing on the screen is the biggest thing.
- Emphasize the CTA. One filled primary button, everything else secondary or text.
- Put the main actions at the top of the hierarchy, where the eye lands first.
- Align by eye, not just by pixels. Use optical centre: play icons, arrows and triangles shift slightly to look centred.
- Respect safe areas: notch, Dynamic Island, home bar.
- Touch targets: at least 44 x 44 pt, larger than the icon itself.
- Keep icons consistent: one icon set, one stroke width, one size grid.
- Use real icons. Replace every emoji used as an icon.

## 10. Make plain mobile screens bold

Sources: S18, S19.

AI makes screens that work but look flat and generic. Upgrade them with one strong visual idea per screen:
- A huge headline or name set in big type over a photo.
- An image-led hero instead of a small thumbnail.
- One color field behind the key content.
- Keep the structure. Change the hierarchy, scale and color.

## Sources

Numbers were read on Instagram on 13 and 14 November 2026: likes / comments / shares, views where given.

- **S2** @charles.unemployed: 20 ways to unslop AI designs. Comment "unslop" for the skill. Reel: https://www.instagram.com/reels/DfcnAJFhAa1/ (6,917 / 1,286 / 3,464)
- **S14** @nuhushaik (Nuhu Shaik): 7 AI design fixes on one dashboard. Comment DESIGN. Reel: https://www.instagram.com/reels/DfVio6bBWl1/ (3,183 / 1,657 / 2,083)
- **S15** @buildwithomar: Fixing a slop dashboard one prompt at a time. Reel: https://www.instagram.com/reels/DfqWmHCmU9p/ (8,551 / 185 / 3,902)
- **S16** @charles.unemployed: Same creator, extra caption tips. (see S1 to S4)
- **S18** @ayoships (Ayo Omolewa, YC W25, 387k+ downloads): Plain AI mobile screens: boring and flat, then upgraded. Reel: https://www.instagram.com/reels/DdYaD4-xsQh/ (3,103 / 29 / 828)
- **S19** @ayoships: Default mobile screens turned bold: big type, image-led. Reel: https://www.instagram.com/reels/Dd-o8qwRHYh/ (28.8K / 164 / 9,128)
