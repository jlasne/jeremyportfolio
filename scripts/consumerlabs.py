#!/usr/bin/env python3
"""consumer.labs: builds /consumerlabs/ (the builders) and /consumerlabs/<handle>/ (one page per builder)
from consumerlabs/data/<handle>.json. Run: python3 scripts/consumerlabs.py, then node scripts/sitemap.mjs."""
import glob, html, json, os
E = html.escape
ROOT = os.path.join(os.path.dirname(__file__), "..", "consumerlabs")
SITE = "https://www.jeremylasne.com"
CSS = open(os.path.join(os.path.dirname(__file__), "consumerlabs.css")).read()

def head(title, desc, url, ld):
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{E(title)}</title>
<meta name="description" content="{E(desc)}">
<link rel="canonical" href="{url}">
<meta name="theme-color" content="#f7f7f5">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Jeremy Lasne">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{E(title)}">
<meta property="og:description" content="{E(desc)}">
<meta property="og:image" content="{SITE}/og-image.png?v=7">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@jeremylasne">
<meta name="twitter:title" content="{E(title)}">
<meta name="twitter:description" content="{E(desc)}">
<meta name="twitter:image" content="{SITE}/og-image.png?v=7">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500&display=swap">
<script type="application/ld+json">{json.dumps(ld)}</script>
<style>{CSS}</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <a class="brand" href="/consumerlabs/">consumer<i>.</i>labs</a>
    <a href="/">by Jeremy Lasne</a>
  </header>'''

FOOT = '''  <section class="news">
    <div><h3>1 builder, 1 lesson, every week.</h3><p>The breakdowns land on X first, then here.</p></div>
    <a class="btn" href="https://x.com/jeremylasne" rel="noopener" target="_blank">Follow @jeremylasne</a>
  </section>
  <p class="note">consumer.labs collects what mobile app builders share in public. Revenue figures come from their own posts, linked on each line; totals marked "estimated" are added up by us. Builders can correct any number at hey@jeremylasne.com.</p>
</div>
</body>
</html>
'''

def avatar(F, size=64):
    ini = "".join(w[0] for w in F["name"].split()[:2])
    return (f'<img class="av" src="https://unavatar.io/x/{E(F["handle"])}" alt="{E(F["name"])}" width="{size}" height="{size}" loading="lazy" '
            f'onerror="this.outerHTML=\'&lt;div class=&quot;av fallback&quot;&gt;{E(ini)}&lt;/div&gt;\'">')

def rev_rows(items):
    out = []
    for name, cat, status, rev, date, url in items:
        r = f'<a href="{E(url)}" rel="noopener" target="_blank">{E(rev)} ↗</a>' if url else f'<span class="faint">{E(rev)}</span>'
        out.append(f'<li><div><b>{E(name)}</b><span class="meta">{E(cat)} · <span class="st {status}">{E(status)}</span></span></div><div class="r">{r}{f"<small>{E(date)}</small>" if date else ""}</div></li>')
    return "".join(out)

def nlessons(F): return sum(len(l) for _, l in F["lessons"])

def profile(F):
    url = f'{SITE}/consumerlabs/{F["handle"]}/'
    title = f'{F["name"]}: app revenue and lessons | consumer.labs'
    desc = f'{F["name"]} (@{F["handle"]}): {F["teaser"]} {nlessons(F)} lessons, each linked to his post.'
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "ProfilePage", "url": url, "name": title, "dateModified": F["asof"],
         "mainEntity": {"@type": "Person", "name": F["name"], "sameAs": [f'https://x.com/{F["handle"]}']}},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE}/"},
            {"@type": "ListItem", "position": 2, "name": "consumer.labs", "item": f"{SITE}/consumerlabs/"},
            {"@type": "ListItem", "position": 3, "name": F["name"], "item": url}]}]}
    srcs = lambda urls: " ".join(f'<a href="{E(u)}" rel="noopener" target="_blank">{i+1}</a>' for i, u in enumerate(urls))
    lessons = "".join(
        f'<details {"open" if i == 0 else ""}><summary><span>{E(t)}</span><span class="count">{len(ls)}</span></summary><ol>' +
        "".join(f'<li><p class="l">{E(l)}</p><blockquote>“{E(q)}”</blockquote><a class="src" href="{E(u)}" rel="noopener" target="_blank">{E(d)} · see the post ↗</a></li>' for l, q, d, u in ls) +
        '</ol></details>' for i, (t, ls) in enumerate(F["lessons"]))
    climb = "".join(f'<li><span class="d">{E(d)}</span><span class="v">{E(v)}</span></li>' for d, v in F["climb"])
    stats = "".join(f'<div class="stat"><b>{E(n)}</b><span>{E(l)}</span></div>' for n, l in F["stats"])
    return head(title, desc, url, ld) + f'''
  <a class="back" href="/consumerlabs/">← All builders</a>
  <article class="card profile">
    <div class="card-head">
      {avatar(F)}
      <div class="who">
        <h1>{E(F["name"])}</h1>
        <a href="https://x.com/{E(F["handle"])}" rel="noopener" target="_blank">@{E(F["handle"])} ↗</a>
        <p>{E(F["one"])}</p>
      </div>
      <div class="asof">as of<br>{E(F["asof_h"])}</div>
    </div>
    <div class="total"><span class="big">{E(F["total"])}</span><span class="unit">{E(F["total_note"])}, apps and SaaS together</span></div>
    <div class="stats">{stats}</div>
    <div class="body">
      <div class="split">
        <section class="sec"><h2 class="lab">mobile apps</h2><ul class="revs">{rev_rows(F["apps"])}</ul></section>
        <section class="sec"><h2 class="lab">products for app makers</h2><ul class="revs">{rev_rows(F["products"])}</ul></section>
      </div>
      <section class="sec"><h2 class="lab">{E(F.get("climb_title", "the climb"))}</h2><ol class="climb">{climb}</ol></section>
      <div class="split">
        <section class="sec phase"><h2 class="lab">at the start</h2><p>{E(F["start"][0])}</p><div class="s">sources{srcs(F["start"][1])}</div></section>
        <section class="sec phase"><h2 class="lab">now</h2><p>{E(F["now"][0])}</p><div class="s">sources{srcs(F["now"][1])}</div></section>
      </div>
      <section class="sec"><h2 class="lab">{nlessons(F)} lessons you can copy, from his posts</h2>{lessons}</section>
    </div>
    <div class="card-foot"><span>Estimates built from public posts. Per-app numbers not shared in public stay blank.</span><a href="mailto:hey@jeremylasne.com?subject=consumer.labs%20correction%20{E(F["handle"])}">Correct a number</a></div>
  </article>
''' + FOOT

def landing(makers):
    url = f"{SITE}/consumerlabs/"
    title = "consumer.labs: mobile app builders and their revenue"
    desc = "The builders behind indie mobile apps: what they earn, how they started, how they grow now. Every number links to the builder's own post."
    ld = {"@context": "https://schema.org", "@type": "CollectionPage", "name": "consumer.labs", "url": url, "description": desc,
          "hasPart": [{"@type": "ProfilePage", "url": f'{url}{m["handle"]}/', "name": m["name"]} for m in makers]}
    total_lessons = sum(nlessons(m) for m in makers)
    cards = "".join(f'''<a class="tile" href="/consumerlabs/{E(m["handle"])}/">
      <div class="tile-head">{avatar(m, 48)}<div><b>{E(m["name"])}</b><span>@{E(m["handle"])}</span></div></div>
      <div class="tile-total">{E(m["total"])}<small>/mo, estimated</small></div>
      <p>{E(m["teaser"])}</p>
      <div class="tile-foot"><span>{len(m["apps"])} apps · {len(m["products"])} product{"s" if len(m["products"]) != 1 else ""} · {nlessons(m)} lessons</span><span class="go">Open →</span></div>
    </a>''' for m in makers)
    return head(title, desc, url, ld) + f'''
  <section class="hero">
    <div class="lab">mobile app builders, in their own words</div>
    <h1>The builders behind indie apps. <mark>And the receipts.</mark></h1>
    <p class="sub">Each builder gets a page: their apps, what they sell to other app makers, how they started, how they grow now and the lessons they shared. Every number links to their own post.</p>
    <div class="pills"><span class="pill"><b>{len(makers)}</b> builder{"s" if len(makers) != 1 else ""}</span><span class="pill"><b>{total_lessons}</b> lessons</span><span class="pill">updated <b>{E(max(m["asof_h"] for m in makers))}</b></span></div>
  </section>
  <main class="tiles">
    {cards}
    <div class="tile next"><b>Next builder in progress.</b><p>Building mobile apps and sharing your numbers? <a href="https://x.com/jeremylasne" rel="noopener" target="_blank">Tell me on X</a>.</p></div>
  </main>
''' + FOOT

makers = [json.load(open(p)) for p in sorted(glob.glob(os.path.join(ROOT, "data", "*.json")))]
for m in makers:
    os.makedirs(os.path.join(ROOT, m["handle"]), exist_ok=True)
    page = profile(m)
    assert "—" not in page
    open(os.path.join(ROOT, m["handle"], "index.html"), "w").write(page)
page = landing(makers)
assert "—" not in page
open(os.path.join(ROOT, "index.html"), "w").write(page)
print(f"consumer.labs: {len(makers)} builder page(s) + landing")
