import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowDown, ArrowUp, CircleAlert, LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react'
import Field from './Field'
import type { Notify } from './Toasts'
import { InlineError, StatusBadge } from './ui'
import { applyPriorities, createStream, deleteStream, updateStream } from '../lib/data'
import { nextValue, planMove } from '../lib/ordering'
import type { Stream, StreamInput } from '../lib/types'
import { emptyToNull, STREAM_TYPES, validateStreamForm } from '../lib/validation'
import type { FieldErrors, StreamForm, StreamType } from '../lib/validation'

export function PublicStreamWarning() {
  return (
    <div className="warn-note" role="note">
      <CircleAlert size={16} />
      <span>
        Stream URLs and headers are <strong>publicly readable</strong> by anyone who has the app&apos;s public key
        (the current anonymous catalogue policy). Never enter API keys, passwords, cookies or provider credentials.
      </span>
    </div>
  )
}

function StreamEditor({
  channelId,
  stream,
  existing,
  onCancel,
  onSaved,
}: {
  channelId: string
  stream: Stream | null
  existing: Stream[]
  onCancel: () => void
  onSaved: (message: string) => Promise<void>
}) {
  const [form, setForm] = useState<StreamForm>(() =>
    stream
      ? {
          stream_url: stream.stream_url,
          stream_type: stream.stream_type,
          priority: String(stream.priority),
          user_agent: stream.user_agent ?? '',
          referer: stream.referer ?? '',
          origin: stream.origin ?? '',
          is_active: stream.is_active,
        }
      : {
          stream_url: '',
          stream_type: 'hls',
          priority: String(nextValue(existing.map((item) => item.priority), 0, 1)),
          user_agent: '',
          referer: '',
          origin: '',
          is_active: true,
        },
  )
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const found = validateStreamForm(form)
    setErrors(found)
    setSubmitError(null)
    if (Object.keys(found).length > 0) return

    const payload: StreamInput = {
      stream_url: form.stream_url.trim(),
      stream_type: form.stream_type as StreamType,
      priority: Number(form.priority.trim()),
      user_agent: emptyToNull(form.user_agent),
      referer: emptyToNull(form.referer),
      origin: emptyToNull(form.origin),
      is_active: form.is_active,
    }
    setSaving(true)
    try {
      if (stream) {
        await updateStream(stream.id, payload)
        await onSaved('Stream updated.')
      } else {
        await createStream(channelId, payload)
        await onSaved('Stream added.')
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'The stream could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="admin-form stream-form" onSubmit={submit} noValidate>
      <h3>{stream ? 'Edit stream' : 'Add stream'}</h3>
      <PublicStreamWarning />
      {submitError ? <InlineError message={submitError} /> : null}
      <Field label="Stream URL" htmlFor="stream-url" error={errors.stream_url} hint="http:// and https:// are accepted. No username, password, token or key.">
        <input id="stream-url" className="text-input" value={form.stream_url} onChange={(event) => setForm({ ...form, stream_url: event.target.value })} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      </Field>
      <div className="form-row">
        <Field label="Format" htmlFor="stream-type" error={errors.stream_type}>
          <select id="stream-type" className="text-input" value={form.stream_type} onChange={(event) => setForm({ ...form, stream_type: event.target.value })}>
            {STREAM_TYPES.map((type) => <option key={type} value={type}>{type === 'hls' ? 'HLS' : type === 'dash' ? 'DASH' : 'Progressive'}</option>)}
          </select>
        </Field>
        <Field label="Priority" htmlFor="stream-priority" error={errors.priority} hint="0 is tried first; higher numbers are backups.">
          <input id="stream-priority" className="text-input" inputMode="numeric" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} />
        </Field>
      </div>
      <Field label="User-Agent (optional)" htmlFor="stream-ua" error={errors.user_agent}>
        <input id="stream-ua" className="text-input" value={form.user_agent} onChange={(event) => setForm({ ...form, user_agent: event.target.value })} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      </Field>
      <Field label="Referer (optional)" htmlFor="stream-referer" error={errors.referer}>
        <input id="stream-referer" className="text-input" value={form.referer} onChange={(event) => setForm({ ...form, referer: event.target.value })} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      </Field>
      <Field label="Origin (optional)" htmlFor="stream-origin" error={errors.origin} hint="Scheme and host only, e.g. https://example.com">
        <input id="stream-origin" className="text-input" value={form.origin} onChange={(event) => setForm({ ...form, origin: event.target.value })} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      </Field>
      <label className="check-row">
        <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
        <span>Enabled (the app may use this stream)</span>
      </label>
      <div className="modal-actions">
        <button className="secondary-button" type="button" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="primary-button compact" type="submit" disabled={saving}>
          {saving ? <LoaderCircle className="spin" size={15} /> : null}
          {stream ? 'Save stream' : 'Add stream'}
        </button>
      </div>
    </form>
  )
}

export default function StreamsManager({
  channelId,
  streams,
  notify,
  onChanged,
}: {
  channelId: string
  streams: Stream[]
  notify: Notify
  onChanged: () => Promise<void>
}) {
  const [editing, setEditing] = useState<Stream | 'new' | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const sorted = useMemo(
    () => [...streams].sort((a, b) => a.priority - b.priority || a.created_at.localeCompare(b.created_at)),
    [streams],
  )

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

  function move(stream: Stream, direction: 'up' | 'down') {
    const updates = planMove(
      sorted.map((item) => ({ id: item.id, value: item.priority })),
      stream.id,
      direction,
      { base: 0, step: 1 },
    )
    if (updates.length === 0) return
    void run(() => applyPriorities(updates), 'Stream priorities saved.')
  }

  if (editing !== null) {
    return (
      <StreamEditor
        channelId={channelId}
        stream={editing === 'new' ? null : editing}
        existing={sorted}
        onCancel={() => setEditing(null)}
        onSaved={async (message) => { setEditing(null); notify('success', message); await onChanged() }}
      />
    )
  }

  return (
    <div className="streams-manager">
      <PublicStreamWarning />
      <div className="streams-head">
        <p>{sorted.length === 0 ? 'No streams yet.' : `${sorted.length} ${sorted.length === 1 ? 'stream' : 'streams'}, tried in priority order.`}</p>
        <button className="primary-button compact" type="button" onClick={() => setEditing('new')}><Plus size={15} /> Add stream</button>
      </div>
      {sorted.length === 0 ? <div className="compact-empty">A channel without an enabled stream cannot be played by the app.</div> : null}
      {sorted.map((stream, index) => (
        <div className={`stream-card${stream.is_active ? '' : ' is-off'}`} key={stream.id}>
          <div className="stream-card-top">
            <span className="priority-pill">{index === 0 ? 'Primary' : `Backup ${index}`}</span>
            <span className="type-chip">{stream.stream_type.toUpperCase()}</span>
            <span className="muted-cell">priority {stream.priority}</span>
            <StatusBadge active={stream.is_active} activeLabel="Enabled" inactiveLabel="Disabled" />
          </div>
          <code className="stream-url" title={stream.stream_url}>{stream.stream_url}</code>
          {stream.user_agent || stream.referer || stream.origin ? (
            <dl className="stream-headers">
              {stream.user_agent ? <div><dt>User-Agent</dt><dd>{stream.user_agent}</dd></div> : null}
              {stream.referer ? <div><dt>Referer</dt><dd>{stream.referer}</dd></div> : null}
              {stream.origin ? <div><dt>Origin</dt><dd>{stream.origin}</dd></div> : null}
            </dl>
          ) : null}
          {confirming === stream.id ? (
            <div className="inline-confirm">
              <span>Delete this stream permanently? Disabling it is safer.</span>
              <button className="secondary-button small" type="button" onClick={() => setConfirming(null)} disabled={busy}>Cancel</button>
              <button
                className="danger-button small"
                type="button"
                disabled={busy}
                onClick={() => { setConfirming(null); void run(() => deleteStream(stream.id), 'Stream deleted.') }}
              >
                Delete
              </button>
            </div>
          ) : (
            <div className="row-actions wrap">
              <button className="mini-button" type="button" aria-label="Raise priority (try earlier)" onClick={() => move(stream, 'up')} disabled={busy || index === 0}><ArrowUp size={14} /></button>
              <button className="mini-button" type="button" aria-label="Lower priority (try later)" onClick={() => move(stream, 'down')} disabled={busy || index === sorted.length - 1}><ArrowDown size={14} /></button>
              <button
                className="secondary-button small"
                type="button"
                disabled={busy}
                onClick={() => void run(async () => { await updateStream(stream.id, { is_active: !stream.is_active }) }, stream.is_active ? 'Stream disabled.' : 'Stream enabled.')}
              >
                {stream.is_active ? 'Disable' : 'Enable'}
              </button>
              <button className="secondary-button small" type="button" onClick={() => setEditing(stream)} disabled={busy}><Pencil size={13} /> Edit</button>
              <button className="danger-button small" type="button" onClick={() => setConfirming(stream.id)} disabled={busy}><Trash2 size={13} /> Delete</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
