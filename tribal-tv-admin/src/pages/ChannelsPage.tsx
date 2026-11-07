import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Plus, Radio, Tv } from 'lucide-react'
import ChannelEditor from '../components/ChannelEditor'
import type { EditorTab } from '../components/ChannelEditor'
import type { Notify } from '../components/Toasts'
import { DataTable, InlineError, PageHeading, SearchBox, StatusBadge } from '../components/ui'
import { applySortOrder, ROW_LIMIT, updateChannel } from '../lib/data'
import { planMove } from '../lib/ordering'
import type { Category, Channel, Stream } from '../lib/types'

type StatusFilter = 'all' | 'active' | 'inactive'

export default function ChannelsPage({
  rows,
  categories,
  streams,
  loading,
  notify,
  onChanged,
  initialCategoryId,
  requestedChannelId,
  onRequestHandled,
}: {
  rows: Channel[]
  categories: Category[]
  streams: Stream[]
  loading: boolean
  notify: Notify
  onChanged: () => Promise<void>
  initialCategoryId: string
  requestedChannelId: string | null
  onRequestHandled: () => void
}) {
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState(initialCategoryId)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [countryFilter, setCountryFilter] = useState('')
  const [editing, setEditing] = useState<{ channel: Channel | null; tab: EditorTab } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setCategoryFilter(initialCategoryId)
  }, [initialCategoryId])

  useEffect(() => {
    if (!requestedChannelId || loading) return
    const target = rows.find((row) => row.id === requestedChannelId)
    if (target) setEditing({ channel: target, tab: 'streams' })
    onRequestHandled()
  }, [requestedChannelId, rows, loading, onRequestHandled])

  const categoryNames = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories])

  const streamCounts = useMemo(() => {
    const counts = new Map<string, { total: number; active: number }>()
    for (const stream of streams) {
      const entry = counts.get(stream.channel_id) ?? { total: 0, active: 0 }
      entry.total += 1
      if (stream.is_active) entry.active += 1
      counts.set(stream.channel_id, entry)
    }
    return counts
  }, [streams])

  const countries = useMemo(
    () => Array.from(new Set(rows.map((row) => row.country).filter((value): value is string => Boolean(value)))).sort(),
    [rows],
  )

  const filtered = useMemo(() => {
    const needle = query.toLowerCase()
    return rows.filter((row) => {
      if (categoryFilter && row.category_id !== categoryFilter) return false
      if (statusFilter === 'active' && !row.is_active) return false
      if (statusFilter === 'inactive' && row.is_active) return false
      if (countryFilter && row.country !== countryFilter) return false
      if (!needle) return true
      return `${row.name} ${row.slug} ${row.country ?? ''} ${row.language ?? ''} ${row.epg_id ?? ''}`.toLowerCase().includes(needle)
    })
  }, [rows, query, categoryFilter, statusFilter, countryFilter])

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true)
    try {
      await action()
      notify('success', success)
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'The change could not be saved.')
    } finally {
      setBusy(false)
    }
    await onChanged()
  }

  function move(channel: Channel, direction: 'up' | 'down') {
    const updates = planMove(
      rows.map((row) => ({ id: row.id, value: row.sort_order })),
      channel.id,
      direction,
      { base: 10, step: 10, visibleIds: filtered.map((row) => row.id) },
    )
    if (updates.length === 0) return
    void run(() => applySortOrder('channels', updates), 'Channel order saved.')
  }

  function toggle(channel: Channel) {
    void run(
      async () => { await updateChannel(channel.id, { is_active: !channel.is_active }) },
      channel.is_active ? `“${channel.name}” deactivated and hidden from the app.` : `“${channel.name}” activated.`,
    )
  }

  const activeFilters = Boolean(query || categoryFilter || statusFilter !== 'all' || countryFilter)

  return (
    <>
      <PageHeading
        eyebrow="CATALOGUE / CHANNEL DIRECTORY"
        title="Channels"
        subtitle="Add, edit, order and activate the channels shown in Tribal TV."
        action={<button className="primary-button compact" type="button" onClick={() => setEditing({ channel: null, tab: 'details' })}><Plus size={16} /> Add channel</button>}
      />
      {rows.length >= ROW_LIMIT ? <InlineError message={`Only the first ${ROW_LIMIT} channels are loaded. Narrow the list with filters.`} /> : null}
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div><h2>Channel directory</h2><p>{filtered.length} of {rows.length} channels · sorted by display order</p></div>
          <SearchBox value={query} onChange={setQuery} placeholder="Search channels…" />
        </div>
        <div className="filter-row">
          <select className="text-input" aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <select className="text-input" aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
          <select className="text-input" aria-label="Filter by country" value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)}>
            <option value="">All countries</option>
            {countries.map((country) => <option key={country} value={country}>{country}</option>)}
          </select>
          {activeFilters ? (
            <button className="secondary-button small" type="button" onClick={() => { setQuery(''); setCategoryFilter(''); setStatusFilter('all'); setCountryFilter('') }}>Clear filters</button>
          ) : null}
        </div>
        <DataTable
          rows={filtered}
          loading={loading}
          rowKey={(row) => row.id}
          emptyTitle={activeFilters ? 'No matching channels' : 'No channels yet'}
          emptyDescription={activeFilters ? 'Try different filters or search terms.' : 'Add your first channel, then give it a stream.'}
          columns={[
            {
              label: 'CHANNEL',
              render: (row) => (
                <div className="primary-cell">
                  <span className="table-avatar channel-avatar">
                    {row.logo_url ? <img className="logo-thumb" src={row.logo_url} alt="" loading="lazy" /> : <Tv size={16} />}
                  </span>
                  <div><strong>{row.name}</strong><small>{row.slug}</small></div>
                </div>
              ),
            },
            { label: 'CATEGORY', render: (row) => <span>{categoryNames.get(row.category_id) ?? 'Unknown'}</span> },
            { label: 'REGION', render: (row) => <span className="muted-cell">{row.country || '—'} · {row.language || '—'}</span> },
            { label: 'EPG ID', render: (row) => <code className="code-chip">{row.epg_id || '—'}</code> },
            {
              label: 'STREAMS',
              render: (row) => {
                const counts = streamCounts.get(row.id) ?? { total: 0, active: 0 }
                return (
                  <button className={`link-button${counts.active === 0 ? ' is-warning' : ''}`} type="button" onClick={() => setEditing({ channel: row, tab: 'streams' })}>
                    <Radio size={12} /> {counts.active}/{counts.total} enabled
                  </button>
                )
              },
            },
            {
              label: 'ORDER',
              render: (row) => (
                <div className="order-controls">
                  <button className="mini-button" type="button" aria-label={`Move ${row.name} up`} onClick={() => move(row, 'up')} disabled={busy}><ArrowUp size={14} /></button>
                  <span className="order-number">{row.sort_order}</span>
                  <button className="mini-button" type="button" aria-label={`Move ${row.name} down`} onClick={() => move(row, 'down')} disabled={busy}><ArrowDown size={14} /></button>
                </div>
              ),
            },
            {
              label: 'STATUS',
              render: (row) => (
                <button className="status-toggle" type="button" onClick={() => toggle(row)} disabled={busy} title={row.is_active ? 'Tap to deactivate' : 'Tap to activate'}>
                  <StatusBadge active={row.is_active} />
                </button>
              ),
            },
            {
              label: 'ACTIONS',
              render: (row) => (
                <div className="row-actions">
                  <button className="secondary-button small" type="button" onClick={() => setEditing({ channel: row, tab: 'details' })}><Pencil size={13} /> Edit</button>
                </div>
              ),
            },
          ]}
        />
      </section>
      <div className="read-only-note">Deactivating a channel hides it from the app but keeps all its data. Reordering applies to the global channel order.</div>

      {editing ? (
        <ChannelEditor
          channel={editing.channel}
          categories={categories}
          channels={rows}
          streams={streams}
          initialTab={editing.tab}
          notify={notify}
          onClose={() => setEditing(null)}
          onChanged={onChanged}
        />
      ) : null}
    </>
  )
}
