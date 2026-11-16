"""Shared geometry for Tasu, the tasu.ai mascot. Pure functions that return SVG path strings.

Only 3 colors exist in the brand: cream #F3EFE7, grey #3A3936, mint #3FE0A0.
"""
import math

CREAM, GREY, MINT, DARK = "#F3EFE7", "#3A3936", "#3FE0A0", "#1C1B19"


def f(v):
    """Compact number: 1 decimal, no trailing .0, no -0."""
    s = "%.1f" % v
    if s == "-0.0":
        s = "0.0"
    return s[:-2] if s.endswith(".0") else s


def catmull(P):
    n = len(P)
    d = "M%s %s" % (f(P[0][0]), f(P[0][1]))
    for i in range(n):
        p0, p1, p2, p3 = P[i - 1], P[i], P[(i + 1) % n], P[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += "C%s %s %s %s %s %s" % (f(c1[0]), f(c1[1]), f(c2[0]), f(c2[1]), f(p2[0]), f(p2[1]))
    return d + "Z"


def squircle(x, y, w, h, n=4.5, pts=64):
    """Continuous-corner tile (superellipse) as a smooth closed cubic path."""
    cx, cy, a, b = x + w / 2, y + h / 2, w / 2, h / 2
    P = []
    for i in range(pts):
        t = 2 * math.pi * (i + 0.5) / pts
        c, s = math.cos(t), math.sin(t)
        P.append((cx + a * math.copysign(abs(c) ** (2 / n), c), cy + b * math.copysign(abs(s) ** (2 / n), s)))
    return catmull(P)


def mochi(cx, top, wide_y, bottom, a, kt=0.56, kr=0.58, kb=0.88, kbx=0.84):
    """Tasu's body: a soft dome with a flat-ish seat. 4 cubic segments, symmetric."""
    ht, hb = wide_y - top, bottom - wide_y
    R, L = cx + a, cx - a
    return (
        f"M{f(cx)} {f(top)}"
        f"C{f(cx + kt * a)} {f(top)} {f(R)} {f(wide_y - kr * ht)} {f(R)} {f(wide_y)}"
        f"C{f(R)} {f(wide_y + kb * hb)} {f(cx + kbx * a)} {f(bottom)} {f(cx)} {f(bottom)}"
        f"C{f(cx - kbx * a)} {f(bottom)} {f(L)} {f(wide_y + kb * hb)} {f(L)} {f(wide_y)}"
        f"C{f(L)} {f(wide_y - kr * ht)} {f(cx - kt * a)} {f(top)} {f(cx)} {f(top)}Z"
    )


# ------------------------------------------------------------------ the mouth
# The smile is a quadratic Bezier S = (P0, P1, P2), stroked with round caps. The tongue grows out of
# its lowest point: its outline meets the smile with tangent fillets, so smile and tongue read as one shape.

def f2(v):
    """Like f, with 2 decimals. The hero mouth uses it: its joins are checked at 8x zoom and more."""
    s = "%.2f" % v
    if float(s) == 0:
        return "0"
    return s.rstrip("0").rstrip(".")


def qpt(S, t):
    (x0, y0), (x1, y1), (x2, y2) = S
    u = 1 - t
    return (u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2)


def qd1(S, t):
    (x0, y0), (x1, y1), (x2, y2) = S
    return (2 * ((1 - t) * (x1 - x0) + t * (x2 - x1)), 2 * ((1 - t) * (y1 - y0) + t * (y2 - y1)))


def qsub(S, t0, t1):
    """Control point and end of the piece of S from t0 to t1 (t1 < t0 runs backwards)."""
    a, d = qpt(S, t0), qd1(S, t0)
    return (a[0] + (t1 - t0) * d[0] / 2, a[1] + (t1 - t0) * d[1] / 2), qpt(S, t1)


def qclosest(S, X):
    """(t, foot, distance) of the point of S closest to X. Fixed sampling, then a fixed ternary search."""
    def d2(t):
        q = qpt(S, t)
        return (q[0] - X[0]) ** 2 + (q[1] - X[1]) ** 2
    i = min(range(401), key=lambda j: d2(j / 400))
    lo, hi = max(0.0, (i - 1) / 400), min(1.0, (i + 1) / 400)
    for _ in range(80):
        m1, m2 = lo + (hi - lo) / 3, hi - (hi - lo) / 3
        if d2(m1) < d2(m2):
            hi = m2
        else:
            lo = m1
    t = (lo + hi) / 2
    return t, qpt(S, t), math.sqrt(d2(t))


def qx(S, x):
    """t where S (left to right) reaches abscissa x."""
    lo, hi = 0.0, 1.0
    for _ in range(80):
        m = (lo + hi) / 2
        if qpt(S, m)[0] < x:
            lo = m
        else:
            hi = m
    return (lo + hi) / 2


def qnormal(S, t):
    """Unit normal of S at t, pointing down (+y), toward the tongue."""
    dx, dy = qd1(S, t)
    n = math.hypot(dx, dy)
    return (-dy / n, dx / n) if dx > 0 else (dy / n, -dx / n)


def sweep(C, A, B):
    """SVG sweep flag of the short arc from A to B around C."""
    return 1 if (A[0] - C[0]) * (B[1] - C[1]) - (A[1] - C[1]) * (B[0] - C[0]) > 0 else 0


def fillet(S, xs, rf, h, side):
    """Circle of radius rf touching the vertical line x = xs and the curve S pushed down by h.
    side = -1: centre left of the line, +1: right of it. Returns its centre C, touch points
    S (on the line) and T (on the pushed curve), and the foot Q on S with its t."""
    cx = xs + side * rf
    lo = qpt(S, qx(S, cx))[1]
    hi = lo + 10 * (rf + h) + 10
    for _ in range(90):
        m = (lo + hi) / 2
        if qclosest(S, (cx, m))[2] < rf + h:
            lo = m
        else:
            hi = m
    yc = (lo + hi) / 2
    t, Q, d = qclosest(S, (cx, yc))
    n = ((cx - Q[0]) / d, (yc - Q[1]) / d)
    return {"C": (cx, yc), "S": (xs, yc), "T": (Q[0] + n[0] * h, Q[1] + n[1] * h), "Q": Q, "t": t}


class Path:
    """Writes SVG path data with a number formatter (f or f2)."""
    def __init__(self, fmt=f):
        self.n, self.d = fmt, []

    def p(self, P):
        return f"{self.n(P[0])} {self.n(P[1])}"

    def M(self, P):
        self.d.append("M" + self.p(P))
        return self

    def L(self, P):
        self.d.append("L" + self.p(P))
        return self

    def V(self, y):
        self.d.append("V" + self.n(y))
        return self

    def Q(self, C, P):
        self.d.append(f"Q{self.p(C)} {self.p(P)}")
        return self

    def A(self, r, sw, P):
        self.d.append(f"A{self.n(r)} {self.n(r)} 0 0 {sw} {self.p(P)}")
        return self

    def Z(self):
        self.d.append("Z")
        return self

    def __str__(self):
        return "".join(self.d)


def smile_d(S, fmt=f):
    return str(Path(fmt).M(S[0]).Q(S[1], S[2]))


def tongue_drop(S, r, rf, h, y_tip, x0, fmt=f):
    """Filled style. A U of half-width r centred on x0, tip at y_tip, under the smile S stroked 2h wide.
    Its sides flare into the smile's lower edge with tangent fillets of radius rf. Its top runs along the
    smile's centre line, under the stroke: no mint shows above the smile, no hairline opens at the join."""
    L, R = fillet(S, x0 - r, rf, h, -1), fillet(S, x0 + r, rf, h, +1)
    c, e = qsub(S, L["t"], R["t"])
    yc = y_tip - r
    return str(Path(fmt).M(L["S"]).A(rf, sweep(L["C"], L["S"], L["T"]), L["T"]).L(L["Q"]).Q(c, e).L(R["T"])
               .A(rf, sweep(R["C"], R["T"], R["S"]), R["S"]).V(yc).A(r, 1, (x0 - r, yc)).Z())


def tongue_loop(S, rc, rf, y_tip, x0, fmt=f):
    """Line style. The tongue outline as a centre line that leaves the smile S along its own tangent,
    bends down with a fillet of radius rf, runs down at x0 -/+ rc, rounds the tip at y_tip and comes back.
    Stroked as wide as the smile, its ends hide inside the smile stroke. Returns (outline, mint fill, L, R).
    The fill is bounded by the outline's and the smile's centre lines, so the strokes cover its edges."""
    L, R = fillet(S, x0 - rc, rf, 0, -1), fillet(S, x0 + rc, rf, 0, +1)
    yc = y_tip - rc
    loop = (Path(fmt).M(L["Q"]).A(rf, sweep(L["C"], L["Q"], L["S"]), L["S"]).V(yc).A(rc, 0, (x0 + rc, yc))
            .V(R["S"][1]).A(rf, sweep(R["C"], R["S"], R["Q"]), R["Q"]))
    c, e = qsub(S, R["t"], L["t"])
    fill = (Path(fmt).M(L["Q"]).A(rf, sweep(L["C"], L["Q"], L["S"]), L["S"]).V(yc).A(rc, 0, (x0 + rc, yc))
            .V(R["S"][1]).A(rf, sweep(R["C"], R["S"], R["Q"]), R["Q"]).Q(c, e).Z())
    return str(loop), str(fill), L, R


def crotch(S, F, rf, h, ri, side, fmt=f):
    """Line style. A round of radius ri in the inner corner where the tongue outline (half-width h, centre
    line = fillet F of radius rf, then the vertical side) meets the smile's lower edge (S pushed down by h).
    side = +1 for the tongue's left side, -1 for its right side. Returns a grey patch whose only visible
    edge is that arc. Its other edges are short chords that stay inside the strokes: to the outline's centre
    line, back to the outline's tangent point on the smile, F["Q"], and along the smile's centre line. So the
    patch holds the whole corner at any ri, and no mint is left past the arc."""
    C, Sx = F["C"], F["S"]

    def at(t):
        q, n = qpt(S, t), qnormal(S, t)
        return q, (q[0] + n[0] * (h + ri), q[1] + n[1] * (h + ri))

    def inside(D):  # signed distance to the outline's centre line, > 0 on the mint side
        if D[1] >= C[1]:
            return side * (D[0] - Sx[0])
        return math.hypot(D[0] - C[0], D[1] - C[1]) - rf

    lo, hi = F["t"], qx(S, Sx[0] + side * 50)
    for _ in range(90):
        m = (lo + hi) / 2
        if inside(at(m)[1]) < h + ri:
            lo = m
        else:
            hi = m
    t = (lo + hi) / 2
    Q, D = at(t)
    n = qnormal(S, t)
    T1 = (Q[0] + n[0] * h, Q[1] + n[1] * h)
    if D[1] >= C[1]:
        T2, A2 = (Sx[0] + side * h, D[1]), (Sx[0], D[1])
    else:
        dd = math.hypot(D[0] - C[0], D[1] - C[1])
        u = ((D[0] - C[0]) / dd, (D[1] - C[1]) / dd)
        T2, A2 = (C[0] + u[0] * (rf + h), C[1] + u[1] * (rf + h)), (C[0] + u[0] * rf, C[1] + u[1] * rf)
    return str(Path(fmt).M(T1).A(ri, sweep(D, T1, T2), T2).L(A2).L(F["Q"]).L(Q).Z())


def rot(px, py, cx, cy, deg):
    r = math.radians(deg)
    dx, dy = px - cx, py - cy
    return cx + dx * math.cos(r) - dy * math.sin(r), cy + dx * math.sin(r) + dy * math.cos(r)


def qrot(S, deg, C):
    """The quadratic S turned by deg about C (clockwise on screen, like SVG rotate()).
    A tilted tongue is drawn upright against qrot(S, -deg, C), then shown inside rotate(deg C):
    the joins stay exact, because the smile it was fitted to lands back on S."""
    return tuple(rot(x, y, C[0], C[1], deg) for x, y in S)
