# jeremylasne.com — Handoff Spec (May 26, 2026)

> **CRITICAL: Do NOT break anything that already works.** Touch ONLY the items listed below. No refactors, no "improvements" to working code. Jeremy is frustrated that previous sessions broke things. Surgical changes only.

All changes target the **unbundled** source files. After editing, run `_rebundle.js` to produce the final `index.html`.

---

## 1. Replace lorem ipsum in The Dock (contact popup)

**File:** `_unbundled/29026d3d-a53b-4b62-aacd-8e9c7c5dc52f.js`  
**Line 528** — replace the paragraph:

```js
// BEFORE
'Lorem ipsum dolor sit amet, consectetur adipiscing elit. The dock is always open. Whether you want to collaborate, share a project, ask a question, or just say hello — drop a line in the bottle and it will find me.',

// AFTER
'The dock is always open. Whether you want to collaborate on a project, share something you are building, ask a question, or just say hello — I read every message. Drop a line and it will find me.',
```

**Line 531** — update email (both label and href):

```js
// BEFORE
cta: { label: 'jeremylasne0@gmail.com', href: 'mailto:jeremylasne0@gmail.com' },

// AFTER
cta: { label: 'hey@jeremylasne.com', href: 'mailto:hey@jeremylasne.com' },
```

---

## 2. Update YouTube link

**File:** `_unbundled/29026d3d-a53b-4b62-aacd-8e9c7c5dc52f.js`  
**Line 502:**

```js
// BEFORE
href: 'https://youtube.com/@jeremylasne',

// AFTER
href: 'https://www.youtube.com/@jeremyfounder',
```

---

## 3. Update TrustViews tagline

**File:** `_unbundled/29026d3d-a53b-4b62-aacd-8e9c7c5dc52f.js`  
**Line 484:**

```js
// BEFORE
tagline: 'trust, verified',

// AFTER
tagline: 'directory ranked on views',
```

---

## 4. Move zone title BELOW the village (not above)

**File:** `_unbundled/6ca7f8cf-df0a-482a-b961-08aeec7304b0.js`  
**Function `ZoneTitleSign` (line 660)** — change position from `top: '6%'` to `bottom`:

```js
// BEFORE (line 663)
position: 'absolute', top: '6%', left: 0, right: 0,

// AFTER
position: 'absolute', bottom: '1%', left: 0, right: 0,
```

Also in the **`SideZone` function (line 779)**, the `<ZoneTitleSign>` is currently rendered after the buildings div. Keep it there but make sure its `zIndex` is high enough to sit on top of the bottom fade band. The current `zIndex: 7` should work since the fade band is `zIndex: 8`. Bump ZoneTitleSign zIndex to **9** to ensure it's visible:

```js
// BEFORE (line 664)
textAlign: 'center', zIndex: 7, pointerEvents: 'none',

// AFTER
textAlign: 'center', zIndex: 9, pointerEvents: 'none',
```

---

## 5. Guarantee building labels are ALWAYS visible

**File:** `index.html` (the CSS inside the `<style>` block) — the `.building-slot .label` class

The labels use `bottom: 100%` (above the building) which can get clipped by the `.village-row`'s `overflow: hidden`. Two changes:

**a)** Remove `overflow: hidden` from `.village-row` in the SideZone function.

**File:** `_unbundled/6ca7f8cf-df0a-482a-b961-08aeec7304b0.js`  
**Line 741:**

```js
// BEFORE
overflow: 'hidden',

// AFTER  — REMOVE this line entirely (or set to 'visible')
overflow: 'visible',
```

**b)** In the CSS (inside `index.html` or the bundled style block), ensure the label has enough `margin-bottom` so it doesn't overlap the building. Current `margin-bottom: 22px` should be sufficient, but verify after the overflow fix that all 4 village labels + 3 founder quarter labels + 3 outskirts labels are fully visible with name AND tagline.

---

## 6. Smooth transition between hero and Projects Village (NO hard cut)

The hero (`ZoneHero`) ends with a sky gradient and the first `SideZone` starts with its own sky gradient. Jeremy wants a seamless blend — no visible seam.

**File:** `_unbundled/72e54a19-2c14-432b-a068-60a9742812b6.js`

**ZoneHero (line 294)** — the hero background ends at `palette.deep`. The first SideZone's `skyTop` is already set to `palette.deep` (line 470). So the colors should match. The issue is likely a hard edge between the two `<section>` elements.

Fix: add a bottom fade on the hero that bleeds into the same color as the village top:

```js
// Inside ZoneHero's return, just before the closing </section> tag (before line 342):
// Add a bottom gradient overlay to smooth the transition
<div aria-hidden="true" style={{
  position: 'absolute',
  bottom: 0, left: 0, right: 0,
  height: 120,
  background: `linear-gradient(180deg, transparent 0%, ${palette.deep} 100%)`,
  zIndex: 6, pointerEvents: 'none',
}} />
```

Also ensure there is **zero margin/padding/gap** between `ZoneHero` and the first `SideZone` in the DOM flow. Check that no CSS `margin` or `padding` on `.zone` creates a visible gap. The `.zone` class currently has no margin/padding in CSS — keep it that way.

---

## 7. Better pixel trees (InlinePine)

**File:** `_unbundled/6ca7f8cf-df0a-482a-b961-08aeec7304b0.js`  
**Function `InlinePine` (line 853)**

Current trees are pure dark silhouettes (`#0a0e1a` / `#070a14` / `#050811`) — almost invisible. Improve them with:

**a)** Richer two-tone palettes that are still dark but have visible detail:

```js
// BEFORE (line 856-860)
const palettes = [
  { '#': '#0a0e1a', '.': '#152038' },
  { '#': '#070a14', '.': '#101a2e' },
  { '#': '#050811', '.': '#0e1626' },
];

// AFTER — still dark silhouettes but with visible foliage tones
const palettes = [
  { '#': '#0f1a12', '.': '#1a3020' },
  { '#': '#0c1610', '.': '#16281c' },
  { '#': '#0a120e', '.': '#132218' },
];
```

These are dark forest greens instead of near-black blues — they'll read as trees rather than voids, while still feeling like nighttime silhouettes.

**b)** Optionally add a subtle drop-shadow glow to make them pop slightly against the dark background. The current `filter` on line 1018 is:

```js
// BEFORE
filter: 'drop-shadow(0 3px 0 rgba(0,0,0,0.45))',

// AFTER — add a very faint green ambient glow
filter: 'drop-shadow(0 3px 0 rgba(0,0,0,0.45)) drop-shadow(0 0 6px rgba(20,40,20,0.3))',
```

**DO NOT** change the tree grid shapes — they're fine. Only touch the colors.

---

## Verification Checklist

After all changes, verify on the live page:

- [ ] Hero scrolls seamlessly into Projects Village (no hard line, no gap)
- [ ] Zone titles ("THE PROJECTS VILLAGE", "THE FOUNDER'S QUARTER", "THE OUTSKIRTS") appear BELOW each village section
- [ ] ALL building labels (name + tagline) are fully visible — not clipped
- [ ] Trees have visible green tones (not pure black voids)
- [ ] The Dock popup shows the new text (no lorem ipsum) with hey@jeremylasne.com
- [ ] YouTube building links to youtube.com/@jeremyfounder
- [ ] TrustViews tagline reads "directory ranked on views"
- [ ] Nothing else changed — hero text, building pixel art, modal styles, animations, audio, walker, all untouched

---

## File Summary

| File | Changes |
|------|---------|
| `_unbundled/29026d3d-...f.js` | Dock text, email, YouTube link, TrustViews tagline |
| `_unbundled/6ca7f8cf-...0.js` | ZoneTitleSign position, village-row overflow, InlinePine colors |
| `_unbundled/72e54a19-...6.js` | Hero bottom fade overlay |

Then rebundle: `node _rebundle.js`
