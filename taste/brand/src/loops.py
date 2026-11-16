"""tasu.ai loops: 4 small animations of Tasu, 6 frames each, drawn in code like the rest of the kit.
A loop may play a frame more than once (its order): the blink comes twice, the hop is a double hop.

usage: python3 -B src/loops.py <brandDir>
Writes to brandDir/loops:
  taste.svg, blink.svg, look.svg, happy.svg   sprite sheets, the 6 frames side by side
  taste-1.svg ... happy-1.svg                 frame 1 alone, the still fallback
  loops.css                                   .tasu-loop and one modifier per loop, timed by the ms lists
  wordmark.svg, wordmark-dark.svg             the lockup's wordmark alone, grey and cream
  preview.html                                every loop at its real size, cream and #1C1B19 (noindex)

Rules: the 3 colors plus opacity, each line keeps its weight in every frame (squash and stretch move the
geometry, never a scale transform), the body stays anchored, mint on the tongue only (and the hero's
selection mark), and frame 6 leads back into frame 1. Every mouth uses the kit's construction from
geom.py: the tongue grows out of the smile with tangent joins, at any length and tilt.
Each frame cell keeps clear padding at its sides, so at any display size no neighbour frame bleeds in.
Output is deterministic: running it twice gives byte-identical files.
"""
import os
import sys

# brand.py reads quick overrides from the environment variable P, and they become its default arguments.
# The loops always draw with the kit's own defaults, so a stray P in the shell cannot change them.
os.environ.pop("P", None)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import brand as B  # noqa: E402
from geom import CREAM, DARK, GREY, f, f2  # noqa: E402

FRAMES = 6

# ------------------------------------------------------------------ shared drawing helpers


def mochi_pts(cx, top, wide_y, bottom, a, kt=0.56, kr=0.58, kb=0.88, kbx=0.84):
    """The control points of geom.mochi: start point, then 4 cubic segments of 3 points each."""
    ht, hb = wide_y - top, bottom - wide_y
    R, L = cx + a, cx - a
    return [(cx, top),
            (cx + kt * a, top), (R, wide_y - kr * ht), (R, wide_y),
            (R, wide_y + kb * hb), (cx + kbx * a, bottom), (cx, bottom),
            (cx - kbx * a, bottom), (L, wide_y + kb * hb), (L, wide_y),
            (L, wide_y - kr * ht), (cx - kt * a, top), (cx, top)]


def mochi_lean(cx, top, wide_y, bottom, a, lean=0.0):
    """geom.mochi, sheared: each point moves sideways by lean x its height above the seat, over the full
    height. The seat stays put and the dome leans. The shear moves control points, not the stroke, so
    the outline keeps one weight. lean = 0 gives geom.mochi's path, byte for byte."""
    P = [(x + lean * (bottom - y) / (bottom - top), y) for x, y in mochi_pts(cx, top, wide_y, bottom, a)]
    d = f"M{f(P[0][0])} {f(P[0][1])}"
    for i in range(1, 13, 3):
        d += "C" + " ".join(f"{f(x)} {f(y)}" for x, y in P[i:i + 3])
    return d + "Z"


def lean_at(y, top, bottom, lean):
    """Sideways shift of the sheared body at height y."""
    return lean * (bottom - y) / (bottom - top)


def lid_eye(ex, ey, er, o, shine=0.27):
    """An eye in a blink, open by o (0 to 1). The upper lid travels 4 times as far as the lower one, so
    the eye is an egg: a round bottom under a flatter top, the lid. Both halves are half ellipses that
    meet with vertical tangents, so the outline stays smooth. The shine stays below the lid."""
    top = ey - er + 2 * er * (1 - o) * .8
    bot = ey + er - 2 * er * (1 - o) * .2
    ryb = (bot - top) / (1.5 + .5 * o)
    ryt = ryb * (.5 + .5 * o)
    ym = bot - ryb
    g = (f'<path d="M{f(ex - er)} {f(ym)}A{f(er)} {f(ryb)} 0 0 0 {f(ex + er)} {f(ym)}'
         f'A{f(er)} {f(ryt)} 0 0 0 {f(ex - er)} {f(ym)}Z" fill="{GREY}"/>')
    if shine and o >= .6:
        sr = er * shine * .85
        cy = max(ey - er * .38, top + sr + er * .08)
        g += f'<circle cx="{f(ex + er * .36)}" cy="{f(cy)}" r="{f(sr)}" fill="{CREAM}"/>'
    return g


def shut_eye(ex, ey, er, sw):
    """A closed eye in a blink: the lids meet in a soft line that dips a little, clear of the smile."""
    w, y0, d = er * .86, ey + er * .1, er * .3
    return (f'<path d="M{f(ex - w)} {f(y0)}Q{f(ex)} {f(y0 + d)} {f(ex + w)} {f(y0)}" fill="none" stroke="{GREY}" '
            f'stroke-width="{f(sw)}" stroke-linecap="round"/>')


def blink_eyes(fx, fy, k, o, sw, shift=(0, 0)):
    """Both eyes at openness o: open dots (eyes_open), lids on the way, or shut."""
    if o >= 1:
        return B.eyes_open(fx, fy, k, .27, shift)
    er, edx = 29 * k, 74 * k
    xs = [fx + sx * edx + dx for sx, dx in zip((-1, 1), shift)]
    if o <= 0:
        return "".join(shut_eye(x, fy, er, sw) for x in xs)
    return "".join(lid_eye(x, fy, er, o) for x in xs)


# ------------------------------------------------------------------ 1. taste (home hero)
# Tasu tastes the paywall card. After a long rest, the tongue pulls in, reaches out to the right, licks right
# to left on the picked plan with a squish of the body, slurps back and settles. Eyes stay shut in delight.
# Frame 1 is hero.svg (tip 68). The card never moves. In frame 3 the face leans 1.5 units into the reach, so the head
# drives the lick. From frame 3 to 4 the tip sweeps 19 units left and 10 down.
# Each tongue end meets the card's cream parts (the picked row's strokes, the plan's bar) cleanly: it stays 2 units
# or more clear of a part, or cuts through it with its end 3.4 units or more past the far edge. One exception:
# frame 6 ends 1.5 units above the bar. The outline is grey on the grey card, so the mint still ends 5.5 units above it.
# The outline meets the card's top edge on its straight sides, 1.9 units or more above the tip arc.
TASTE = [
    {},                                                                            # 1 rest: hero.svg, held
    dict(top=12.8, a=97.3, dy=-1, tip=56, eh=8.4),                                  # 2 pulls in, tip 11 inside the card
    dict(top=13.5, a=97.6, dx=1.5, dy=-.4, tip=72, tilt=-13, eh=7.9),               # 3 reaches right, the face leans in
    dict(top=17, wide=107.6, a=100.6, dy=2.2, tip=79, tilt=7, eh=6.2, ew=11.8),     # 4 the lick, left, squish
    dict(top=13, wide=105.6, a=97.4, dy=-.8, tip=58, tilt=-2, eh=8.6),              # 5 slurps back, eyes squeeze
    dict(top=14.4, wide=106.2, a=98.3, dy=.3, tip=70, eh=7.3),                      # 6 settles, 2 past the rest
]


def taste_frame(pose):
    if not pose:
        return B.hero_inner()
    pose = dict(pose)
    pose.setdefault("spread", 28 * pose.get("a", 98) / 98)
    return B.hero_inner(**pose)


# ------------------------------------------------------------------ 2. blink (header icon)
# The 512 icon: a plain blink, then 2.1 s later a blink with a tongue wag, so the blinks come 2.1 s and 3.9 s
# apart and never tick like a metronome. Frame 1 is icon.svg. The wag swings 15 and 13 degrees, so at the
# 32 px header size the centre of the tongue's round end travels 1.4 px, enough to read as a wag.
# Each frame sits in icon.svg's own 512 viewport, which clips the tile's soft edge exactly as icon.svg does.
# The mouths of frames 2 to 6 use 2 decimals: each fillet touches the smile's lower edge 0.007 to 0.014 units
# inside the stroke, with its tangent within 0.04 degrees.
BLINK = [
    {},                                        # 1 rest: icon.svg
    dict(o=.45),                               # 2 the lids come down (and go up again in the plain blink)
    dict(o=0, tilt=-4, tip=95),                # 3 shut, the tongue starts to swing
    dict(o=.7, tilt=15, tip=99),               # 4 opening, the tongue swings out
    dict(o=1, tilt=-13, tip=99),               # 5 open, the tongue swings back
    dict(o=1, tilt=6, tip=95),                 # 6 settles
]
FX, FY, FK = 256, 300, 1.08
ICON_VP = '<svg width="512" height="512" viewBox="0 0 512 512">'


def blink_frame(pose):
    if not pose:
        return ICON_VP + B.icon_inner() + "</svg>"
    eyes = blink_eyes(FX, FY, FK, pose.get("o", 1), 16 * FK)
    mouth = B.mouth_filled(FX, FY, FK, tip=pose.get("tip", 93), tilt=pose.get("tilt", 0), fmt=f2)
    return ICON_VP + f'<path d="{B.TILE}" fill="{GREY}"/><path d="{B.BODY}" fill="{CREAM}"/>' + eyes + mouth + "</svg>"


# ------------------------------------------------------------------ line-style mochi (look, happy)
# The icon's mochi without the tile, in the touch icon's line style: cream body, grey outline 16,
# the mouth line 12. It reads on cream and on #1C1B19.
BSW, MSW, ESW = 16, 12, 14  # body outline, mouth line, eye lines
BODY0 = dict(top=104, wide=316, bottom=436, a=198)


def line_body(top=104, wide=316, bottom=436, a=198, lean=0.0, cx=256):
    return (f'<path d="{mochi_lean(cx, top, wide, bottom, a, lean)}" fill="{CREAM}" stroke="{GREY}" '
            f'stroke-width="{f(BSW)}" stroke-linejoin="round"/>')


# ------------------------------------------------------------------ 3. look (empty search state)
# Tasu looks left, then right, then back, with a small head tilt, as if searching. The seat stays put:
# the dome leans and perks up at each side, the face turns toward the look, and the tongue trails.
LOOK = [
    dict(u=0, tilt=0, lean=0, tt=0, bob=0),             # 1 rest, held
    dict(u=-.65, tilt=-3, lean=-15, tt=-7, bob=-3),     # 2 turning left, the tongue trails
    dict(u=-1, tilt=-5, lean=-24, tt=2, bob=-6),        # 3 looks left, perked up, held
    dict(u=.1, tilt=1, lean=3, tt=9, bob=4, o=0),       # 4 swings through the middle, dips, blinks
    dict(u=1, tilt=5, lean=24, tt=-2, bob=-6),          # 5 looks right, perked up, held
    dict(u=.3, tilt=1.5, lean=7, tt=-4, bob=-2),        # 6 coming back, the tongue trails
]


def look_frame(pose):
    """bob > 0 lowers the dome (a small squash), bob < 0 lifts it (Tasu perks up). The seat stays put."""
    u, tilt, lean, tt, bob, o = pose["u"], pose["tilt"], pose["lean"], pose["tt"], pose["bob"], pose.get("o", 1)
    top0, wide0, bottom, a0 = BODY0["top"], BODY0["wide"], BODY0["bottom"], BODY0["a"]
    top = top0 + bob
    wide = bottom - (bottom - wide0) * (bottom - top) / (bottom - top0)
    fy = bottom - (bottom - FY) * (bottom - top) / (bottom - top0)
    base = FX + lean_at(fy, top, bottom, lean)
    # the face turns: the far eye slides 29 units, the mouth 28 and the eye on the side of the look 27, so the
    # near eye keeps 8.6 units of cream from the smile's end (9.4 at rest)
    near, far = 27 * u, 29 * u
    shift = (near, far) if u < 0 else (far, near)
    mx = base + 28 * u
    g0, g1 = B.turn(tilt, (mx, fy + 30))
    return (line_body(top, wide, bottom, a0 + .3 * bob, lean) + g0 + blink_eyes(base, fy, FK, o, ESW, shift)
            + B.line_mouth(mx, fy, FK, MSW, tilt=tt, fmt=f2) + g1)


# ------------------------------------------------------------------ 4. happy (closing "Follow on X")
# A double hop with squash and stretch, eyes shut in delight, the tongue bouncing. Each hop is crouch, take-off,
# top, fall, then the landing, which reuses the crouch (frame 2). The first landing is also the second hop's
# crouch. After the second landing comes a small rebound on the ground (frame 6), so the hop settles into the
# rest with a jiggle instead of a snap. Squash and stretch change the body's height and width around its seat
# with h * w close to 1, so the drawn body keeps its area within 1.5%. The face rides at the square root of the
# squash, a little higher than the body, so the tongue's outline ends 16.7 units or more above the seat.
# The seat rises 18, 46 and 20 units at take-off, top and fall, so the head peaks at the top of the hop, 1.4 units
# above the stretched take-off, and the outline rises and falls in one arc.
HAPPY = [
    dict(h=1, w=1, up=0, tip=96),              # 1 rest, held
    dict(h=.9, w=1.1, up=0, tip=91),           # 2 crouch, and each landing; the tongue squashes too
    dict(h=1.08, w=.93, up=18, tip=102),       # 3 take-off, stretched, the tongue trails
    dict(h=1, w=1, up=46, tip=87),             # 4 top of the hop, the head at its highest, the tongue floats up
    dict(h=1.05, w=.95, up=20, tip=86),        # 5 falls, stretched
    dict(h=1.04, w=.962, up=0, tip=99),        # 6 rebound on the ground; the tongue overshoots and lands late
]


def happy_frame(pose):
    h, w, up, tip = pose["h"], pose["w"], pose["up"], pose["tip"]
    top0, wide0, bottom0, a0 = BODY0["top"], BODY0["wide"], BODY0["bottom"], BODY0["a"]
    bottom = bottom0 - up
    top = bottom - (bottom0 - top0) * h
    wide = bottom - (bottom0 - wide0) * h
    fy = bottom - (bottom0 - FY) * h ** .5
    edx = 74 * FK * w
    eyes = "".join(B.happy_eye(FX + sx * edx, fy - 8 * h, 24 * w, 16 * h, ESW) for sx in (-1, 1))
    return line_body(top, wide, bottom, a0 * w) + eyes + B.line_mouth(FX, fy, FK, MSW, tip=tip, fmt=f2)


# ------------------------------------------------------------------ the loops
# cell = the viewBox of one frame (x, y, w, h). order = the frames played in turn (0 = frame 1), when a loop shows
# a frame more than once; without it, frames 1 to 6 play once each. ms = how long each step shows, in milliseconds.
# delay = the CSS animation-delay: -1000 starts the cycle 1000 ms in. The hero's 3 s cycle and the header's 6 s
# blink both start at page load, so without it every second lick lands on the wag. With it, the tongue first moves
# 1.28 s after load, and the licks (1.28 to 2 s and 4.28 to 5 s of every 6 s) fall between the plain blink
# (3.4 s) and the wag (5.5 s).
LOOPS = [
    dict(name="taste", frames=[taste_frame(p) for p in TASTE], cell=(0, 0, 240, 224),
         ms=[2280, 90, 90, 180, 150, 210], delay=-1000,
         label="Tasu, the tasu.ai mascot, licks a paywall card",
         where="Home hero, above the headline", size=(300, 280)),
    dict(name="blink", frames=[blink_frame(p) for p in BLINK], cell=(-16, -16, 544, 544),
         order=[0, 1, 2, 1, 0, 1, 2, 3, 4, 5],
         ms=[3400, 60, 80, 60, 1900, 60, 80, 90, 130, 140],
         label="Tasu, the tasu.ai mascot, blinking",
         where="Header logo icon, next to the wordmark", size=(34, 34)),
    dict(name="look", frames=[look_frame(p) for p in LOOK], cell=(16, 50, 480, 440),
         ms=[1400, 120, 620, 110, 780, 170],
         label="Tasu, the tasu.ai mascot, looking around",
         where="Empty search state", size=(96, 88)),
    dict(name="happy", frames=[happy_frame(p) for p in HAPPY], cell=(16, 0, 480, 480),
         order=[0, 1, 2, 3, 4, 1, 2, 3, 4, 1, 5],
         ms=[2200, 90, 70, 140, 60, 80, 70, 140, 60, 90, 100],
         label="Tasu, the tasu.ai mascot, hopping with joy",
         where='Closing "Follow on X" block', size=(120, 120)),
]


def order(L):
    return L.get("order", list(range(FRAMES)))


assert LOOPS[0]["frames"][0] == B.hero_inner(), "taste frame 1 must be hero.svg"
assert LOOPS[1]["frames"][0] == ICON_VP + B.icon_inner() + "</svg>", "blink frame 1 must be icon.svg"
for _L in LOOPS:
    _o = order(_L)
    assert len(_L["frames"]) == FRAMES and len(_L["ms"]) == len(_o), _L["name"]
    # every frame plays, frame 1 starts the cycle (the still, reduced motion) and frame 6 leads back into it
    assert sorted(set(_o)) == list(range(FRAMES)) and _o[0] == 0 and _o[-1] == FRAMES - 1, _L["name"]
    assert all(a != b for a, b in zip(_o, _o[1:])), _L["name"]


def svg_open(vb, w, h, label, extra=""):
    x, y, vw, vh = vb
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{f(x)} {f(y)} {f(vw)} {f(vh)}" width="{f(w)}" '
            f'height="{f(h)}"{extra} role="img" aria-label="{label}"><title>{label}</title>')


def sprite_svg(L):
    """The 6 frames side by side. preserveAspectRatio="none": the CSS sizes the sprite to 600% x 100% of the box,
    so in a box of any ratio each frame still fills exactly one sixth and no neighbour frame slides in."""
    x, y, w, h = L["cell"]
    g = []
    for i, fr in enumerate(L["frames"]):
        tx, ty = i * w - x, -y
        t = f' transform="translate({f(tx)} {f(ty)})"' if (tx or ty) else ""
        g.append(f"<g{t}>{fr}</g>")
    return (svg_open((0, 0, FRAMES * w, h), FRAMES * w, h, L["label"], ' preserveAspectRatio="none"')
            + "".join(g) + "</svg>")


def still_svg(L):
    x, y, w, h = L["cell"]
    return svg_open(L["cell"], w, h, L["label"]) + L["frames"][0] + "</svg>"


# ------------------------------------------------------------------ CSS
def pct(v):
    s = "%.3f" % v
    return s.rstrip("0").rstrip(".") + "%"


def keyframes(L):
    """One keyframe per step, at the step's start, showing its frame. The closing 100% keyframe repeats the last
    step's frame, so it holds to the end of the cycle."""
    total = sum(L["ms"])
    out, t = [], 0
    for idx, ms in zip(order(L), L["ms"]):
        out.append(f"  {pct(100 * t / total)} {{ background-position: {pct(20 * idx)} 0; }}")
        t += ms
    out.append(f"  100% {{ background-position: {pct(20 * order(L)[-1])} 0; }}")
    return f"@keyframes tasu-{L['name']} {{\n" + "\n".join(out) + "\n}"


def timing(L):
    """frames 1, 2, ... show for 2280, 90, ... ms: the steps of one cycle, in words, and where the cycle starts."""
    fr = ", ".join(str(i + 1) for i in order(L))
    ms = ", ".join(str(v) for v in L["ms"])
    start = f", and the cycle starts {-L['delay']} ms in" if L.get("delay") else ""
    return f"frames {fr} show for {ms} ms{start}"


def css():
    rows = ["/* tasu.ai loops. Generated by src/loops.py: edit the timings there, not here.",
            "   Each loop is one SVG sprite, 6 frames side by side. Each keyframe shows one frame, and a loop",
            "   may show a frame more than once. steps(1, end) holds each frame until the next keyframe,",
            "   so every step keeps its own duration. */",
            ".tasu-loop {",
            "  display: inline-block;",
            "  vertical-align: middle;",
            "  align-self: center;",
            "  background-repeat: no-repeat;",
            "  background-size: 600% 100%;",
            "  background-position: 0 0;",
            "  animation-timing-function: steps(1, end);",
            "  animation-iteration-count: infinite;",
            "}"]
    for L in LOOPS:
        x, y, w, h = L["cell"]
        rows += [f".tasu-loop--{L['name']} {{",
                 f"  aspect-ratio: {f(w)} / {f(h)};",
                 f"  background-image: url(\"{L['name']}.svg\");",
                 f"  animation-name: tasu-{L['name']};",
                 f"  animation-duration: {sum(L['ms'])}ms;"]
        if L.get("delay"):
            rows += [f"  animation-delay: {L['delay']}ms;"]
        rows += ["}"]
    rows += [".tasu-loop.is-paused { animation-play-state: paused; }"]
    for L in LOOPS:
        rows += [f"/* {L['name']}: {timing(L)} */", keyframes(L)]
    rows += ["@media (prefers-reduced-motion: reduce) {",
             "  .tasu-loop[class] { animation: none; background-position: 0 0; }",
             "}"]
    return "\n".join(rows)


# ------------------------------------------------------------------ the wordmark alone
WM_W = 322.5  # 86 px wide at 32 px tall, the ink ends at 322.2


def wordmark_svg(ink):
    """The lockup's wordmark alone: same path, same softened corners, in a frame as tall as the tile
    (120 units), so at the icon's height its x-height sits where it sits in the lockup."""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f(WM_W)} {B.LOCK_TILE}" width="{f(WM_W)}" '
            f'height="{B.LOCK_TILE}" role="img" aria-label="tasu.ai" color="{ink}"><title>tasu.ai</title>'
            + B.wordmark_path(0, B.wordmark_base()) + "</svg>")


# ------------------------------------------------------------------ preview page
def span(L, w, extra="", style=""):
    """A loop w px wide. The modifier's aspect-ratio gives the height, and it shrinks with a narrow pane."""
    st = f"width:{f(w)}px" + (";" + style if style else "")
    return (f'<span class="tasu-loop tasu-loop--{L["name"]}{extra}" role="img" aria-label="{L["label"]}" '
            f'style="{st}"></span>')


def preview_html():
    by = {L["name"]: L for L in LOOPS}
    rows = []
    for L in LOOPS:
        w, h = L["size"]
        if L["name"] == "taste":
            cells = span(L, 240) + span(L, 320)
            note = "240 and 320 px wide, the height from aspect-ratio"
        elif L["name"] == "blink":
            cells = (span(L, 34) + '<span class="hd">' + span(L, 34, "", "margin:-1px")
                     + '<img class="wm-l" src="wordmark.svg" width="86" height="32" alt="">'
                     + '<img class="wm-d" src="wordmark-dark.svg" width="86" height="32" alt=""></span>')
            note = "32 px tile (a 34 px box with 1 px of clear padding), alone and in the header"
        else:
            cells = span(L, w)
            note = f"{f(w)} x {f(h)} px"
        cycle = f"{sum(L['ms']) / 1000:g} s"
        rows.append(f'<section><h2>{L["name"]}</h2><p>{L["where"]}. {note}. One cycle, {cycle}: '
                    f'{timing(L)}.</p>'
                    f'<div class="pair"><div class="pane light">{cells}</div>'
                    f'<div class="pane dark">{cells}</div></div></section>')
    rm = "".join(span(by[n], by[n]["size"][0]) for n in ("taste", "blink", "look", "happy"))  # README widths
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Tasu loops preview</title>
<link rel="stylesheet" href="loops.css">
<style>
body{{margin:0;background:#F3EFE7;color:{GREY};font:15px/1.5 system-ui,sans-serif}}
main{{max-width:960px;margin:0 auto;padding:32px 16px 64px}}
h1{{font-size:24px;margin:0 0 4px}} h2{{font-size:17px;margin:32px 0 2px}} p{{margin:0 0 10px}}
.pair{{display:grid;grid-template-columns:1fr 1fr;gap:12px}}
.pane{{display:flex;flex-wrap:wrap;align-items:center;gap:24px;padding:24px;border-radius:16px;min-height:96px}}
.pane{{min-width:0}} .pane .tasu-loop{{max-width:100%}}
.light{{background:#F3EFE7;outline:1px solid rgba(58,57,54,.15)}} .dark{{background:{DARK};color:{CREAM}}}
.hd{{display:inline-flex;align-items:center;gap:7px}}
.dark .wm-l,.light .wm-d{{display:none}}
.rm .tasu-loop{{animation:none;background-position:0 0}}
@media (max-width:640px){{.pair{{grid-template-columns:1fr}}.pane{{padding:16px}}}}
</style></head>
<body><main>
<h1>Tasu loops</h1>
<p>4 loops of 6 frames, at their real sizes, on cream and on {DARK}. Off screen, or in a hidden tab, every loop pauses.</p>
{"".join(rows)}
<section class="rm"><h2>Reduced motion</h2><p>With prefers-reduced-motion: reduce, each loop shows frame 1 and stays still, as here.</p>
<div class="pair"><div class="pane light">{rm}</div><div class="pane dark">{rm}</div></div></section>
</main>
<script>
(() => {{
  const loops = document.querySelectorAll('.tasu-loop');
  const onScreen = new WeakMap();
  const sync = el => el.classList.toggle('is-paused', document.hidden || !onScreen.get(el));
  const io = new IntersectionObserver(es => es.forEach(e => {{ onScreen.set(e.target, e.isIntersecting); sync(e.target); }}));
  loops.forEach(el => io.observe(el));
  document.addEventListener('visibilitychange', () => loops.forEach(sync));
}})();
</script>
</body></html>"""


def main(brand):
    out = os.path.join(brand, "loops")
    os.makedirs(out, exist_ok=True)
    files = {}
    for L in LOOPS:
        files[f"{L['name']}.svg"] = sprite_svg(L)
        files[f"{L['name']}-1.svg"] = still_svg(L)
    files["loops.css"] = css()
    files["wordmark.svg"] = wordmark_svg(GREY)
    files["wordmark-dark.svg"] = wordmark_svg(CREAM)
    files["preview.html"] = preview_html()
    for name, s in files.items():
        with open(os.path.join(out, name), "w") as fh:
            fh.write(s + "\n")
    print("ok", len(files))


if __name__ == "__main__":
    main(sys.argv[1])
