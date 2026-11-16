"""Convert a string into one SVG path (absolute coords) using harfbuzz shaping.

usage: python3 wordmark.py FONT.ttf "tasu.ai" SIZE TRACKING_EM [OUT.json]
Prints JSON: {"d": path, "width": advance width, "ascent":..., "xh":..., "bbox": [...]}.
The baseline sits at y=0; y grows downward (SVG).
"""
import json
import sys

import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

font_path, text, size, tracking = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])

blob = hb.Blob.from_file_path(font_path)
face = hb.Face(blob)
hbfont = hb.Font(face)
upem = face.upem
buf = hb.Buffer()
buf.add_str(text)
buf.guess_segment_properties()
hb.shape(hbfont, buf, {"kern": True, "liga": True})

tt = TTFont(font_path)
gs = tt.getGlyphSet()
order = tt.getGlyphOrder()
scale = size / upem
track_units = tracking * upem

pen = SVGPathPen(gs, ntos=lambda v: ("%.2f" % v).rstrip("0").rstrip("."))
bpen = BoundsPen(gs)
x = 0.0
glyphs = []
for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
    name = order[info.codepoint]
    gx = x + pos.x_offset
    gy = pos.y_offset
    # font units: y up. SVG: y down. transform = scale, flip y, translate
    t = (scale, 0, 0, -scale, gx * scale, -gy * scale)
    gs[name].draw(TransformPen(pen, t))
    gs[name].draw(TransformPen(bpen, t))
    glyphs.append({"name": name, "x": gx * scale, "adv": pos.x_advance * scale})
    x += pos.x_advance + track_units
width = (x - track_units) * scale
os2 = tt["OS/2"]
out = {
    "d": pen.getCommands(),
    "width": round(width, 2),
    "ascent": round(tt["hhea"].ascent * scale, 2),
    "capH": round(getattr(os2, "sCapHeight", 0) * scale, 2),
    "xh": round(getattr(os2, "sxHeight", 0) * scale, 2),
    "bbox": [round(v, 2) for v in bpen.bounds],
    "glyphs": glyphs,
}
if len(sys.argv) > 5:
    with open(sys.argv[5], "w") as f:
        json.dump(out, f)
print(json.dumps({k: v for k, v in out.items() if k != "d"}))
