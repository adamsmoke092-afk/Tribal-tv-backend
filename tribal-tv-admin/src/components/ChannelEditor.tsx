import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { LoaderCircle, Tv, Upload } from 'lucide-react'
import Field from './Field'
import Modal from './Modal'
import StreamsManager from './StreamsManager'
import type { Notify } from './Toasts'
import { InlineError } from './ui'
import {
  checkLogoFile,
  createChannel,
  deleteChannel,
  LOGO_ACCEPT,
  removeLogoQuietly,
  updateChannel,
  uploadLogo,
} from '../lib/data'
import { nextValue } from '../lib/ordering'
import type { Category, Channel, ChannelInput, Stream } from '../lib/types'
import { emptyToNull, slugify, validateChannelForm, validateLogoUrl } from '../lib/validation'
import type { ChannelForm, FieldErrors } from '../lib/validation'

export type EditorTab = 'details' | 'streams'

export default function ChannelEditor({
  channel,
  categories,
  channels,
  streams,
  initialTab,
  notify,
  onClose,
  onChanged,
}: {
  channel: Channel | null
  categories: Category[]
  channels: Channel[]
  streams: Stream[]
  initialTab: EditorTab
  notify: Notify
  onClose: () => void
  onChanged: () => Promise<void>
}) {
  const [current, setCurrent] = useState<Channel | null>(channel)
  const [tab, setTab] = useState<EditorTab>(channel ? initialTab : 'details')
  const [form, setForm] = useState<ChannelForm>(() =>
    channel
      ? {
          name: channel.name,
          slug: channel.slug,
          category_id: channel.category_id,
          logo_url: channel.logo_url ?? '',
          country: channel.country ?? '',
          language: channel.language ?? '',
          epg_id: channel.epg_id ?? '',
          sort_order: String(channel.sort_order),
          is_active: channel.is_active,
        }
      : {
          name: '',
          slug: '',
          category_id: categories.length === 1 ? categories[0].id : '',
          logo_url: '',
          country: '',
          language: '',
          epg_id: '',
          sort_order: String(nextValue(channels.map((item) => item.sort_order), 10, 10)),
          is_active: true,
        },
  )
  const [slugTouched, setSlugTouched] = useState(channel !== null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null)
      return undefined
    }
    const url = URL.createObjectURL(logoFile)
    setLogoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [logoFile])

  const channelStreams = current ? streams.filter((stream) => stream.channel_id === current.id) : []
  const typedLogo = validateLogoUrl(form.logo_url) === null && form.logo_url.trim() !== '' ? form.logo_url.trim() : null
  const previewSrc = logoPreview ?? typedLogo

  function changeName(value: string) {
    setForm((previous) => ({ ...previous, name: value, slug: slugTouched ? previous.slug : slugify(value, 96) }))
  }

  function pickLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!file) return
    const problem = checkLogoFile(file)
    if (problem) {
      setErrors((previous) => ({ ...previous, logo_file: problem }))
      return
    }
    setErrors((previous) => {
      const next = { ...previous }
      delete next.logo_file
      return next
    })
    setLogoFile(file)
  }

  function clearLogo() {
    setLogoFile(null)
    setForm((previous) => ({ ...previous, logo_url: '' }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const found = validateChannelForm(form)
    setErrors(found)
    setSubmitError(null)
    if (Object.keys(found).length > 0) return

    let uploadedUrl: string | null = null
    setSaving(true)
    try {
      let logoUrl = emptyToNull(form.logo_url)
      if (logoFile) {
        uploadedUrl = await uploadLogo(logoFile)
        logoUrl = uploadedUrl
      }
      const payload: ChannelInput = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        category_id: form.category_id,
        logo_url: logoUrl,
        country: emptyToNull(form.country),
        language: emptyToNull(form.language),
        epg_id: emptyToNull(form.epg_id),
        sort_order: Number(form.sort_order.trim()),
        is_active: form.is_active,
      }
      if (current) {
        const previousLogo = current.logo_url
        const saved = await updateChannel(current.id, payload)
        setCurrent(saved)
        if (previousLogo && previousLogo !== saved.logo_url) void removeLogoQuietly(previousLogo)
        notify('success', `Channel “${saved.name}” saved.`)
      } else {
        const created = await createChannel(payload)
        setCurrent(created)
        setTab('streams')
        notify('success', `Channel “${created.name}” created. Now add its stream.`)
      }
      setLogoFile(null)
      setForm((previous) => ({ ...previous, logo_url: logoUrl ?? '' }))
      await onChanged()
    } catch (error) {
      if (uploadedUrl) void removeLogoQuietly(uploadedUrl)
      setSubmitError(error instanceof Error ? error.message : 'The channel could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!current) return
    setSaving(true)
    try {
      const logo = current.logo_url
      await deleteChannel(current.id)
      void removeLogoQuietly(logo)
      notify('success', `Channel “${current.name}” deleted.`)
      await onChanged()
      onClose()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'The channel could not be deleted.')
      setConfirmingDelete(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={current ? `Edit ${current.name}` : 'Add channel'} onClose={saving ? () => undefined : onClose} wide>
      <div className="tab-row" role="tablist">
        <button className={`tab-button${tab === 'details' ? ' is-active' : ''}`} role="tab" aria-selected={tab === 'details'} type="button" onClick={() => setTab('details')}>Details</button>
        <button className={`tab-button${tab === 'streams' ? ' is-active' : ''}`} role="tab" aria-selected={tab === 'streams'} type="button" onClick={() => setTab('streams')} disabled={!current}>
          Streams{current ? ` (${channelStreams.length})` : ''}
        </button>
      </div>

      {tab === 'streams' && current ? (
        <StreamsManager channelId={current.id} streams={channelStreams} notify={notify} onChanged={onChanged} />
      ) : (
        <form className="admin-form" onSubmit={submit} noValidate>
          {submitError ? <InlineError message={submitError} /> : null}
          {categories.length === 0 ? <InlineError message="Create a category first. Every channel must belong to one." /> : null}

          <Field label="Channel name" htmlFor="ch-name" error={errors.name}>
            <input id="ch-name" className="text-input" value={form.name} onChange={(event) => changeName(event.target.value)} maxLength={150} autoFocus={!current} />
          </Field>
          <Field label="Slug" htmlFor="ch-slug" error={errors.slug} hint={current ? 'Changing the slug changes the identifier apps may rely on.' : 'Generated from the name.'}>
            <input id="ch-slug" className="text-input" value={form.slug} onChange={(event) => { setSlugTouched(true); setForm({ ...form, slug: event.target.value }) }} maxLength={96} autoCapitalize="none" autoCorrect="off" />
          </Field>
          <Field label="Category" htmlFor="ch-category" error={errors.category_id}>
            <select id="ch-category" className="text-input" value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })}>
              <option value="">Choose a category…</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}{category.is_active ? '' : ' (inactive)'}</option>
              ))}
            </select>
          </Field>

          <div className="field">
            <label htmlFor="ch-logo-url">Logo</label>
            <div className="logo-row">
              <div className="logo-preview">
                {previewSrc ? <img src={previewSrc} alt="Logo preview" /> : <Tv size={22} />}
              </div>
              <div className="logo-controls">
                <label className="secondary-button small file-button">
                  <Upload size={13} /> Upload image
                  <input type="file" accept={LOGO_ACCEPT} onChange={pickLogo} hidden />
                </label>
                <button className="secondary-button small" type="button" onClick={clearLogo}>Remove</button>
              </div>
            </div>
            {errors.logo_file ? <small className="field-error" role="alert">{errors.logo_file}</small> : <small className="field-hint">PNG, JPEG or WebP, up to 1 MB. Or paste an https:// image URL below.</small>}
            <input id="ch-logo-url" className="text-input" placeholder="https://…" value={form.logo_url} onChange={(event) => { setLogoFile(null); setForm({ ...form, logo_url: event.target.value }) }} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            {errors.logo_url ? <small className="field-error" role="alert">{errors.logo_url}</small> : null}
          </div>

          <div className="form-row">
            <Field label="Country" htmlFor="ch-country" error={errors.country} hint="Two letters, e.g. GB">
              <input id="ch-country" className="text-input" value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value.toUpperCase() })} maxLength={2} autoCapitalize="characters" />
            </Field>
            <Field label="Language" htmlFor="ch-language" error={errors.language} hint="e.g. en">
              <input id="ch-language" className="text-input" value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value.toLowerCase() })} maxLength={3} autoCapitalize="none" />
            </Field>
          </div>
          <Field label="EPG ID (tvg-id, optional)" htmlFor="ch-epg" error={errors.epg_id} hint="Used to match programme guides. No spaces.">
            <input id="ch-epg" className="text-input" value={form.epg_id} onChange={(event) => setForm({ ...form, epg_id: event.target.value })} maxLength={200} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          </Field>
          <Field label="Display order" htmlFor="ch-order" error={errors.sort_order} hint="Lower numbers appear first.">
            <input id="ch-order" className="text-input" inputMode="numeric" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} />
          </Field>
          <label className="check-row">
            <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
            <span>Active (listed in the app)</span>
          </label>

          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>Close</button>
            <button className="primary-button compact" type="submit" disabled={saving || categories.length === 0}>
              {saving ? <LoaderCircle className="spin" size={15} /> : null}
              {current ? 'Save changes' : 'Create channel'}
            </button>
          </div>

          {current ? (
            <div className="danger-zone">
              {confirmingDelete ? (
                <div className="inline-confirm">
                  <span>Permanently delete this channel and its {channelStreams.length} stream(s)? Deactivating is safer.</span>
                  <button className="secondary-button small" type="button" onClick={() => setConfirmingDelete(false)} disabled={saving}>Cancel</button>
                  <button className="danger-button small" type="button" onClick={() => void confirmDelete()} disabled={saving}>Delete permanently</button>
                </div>
              ) : (
                <button className="danger-button small" type="button" onClick={() => setConfirmingDelete(true)} disabled={saving}>Delete channel…</button>
              )}
            </div>
          ) : null}
        </form>
      )}
    </Modal>
  )
}
