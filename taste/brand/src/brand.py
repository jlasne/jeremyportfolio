"""tasu.ai brand kit generator. Every shape is drawn in code.

usage: python3 src/brand.py <brandDir>
Writes to brandDir: icon.svg, favicon.svg, lockup.svg, lockup-dark.svg, hero.svg.
Writes to brandDir/src: touch.svg, the apple-touch-icon master. Then run src/render.cjs for the PNGs.
src/loops.py imports this file to draw the animated loops: importing it writes nothing.

Winner: "The taster" (Tasu, a cream mochi with a mint tongue).
Graft from the runner-up "Scoop": in the hero, Tasu closes its eyes in delight while it tastes.
Only 3 colors: cream #F3EFE7, grey #3A3936, mint #3FE0A0 (plus opacity of the same colors).

The mouth: the tongue grows out of the lowest point of the smile, so smile and tongue read as one shape.
Filled style (icon, favicon): the tongue's sides flare into the smile's lower edge with tangent fillets.
Line style (hero, touch): the smile's outline leaves the smile along its own tangent and runs round the
tongue at the same weight, with a small round in each inner corner.
The pose arguments (tip, tilt, body and face offsets) default to the still kit. The loops move them.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geom import (CREAM, GREY, MINT, crotch, f, f2, mochi, qrot, smile_d, squircle, tongue_drop,  # noqa: E402
                  tongue_loop)

HERE = os.path.dirname(os.path.abspath(__file__))
WM = json.load(open(os.path.join(HERE, "wm800.json")))
P = json.loads(os.environ.get("P", "{}"))  # quick overrides while iterating


def p(k, d):
    return P.get(k, d)


def root(vb_w, vb_h, label, w=None, h=None, extra=""):
    size = f' width="{f(w)}" height="{f(h)}"' if w else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f(vb_w)} {f(vb_h)}"{size} role="img" '
            f'aria-label="{label}"{extra}>')


def turn(tilt, C, fmt=f):
    """Opening and closing tags of a group turned by tilt degrees about C. Empty when tilt is 0."""
    if not tilt:
        return "", ""
    return f'<g transform="rotate({fmt(tilt)} {fmt(C[0])} {fmt(C[1])})">', "</g>"


# ------------------------------------------------------------------ icon (512 grid)
TILE = squircle(0, 0, 512, 512, n=4.5)
BODY = mochi(256, 104, 316, 436, 198)


def smile(fx, fy, k, a=35, y_end=24, y_ctl=49):
    """The smile as a quadratic, in face units: ends at (+/-a, y_end), lowest point (0, (y_end + y_ctl) / 2)."""
    return ((fx - a * k, fy + y_end * k), (fx, fy + y_ctl * k), (fx + a * k, fy + y_end * k))


def eyes_open(fx, fy, k, shine=p("shine", 0.27), shift=(0, 0)):
    """2 dot eyes with a shine. shift = extra x offset of the left and right eye (the look loop)."""
    g = []
    er, edx = 29 * k, 74 * k
    for sx, dx in zip((-1, 1), shift):
        ex = fx + sx * edx + dx
        g.append(f'<circle cx="{f(ex)}" cy="{f(fy)}" r="{f(er)}" fill="{GREY}"/>')
        if shine:
            g.append(f'<circle cx="{f(ex + er * .36)}" cy="{f(fy - er * .38)}" r="{f(er * shine)}" fill="{CREAM}"/>')
    return "".join(g)


def mouth_filled(fx, fy, k, tip=p("ttip", 93), tilt=0, fmt=f):
    """Filled style: the smile, one grey stroke, and the mint tongue growing out of its lowest point.
    The tongue's sides flare into the smile's lower edge with tangent fillets and its top runs under the
    stroke, so smile and tongue read as one shape. tip = the tongue's tip below the eye line, in face units.
    tilt = the tongue's swing in degrees about its root: it is fitted upright to the smile turned by -tilt,
    then turned back, so every join stays exact.
    fmt writes the smile, the tongue and the turn: f (1 decimal) for the icon, f2 for the blink loop, whose
    tilted tongues need 2 decimals to keep each fillet's touch point inside the smile's stroke."""
    sm, sw = smile(fx, fy, k), 16 * k
    piv = (float(fmt(fx)), float(fmt(fy + 36.5 * k)))  # rounded, so rotate() turns about the very point qrot used
    up = qrot(sm, -tilt, piv) if tilt else sm
    tongue = tongue_drop(up, p("tr", 22) * k, p("trf", 10) * k, sw / 2, fy + tip * k, fx, fmt)
    q = (tip - 36.5) / 56.5  # the crease keeps its place on a longer or shorter tongue
    g0, g1 = turn(tilt, piv, fmt)
    return (g0 + f'<path d="{tongue}" fill="{MINT}"/>'
            + f'<path d="M{f(fx)} {f(fy + (36.5 + 17.5 * q) * k)}V{f(fy + (36.5 + 37.5 * q) * k)}" stroke="{GREY}" '
            f'stroke-width="{f(9 * k)}" stroke-linecap="round" opacity=".3"/>' + g1
            + f'<path d="{smile_d(sm, fmt)}" fill="none" stroke="{GREY}" stroke-width="{f(sw)}" '
            f'stroke-linecap="round"/>')


def face_open(fx, fy, k, shine=p("shine", 0.27)):
    """The default face: 2 dot eyes with a shine, and a smile with the mint tongue growing out of it.
    (fx, fy) = centre of the eye line, k = scale (1.08 in the 512 icon)."""
    return eyes_open(fx, fy, k, shine) + mouth_filled(fx, fy, k)


def icon_inner():
    return f'<path d="{TILE}" fill="{GREY}"/><path d="{BODY}" fill="{CREAM}"/>{face_open(256, 300, 1.08)}'


def icon_svg():
    return root(512, 512, "tasu.ai", 512, 512) + "<title>tasu.ai</title>" + icon_inner() + "</svg>"


# ------------------------------------------------------------------ favicon (16 px master)
def favicon_svg():
    """Drawn for a 16 px grid (1 px = 32 units): no eye shine, eyes on whole pixel rows 8 and 9.
    The smile is 1 px thick and fills row 10 (columns 7 and 8 dark, 6 and 9 light). The 2 px tongue
    (columns 7 and 8) fills row 11 and rounds off in row 12, and row 13 stays cream above the tile.
    So a 1x browser tab shows 2 dark eyes, a dark smile and mint pixels under it. At 32 px the smile's
    ends turn up and keep 17 units (1.1 px) clear of the eyes. Same construction as the icon."""
    g = [f'<path d="{TILE}" fill="{GREY}"/>', f'<path d="{mochi(256, 96, 320, 448, 204)}" fill="{CREAM}"/>']
    for ex in (176, 336):
        g.append(f'<rect x="{ex - 32}" y="256" width="64" height="64" rx="32" fill="{GREY}"/>')
    sm = ((222, 334), (256, 352), (290, 334))
    g.append(f'<path d="{tongue_drop(sm, 32, 10, 16, 416, 256)}" fill="{MINT}"/>')
    g.append(f'<path d="{smile_d(sm)}" fill="none" stroke="{GREY}" stroke-width="32" stroke-linecap="round"/>')
    return root(512, 512, "tasu.ai", 32, 32) + "<title>tasu.ai</title>" + "".join(g) + "</svg>"


# ------------------------------------------------------------------ lockup
LOCK_TILE, LOCK_GAP, LOCK_SOFT, LOCK_XH_SHIFT = 120, p("gap", 26), p("soft", 2.2), p("xhshift", 5)


def wordmark_base(tile=LOCK_TILE, xh_shift=LOCK_XH_SHIFT):
    """Baseline of the wordmark in a frame as tall as the tile: the x-height band sits on the tile's
    centre line, nudged xh_shift units down so the round letters look centred."""
    return tile / 2 + WM["xh"] / 2 + xh_shift


def wordmark_path(x, base, soft=LOCK_SOFT):
    """The wordmark "tasu.ai" in Schibsted Grotesk 800, -3% tracking, as one currentColor path with
    softened corners, its baseline's left end at (x, base)."""
    stroke = f' stroke="currentColor" stroke-width="{f(soft)}" stroke-linejoin="round"' if soft else ""
    return f'<path transform="translate({f(x)} {f(base)})" d="{WM["d"]}" fill="currentColor"{stroke}/>'


def lockup_svg(ink, gap=LOCK_GAP, soft=LOCK_SOFT, xh_shift=LOCK_XH_SHIFT):
    """Icon tile (120 units) + the wordmark, drawn as paths."""
    tile = LOCK_TILE
    base = wordmark_base(tile, xh_shift)
    wx = tile + gap
    x_end = wx + WM["bbox"][2] + soft
    w = x_end + 1
    return (root(w, tile, "tasu.ai", w, tile, f' color="{ink}"') + "<title>tasu.ai</title>"
            + f'<g transform="scale({tile / 512})">{icon_inner()}</g>'
            + wordmark_path(wx, base, soft)
            + "</svg>")


# ------------------------------------------------------------------ hero
SW = 4.0
HERO_LABEL = "Tasu, the tasu.ai mascot, peeks over a paywall card and tastes it"


def paywall_card(cw, ch):
    """A paywall reduced to its parts: close x, 2 plans (the top one picked, with the mint
    selection mark on the right, iOS style) and the main button. Grey screen, cream content."""
    c = [f'<rect x="{f(-cw / 2)}" y="{f(-ch / 2)}" width="{f(cw)}" height="{f(ch)}" rx="20" fill="{GREY}"/>']
    pad = 14
    x0, w = -cw / 2 + pad, cw - 2 * pad
    xx, xy = cw / 2 - 19, -ch / 2 + 16
    c.append(f'<path d="M{f(xx - 3.5)} {f(xy - 3.5)}l7 7m0 -7l-7 7" stroke="{CREAM}" stroke-width="2.5" '
             f'stroke-linecap="round" opacity=".62"/>')
    rh = 22
    for i, y in enumerate((-18, 10)):
        on = i == 0
        op = "" if on else ' opacity=".4"'
        c.append(f'<rect x="{f(x0)}" y="{f(y - rh / 2)}" width="{f(w)}" height="{rh}" rx="{rh / 2:g}" fill="none" '
                 f'stroke="{CREAM}" stroke-width="{3 if on else 2.5}"{op}/>')
        c.append(f'<path d="M{f(x0 + 11)} {f(y)}H{f(x0 + w * (.5 if on else .38))}" stroke="{CREAM}" '
                 f'stroke-width="4.5" stroke-linecap="round"{op}/>')
        if on:
            c.append(f'<circle cx="{f(x0 + w - 11)}" cy="{f(y)}" r="5.5" fill="{MINT}"/>')
        else:
            c.append(f'<circle cx="{f(x0 + w - 11)}" cy="{f(y)}" r="4.5" fill="none" stroke="{CREAM}" '
                     f'stroke-width="2.5"{op}/>')
    c.append(f'<rect x="{f(x0)}" y="30" width="{f(w)}" height="16" rx="8" fill="{CREAM}"/>')
    return "".join(c)


def happy_eye(x, y, w=p("hew", 11), h=p("heh", 7.5), sw=SW + .5):
    """Closed, delighted eye: an arch (the graft from Scoop)."""
    return (f'<path d="M{f(x - w)} {f(y + h * .45)}Q{f(x)} {f(y - h * 1.35)} {f(x + w)} {f(y + h * .45)}" '
            f'fill="none" stroke="{GREY}" stroke-width="{f(sw)}" stroke-linecap="round"/>')


def hero_mouth(cx, ey, rc=p("hrc", 10), rf=p("hrf", 5), ri=p("hri", 1.2), tip=68, tilt=0):
    """Line style: the smile and the tongue outline are one line of weight SW. The outline leaves the smile
    along its tangent, bends down (fillet rf on the centre line), drapes over the card and comes back.
    A round of radius ri softens each inner corner. Coordinates use 2 decimals for clean joins at 8x.
    tip = the tongue's tip below the eye line, tilt = its swing about its root, as in mouth_filled.
    At tip 68 the tongue rests on the picked plan: its outline cuts the row's top stroke cleanly and ends
    3.8 units above the plan's bar, so no cream hairline is left under it."""
    sm = ((cx - 18, ey + 17), (cx, ey + 31), (cx + 18, ey + 17))
    piv = (cx, float(f2(ey + 24)))
    up = qrot(sm, -tilt, piv) if tilt else sm
    loop, fill, L, R = tongue_loop(up, rc, rf, ey + tip, cx, f2)
    q = (tip - 24) / 40  # the crease keeps its place on a longer or shorter tongue
    st = f'stroke="{GREY}" stroke-width="{f(SW)}"'
    g0, g1 = turn(tilt, piv, f2)
    return (g0 + f'<path d="{fill}" fill="{MINT}"/>'
            f'<path d="M{f(cx)} {f(ey + 24 + 20 * q)}V{f(ey + 24 + 30 * q)}" stroke="{GREY}" stroke-width="2.5" '
            f'stroke-linecap="round" opacity=".45"/>'
            f'<path d="{loop}" fill="none" {st} stroke-linejoin="round"/>' + g1
            + f'<path d="{smile_d(sm, f2)}" fill="none" {st} stroke-linecap="round"/>'
            + g0 + "".join(f'<path d="{crotch(up, F, rf, SW / 2, ri, s, f2)}" fill="{GREY}"/>'
                           for F, s in ((L, 1), (R, -1))) + g1)


def hero_inner(top=14, wide=106, bottom=186, a=98, dx=0, dy=0, spread=28, ew=p("hew", 11), eh=p("heh", 7.5),
               tip=68, tilt=0):
    """Tasu peeks over a floating paywall card and tastes it, eyes shut in delight. The defaults are
    hero.svg. The taste loop moves the body (top, wide, bottom, a: a squish), the face (dx, dy, the eye
    spread and arch), and the tongue (tip, tilt). The card never moves."""
    cx, ey = 120, p("ey", 62)
    fx, fy = cx + dx, ey + dy
    g = [f'<path d="{mochi(cx, top, wide, bottom, a)}" fill="{CREAM}" stroke="{GREY}" stroke-width="{f(SW)}" '
         f'stroke-linejoin="round"/>']
    g += [happy_eye(fx - spread, fy + 2, ew, eh), happy_eye(fx + spread, fy + 2, ew, eh)]
    ccx, ccy, ang, cw, ch = 122, 156, -5, 150, 104
    g.append(f'<g transform="translate({ccx} {ccy}) rotate({ang})">{paywall_card(cw, ch)}</g>')
    g.append(hero_mouth(fx, fy, tip=tip, tilt=tilt))
    return "".join(g)


def hero_svg():
    """It acts out the headline: Tasu sits behind the paywall. Transparent background."""
    return root(240, 224, HERO_LABEL, 240, 224) + f"<title>{HERO_LABEL}</title>" + hero_inner() + "</svg>"


# ------------------------------------------------------------------ apple-touch-icon master
def line_mouth(fx, fy, fk, msw, tip=96, tilt=0, ri=4, fmt=f):
    """Line style at icon scale (the touch icon and the loops): the smile's line continues round the
    tongue at one weight msw, with a round of radius ri in each inner corner. tip and tilt as in mouth_filled.
    fmt writes the smile, the tongue, the inner rounds and the turn: f (1 decimal) for the touch icon, f2 for
    the loops, whose mouths move to fractional places. With f2 the outline's ends sit on the smile's centre
    line within 0.01 units, so the joins stay exact at 32x zoom."""
    sm = smile(fx, fy, fk, a=38, y_ctl=50)
    rf = 10 * fk
    piv = (float(fmt(fx)), float(fmt(fy + 37 * fk)))  # rounded, so rotate() turns about the very point qrot used
    up = qrot(sm, -tilt, piv) if tilt else sm
    loop, fill, L, R = tongue_loop(up, 24 * fk, rf, fy + tip * fk, fx, fmt)
    q = (tip - 37) / 59  # the crease keeps its place on a longer or shorter tongue
    g0, g1 = turn(tilt, piv, fmt)
    g = [g0, f'<path d="{fill}" fill="{MINT}"/>',
         f'<path d="M{f(fx)} {f(fy + (37 + 20 * q) * fk)}V{f(fy + (37 + 40 * q) * fk)}" stroke="{GREY}" '
         f'stroke-width="{f(9 * fk)}" stroke-linecap="round" opacity=".45"/>',
         f'<path d="{loop}" fill="none" stroke="{GREY}" stroke-width="{f(msw)}" stroke-linejoin="round"/>', g1,
         f'<path d="{smile_d(sm, fmt)}" fill="none" stroke="{GREY}" stroke-width="{f(msw)}" stroke-linecap="round"/>',
         g0]
    for F, s in ((L, 1), (R, -1)):
        g.append(f'<path d="{crotch(up, F, rf, msw / 2, ri, s, fmt)}" fill="{GREY}"/>')
    g.append(g1)
    return "".join(g)


def touch_svg():
    """180 px home-screen icon on cream, full bleed (iOS rounds the corners). Same mochi and eyes
    as the icon, drawn in the hero's line style: cream body, grey outline. The smile's line continues round
    the tongue at one weight (12, lighter than the body's 16 so the mint still shows at 60 pt)."""
    k = p("tk", 1.0)  # mochi scale inside the 512 square (1 = same size as in icon.svg)
    o = 256 * (1 - k)
    sw, msw = p("tsw", 16) / k, p("tmsw", 12) / k
    fx, fy, fk = 256, 300, 1.08
    g = [f'<rect width="512" height="512" fill="{CREAM}"/>',
         f'<g transform="translate({f(o)} {f(o + p("tdy", -8))}) scale({k})">',
         f'<path d="{BODY}" fill="{CREAM}" stroke="{GREY}" stroke-width="{f(sw)}" stroke-linejoin="round"/>',
         eyes_open(fx, fy, fk, .27), line_mouth(fx, fy, fk, msw), "</g>"]
    return root(512, 512, "tasu.ai", 180, 180) + "".join(g) + "</svg>"


def main(brand):
    work = os.path.join(brand, "src")
    os.makedirs(brand, exist_ok=True)
    os.makedirs(work, exist_ok=True)
    files = {
        os.path.join(brand, "icon.svg"): icon_svg(),
        os.path.join(brand, "favicon.svg"): favicon_svg(),
        os.path.join(brand, "lockup.svg"): lockup_svg(GREY),
        os.path.join(brand, "lockup-dark.svg"): lockup_svg(CREAM),
        os.path.join(brand, "hero.svg"): hero_svg(),
        os.path.join(work, "touch.svg"): touch_svg(),
    }
    for path, s in files.items():
        with open(path, "w") as fh:
            fh.write(s + "\n")
    print("ok", len(files))


if __name__ == "__main__":
    main(sys.argv[1])
