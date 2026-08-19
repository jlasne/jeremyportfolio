#!/usr/bin/env python3
"""
Overlap — assemble self-contained pages.

Every page this writes has its CSS and JS *inside* it. No external app.css,
no external app.js. A static host only has to serve one file correctly, and
there is no window where new HTML meets old assets.

Sources stay single-copy — edit app.css / app.js / clock.js / landing.src.html
and run this. Never edit the generated index.html files by hand.

    python3 overlap/build.py
"""
import io, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
read = lambda n: io.open(os.path.join(HERE, n), encoding="utf-8").read()
def write(n, s):
    path = os.path.join(HERE, n)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    io.open(path, "w", encoding="utf-8").write(s)
    print("  %-22s %6.1f KB" % (n, len(s.encode("utf-8")) / 1024.0))

CSS   = read("app.css")
APP   = read("app.js")
CLOCK = read("clock.js")

HEAD = '''<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover%(scale)s">
<title>%(title)s</title>
<meta name="description" content="%(desc)s">
<meta name="theme-color" content="%(theme)s">
<meta name="apple-mobile-web-app-capable" content="yes">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">'''

APP_PAGE = '''<!DOCTYPE html>
<html lang="en">
<head>
%(head)s
<style>
%(css)s
</style>
</head>
<body>
<div id="root"></div>
<script>var OVERLAP_STEP = %(step)d;</script>
<script>
%(config)s
</script>
<script>
%(app)s
</script>
</body>
</html>
'''

def build_app_pages():
    config = read("config.js")
    for step, (slug, title, desc) in enumerate([
        ("team", "Team", "Everyone's hours, in their own timezone, and the overlap between them."),
        ("plan", "Plan", "Pick the hour that works and hand it to your calendar."),
        ("next", "Next", "Tell us what Overlap should do next."),
    ]):
        head = HEAD % {"title": "%s — Overlap" % title, "desc": desc,
                       "theme": "#F2F2F7", "scale": ", maximum-scale=1"}
        write("%s/index.html" % slug, APP_PAGE % {
            "head": head, "css": CSS, "app": APP, "config": config, "step": step})

def build_landing():
    src = read("landing.src.html")
    # the shared stylesheet becomes a style block, in place
    src = re.sub(r'<link rel="stylesheet" href="app\.css[^"]*">',
                 "<style>\n" + CSS + "\n</style>", src, count=1)
    # so does the clock
    src = re.sub(r'<script src="clock\.js[^"]*"></script>',
                 "<script>\n" + CLOCK + "\n</script>", src, count=1)
    if "app.css" in src or 'src="clock.js' in src:
        sys.exit("build: landing still references an external asset")
    write("index.html", src)

print("overlap: building self-contained pages")
build_app_pages()
build_landing()
print("done")
