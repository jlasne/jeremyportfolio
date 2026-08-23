#!/usr/bin/env python3
"""
Overlap — assemble self-contained pages.

Every page this writes has its CSS and JS *inside* it. No external app.css,
no external app.js. A static host only has to serve one file correctly, and
there is no window where new HTML meets old assets.

Sources stay single-copy — edit app.css / app.js / login.js / landing.src.html
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
LOGIN = read("login.js")

HEAD = '''<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover%(scale)s">
<title>%(title)s</title>
<meta name="description" content="%(desc)s">
<meta name="theme-color" content="%(theme)s">
<meta name="apple-mobile-web-app-capable" content="yes">
<link rel="icon" href="/overlap/icon.svg" type="image/svg+xml">
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

LOGIN_PAGE = '''<!DOCTYPE html>
<html lang="en">
<head>
%(head)s
<style>
%(css)s
.door{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px}
.door-in{width:100%%;max-width:360px;text-align:center}
.door .mark{width:56px;height:49px;margin:0 auto 24px;display:block;color:var(--ink);
  --mark-cut:var(--ground)}
.door h1{font-size:27px;line-height:1.15;letter-spacing:-.035em;font-weight:700;margin:0 0 8px}
.door .lede{font-size:15px;line-height:1.5;color:var(--ink-2);margin:0 0 28px;letter-spacing:-.01em}
#gbtn{display:flex;justify-content:center;min-height:44px}
.or{display:flex;align-items:center;gap:12px;margin:22px 0;color:var(--ink-3);font-size:12px;
  font-weight:600;letter-spacing:.08em;text-transform:uppercase}
.or::before,.or::after{content:"";flex:1;height:1px;background:var(--sep)}
.door .card{text-align:left;margin-bottom:12px}
.door input{font-size:16px;letter-spacing:-.02em}
.door input:disabled{color:var(--ink-2)}
.note{font-size:13px;line-height:1.5;color:var(--ink-2);margin:16px 0 0;letter-spacing:-.005em;
  min-height:20px}
.note.bad{color:var(--ink)}
.guest{margin:26px 0 0;padding-top:22px;box-shadow:0 -1px 0 var(--sep)}
.guest a{display:block;font-size:15px;font-weight:600;letter-spacing:-.015em;color:var(--ink);
  text-decoration:none}
.guest a:hover{text-decoration:underline}
.guest span{display:block;font-size:13px;line-height:1.5;color:var(--ink-2);margin-top:5px;
  letter-spacing:-.005em}
.door .foot{margin-top:30px;font-size:13px;color:var(--ink-3)}
.door .foot a{color:var(--ink-2);text-decoration:none;border-bottom:1px solid var(--ink-3)}
</style>
</head>
<body>
<div class="door"><div class="door-in">
  <svg class="mark" viewBox="0 0 64 56" aria-hidden="true"><g fill="currentColor"><rect x="4" y="13" width="9" height="30" rx="4.5"/><rect x="18" y="4" width="9" height="48" rx="4.5"/><rect x="32" y="17" width="9" height="22" rx="4.5"/><rect x="46" y="9" width="9" height="38" rx="4.5"/></g><rect x="1" y="24" width="61" height="7" rx="3.5" fill="var(--mark-cut,#fff)"/></svg>
  <h1>Sign in to Overlap</h1>
  <p class="lede">One tap, and your hours follow you to every meeting.</p>
  <div id="ways">
    <div id="gwrap"><div id="gbtn"></div></div>
  </div>
  <p class="note" id="note"></p>
  <p class="foot"><a href="/overlap/">Back to Overlap</a></p>
</div></div>
<script>
%(config)s
</script>
<script>
%(login)s
</script>
</body>
</html>
'''

def build_login():
    head = HEAD % {"title": "Sign in — Overlap", "theme": "#FFFFFF",
                   "desc": "Sign in to Overlap.", "scale": ""}
    write("login/index.html", LOGIN_PAGE % {
        "head": head, "css": CSS, "login": LOGIN, "config": read("config.js")})

def build_landing():
    src = read("landing.src.html")
    # the shared stylesheet becomes a style block, in place
    src = re.sub(r'<link rel="stylesheet" href="app\.css[^"]*">',
                 "<style>\n" + CSS + "\n</style>", src, count=1)
    if "app.css" in src:
        sys.exit("build: landing still references an external asset")
    write("index.html", src)

print("overlap: building self-contained pages")
build_app_pages()
build_login()
build_landing()
print("done")
