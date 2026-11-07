import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, ShieldCheck, Tv } from 'lucide-react'

export default function AuthScreen({
  onSignIn,
  busy,
  error,
}: {
  onSignIn: (email: string, password: string) => Promise<void>
  busy: boolean
  error: string | null
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSignIn(email.trim(), password)
  }

  return (
    <main className="auth-screen">
      <div className="auth-ambient auth-ambient-one" />
      <div className="auth-ambient auth-ambient-two" />
      <section className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark auth-brand-mark"><Tv size={22} strokeWidth={2.2} /></div>
          <div>
            <div className="brand-name">TRIBAL TV</div>
            <div className="brand-caption">ADMIN CONSOLE</div>
          </div>
        </div>

        <div className="auth-icon"><ShieldCheck size={23} /></div>
        <p className="eyebrow">RESTRICTED WORKSPACE</p>
        <h1>Welcome back.</h1>
        <p className="auth-copy">Sign in with your registered administrator account to manage the Tribal TV catalogue.</p>

        <form className="auth-form" onSubmit={submit}>
          <label className="field-label" htmlFor="admin-email">Email address</label>
          <input
            id="admin-email"
            autoComplete="username"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@example.com"
            required
          />

          <label className="field-label password-label" htmlFor="admin-password">Password</label>
          <div className="password-field">
            <input
              id="admin-password"
              autoComplete="current-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>

          {error ? <div className="auth-error" role="alert">{error}</div> : null}

          <button className="primary-button auth-submit" type="submit" disabled={busy || !email.trim() || !password}>
            {busy ? <span className="button-spinner" /> : <ShieldCheck size={17} />}
            {busy ? 'Verifying access…' : 'Sign in securely'}
          </button>
        </form>

        <div className="auth-footnote">
          <span className="auth-lock"><ShieldCheck size={14} /></span>
          Administrator access only · No public registration
        </div>
      </section>
      <div className="auth-version">TRIBAL TV / ADMIN / PHASE 01</div>
    </main>
  )
}
