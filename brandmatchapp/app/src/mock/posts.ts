import type { Creator, Post } from '../types'
import { thumbnailFor } from '../lib/images'
import { daysAgo } from './time'

// The last 12 posts of a creator, drawn on demand. Views and comments spread
// around the creator's own median, which is how the real crawl computes
// engagement: from posts we pulled ourselves. Only the panel ever asks for
// them, so building 12 posts for every creator up front would be waste.

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 10_000) / 10_000
  }
}

function seedOf(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function postsFor(c: Creator): Post[] {
  const next = rng(seedOf(c.id))
  const gap = 30 / Math.max(c.postsPerMonth, 1)
  const firstDay = Math.max(0, Math.round((new Date().getTime() - new Date(c.lastPostAt).getTime()) / 86_400_000))
  const list: Post[] = []
  for (let i = 0; i < 12; i++) {
    const kind: Post['kind'] = next() < 0.75 ? 'reel' : 'post'
    const spread = 0.45 + next() * 1.3
    const views = Math.round(c.medianReelViews * spread * (kind === 'post' ? 0.35 : 1))
    const comments = Math.max(2, Math.round(views * c.engagementRate * (0.04 + next() * 0.05)))
    list.push({
      id: `${c.id}-p${i + 1}`,
      creatorId: c.id,
      kind,
      thumbnail: thumbnailFor(`${c.handle}-${i}`, kind),
      views,
      comments,
      date: daysAgo(Math.round(firstDay + i * gap), 12),
    })
  }
  return list
}
