import type { AuditEvent } from './types'

export interface ChangeLine {
  key: string
  before?: string
  after?: string
}

const HIDDEN_KEYS = new Set(['updated_at', 'created_at'])

export function showValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text.length > 120 ? `${text.slice(0, 117)}…` : text
}

/** Summarises an audit event: for updates only the fields that actually changed. */
export function describeChanges(event: Pick<AuditEvent, 'action' | 'old_data' | 'new_data'>): ChangeLine[] {
  const before = event.old_data ?? {}
  const after = event.new_data ?? {}
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).filter((key) => !HIDDEN_KEYS.has(key))

  if (event.action === 'UPDATE') {
    return keys
      .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      .map((key) => ({ key, before: showValue(before[key]), after: showValue(after[key]) }))
  }
  if (event.action === 'INSERT') return keys.map((key) => ({ key, after: showValue(after[key]) }))
  return keys.map((key) => ({ key, before: showValue(before[key]) }))
}

export function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}
