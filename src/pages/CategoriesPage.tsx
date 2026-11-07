import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowDown, ArrowUp, FolderOpen, LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react'
import ConfirmDialog from '../components/ConfirmDialog'
import Field from '../components/Field'
import Modal from '../components/Modal'
import type { Notify } from '../components/Toasts'
import { DataTable, InlineError, PageHeading, SearchBox, StatusBadge } from '../components/ui'
import { applySortOrder, createCategory, deleteCategory, updateCategory } from '../lib/data'
import { nextValue, planMove } from '../lib/ordering'
import type { Category, CategoryInput, Channel } from '../lib/types'
import { slugify, validateCategoryForm } from '../lib/validation'
import type { CategoryForm, FieldErrors } from '../lib/validation'

interface Props {
  rows: Category[]
  channels: Channel[]
  loading: boolean
  notify: Notify
  onChanged: () => Promise<void>
  onViewChannels: (categoryId: string) => void
}

function CategoryEditor({
  category,
  rows,
  onClose,
  onSaved,
}: {
  category: Category | null
  rows: Category[]
  onClose: () => void
  onSaved: (message: string) => Promise<void>
}) {
  const [form, setForm] = useState<CategoryForm>(() =>
    category
      ? { name: category.name, slug: category.slug, sort_order: String(category.sort_order), is_active: category.is_active }
      : { name: '', slug: '', sort_order: String(nextValue(rows.map((row) => row.sort_order), 10, 10)), is_active: true },
  )
  const [slugTouched, setSlugTouched] = useState(category !== null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function changeName(value: string) {
    setForm((previous) => ({ ...previous, name: value, slug: slugTouched ? previous.slug : slugify(value, 64) }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const found = validateCategoryForm(form)
    setErrors(found)
    setSubmitError(null)
    if (Object.keys(found).length > 0) return

    const payload: CategoryInput = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      sort_order: Number(form.sort_order.trim()),
      is_active: form.is_active,
    }
    setSaving(true)
    try {
      if (category) {
        await updateCategory(category.id, payload)
        await onSaved(`Category “${payload.name}” updated.`)
      } else {
        await createCategory(payload)
        await onSaved(`Category “${payload.name}” created.`)
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'The category could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={category ? 'Edit category' : 'Add category'} onClose={saving ? () => undefined : onClose}>
      <form className="admin-form" onSubmit={submit} noValidate>
        {submitError ? <InlineError message={submitError} /> : null}
        <Field label="Name" htmlFor="cat-name" error={errors.name}>
          <input id="cat-name" className="text-input" value={form.name} onChange={(event) => changeName(event.target.value)} maxLength={100} autoFocus />
        </Field>
        <Field
          label="Slug"
          htmlFor="cat-slug"
          error={errors.slug}
          hint={category ? 'Changing the slug changes the identifier apps may rely on.' : 'Generated from the name. Lowercase letters, numbers and hyphens.'}
        >
          <input
            id="cat-slug"
            className="text-input"
            value={form.slug}
            onChange={(event) => { setSlugTouched(true); setForm({ ...form, slug: event.target.value }) }}
            maxLength={64}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </Field>
        <Field label="Display order" htmlFor="cat-order" error={errors.sort_order} hint="Lower numbers appear first.">
          <input id="cat-order" className="text-input" inputMode="numeric" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} />
        </Field>
        <label className="check-row">
          <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
          <span>Active (visible to the app)</span>
        </label>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="primary-button compact" type="submit" disabled={saving}>
            {saving ? <LoaderCircle className="spin" size={15} /> : null}
            {category ? 'Save changes' : 'Create category'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function CategoriesPage({ rows, channels, loading, notify, onChanged, onViewChannels }: Props) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const [busy, setBusy] = useState(false)

  const channelCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const channel of channels) counts.set(channel.category_id, (counts.get(channel.category_id) ?? 0) + 1)
    return counts
  }, [channels])

  const filtered = useMemo(
    () => rows.filter((row) => `${row.name} ${row.slug}`.toLowerCase().includes(query.toLowerCase())),
    [rows, query],
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

  function move(category: Category, direction: 'up' | 'down') {
    const updates = planMove(
      rows.map((row) => ({ id: row.id, value: row.sort_order })),
      category.id,
      direction,
      { base: 10, step: 10, visibleIds: filtered.map((row) => row.id) },
    )
    if (updates.length === 0) return
    void run(() => applySortOrder('channel_categories', updates), 'Category order saved.')
  }

  function toggle(category: Category) {
    void run(
      async () => { await updateCategory(category.id, { is_active: !category.is_active }) },
      category.is_active ? `“${category.name}” deactivated.` : `“${category.name}” activated.`,
    )
  }

  async function confirmDelete() {
    if (!deleting) return
    const target = deleting
    await run(async () => { await deleteCategory(target.id) }, `Category “${target.name}” deleted.`)
    setDeleting(null)
  }

  return (
    <>
      <PageHeading
        eyebrow="CATALOGUE / TAXONOMY"
        title="Categories"
        subtitle="Create, order and activate the groups used to organise Tribal TV channels."
        action={<button className="primary-button compact" type="button" onClick={() => setEditing('new')}><Plus size={16} /> Add category</button>}
      />
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div><h2>All categories</h2><p>{rows.length} total · sorted by display order</p></div>
          <SearchBox value={query} onChange={setQuery} placeholder="Search categories…" />
        </div>
        <DataTable
          rows={filtered}
          loading={loading}
          rowKey={(row) => row.id}
          emptyTitle={query ? 'No matching categories' : 'No categories yet'}
          emptyDescription={query ? 'Try a different search term.' : 'Add your first category, then assign channels to it.'}
          columns={[
            { label: 'CATEGORY', render: (row) => <div className="primary-cell"><span className="table-avatar category-avatar"><FolderOpen size={16} /></span><div><strong>{row.name}</strong><small>{row.slug}</small></div></div> },
            {
              label: 'CHANNELS',
              render: (row) => {
                const count = channelCounts.get(row.id) ?? 0
                return <button className="link-button" type="button" onClick={() => onViewChannels(row.id)}>{count} {count === 1 ? 'channel' : 'channels'}</button>
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
              render: (row) => {
                const count = channelCounts.get(row.id) ?? 0
                return (
                  <div className="row-actions">
                    <button className="secondary-button small" type="button" onClick={() => setEditing(row)}><Pencil size={13} /> Edit</button>
                    <button
                      className="danger-button small"
                      type="button"
                      onClick={() => setDeleting(row)}
                      disabled={busy || count > 0}
                      title={count > 0 ? 'Move or deactivate its channels first' : 'Delete this category'}
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                )
              },
            },
          ]}
        />
      </section>
      <div className="read-only-note">A category can only be deleted when it has no channels. Deactivating hides it and its channels from the app without losing anything.</div>

      {editing !== null ? (
        <CategoryEditor
          category={editing === 'new' ? null : editing}
          rows={rows}
          onClose={() => setEditing(null)}
          onSaved={async (message) => { setEditing(null); notify('success', message); await onChanged() }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title="Delete category?"
          message={`“${deleting.name}” will be permanently deleted. This cannot be undone. To hide it instead, deactivate it.`}
          confirmLabel="Delete category"
          danger
          busy={busy}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </>
  )
}
