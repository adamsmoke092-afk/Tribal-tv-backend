import type { ReactNode } from 'react'
import { LoaderCircle, Search } from 'lucide-react'

export function PageHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string
  title: string
  subtitle: string
  action?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      {action ? <div className="page-heading-action">{action}</div> : null}
    </div>
  )
}

export function StatusBadge({ active, activeLabel = 'Active', inactiveLabel = 'Inactive' }: {
  active: boolean
  activeLabel?: string
  inactiveLabel?: string
}) {
  return (
    <span className={`status-badge ${active ? 'is-active' : 'is-inactive'}`}>
      <span className="status-dot" />
      {active ? activeLabel : inactiveLabel}
    </span>
  )
}

export function SearchBox({
  value,
  onChange,
  placeholder = 'Search records…',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="search-box">
      <Search size={16} aria-hidden="true" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </label>
  )
}

export interface TableColumn<T> {
  label: string
  render: (row: T) => ReactNode
  className?: string
}

export function DataTable<T>({
  columns,
  rows,
  loading,
  emptyTitle,
  emptyDescription,
  rowKey,
}: {
  columns: TableColumn<T>[]
  rows: T[]
  loading: boolean
  emptyTitle: string
  emptyDescription: string
  rowKey: (row: T, index: number) => string
}) {
  if (loading) {
    return (
      <div className="table-state">
        <LoaderCircle className="spin" size={24} />
        <span>Loading records…</span>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><Search size={22} /></div>
        <h3>{emptyTitle}</h3>
        <p>{emptyDescription}</p>
      </div>
    )
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th className={column.className} key={column.label}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey(row, index)}>
              {columns.map((column) => (
                <td className={column.className} key={column.label}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function InlineError({ message }: { message: string }) {
  return (
    <div className="inline-error" role="alert">
      <span className="error-mark">!</span>
      <span>{message}</span>
    </div>
  )
}

export function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
