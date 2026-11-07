import { useMemo, useState } from 'react'
import { Radio, Settings } from 'lucide-react'
import { PublicStreamWarning } from '../components/StreamsManager'
import { DataTable, formatDate, PageHeading, SearchBox, StatusBadge } from '../components/ui'
import type { Channel, Stream } from '../lib/types'

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return 'invalid URL'
  }
}

export default function StreamsPage({
  rows,
  channels,
  loading,
  onManage,
}: {
  rows: Stream[]
  channels: Channel[]
  loading: boolean
  onManage: (channelId: string) => void
}) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | 'enabled' | 'disabled'>('all')
  const channelNames = useMemo(() => new Map(channels.map((channel) => [channel.id, channel.name])), [channels])

  const filtered = useMemo(() => {
    const needle = query.toLowerCase()
    return rows.filter((row) => {
      if (status === 'enabled' && !row.is_active) return false
      if (status === 'disabled' && row.is_active) return false
      return `${channelNames.get(row.channel_id) ?? ''} ${row.stream_type} ${hostOf(row.stream_url)}`.toLowerCase().includes(needle)
    })
  }, [rows, channelNames, query, status])

  return (
    <>
      <PageHeading
        eyebrow="CATALOGUE / DELIVERY"
        title="Stream sources"
        subtitle="Every stream across all channels. Open a channel to add, edit, reorder or disable its streams."
        action={<span className="record-count">{rows.length} RECORDS</span>}
      />
      <PublicStreamWarning />
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div><h2>Configured sources</h2><p>Only the host is shown here; full URLs and headers are inside each channel.</p></div>
          <SearchBox value={query} onChange={setQuery} placeholder="Search sources…" />
        </div>
        <div className="filter-row">
          <select className="text-input" aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value as 'all' | 'enabled' | 'disabled')}>
            <option value="all">All streams</option>
            <option value="enabled">Enabled only</option>
            <option value="disabled">Disabled only</option>
          </select>
        </div>
        <DataTable
          rows={filtered}
          loading={loading}
          rowKey={(row) => row.id}
          emptyTitle={query || status !== 'all' ? 'No matching stream sources' : 'No stream sources yet'}
          emptyDescription={query || status !== 'all' ? 'Try another channel name, host or filter.' : 'Open a channel and add its first stream.'}
          columns={[
            { label: 'CHANNEL', render: (row) => <div className="primary-cell"><span className="table-avatar stream-avatar"><Radio size={16} /></span><div><strong>{channelNames.get(row.channel_id) ?? 'Unknown channel'}</strong><small>{hostOf(row.stream_url)}</small></div></div> },
            { label: 'FORMAT', render: (row) => <span className="type-chip">{row.stream_type.toUpperCase()}</span> },
            { label: 'PRIORITY', render: (row) => <span className="order-number">{row.priority}</span> },
            { label: 'STATUS', render: (row) => <StatusBadge active={row.is_active} activeLabel="Enabled" inactiveLabel="Disabled" /> },
            { label: 'UPDATED', render: (row) => <span className="muted-cell">{formatDate(row.updated_at)}</span> },
            { label: 'MANAGE', render: (row) => <button className="secondary-button small" type="button" onClick={() => onManage(row.channel_id)}><Settings size={13} /> Open channel</button> },
          ]}
        />
      </section>
    </>
  )
}
