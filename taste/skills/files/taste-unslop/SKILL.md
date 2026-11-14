---
name: taste-unslop
description: "The 29-item Slop Check of AI design signs, the unslop method, content cuts and the final checklist. Use when reviewing, auditing or polishing a screen an AI built, or before shipping any UI."
---

# TASTE: Unslop

Apply these rules to every screen, component and animation you build. When a rule gives a number, use that number.
Part of the tasu.ai taste skill. The full file: https://www.jeremylasne.com/taste/taste.md

## 5. Content

Sources: S2, S4, S14, S15, S27.

- Fix 3 things to stop a design from looking cheap: low contrast, a broken layout, and copy that does not convert. (S27)

- Delete filler badges ("New", "AI-powered", "Beta") unless they change a decision.
- Drop redundant labels. If the value explains itself, remove the label.
- Cut verbose, redundant text. One sentence where AI wrote three.
- Delete the "Welcome back, Name" banner unless it carries data.
- Design empty states: what the screen shows before there is content, plus one action to fill it.
- Use progressive disclosure: show the basics, reveal advanced options on demand.

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

## Sources

Numbers were read on Instagram on 13 and 14 November 2026: likes / comments / shares, views where given.

- **S1** @charles.unemployed (Charles Liu, co-founder of Gleam, 500k+ users): 20 AI design slop indicators + unslop method. Reel: https://www.instagram.com/charles.unemployed/reel/DfSbDWhR2bi/ (14.8K / 286 / 5.3K)
- **S2** @charles.unemployed: 20 ways to unslop AI designs. Comment "unslop" for the skill. Reel: https://www.instagram.com/reels/DfcnAJFhAa1/ (6,917 / 1,286 / 3,464)
- **S4** @charles.unemployed: 20 design terms you should know + 5 in caption. Reel: https://www.instagram.com/reels/Dfh24cUh4KF/ (16.1K / 39 / 4,800)
- **S14** @nuhushaik (Nuhu Shaik): 7 AI design fixes on one dashboard. Comment DESIGN. Reel: https://www.instagram.com/reels/DfVio6bBWl1/ (3,183 / 1,657 / 2,083)
- **S15** @buildwithomar: Fixing a slop dashboard one prompt at a time. Reel: https://www.instagram.com/reels/DfqWmHCmU9p/ (8,551 / 185 / 3,902)
- **S27** @pierredelcourr: Cheap-looking sites: low contrast, broken layout, copy that does not convert. Reel: https://www.instagram.com/reels/DfVL5fPTWoR/
