import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react'
import { formatDate, InlineError, PageHeading } from '../components/ui'
import { describeChanges, shortId } from '../lib/audit'
import { loadAuditPage } from '../lib/data'
import type { AuditEvent } from '../lib/types'

const PAGE_SIZE = 20
const TABLES = ['channel_categories', 'channels', 'channel_streams', 'admin_users']

function adminLabel(event: AuditEvent, currentUserId: string): string {
  if (event.actor_id) return event.actor_id === currentUserId ? 'You' : `Admin ${shortId(event.actor_id)}`
  return 'Database owner / service'
}

export default function AuditPage({ currentUserId, refreshKey }: { currentUserId: string; refreshKey: number }) {
  const [page, setPage] = useState(0)
  const [tableFilter, setTableFilter] = useState('')
  const [rows, setRows] = useState<AuditEvent[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    loadAuditPage(page, PAGE_SIZE, tableFilter)
      .then((result) => {
        if (cancelled) return
        setRows(result.rows)
        setTotal(result.total)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'The audit log could not be loaded.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page, tableFilter, refreshKey])

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      <PageHeading
        eyebrow="MONITORING / AUDIT TRAIL"
        title="Activity log"
        subtitle="Read-only record of every catalogue change, written by database triggers. It cannot be edited or deleted here."
        action={<span className="record-count">{total} EVENTS</span>}
      />
      {error ? <InlineError message={error} /> : null}
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div><h2>Recent changes</h2><p>Newest first · page {page + 1} of {pages}</p></div>
          <select className="text-input toolbar-select" aria-label="Filter by table" value={tableFilter} onChange={(event) => { setPage(0); setTableFilter(event.target.value) }}>
            <option value="">All tables</option>
            {TABLES.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        {loading ? (
          <div className="table-state"><LoaderCircle className="spin" size={24} /><span>Loading records…</span></div>
        ) : rows.length === 0 ? (
          <div className="empty-state"><h3>No audit events</h3><p>No recorded changes match this filter.</p></div>
        ) : (
          <div className="audit-list">
            {rows.map((event) => {
              const changes = describeChanges(event)
              return (
                <article className="audit-card" key={event.id}>
                  <header>
                    <span className={`event-chip event-${event.action.toLowerCase()}`}>{event.action}</span>
                    <strong className="event-table-name">{event.table_name}</strong>
                    <code className="code-chip" title={event.record_id}>{shortId(event.record_id)}</code>
                    <span className="muted-cell">{formatDate(event.occurred_at)}</span>
                  </header>
                  <p className="audit-actor">{adminLabel(event, currentUserId)}{event.actor_role ? ` · ${event.actor_role}` : ''}</p>
                  {changes.length > 0 ? (
                    <ul className="diff-list">
                      {changes.map((line) => (
                        <li key={line.key}>
                          <b>{line.key}</b>
                          {line.before !== undefined ? <span className="diff-before">{line.before}</span> : null}
                          {line.before !== undefined && line.after !== undefined ? <span className="diff-arrow">→</span> : null}
                          {line.after !== undefined ? <span className="diff-after">{line.after}</span> : null}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="audit-actor">No field changes recorded.</p>}
                  <details>
                    <summary>Full previous and updated values</summary>
                    <pre>{JSON.stringify({ previous: event.old_data, updated: event.new_data }, null, 2)}</pre>
                  </details>
                </article>
              )
            })}
          </div>
        )}
        <div className="pagination">
          <button className="secondary-button small" type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0 || loading}><ChevronLeft size={14} /> Newer</button>
          <span>Page {page + 1} / {pages}</span>
          <button className="secondary-button small" type="button" onClick={() => setPage((value) => Math.min(pages - 1, value + 1))} disabled={page >= pages - 1 || loading}>Older <ChevronRight size={14} /></button>
        </div>
      </section>
      <div className="read-only-note">Previous and updated values can include stream URLs and headers. This page is visible to administrators only.</div>
    </>
  )
}
