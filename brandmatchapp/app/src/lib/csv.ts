// A CSV the client can open in a spreadsheet, built and downloaded in the
// browser. Nothing leaves the page to produce it.

function cell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  // A comma, a quote or a newline inside a field means the field gets quoted.
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const head = columns.map(cell).join(',')
  const body = rows.map((row) => columns.map((c) => cell(row[c])).join(','))
  // Excel reads a plain UTF-8 file as Latin-1 without the mark in front.
  return '﻿' + [head, ...body].join('\r\n')
}

export function download(name: string, text: string): void {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
