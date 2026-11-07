import { ShieldX, LogOut, Tv } from 'lucide-react'

export default function AccessDenied({ onReturn, email }: { onReturn: () => void; email?: string }) {
  return (
    <main className="auth-screen">
      <div className="auth-ambient auth-ambient-one" />
      <section className="auth-card denied-card">
        <div className="auth-brand">
          <div className="brand-mark auth-brand-mark"><Tv size={22} /></div>
          <div><div className="brand-name">TRIBAL TV</div><div className="brand-caption">ADMIN CONSOLE</div></div>
        </div>
        <div className="denied-icon"><ShieldX size={27} /></div>
        <p className="eyebrow">ACCESS RESTRICTED</p>
        <h1>Administrator access required.</h1>
        <p className="auth-copy">
          {email ? `The account ${email} is not on the administrator allow-list.` : 'This account is not on the administrator allow-list.'}
          {' '}The session has been signed out. Contact the database owner if you believe this is incorrect.
        </p>
        <button className="primary-button auth-submit" onClick={onReturn}>
          <LogOut size={17} /> Return to sign in
        </button>
        <div className="auth-footnote"><ShieldX size={14} /> No dashboard data was opened.</div>
      </section>
      <div className="auth-version">TRIBAL TV / ADMIN / ACCESS CONTROL</div>
    </main>
  )
}
