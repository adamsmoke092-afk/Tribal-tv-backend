import { Menu, RefreshCw, ShieldCheck } from 'lucide-react'
import type { Section } from './Sidebar'

const titles: Record<Section, { title: string; crumb: string }> = {
  overview: { title: 'Overview', crumb: 'Workspace' },
  categories: { title: 'Categories', crumb: 'Catalogue' },
  channels: { title: 'Channels', crumb: 'Catalogue' },
  streams: { title: 'Stream sources', crumb: 'Catalogue' },
  activity: { title: 'Activity log', crumb: 'Monitoring' },
  settings: { title: 'System settings', crumb: 'Monitoring' },
}

export default function Topbar({
  section,
  email,
  onRefresh,
  refreshing,
  onMenu,
}: {
  section: Section
  email: string
  onRefresh: () => void
  refreshing: boolean
  onMenu: () => void
}) {
  const page = titles[section]
  const initials = (email.split('@')[0] || 'A').slice(0, 2).toUpperCase()

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="mobile-menu-button" aria-label="Open navigation" onClick={onMenu}><Menu size={20} /></button>
        <div className="breadcrumb"><span>{page.crumb}</span><span className="breadcrumb-slash">/</span><strong>{page.title}</strong></div>
      </div>
      <div className="topbar-right">
        <div className="secure-indicator"><ShieldCheck size={14} /><span>Secure session</span></div>
        <button className="icon-button" title="Refresh current view" aria-label="Refresh current view" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw className={refreshing ? 'spin' : ''} size={17} />
        </button>
        <div className="user-menu">
          <div className="user-avatar">{initials}</div>
          <div className="user-menu-copy"><strong>Administrator</strong><span>{email}</span></div>
        </div>
      </div>
    </header>
  )
}
