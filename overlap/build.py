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
        head = HEAD % {"title": "%s · Overlap" % title, "desc": desc,
                       "theme": "#F2F2F7", "scale": ", maximum-scale=1"}
        write("%s/index.html" % slug, APP_PAGE % {
            "head": head, "css": CSS, "app": APP, "config": config, "step": step})

LOGIN_PAGE = '''<!DOCTYPE html>
<html lang="en">
<head>
%(head)s
<style>
%(css)s
.door{min-height:100dvh;display:flex;align-items:center;justify-content:center;
  padding:clamp(20px,5vw,40px)}
.door-in{width:100%%;max-width:min(520px,100%%);text-align:center}
.door .mark{width:clamp(64px,11vw,88px);height:auto;margin:0 auto clamp(24px,4vh,36px);
  display:block;color:var(--ink);--mark-cut:var(--ground)}
.door h1{font-size:clamp(30px,5.2vw,44px);line-height:1.08;letter-spacing:-.04em;
  font-weight:800;margin:0 0 clamp(10px,1.6vh,16px)}
.door .lede{font-size:clamp(15px,2.2vw,19px);line-height:1.45;color:var(--ink-2);
  margin:0 auto clamp(26px,4vh,38px);letter-spacing:-.012em;max-width:34ch}
#gbtn{display:flex;justify-content:center;min-height:44px}
.note{font-size:14px;line-height:1.5;color:var(--ink-2);margin:18px 0 0;letter-spacing:-.005em;
  min-height:21px}
.note.bad{color:var(--ink)}
.door .btn{margin-top:8px}
/* the one thing sign-in has to promise, said small and last */
.door .fine{margin:clamp(26px,4vh,38px) 0 0;padding-top:clamp(18px,2.6vh,24px);
  box-shadow:0 -1px 0 var(--sep);font-size:13px;line-height:1.55;color:var(--ink-3);
  letter-spacing:-.005em}
</style>
</head>
<body>
<div class="door"><div class="door-in">
  <svg class="mark" viewBox="0 0 64 56" aria-hidden="true"><g fill="currentColor"><rect x="4" y="13" width="9" height="30" rx="4.5"/><rect x="18" y="4" width="9" height="48" rx="4.5"/><rect x="32" y="17" width="9" height="22" rx="4.5"/><rect x="46" y="9" width="9" height="38" rx="4.5"/></g><rect x="1" y="24" width="61" height="7" rx="3.5" fill="var(--mark-cut,#fff)"/></svg>
  <h1>Sign in to Overlap</h1>
  <p class="lede">One tap, and your hours follow you into every meeting.</p>
  <div id="ways">
    <div id="gwrap"><div id="gbtn"></div></div>
  </div>
  <p class="note" id="note"></p>
  <p class="fine">Free. Overlap reads when you are busy, never what you are busy with.</p>
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
    head = HEAD % {"title": "Sign in · Overlap", "theme": "#FFFFFF",
                   "desc": "Sign in to Overlap.", "scale": ""}
    write("login/index.html", LOGIN_PAGE % {
        "head": head, "css": CSS, "login": LOGIN, "config": read("config.js")})

def build_landing():
    src = read("landing.src.html")
    # the shared stylesheet becomes a style block, in place
    src = re.sub(r'<link rel="stylesheet" href="app\.css[^"]*">',
                 "<style>\n" + CSS + "\n</style>", src, count=1)
    # an unreplaced <link>/<script>, not merely the word: a comment is free
    # to name a source file without failing the build over it
    if re.search(r'(?:href|src)="(?:app\.css|app\.js|login\.js)', src):
        sys.exit("build: landing still references an external asset")
    write("index.html", src)

print("overlap: building self-contained pages")
build_app_pages()
build_login()
build_landing()
print("done")
