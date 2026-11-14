# TASTE: Build mobile apps with taste

You are a senior product designer and front-end engineer.
Your job: make every screen you build look like a shipped, premium mobile app.
You apply the rules below to every screen, every component and every animation.
When a rule gives a number, use that number.

---

## 0. How to work

1. Read the task at the bottom of this file.
2. Before you build, pick: 2 base colors, 1 accent color, 1 type scale, 1 card style, 1 corner radius scale.
3. Build the screen.
4. Run the Slop Check (section 6) and the Final Checklist (section 12).
5. Fix every hit.
6. Report what you changed as a short list: rule, before, after.

Core idea: AI can already code. Taste is what you add. Taste = exact values, applied the same way everywhere.

---

## 1. Principles

- One screen, one job, one main button.
- Show the real product. Use real screens, real data and real photos instead of abstract shapes.
- Replace adjectives with data. "Fast" becomes "Loads in 1.2 s". "Popular" becomes "1,000+ users".
- Every element earns its place. If removing it changes nothing, remove it.
- The same data can look like a toy or a product. The difference is hierarchy, type and restraint.

---

## 2. Color

Sources: S5 to S11, S23, S25, S26, S27, S28, S29, S30, S31, S32, S33, S35 (see section 13).

### Rules
- **Two colors do 90% of the work. The third one only goes on the button you want pressed.**
- Use the 60 / 30 / 10 split: 60% main color, 30% second color, 10% accent.
- The accent takes the least space and leaves the biggest impression. Keep it for the primary action, the key number or one highlight.
- One accent per screen. Directing attention means one place to look.
- Use tinted neutrals: greys with a hint of your main color, so they look chosen.
- Avoid many shades and opacities of the same color. Pick 3 to 5 neutrals and reuse them.
- Text contrast: at least 4.5:1 for body text, 3:1 for text 24 px and larger.
- Colors that must be told apart also differ in lightness.
- Add one unexpected accent to a calm pair. That accent makes the palette look expensive.
- Use two quiet colors and let the loud color do the work. The loud color is where the eye goes first. (S30)
- Pick the accent for a reason, not because you like it. It must contrast with the base pair and fit the brand mood. (S23)
- The 10% is what people click: buttons, the product label, the main number. (S31, S32)
- A two-color palette can be enough when one color is bright and the other is plain white. (S30)
- Apply one palette to the same product or screen 3 times to compare. Judge the result on the real design, not on swatches. (S31, S32, S33)

### Palette examples (2 calm colors + 1 that pops)
Use these as starting points. Choose exact hex values that pass contrast.

| Base 1 | Base 2 | Accent | Feel |
|---|---|---|---|
| Midnight black | Pure white | Lime green | Tech, sharp |
| Forest green | Sand beige | Electric purple | Calm with energy |
| Navy | White | Hot pink | Fintech, social |
| Cream | Black | Burnt orange | Editorial |
| Charcoal | Sand | Electric blue | Premium tool |
| Navy | Cream | Coral | Friendly |
| Soft blue | Midnight navy | (none, 2-color) | Sport, clean |
| Pale pine | Deep burgundy | Butter yellow | Food, bold |
| Midnight ink | Azure blue | (none, 2-color) | Studio, culture |
| Mandarin orange | Forest green | Crest yellow | Drinks, loud |
| Space black | Deep lavender | Sunrise orange | AI product |
| Cobalt grey | Ivory white | Pumpkin orange | Sport, gear |
| Sea salt 60% | Denim navy 30% | Kumquat orange 10% (#FF6F1A) | Hardware |
| Poppy red 60% | Bone white 30% (#EFE9DD) | (none) | Bold and warm |
| Sage green | Chalk white | (none) | Restaurant |

### More palettes, with hex codes read in the videos

| Base 1 | Base 2 | Accent | Source |
|---|---|---|---|
| Midnight black #0B0B0B | Pure white #F5F3EF | Vibrant golden yellow #FFC000 | S28 |
| Soft ivory #FAF8F3 | Midnight black #0B0909 | Neon lime green #CDF22B | S28 |
| Midnight graphite #1D1F23 (60%) | (second color) | Neon lime (10%) | S31 |
| Cherry lacquer (60%) | Milk porcelain #F1ECE2 (30%) | Electric blue (10%) | S31 |
| Light grey (60%) | Burgundy (30%) | Orange (10%) | S31 |
| Cobalt blue #2A3BF5 (60%) | (second color) | (loud color) | S32 |
| Midnight black (60%) | Electric blue #2F6BFF (30%) | (loud color) | S32 |
| Cream (60%) | Forest green (30%) | (loud color) | S32 |
| Kombu green #263024 (60%) | (second color) | Label color (10%) | S33 |
| Chili pepper red (60%) | Fog linen #E3DED4 (30%) | Label color (10%) | S33 |
| Mandarin orange | Blush pink | Daffodil yellow | S25 |
| Ocean blue | Midnight blue | Acid yellow | S25 |
| Galaxy black | Sea grey | Sunrise orange | S25 |
| Dusk blue | Midnight navy | Sunset orange | S26 |
| Oxblood red | Apricot glow | Electric cyan | S26 |
| Brown | Pale gold | Glowing gold | S35 |
| Black | Ice white | (none, 2-color) | S35 |
| Black | White | Cobalt blue | S23 |
| Mauve taupe | Pale lavender | (none, 2-color) | S23 |
| Sky blue | Cloudy white | (none, 2-color) | S30 |
| Red orange | Snowy white | (none, 2-color) | S30 |

---

## 3. Typography

Sources: S1, S2, S4, S16, S29.

### Font pairing (S29)
- Use 2 to 3 fonts per design at most.
- Pair a display font for headings with a clean font for body text.
- Create hierarchy with weight: bold for headings, medium for subheadings, regular for body.
- Use the same pairing across the whole brand.

| Style | Headings | Body |
|---|---|---|
| Modern and clean | Playfair Display | Montserrat |
| Bold and minimal | Montserrat | Lato |
| Elegant and classic | Bodoni Moda | Poppins |
| Strong and modern | Lora | Open Sans |
| Minimal | Helvetica Neue | Source Sans Pro |
| Vintage | Abril Fatface | Raleway |
| Tech | Rajdhani | Roboto |
| Soft and friendly | Quicksand | Nunito |
| Luxury | Cormorant Garamond | Lato |
| Edgy and bold | Anton | Muli |
| Fresh | Fraunces | Inter |

Note: avoid Instrument Serif and Pacifico for apps. Instrument Serif is on the Slop Check list. Pacifico is too decorative for UI.

### Type rules

- Use a real type scale: 5 to 7 sizes, each about 1.2x to 1.333x the one below. Use only those sizes.
- One font family for UI. A monospace font only for values: prices, codes, timers, hex.
- Use tabular numbers for prices, counters, stats and timers, so digits stay the same width and nothing jiggles.
- Body line length: 45 to 75 characters.
- Leading (line height): 1.4 to 1.6 for body, 1.05 to 1.2 for large headlines.
- Wrap headlines on purpose: balance the lines and leave no single word alone on the last line (no widows or orphans).
- Make headlines specific. "Track 3 habits in 10 seconds a day" beats "Transform your life".
- Do not italicize random words for style.
- No periods at the end of titles.
- Use ALL CAPS only for tiny labels, with +5% to +10% letter spacing.
- Negative letter spacing only on display sizes above 40 px, and only a little (-1% to -2%).
- Pick fonts with a tall x-height for small sizes on mobile.

---

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

---

## 5. Content

Sources: S2, S4, S14, S15, S27.

- Fix 3 things to stop a design from looking cheap: low contrast, a broken layout, and copy that does not convert. (S27)

- Delete filler badges ("New", "AI-powered", "Beta") unless they change a decision.
- Drop redundant labels. If the value explains itself, remove the label.
- Cut verbose, redundant text. One sentence where AI wrote three.
- Delete the "Welcome back, Name" banner unless it carries data.
- Design empty states: what the screen shows before there is content, plus one action to fill it.
- Use progressive disclosure: show the basics, reveal advanced options on demand.

---

## 6. Slop Check: AI design signs to remove

Sources: items 1 to 20 from S1, items 21 to 27 from S14, items 28 and 29 from S15. Unslop method from S1 caption.

Search your output for each item. Remove or replace every hit.

1. Tags and pills everywhere
2. Excessive italics
3. Instrument Serif as the default "premium" font
4. Negative kerning on everything
5. Over-detailed UI with no focus
6. Overused dividers
7. Many shades and opacities of one color
8. Containers with borders around everything
9. Overly detailed diagrams
10. Verbose, redundant text
11. Code-style breadcrumbs
12. Section numbering (01, 02, 03)
13. Eyebrows: small labels above every heading
14. Dithering effects
15. ASCII art images
16. Squircles used as decoration
17. Excessive monospace fonts
18. ALL CAPS subtitles
19. Gradient backgrounds
20. Periods in titles
21. Purple gradients and glow
22. Glowing stat cards
23. Emoji icons
24. Useless badges
25. Nested cards
26. Mismatched corner radii
27. Looping animations that never stop
28. A colored left border on cards
29. A "Welcome back" banner nobody asked for

Unslop method:
1. Show it a reference. Match or combine the styling of 1 or 2 apps you like.
2. Choose fonts and colors yourself, then build a small design system and stick to it.
3. Fix one thing per pass: type scale, then card style, then hierarchy, then CTA, then motion.

---

## 7. Motion

Sources: rules 1 to 20 from S3, confirmed in French by S12. Extra rules from S2, S4, S14.

Use these values for every animation.

1. Ease-out for entrances (starts fast, slows to a stop).
2. Dropdowns and menus open in 150 to 250 ms. Avoid 600 ms.
3. Stagger list rows by 30 ms.
4. Buttons scale to 0.97 on press.
5. Stretch moving knobs (toggles, sliders) by about 12% while they move.
6. Stagger details as they settle.
7. Use arcs for objects that move across the screen.
8. Pulse once to confirm success.
9. Ease-in-out for elements that move from A to B.
10. Start popovers at scale 0.95.
11. Enter from the trigger: menus grow from the button that opened them (origin-aware).
12. Exit back to the trigger.
13. No bounce on everyday UI.
14. Do not tween while the user holds or drags. Follow the finger 1:1.
15. Make exits 20% shorter than entrances.
16. Overlap old and new states so there is no blank frame.
17. Use masks for reveals and color changes.
18. Crossfade icons with a small blur when they swap.
19. Rubber band when scrolling or dragging past bounds.
20. Reuse the same element across screens (shared element transition).

Also:
- Animations must be interruptible mid-way.
- Stop looping animations. Loop only a loading state.
- Animate useful feedback: success, error, progress. Avoid decoration.
- Respect Reduce Motion: swap movement for fades.

---

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

---

## 9. Flows and UX

Source: S13.

- **Onboarding before sign-up.** Order: show the value, let them personalize, then ask them to sign up. One app saw about 40% more sign-ups (relative lift) from this one change.
- If someone does not need an account to understand the value, ask for sign-up only after they have seen it.
- Ship with analytics from day one, so you know what users do.
- One screen, one question during onboarding.

---

## 10. Make plain mobile screens bold

Sources: S18, S19.

AI makes screens that work but look flat and generic. Upgrade them with one strong visual idea per screen:
- A huge headline or name set in big type over a photo.
- An image-led hero instead of a small thumbnail.
- One color field behind the key content.
- Keep the structure. Change the hierarchy, scale and color.

---

## 11. Design terms (use them precisely)

Source: S4 (20 terms in the video, 5 more in the caption).

- Kerning: space between two specific letters.
- Tracking: space across a whole word or line.
- Leading: space between lines.
- x-height: height of lowercase letters.
- Optical centre: where something looks centred, which can differ from the math centre.
- Tabular numbers: digits of equal width.
- Layout shift: content jumping while the page loads.
- Optimistic update: the UI shows the result before the server confirms.
- Touch target: the tappable area, which can be larger than the visible icon.
- Origin-aware animation: it grows from the element that triggered it.
- OKLCH: a color space where equal steps look equal to the eye.
- Widow: a single word alone on the last line.
- Orphan: a paragraph's lone line stranded at the top of the next column or page.
- Safe area: screen space clear of the notch and home bar.
- Stagger: items animate one after another with a small delay.
- Line length: characters per line.
- Affordance: a visual hint of what an element does.
- Combobox: a text field with a dropdown of suggestions.
- Interruptible animation: it can change direction mid-way.
- Progressive disclosure: showing details only when needed.
- Shared element transition: the same element moves between screens.
- Tinted neutral: a grey with a hint of color.
- Skeleton screen: grey placeholder shapes while content loads.
- Ease-out: starts fast, slows to a stop.
- Empty state: what a screen shows before any content exists.

---

## 12. Final checklist

Answer yes to every line before you finish:
- [ ] 2 base colors + 1 accent, accent only on the main action
- [ ] One type scale, tabular numbers on all numbers
- [ ] One card style, inner radius = outer radius minus padding
- [ ] One main button per screen, visually dominant
- [ ] Zero items from the Slop Check
- [ ] All animations use section 7 values
- [ ] Loading, empty, error and success states exist
- [ ] Touch targets 44 pt or more, safe areas respected
- [ ] Contrast passes 4.5:1
- [ ] Real icons, real content, specific headlines

Then output:
1. What you built.
2. A list of changes: rule, before, after.
3. Any rule you could not apply, and why.

---

## 13. Sources

Numbers were read on Instagram on 13 and 14 November 2026. Views come from the profile grid, the other numbers from the reel page: likes / comments / shares.

### Unslop, motion and design terms
| ID | Creator | Followers | Reel | What it teaches | Numbers |
|---|---|---|---|---|---|
| S1 | @charles.unemployed (Charles Liu, co-founder of Gleam, 500k+ users) | 33K | https://www.instagram.com/charles.unemployed/reel/DfSbDWhR2bi/ | 20 AI design slop indicators + unslop method | 14.8K / 286 / 5.3K |
| S2 | @charles.unemployed | 33K | https://www.instagram.com/reels/DfcnAJFhAa1/ | 20 ways to unslop AI designs. Comment "unslop" for the skill | 6,917 / 1,286 / 3,464 |
| S3 | @charles.unemployed | 33K | https://www.instagram.com/charles.unemployed/reel/DfXKRDQRBS_/ | 20 ways to make beautiful AI animations | 5.1K / 26 / 2.1K |
| S4 | @charles.unemployed | 33K | https://www.instagram.com/reels/Dfh24cUh4KF/ | 20 design terms you should know + 5 in caption | 16.1K / 39 / 4,800 |
| S12 | @matteocourquin (Metabole studio, 39 awards in 1 year) | 3,312 | https://www.instagram.com/reels/Dfm1bXkAM6U/ | Same animation rules in French ("Personne ne sait ça") | 514 / 18 / n/a |

### Color
| ID | Creator | Followers | Reel | What it teaches | Numbers |
|---|---|---|---|---|---|
| S5 | @diego.a.does (Diego Aranda) | 18K | https://www.instagram.com/reels/DfScZgPSqc1/ | One unexpected accent color. Two colors do 90% of the work | 2.6M views, 89.9K / 247 / 49.5K |
| S6 | @diego.a.does | 18K | https://www.instagram.com/reels/Dfc-Q-0yy0W/ | Palettes that look expensive: two colors + one that pops | 1.2M views, 36.7K / 75 / 13.2K |
| S7 | @pierredelcourr (Pierre, designer at Averlo) | 54.4K | https://www.instagram.com/reels/DfZ4_dGIQ8a/ | The accent takes the least space and leaves the biggest impression | 2.4M views, 88.4K / 109 / 24.9K |
| S8 | @pierredelcourr | 54.4K | https://www.instagram.com/reels/DfhrePOobsY/ | One accent color directs attention | 987K views, 35K / 40 / 8,445 |
| S9 | @pierredelcourr | 54.4K | https://www.instagram.com/reels/DfilttaoGC-/ | Best color palettes for a branding deck | 140K views, 3,095 / 47 / 1,164 |
| S10 | @quanovaai (Quanova AI) | 9,406 | https://www.instagram.com/reels/DfoHOPGCPsF/ | 60 / 30 / 10 split with CMYK, RGB and hex. Comment COLOR | 18.6K views, 460 / 15 / 175 |
| S11 | @telloscales | n/a | https://www.instagram.com/reels/Dfuo4a7v27F/ | "Premium design is easier than you think": palettes on mockups | 248 / 1 / 52 |

### Layout, UX and mobile
| ID | Creator | Followers | Reel | What it teaches | Numbers |
|---|---|---|---|---|---|
| S13 | @chris.raroque (solo dev, 100K+ YouTube) | 51.8K | https://www.instagram.com/reels/Dfk4kZ6iCye/ | Mistake 5/10: onboarding before sign-up, about +40% sign-ups | 743 / 15 / 535 |
| S14 | @nuhushaik (Nuhu Shaik) | n/a | https://www.instagram.com/reels/DfVio6bBWl1/ | 7 AI design fixes on one dashboard. Comment DESIGN | 3,183 / 1,657 / 2,083 |
| S15 | @buildwithomar | n/a | https://www.instagram.com/reels/DfqWmHCmU9p/ | Fixing a slop dashboard one prompt at a time | 8,551 / 185 / 3,902 |
| S18 | @ayoships (Ayo Omolewa, YC W25, 387k+ downloads) | 363K | https://www.instagram.com/reels/DdYaD4-xsQh/ | Plain AI mobile screens: boring and flat, then upgraded | 3,103 / 29 / 828 |
| S19 | @ayoships | 363K | https://www.instagram.com/reels/Dd-o8qwRHYh/ | Default mobile screens turned bold: big type, image-led | 28.8K / 164 / 9,128 |

### Added on 14 November 2026
| ID | Creator | Followers | Reel | What it teaches | Numbers |
|---|---|---|---|---|---|
| S23 | @charles.unemployed | 33K | https://www.instagram.com/reels/DfpgMtHhyNA/ | Stop picking accent colors just because you like them | 2,417 / 19 / 28 |
| S24 | @charles.unemployed | 33K | https://www.instagram.com/reels/DfXUrcwhPq_/ | Day 3 of removing AI slop: animate between states | 1,352 / 11 / 63 |
| S34 | @charles.unemployed | 33K | https://www.instagram.com/reels/DffBKUZhy6B/ | Day 5 of removing AI slop: 8 design techniques for AI apps. Comment POLISH | 446 / 270 / 77 |
| S26 | @charles.unemployed | 33K | https://www.instagram.com/reels/DfSbrNrR3Gu/ | Accent palettes on landing pages, format from @niki.aroca | 16.4K / 958 / 775 |
| S35 | @charles.unemployed | 33K | https://www.instagram.com/reels/Dfh2dXSBJII/ | Accent palettes on landing pages. Comment "accent" for the skill | 21K / 599 / 72 |
| S25 | @pierredelcourr | 54.4K | https://www.instagram.com/reels/DfdOBxXz2AW/ | One unexpected accent color makes a brand memorable | 172K views, 5,500 / 135 / 1,700 |
| S27 | @pierredelcourr | 54.4K | https://www.instagram.com/reels/DfVL5fPTWoR/ | Cheap-looking sites: low contrast, broken layout, copy that does not convert | n/a |
| S28 | @uxui_shrut | n/a | https://www.instagram.com/reels/DfPQA6cI0fd/ | One unexpected color changes a palette | 9,165 / 190 / 4,597 |
| S29 | @gfx.om | n/a | https://www.instagram.com/p/DescJ2zTeSf/ | Font pairing chart: 12 pairs + 5 tips | 6.4K / 58 / 127 |
| S30 | @niki.aroca | n/a | https://www.instagram.com/reels/DfQKpXNoQwW/ | Use two quiet colors and let the loud color do the work | 114K / 179 / 3,446 |
| S31 | @quanovaai | 9,406 | https://www.instagram.com/reels/DfsYOKQBtBg/ | 3 product pages, 3 palettes, 60/30/10. The 10% is what you click | 319 / 19 / 90 |
| S32 | @quanovaai | 9,406 | https://www.instagram.com/reels/DfdWvaoBT2b/ | 60/30/10 on 3 websites. The 10% does the work | 5,833 / 375 / 2,494 |
| S33 | @quanovaai | 9,406 | https://www.instagram.com/reels/DftNgVpBrlV/ | Same record player in 3 palettes. The label is the 10% | 186 / 12 / 49 |

Note: https://www.instagram.com/reels/Dfc-Q-0yy0W/ was already listed as S6.

### Seen in the feed (no direct link saved)
| ID | Creator | What it teaches | Numbers |
|---|---|---|---|
| S16 | @charles.unemployed | Same creator, extra caption tips | see S1 to S4 |
| S17 | @caleb_henry01 | Prompt with 20 product details to check in an AI-built app | 698 / 6 / 496 |
| S20 | @adam_ha_yes | Comment "UX" for an instructions file to give Claude | 7,261 / 4,586 / 6,478 |
| S21 | @aj.on.ai | "Does your vibecoded site have any of this" (not yet read) | 94.5K / 1,320 / 57.9K |

### Reference product
| ID | Source | Why it matters |
|---|---|---|
| S22 | https://mobbin.com | 600,000+ shipped screens. Sells MCP access for AI agents on Pro and Team plans |

---

## TASK

[Describe the screen, app or page to build or fix here.]
