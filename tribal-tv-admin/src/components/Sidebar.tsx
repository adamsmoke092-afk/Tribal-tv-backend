import {
  Activity,
  ChevronRight,
  Database,
  FolderOpen,
  LayoutDashboard,
  Radio,
  Settings,
  Tv,
  X,
} from 'lucide-react'

export type Section = 'overview' | 'categories' | 'channels' | 'streams' | 'activity' | 'settings'

const groups = [
  {
    label: 'WORKSPACE',
    items: [
      { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
      { id: 'categories' as const, label: 'Categories', icon: FolderOpen },
      { id: 'channels' as const, label: 'Channels', icon: Tv },
      { id: 'streams' as const, label: 'Stream sources', icon: Radio },
    ],
  },
  {
    label: 'MONITORING',
    items: [
      { id: 'activity' as const, label: 'Activity log', icon: Activity },
      { id: 'settings' as const, label: 'System settings', icon: Settings },
    ],
  },
]

export default function Sidebar({
  active,
  onNavigate,
  open,
  onClose,
}: {
  active: Section
  onNavigate: (section: Section) => void
  open: boolean
  onClose: () => void
}) {
  return (
    <>
      {open ? <button className="sidebar-scrim" aria-label="Close navigation" onClick={onClose} /> : null}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark"><Tv size={21} strokeWidth={2.1} /></div>
          <div className="brand-copy">
            <div className="brand-name">TRIBAL TV</div>
            <div className="brand-caption">ADMIN CONSOLE</div>
          </div>
          <button className="sidebar-close" aria-label="Close menu" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="workspace-chip">
          <div className="workspace-chip-icon"><Database size={15} /></div>
          <div><strong>Production</strong><span>EU · eu-west-3</span></div>
          <span className="workspace-live-dot" />
        </div>

        <nav className="side-navigation" aria-label="Main navigation">
          {groups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              {group.items.map((item) => {
                const Icon = item.icon
                const selected = active === item.id
                return (
                  <button
                    key={item.id}
                    className={`nav-item ${selected ? 'nav-item-active' : ''}`}
                    onClick={() => { onNavigate(item.id); onClose() }}
                    aria-current={selected ? 'page' : undefined}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    <span>{item.label}</span>
                    {selected ? <ChevronRight className="nav-chevron" size={15} /> : null}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-protection">
            <div className="protection-icon"><Database size={16} /></div>
            <div><strong>Database protected</strong><span>RLS policies active</span></div>
            <span className="protection-check">✓</span>
          </div>
          <div className="sidebar-build">TRIBAL ADMIN <span>v0.1.0</span></div>
        </div>
      </aside>
    </>
  )
}
