/**
 * The sunrise the portal word is cut out of.
 *
 * Drawn, not photographed, for one reason: at rest the word is 63px tall on a
 * 900px viewport, so each letter is a 7%-tall window onto this picture. A photo
 * of a hazy sky puts the same flat colour in every one of those windows and the
 * word reads as painted text. Detail has to sit in the band the word crosses.
 *
 * So the composition is built around y=414, which is 46% of the height and where
 * GlyphPortal centres the word:
 *   - the sun disc spans x 560..880, so middle letters go gold and outer letters
 *     stay orange, which varies the word across its length,
 *   - its rim and three haze rings draw arcs through the band,
 *   - cloud bars 6px to 16px tall cross it, which is the letter-scale detail a
 *     photograph was missing.
 *
 * Every value in the band stays well under the cream the page sits on, so the
 * letters over the sun still read. Measured against #faf6ec, the band runs 2.72
 * contrast on open sky down to 1.44 at the sun core.
 *
 * Ridges sit below 500 and carry the view once the dive opens the frame up.
 * Vector, so the 1.16x field scale and any later zoom stay clean.
 */

/** Ridge silhouettes, far to near. They darken as they approach. */
const RIDGES = [
  { d: 'M0,530 C90,498 150,472 250,494 C330,512 380,546 470,528 C560,510 620,468 730,486 C830,502 880,544 980,530 C1080,516 1140,474 1250,490 C1340,503 1390,532 1440,520 L1440,900 L0,900 Z', fill: '#f2bf96', haze: 0.34 },
  { d: 'M0,614 C110,580 190,552 300,578 C400,601 450,636 560,616 C670,596 730,556 850,576 C960,594 1010,634 1120,618 C1230,602 1300,562 1400,582 C1420,586 1432,592 1440,590 L1440,900 L0,900 Z', fill: '#e3a271', haze: 0.30 },
  { d: 'M0,706 C130,668 230,644 350,672 C470,700 530,732 660,710 C790,688 850,650 980,674 C1110,698 1170,730 1300,708 C1370,696 1410,684 1440,690 L1440,900 L0,900 Z', fill: '#cb8149', haze: 0.24 },
  { d: 'M0,812 C150,772 260,750 400,780 C540,810 620,836 780,812 C940,788 1010,758 1160,782 C1290,803 1370,820 1440,808 L1440,900 L0,900 Z', fill: '#a75f2c', haze: 0.18 },
]

/** Cloud bars. [x, y, width, height, light?, opacity] */
const CLOUDS: [number, number, number, number, boolean, number][] = [
  [430, 300, 240, 7, true, 0.16],
  [770, 288, 286, 8, true, 0.15],
  [96, 336, 430, 9, true, 0.24],
  [880, 330, 392, 11, true, 0.22],
  [262, 360, 286, 6, true, 0.18],
  [1010, 356, 318, 6, true, 0.17],
  [40, 392, 498, 14, true, 0.28],
  [902, 398, 512, 13, true, 0.26],
  [150, 416, 330, 7, false, 0.09],
  [960, 422, 356, 7, false, 0.08],
  [214, 446, 404, 10, false, 0.09],
  [824, 448, 448, 9, false, 0.08],
  [0, 470, 360, 16, true, 0.22],
  [1080, 474, 360, 15, true, 0.20],
]

export function Sky() {
  return (
    <svg
      className="lp-sky-art"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="sky-air" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9c3a08" />
          <stop offset="0.18" stopColor="#c94e0c" />
          <stop offset="0.32" stopColor="#e56413" />
          <stop offset="0.46" stopColor="#f2711f" />
          <stop offset="0.53" stopColor="#f5843a" />
          <stop offset="0.62" stopColor="#f8a663" />
          <stop offset="0.74" stopColor="#f4c79b" />
          <stop offset="1" stopColor="#eed0b5" />
        </linearGradient>

        {/* Wider than the disc, so the rim reads as an edge and not a cut. */}
        <radialGradient id="sky-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffb168" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="#ff9440" stopOpacity="0.30" />
          <stop offset="1" stopColor="#ff8226" stopOpacity="0" />
        </radialGradient>

        <radialGradient id="sky-disc" cx="0.5" cy="0.44" r="0.58">
          <stop offset="0" stopColor="#ffc489" />
          <stop offset="0.55" stopColor="#ffb26a" />
          <stop offset="1" stopColor="#fa9a47" />
        </radialGradient>

        <linearGradient id="sky-horizon" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffcf9a" stopOpacity="0" />
          <stop offset="1" stopColor="#ffcf9a" stopOpacity="0.5" />
        </linearGradient>

        {/* A bar with hard ends is a bar. Blurred, it is a cloud. */}
        <filter id="sky-soft" x="-20%" y="-300%" width="140%" height="700%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        {/* Haze pools on a ridge line, which is what separates it from the next. */}
        <filter id="sky-haze" x="-10%" y="-40%" width="120%" height="180%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>

      <rect width="1440" height="900" fill="url(#sky-air)" />

      <circle cx="720" cy="414" r="360" fill="url(#sky-glow)" />

      {/* Blurred, or the three of them read as a target rather than as haze. */}
      <g filter="url(#sky-haze)">
        <circle cx="720" cy="414" r="212" fill="none" stroke="#ffd9a2" strokeOpacity="0.22" strokeWidth="16" />
        <circle cx="720" cy="414" r="262" fill="none" stroke="#ffd9a2" strokeOpacity="0.14" strokeWidth="11" />
        <circle cx="720" cy="414" r="318" fill="none" stroke="#ffd9a2" strokeOpacity="0.08" strokeWidth="8" />
      </g>

      <circle cx="720" cy="414" r="160" fill="url(#sky-disc)" />

      <g filter="url(#sky-soft)">
        {CLOUDS.map(([x, y, w, h, light, o], i) => (
          <ellipse
            key={i}
            cx={x + w / 2}
            cy={y + h / 2}
            rx={w / 2}
            ry={h / 2}
            fill={light ? '#ffd7a4' : '#a8400a'}
            opacity={o}
          />
        ))}
      </g>

      <rect x="0" y="452" width="1440" height="80" fill="url(#sky-horizon)" />

      {RIDGES.map((r, i) => (
        <g key={i}>
          {/* Drawn first, so the ridge covers its lower half and leaves haze
              sitting on the ridge line. */}
          <path d={r.d} fill="none" stroke="#ffcf9a" strokeOpacity={r.haze} strokeWidth="30" filter="url(#sky-haze)" />
          <path d={r.d} fill={r.fill} />
        </g>
      ))}
    </svg>
  )
}
