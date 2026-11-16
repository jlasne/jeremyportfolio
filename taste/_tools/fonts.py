"""Build the self-hosted Schibsted Grotesk files for tasu.ai (taste/fonts/).

Input: Google Fonts' variable latin and latin-ext woff2 subsets (wght 400-900), from
https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400..800&display=swap
  latin:     https://fonts.gstatic.com/s/schibstedgrotesk/v7/Jqz55SSPQuCQF3t8uOwiUL-taUTtap9GayojdSFO.woff2
  latin-ext: https://fonts.gstatic.com/s/schibstedgrotesk/v7/Jqz55SSPQuCQF3t8uOwiUL-taUTtap9IayojdSFOd1I.woff2
Run: python3 fonts.py latin.woff2 latin-ext.woff2 ../fonts /path/to/LiberationSans-Regular.ttf
Needs fontTools and brotli (pip install fonttools brotli). License: SIL OFL 1.1.
Output: taste/fonts/schibsted-grotesk-latin.woff2 with the `tnum` lookup narrowed
to the digits 0-9, so tabular numbers never widen . , : ; # % (they are 1300 units
wide under tnum, about 2.3x their normal width), and an untouched latin-ext copy.
Also prints the metrics for the Arial fallback face (size-adjust and overrides).
"""
import sys, shutil
from fontTools.ttLib import TTFont

src_latin, src_ext, out_dir, arial = sys.argv[1:5]
DIGITS = {'zero','one','two','three','four','five','six','seven','eight','nine'}

f = TTFont(src_latin)
gsub = f['GSUB'].table
changed = 0
for fr in gsub.FeatureList.FeatureRecord:
    if fr.FeatureTag != 'tnum':
        continue
    for li in fr.Feature.LookupListIndex:
        for st in gsub.LookupList.Lookup[li].SubTable:
            m = getattr(st, 'mapping', None)
            if not m:
                continue
            for g in list(m):
                if g not in DIGITS:
                    del m[g]; changed += 1
print('tnum: removed', changed, 'non-digit substitutions')
f.flavor = 'woff2'
f.save(out_dir + '/schibsted-grotesk-latin.woff2')
shutil.copyfile(src_ext, out_dir + '/schibsted-grotesk-latin-ext.woff2')

# Fallback metrics, next/font style: match the average advance of English text.
sample = ('the quick brown fox jumps over the lazy dog ' * 3 +
          'THE PAYWALLS BEHIND TOP APPS 0123456789 $29.99 a year, 4.8 rating')
def avg(font):
    cmap = font.getBestCmap(); hm = font['hmtx']; upm = font['head'].unitsPerEm
    w = sum(hm[cmap[ord(c)]][0] for c in sample if ord(c) in cmap)
    return w / len(sample) / upm
sg = TTFont(src_latin); ar = TTFont(arial)
upm = sg['head'].unitsPerEm
hh = sg['hhea']; os2 = sg['OS/2']
print('UPM', upm, 'hhea', hh.ascent, hh.descent, hh.lineGap,
      'typo', os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap,
      'win', os2.usWinAscent, os2.usWinDescent, 'useTypo', bool(os2.fsSelection & 128),
      'xH', os2.sxHeight, 'capH', os2.sCapHeight)
size_adjust = avg(sg) / avg(ar)
print('size-adjust: %.2f%%' % (size_adjust * 100))
print('ascent-override: %.2f%%' % (hh.ascent / upm / size_adjust * 100))
print('descent-override: %.2f%%' % (-hh.descent / upm / size_adjust * 100))
print('line-gap-override: %.2f%%' % (hh.lineGap / upm / size_adjust * 100))
