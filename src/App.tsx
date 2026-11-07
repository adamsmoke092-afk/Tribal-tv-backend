import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  FolderOpen,
  Gauge,
  Radio,
  ShieldCheck,
  Tv,
} from 'lucide-react'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import AccessDenied from './components/AccessDenied'
import AuthScreen from './components/AuthScreen'
import Sidebar from './components/Sidebar'
import type { Section } from './components/Sidebar'
import ToastHost from './components/Toasts'
import type { Notify, Toast } from './components/Toasts'
import Topbar from './components/Topbar'
import { formatDate, InlineError, PageHeading, StatusBadge } from './components/ui'
import { checkAdminAccess } from './lib/adminAccess'
import {
  loadCatalogueStats,
  loadCategories,
  loadChannels,
  loadRecentActivity,
  loadStreams,
} from './lib/data'
import { supabase } from './lib/supabase'
import type { AuditEvent, CatalogueStats, Category, Channel, Stream } from './lib/types'
import AuditPage from './pages/AuditPage'
import CategoriesPage from './pages/CategoriesPage'
import ChannelsPage from './pages/ChannelsPage'
import StreamsPage from './pages/StreamsPage'

type AuthState = 'checking' | 'signed-out' | 'not-admin' | 'admin'

const emptyStats: CatalogueStats = {
  categories: 0,
  activeChannels: 0,
  inactiveChannels: 0,
  streams: 0,
  activeStreams: 0,
  catalogueVersion: null,
  catalogueUpdatedAt: null,
}

function projectRefFromUrl(): string {
  try {
    return new URL(String(import.meta.env.VITE_SUPABASE_URL)).hostname.split('.')[0]
  } catch {
    return 'unknown'
  }
}

function Overview({
  stats,
  activity,
  onNavigate,
}: {
  stats: CatalogueStats
  activity: AuditEvent[]
  onNavigate: (section: Section) => void
}) {
  const cards = [
    { label: 'Categories', value: stats.categories, icon: FolderOpen, note: 'Catalogue groups', section: 'categories' as const },
    { label: 'Active channels', value: stats.activeChannels, icon: Tv, note: 'Listed in the app', section: 'channels' as const },
    { label: 'Inactive channels', value: stats.inactiveChannels, icon: Tv, note: 'Hidden from the app', section: 'channels' as const },
    { label: 'Stream sources', value: stats.streams, icon: Radio, note: `${stats.activeStreams} enabled`, section: 'streams' as const },
  ]

  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / OVERVIEW"
        title="Good day, Administrator."
        subtitle="A live snapshot of the Tribal TV catalogue and its recent changes."
        action={<span className="live-pill"><span /> LIVE DATABASE</span>}
      />

      <section className="stats-grid" aria-label="Catalogue totals">
        {cards.map((card, index) => {
          const Icon = card.icon
          return (
            <button className={`stat-card stat-card-${index + 1}`} key={card.label} onClick={() => onNavigate(card.section)}>
              <div className="stat-card-top">
                <span className="stat-icon"><Icon size={19} /></span>
                <ArrowUpRight size={16} className="stat-arrow" />
              </div>
              <div className="stat-value">{card.value.toLocaleString()}</div>
              <div className="stat-label">{card.label}</div>
              <div className="stat-note">{card.note}</div>
            </button>
          )
        })}
      </section>

      <div className="overview-grid">
        <section className="panel activity-panel">
          <div className="panel-heading">
            <div><p className="panel-kicker">MONITORING</p><h2>Recent activity</h2></div>
            <button className="text-button" onClick={() => onNavigate('activity')}>View activity <ArrowUpRight size={14} /></button>
          </div>
          {activity.length === 0 ? (
            <div className="compact-empty"><Activity size={20} /><span>No audit activity has been recorded yet.</span></div>
          ) : (
            <div className="activity-list">
              {activity.slice(0, 5).map((event) => (
                <div className="activity-row" key={event.id}>
                  <div className={`activity-action-icon action-${event.action.toLowerCase()}`}>
                    {event.action === 'INSERT' ? '+' : event.action === 'DELETE' ? '−' : '↻'}
                  </div>
                  <div className="activity-main">
                    <strong>{event.action.toLowerCase()} <span>{event.table_name.replaceAll('_', ' ')}</span></strong>
                    <small>{event.actor_role || 'authenticated'} · {formatDate(event.occurred_at)}</small>
                  </div>
                  <span className="activity-type">{event.table_name}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel health-panel">
          <div className="panel-heading">
            <div><p className="panel-kicker">CATALOGUE</p><h2>Version and updates</h2></div>
            <span className="health-icon"><Gauge size={20} /></span>
          </div>
          <div className="health-status"><span className="health-pulse" /><strong>Version {stats.catalogueVersion ?? '—'}</strong></div>
          <p className="health-description">The app compares this number to know when to download the catalogue again. It increases after every change to categories, channels or streams.</p>
          <div className="health-checks">
            <div><span><CheckCircle2 size={15} /> Last catalogue update</span><b>{stats.catalogueUpdatedAt ? formatDate(stats.catalogueUpdatedAt) : '—'}</b></div>
            <div><span><CheckCircle2 size={15} /> Enabled streams</span><b>{stats.activeStreams} / {stats.streams}</b></div>
            <div><span><CheckCircle2 size={15} /> Administrator session</span><b>Verified</b></div>
          </div>
          <button className="health-link" onClick={() => onNavigate('settings')}>View system configuration <ArrowUpRight size={14} /></button>
        </section>
      </div>

      <section className="quick-links">
        <div><p className="panel-kicker">GET STARTED</p><h2>Manage your catalogue</h2><p>Add categories, then channels, then give each channel one or more streams.</p></div>
        <button onClick={() => onNavigate('categories')}><FolderOpen size={18} /><span>Categories</span><ArrowUpRight size={15} /></button>
        <button onClick={() => onNavigate('channels')}><Tv size={18} /><span>Channels</span><ArrowUpRight size={15} /></button>
        <button onClick={() => onNavigate('streams')}><Radio size={18} /><span>Stream sources</span><ArrowUpRight size={15} /></button>
      </section>
    </>
  )
}

function SettingsPage({ stats, connected }: { stats: CatalogueStats; connected: boolean }) {
  return (
    <>
      <PageHeading eyebrow="MONITORING / ENVIRONMENT" title="System settings" subtitle="Details about this dashboard's connection and access controls." />
      <div className="settings-grid">
        <section className="panel settings-panel">
          <div className="panel-heading"><div><p className="panel-kicker">BACKEND</p><h2>Supabase project</h2></div><span className="settings-symbol"><FolderOpen size={19} /></span></div>
          <div className="settings-rows">
            <div><span>Project reference</span><code>{projectRefFromUrl()}</code></div>
            <div><span>Data connection</span><StatusBadge active={connected} activeLabel="Connected" inactiveLabel="Problem loading data" /></div>
            <div><span>Catalogue version</span><strong>{stats.catalogueVersion ?? '—'}</strong></div>
            <div><span>Dashboard mode</span><strong>Catalogue management · administrators only</strong></div>
          </div>
        </section>
        <section className="panel settings-panel">
          <div className="panel-heading"><div><p className="panel-kicker">SECURITY</p><h2>Access controls</h2></div><span className="settings-symbol shield-symbol"><ShieldCheck /></span></div>
          <div className="security-list">
            <div><CheckCircle2 size={17} /><span><strong>Supabase Auth</strong><small>Email and password sign-in only</small></span><b>Enabled</b></div>
            <div><CheckCircle2 size={17} /><span><strong>Admin allow-list</strong><small>Checked by is_current_user_admin() at sign-in</small></span><b>Verified</b></div>
            <div><CheckCircle2 size={17} /><span><strong>Row-level security</strong><small>Enforced by the database on every read and write</small></span><b>Server-side</b></div>
            <div><CheckCircle2 size={17} /><span><strong>Privileged keys</strong><small>No service-role or secret key in the browser</small></span><b>Not used</b></div>
          </div>
        </section>
      </div>
      <section className="configuration-callout"><CircleAlert size={18} /><div><strong>Some settings live only in Supabase.</strong><p>This dashboard cannot change the admin allow-list, database policies, Auth settings (such as disabling public sign-ups or leaked-password protection) or API keys. Administrators are added by the database owner through the secure SQL process.</p></div></section>
    </>
  )
}

export default function App() {
  const [authState, setAuthState] = useState<AuthState>('checking')
  const [user, setUser] = useState<User | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [section, setSection] = useState<Section>('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [stats, setStats] = useState<CatalogueStats>(emptyStats)
  const [categories, setCategories] = useState<Category[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [activity, setActivity] = useState<AuditEvent[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [channelCategoryFilter, setChannelCategoryFilter] = useState('')
  const [requestedChannelId, setRequestedChannelId] = useState<string | null>(null)
  const authCheckSequence = useRef(0)
  const suppressNextSignOut = useRef(false)
  const toastCounter = useRef(0)

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback<Notify>(
    (kind, message) => {
      const id = ++toastCounter.current
      setToasts((current) => [...current.slice(-3), { id, kind, message }])
      window.setTimeout(() => dismissToast(id), kind === 'error' ? 9000 : 4500)
    },
    [dismissToast],
  )

  const verifyAccess = useCallback(async () => {
    const sequence = ++authCheckSequence.current
    try {
      const result = await checkAdminAccess()
      if (sequence !== authCheckSequence.current) return
      if (result.status === 'admin') {
        setUser(result.user)
        setAuthError(null)
        setAuthState('admin')
      } else if (result.status === 'not-admin') {
        setUser(null)
        suppressNextSignOut.current = true
        await supabase.auth.signOut({ scope: 'local' })
        if (sequence === authCheckSequence.current) setAuthState('not-admin')
      } else {
        setUser(null)
        setAuthState('signed-out')
      }
    } catch (error) {
      if (sequence !== authCheckSequence.current) return
      setUser(null)
      setAuthState('signed-out')
      setAuthError(error instanceof Error ? error.message : 'Admin access could not be verified.')
    }
  }, [])

  useEffect(() => {
    void verifyAccess()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      // Defer work out of the auth callback to avoid awaiting Supabase calls
      // while its internal auth lock is held.
      window.setTimeout(() => {
        if (!session && suppressNextSignOut.current) {
          suppressNextSignOut.current = false
          return
        }
        void verifyAccess()
      }, 0)
    })
    return () => {
      authCheckSequence.current += 1
      subscription.unsubscribe()
    }
  }, [verifyAccess])

  const refreshData = useCallback(async (quiet = false) => {
    if (authState !== 'admin') return
    setRefreshing(true)
    if (!quiet) setDataLoading(true)
    setDataError(null)
    try {
      const [nextStats, nextCategories, nextChannels, nextStreams, nextActivity] = await Promise.all([
        loadCatalogueStats(),
        loadCategories(),
        loadChannels(),
        loadStreams(),
        loadRecentActivity(12),
      ])
      setStats(nextStats)
      setCategories(nextCategories)
      setChannels(nextChannels)
      setStreams(nextStreams)
      setActivity(nextActivity)
      setRefreshKey((value) => value + 1)
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Dashboard data could not be loaded.')
    } finally {
      setRefreshing(false)
      setDataLoading(false)
    }
  }, [authState])

  useEffect(() => {
    if (authState === 'admin') void refreshData()
  }, [authState, refreshData])

  const handleRequestHandled = useCallback(() => setRequestedChannelId(null), [])

  function navigate(next: Section) {
    setChannelCategoryFilter('')
    setSection(next)
  }

  function viewChannelsOfCategory(categoryId: string) {
    setChannelCategoryFilter(categoryId)
    setSection('channels')
  }

  function manageChannel(channelId: string) {
    setRequestedChannelId(channelId)
    setSection('channels')
  }

  async function signIn(email: string, password: string) {
    setAuthBusy(true)
    setAuthError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      await verifyAccess()
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Sign-in failed. Check your credentials and try again.')
      setAuthState('signed-out')
    } finally {
      setAuthBusy(false)
    }
  }

  async function signOut() {
    setAuthBusy(true)
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw error
      setUser(null)
      setAuthState('signed-out')
      setAuthError(null)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Sign-out could not be completed.')
    } finally {
      setAuthBusy(false)
    }
  }

  if (authState === 'checking') {
    return <main className="boot-screen"><div className="boot-mark"><Tv size={23} /></div><div className="boot-spinner" /><strong>Verifying administrator session</strong><span>Connecting to Tribal TV securely</span></main>
  }

  if (authState === 'not-admin') {
    return <AccessDenied onReturn={() => { suppressNextSignOut.current = false; setAuthError(null); setAuthState('signed-out') }} />
  }

  if (authState !== 'admin' || !user) {
    return <AuthScreen onSignIn={signIn} busy={authBusy} error={authError} />
  }

  const refreshQuietly = () => refreshData(true)

  return (
    <div className="app-shell">
      <Sidebar active={section} onNavigate={navigate} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-area">
        <Topbar section={section} email={user.email ?? 'Administrator'} onRefresh={() => void refreshData()} refreshing={refreshing} onMenu={() => setSidebarOpen(true)} />
        <div className="content-area">
          {dataError ? <InlineError message={dataError} /> : null}
          {section === 'overview' ? <Overview stats={stats} activity={activity} onNavigate={navigate} /> : null}
          {section === 'categories' ? (
            <CategoriesPage rows={categories} channels={channels} loading={dataLoading} notify={notify} onChanged={refreshQuietly} onViewChannels={viewChannelsOfCategory} />
          ) : null}
          {section === 'channels' ? (
            <ChannelsPage
              rows={channels}
              categories={categories}
              streams={streams}
              loading={dataLoading}
              notify={notify}
              onChanged={refreshQuietly}
              initialCategoryId={channelCategoryFilter}
              requestedChannelId={requestedChannelId}
              onRequestHandled={handleRequestHandled}
            />
          ) : null}
          {section === 'streams' ? <StreamsPage rows={streams} channels={channels} loading={dataLoading} onManage={manageChannel} /> : null}
          {section === 'activity' ? <AuditPage currentUserId={user.id} refreshKey={refreshKey} /> : null}
          {section === 'settings' ? <SettingsPage stats={stats} connected={dataError === null} /> : null}
          <footer className="app-footer"><span>TRIBAL TV ADMIN</span><span>CATALOGUE MANAGEMENT</span><button onClick={signOut} disabled={authBusy}>Sign out</button></footer>
        </div>
      </main>
      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
