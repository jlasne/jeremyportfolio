// Strip a drawing's flat ground to transparency, keeping its edges clean.
//
// A generated image arrives on a flat ground that is never quite the page's
// colour and never quite flat. This reads the ground from the corners, turns
// every pixel's distance from it into alpha, and un-blends the colour so an
// anti-aliased stroke keeps its true colour instead of a fringe of ground.
// Soft shadows come out as soft translucent grey, which is what they are.
//
//   node scripts/unmatte.mjs src/art/stack.png [more.png ...]
import { PNG } from 'pngjs'
import { readFileSync, writeFileSync } from 'node:fs'

const LO = 8    // within this of the ground: fully transparent (absorbs noise)
const HI = 70   // this far from the ground: fully opaque

for (const file of process.argv.slice(2)) {
  const png = PNG.sync.read(readFileSync(file))
  const { width: w, height: h, data } = png
  const px = (x, y) => { const i = (y * w + x) * 4; return [data[i], data[i + 1], data[i + 2]] }

  // The ground is the median of a ring of samples around the edge.
  const samples = []
  for (let t = 0; t < 40; t++) {
    const k = Math.floor((t / 40) * (w - 1))
    samples.push(px(k, 3), px(k, h - 4), px(3, Math.floor((t / 40) * (h - 1))), px(w - 4, Math.floor((t / 40) * (h - 1))))
  }
  const ground = [0, 1, 2].map((c) => samples.map((s) => s[c]).sort((a, b) => a - b)[samples.length >> 1])

  let kept = 0
  for (let i = 0; i < data.length; i += 4) {
    const d = Math.max(Math.abs(data[i] - ground[0]), Math.abs(data[i + 1] - ground[1]), Math.abs(data[i + 2] - ground[2]))
    const a = Math.max(0, Math.min(1, (d - LO) / (HI - LO)))
    // A transparent pixel keeps no colour: noisy ground under alpha zero is
    // invisible and still costs most of the file.
    if (a === 0) { data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0; continue }
    // p = a*c + (1-a)*g  =>  c = (p - (1-a)*g) / a
    for (let c = 0; c < 3; c++) {
      data[i + c] = Math.max(0, Math.min(255, Math.round((data[i + c] - (1 - a) * ground[c]) / a)))
    }
    data[i + 3] = Math.round(a * 255)
    kept++
  }
  writeFileSync(file, PNG.sync.write(png, { deflateLevel: 9 }))
  const hex = '#' + ground.map((v) => v.toString(16).padStart(2, '0')).join('')
  console.log(`${file.split('/').pop().padEnd(18)} ground ${hex}  kept ${(100 * kept / (w * h)).toFixed(1)}% of pixels`)
}
