#!/usr/bin/env python3
"""tasu.ai media helper. Run it from anywhere: python3 taste/_tools/media.py [--jpeg]

Writes small copies that the generator picks up when they exist (build.mjs falls back to the
originals otherwise):
  media/<slug>/icon-256.webp     every icon shown at 128 CSS px or less (icon.png stays for JSON-LD)
  media/<slug>/thumb-pwN.webp    each paywall capture at 216 px wide, for the hero's floating cards
                                 (they render 40 to 104 px wide)
With --jpeg it also re-encodes the App Store screenshots (sN.jpg) and the UI element crops
(el-*.jpg) saved near-lossless (first luminance quantizer 4 or less, about quality 87 and up) at
quality 80, progressive. Dimensions stay the same, and a second run changes nothing.
Needs Pillow. Thumbnails are rebuilt only when the source is newer."""
import glob
import os
import sys

from PIL import Image

MEDIA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'media')
THUMB_W = 216


def newer(src, dst):
    return not os.path.exists(dst) or os.path.getmtime(src) > os.path.getmtime(dst)


def webp(src, dst, width, quality):
    if not newer(src, dst):
        return False
    im = Image.open(src)
    im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
    if im.width != width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=quality, method=6)
    return True


def near_lossless(path):
    try:
        q = Image.open(path).quantization
    except Exception:
        return False
    return bool(q) and q[0][0] <= 4


def main():
    made, saved = [], 0
    for folder in sorted(glob.glob(os.path.join(MEDIA, '*', ''))):
        icon = os.path.join(folder, 'icon.png')
        if os.path.exists(icon) and webp(icon, os.path.join(folder, 'icon-256.webp'), 256, 90):
            made.append(os.path.relpath(os.path.join(folder, 'icon-256.webp'), MEDIA))
        for pw in sorted(glob.glob(os.path.join(folder, 'pw[0-9]*.jpg'))):
            dst = os.path.join(folder, 'thumb-' + os.path.basename(pw)[:-4] + '.webp')
            if webp(pw, dst, THUMB_W, 80):
                made.append(os.path.relpath(dst, MEDIA))
        if '--jpeg' in sys.argv:
            for f in sorted(glob.glob(os.path.join(folder, 's[0-9]*.jpg')) + glob.glob(os.path.join(folder, 'el-*.jpg'))):
                if not near_lossless(f):
                    continue
                before = os.path.getsize(f)
                Image.open(f).convert('RGB').save(f, 'JPEG', quality=80, optimize=True, progressive=True)
                saved += before - os.path.getsize(f)
                made.append(os.path.relpath(f, MEDIA) + ' (re-encoded)')
    total = sum(os.path.getsize(f) for f in glob.glob(os.path.join(MEDIA, '*', '*')))
    print(f'{len(made)} files written' + (f', {saved / 1e6:.2f} MB saved' if saved else ''))
    for m in made:
        print('  ' + m)
    print(f'media folder: {total / 1e6:.2f} MB (cap 15 MB)')


if __name__ == '__main__':
    main()
