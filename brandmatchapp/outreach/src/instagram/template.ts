import { readFileSync } from 'node:fs'
import type { Target } from './leads.js'

// Templates in, one message out.
//
// One rule: a placeholder nothing fills stops the message. "Hey {{firstName}}"
// landing in a real inbox costs more than the lead is worth, so an unfilled
// slot skips the lead and says so in the log.

export type Template = string

export function loadTemplates(file: string): Template[] {
  const raw = JSON.parse(readFileSync(file, 'utf8')) as unknown
  const list = Array.isArray(raw) ? raw : []
  const out = list.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
  if (out.length === 0) throw new Error(`${file} holds no template`)
  return out
}

export function fieldsFor(t: Target): Record<string, string> {
  const name = t.name || t.handle
  return {
    handle: t.handle,
    name,
    firstName: capitalised((name.split(/[\s._-]+/)[0] ?? name).trim()),
    followers: t.followers ? compact(t.followers) : '',
  }
}

/**
 * The first word of a cold message, written the way a person would write it.
 *
 * Instagram names arrive however their owner typed them, so "sylvie | online
 * fitness coach" gives "sylvie" and the message opened "Hi sylvie". A name
 * that already carries a capital anywhere is left alone, which keeps McKenzie
 * and d'Arcy intact.
 */
function capitalised(word: string): string {
  if (!word || word !== word.toLowerCase()) return word
  return word[0]!.toUpperCase() + word.slice(1)
}

export function render(template: Template, t: Target): { message: string; missing: string[] } {
  const fields = fieldsFor(t)
  const missing: string[] = []
  const message = template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const value = fields[key]
    if (!value) {
      missing.push(key)
      return ''
    }
    return value
  })
  return { message: message.replace(/\s+/g, ' ').trim(), missing }
}

/** A different template each time, so one account does not send one string 50 times. */
export function rotate(templates: Template[], index: number): Template {
  return templates[index % templates.length] as Template
}

function compact(n: number): string {
  if (n >= 1e6) return `${Math.round(n / 1e5) / 10}M`
  if (n >= 1e3) return `${Math.round(n / 100) / 10}k`
  return String(n)
}
