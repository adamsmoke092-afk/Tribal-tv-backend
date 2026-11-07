import { explain } from './errors'
import { supabase } from './supabase'
import type { OrderUpdate } from './ordering'
import type {
  AuditEvent,
  CatalogueStats,
  Category,
  CategoryInput,
  Channel,
  ChannelInput,
  Stream,
  StreamInput,
} from './types'

const CATEGORY_COLUMNS = 'id, slug, name, sort_order, is_active, created_at, updated_at'
const CHANNEL_COLUMNS =
  'id, slug, name, category_id, logo_url, country, language, epg_id, is_active, sort_order, created_at, updated_at'
const STREAM_COLUMNS =
  'id, channel_id, stream_url, stream_type, priority, user_agent, referer, origin, is_active, created_at, updated_at'
const AUDIT_COLUMNS = 'id, occurred_at, actor_id, actor_role, table_name, record_id, action, old_data, new_data'

export const ROW_LIMIT = 1000

export const LOGO_BUCKET = 'channel-logos'
export const LOGO_MAX_BYTES = 1048576
const LOGO_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}
export const LOGO_ACCEPT = Object.keys(LOGO_EXTENSIONS).join(',')

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function loadCatalogueStats(): Promise<CatalogueStats> {
  const [categories, activeChannels, inactiveChannels, streams, activeStreams, meta] = await Promise.all([
    supabase.from('channel_categories').select('id', { count: 'exact', head: true }),
    supabase.from('channels').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('channels').select('id', { count: 'exact', head: true }).eq('is_active', false),
    supabase.from('channel_streams').select('id', { count: 'exact', head: true }),
    supabase.from('channel_streams').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('catalogue_meta').select('version, updated_at').eq('id', 1).maybeSingle(),
  ])

  for (const result of [categories, activeChannels, inactiveChannels, streams, activeStreams, meta]) {
    if (result.error) throw explain(result.error, 'Loading catalogue totals')
  }

  const metaRow = meta.data as { version: number; updated_at: string } | null
  return {
    categories: categories.count ?? 0,
    activeChannels: activeChannels.count ?? 0,
    inactiveChannels: inactiveChannels.count ?? 0,
    streams: streams.count ?? 0,
    activeStreams: activeStreams.count ?? 0,
    catalogueVersion: metaRow ? Number(metaRow.version) : null,
    catalogueUpdatedAt: metaRow ? metaRow.updated_at : null,
  }
}

export async function loadCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('channel_categories')
    .select(CATEGORY_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
    .limit(ROW_LIMIT)
  if (error) throw explain(error, 'Loading categories')
  return (data ?? []) as Category[]
}

export async function loadChannels(): Promise<Channel[]> {
  const { data, error } = await supabase
    .from('channels')
    .select(CHANNEL_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
    .limit(ROW_LIMIT)
  if (error) throw explain(error, 'Loading channels')
  return (data ?? []) as Channel[]
}

export async function loadStreams(): Promise<Stream[]> {
  const { data, error } = await supabase
    .from('channel_streams')
    .select(STREAM_COLUMNS)
    .order('channel_id', { ascending: true })
    .order('priority', { ascending: true })
    .limit(ROW_LIMIT)
  if (error) throw explain(error, 'Loading stream sources')
  return (data ?? []) as Stream[]
}

/** Light query for the overview: no old/new payloads. */
export async function loadRecentActivity(limit: number): Promise<AuditEvent[]> {
  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('id, occurred_at, actor_id, actor_role, table_name, record_id, action')
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (error) throw explain(error, 'Loading recent activity')
  return ((data ?? []) as Omit<AuditEvent, 'old_data' | 'new_data'>[]).map((row) => ({
    ...row,
    old_data: null,
    new_data: null,
  }))
}

export async function loadAuditPage(
  page: number,
  pageSize: number,
  tableName: string,
): Promise<{ rows: AuditEvent[]; total: number }> {
  const from = page * pageSize
  const to = from + pageSize - 1
  let query = supabase
    .from('admin_audit_log')
    .select(AUDIT_COLUMNS, { count: 'exact' })
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to)
  if (tableName) query = query.eq('table_name', tableName)
  const { data, error, count } = await query
  if (error) throw explain(error, 'Loading the audit log')
  return { rows: (data ?? []) as AuditEvent[], total: count ?? 0 }
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function createCategory(input: CategoryInput): Promise<Category> {
  const { data, error } = await supabase.from('channel_categories').insert(input).select(CATEGORY_COLUMNS).single()
  if (error) throw explain(error, 'Creating the category')
  return data as Category
}

export async function updateCategory(id: string, patch: Partial<CategoryInput>): Promise<Category> {
  const { data, error } = await supabase
    .from('channel_categories')
    .update(patch)
    .eq('id', id)
    .select(CATEGORY_COLUMNS)
    .single()
  if (error) throw explain(error, 'Updating the category')
  return data as Category
}

export async function deleteCategory(id: string): Promise<void> {
  const { data, error } = await supabase.from('channel_categories').delete().eq('id', id).select('id')
  if (error) throw explain(error, 'Deleting the category')
  if (!data || data.length === 0) throw new Error('Deleting the category was refused or the category no longer exists.')
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export async function createChannel(input: ChannelInput): Promise<Channel> {
  const { data, error } = await supabase.from('channels').insert(input).select(CHANNEL_COLUMNS).single()
  if (error) throw explain(error, 'Creating the channel')
  return data as Channel
}

export async function updateChannel(id: string, patch: Partial<ChannelInput>): Promise<Channel> {
  const { data, error } = await supabase.from('channels').update(patch).eq('id', id).select(CHANNEL_COLUMNS).single()
  if (error) throw explain(error, 'Updating the channel')
  return data as Channel
}

export async function deleteChannel(id: string): Promise<void> {
  const { data, error } = await supabase.from('channels').delete().eq('id', id).select('id')
  if (error) throw explain(error, 'Deleting the channel')
  if (!data || data.length === 0) throw new Error('Deleting the channel was refused or the channel no longer exists.')
}

// ---------------------------------------------------------------------------
// Streams
// ---------------------------------------------------------------------------

export async function createStream(channelId: string, input: StreamInput): Promise<Stream> {
  const { data, error } = await supabase
    .from('channel_streams')
    .insert({ channel_id: channelId, ...input })
    .select(STREAM_COLUMNS)
    .single()
  if (error) throw explain(error, 'Adding the stream')
  return data as Stream
}

export async function updateStream(id: string, patch: Partial<StreamInput>): Promise<Stream> {
  const { data, error } = await supabase
    .from('channel_streams')
    .update(patch)
    .eq('id', id)
    .select(STREAM_COLUMNS)
    .single()
  if (error) throw explain(error, 'Updating the stream')
  return data as Stream
}

export async function deleteStream(id: string): Promise<void> {
  const { data, error } = await supabase.from('channel_streams').delete().eq('id', id).select('id')
  if (error) throw explain(error, 'Deleting the stream')
  if (!data || data.length === 0) throw new Error('Deleting the stream was refused or the stream no longer exists.')
}

// ---------------------------------------------------------------------------
// Ordering (one UPDATE per changed row; refresh afterwards because a failure
// part-way through can leave a partially applied order)
// ---------------------------------------------------------------------------

export async function applySortOrder(table: 'channel_categories' | 'channels', updates: OrderUpdate[]): Promise<void> {
  const results = await Promise.all(
    updates.map((update) =>
      supabase.from(table).update({ sort_order: update.value }).eq('id', update.id).select('id').single(),
    ),
  )
  const failed = results.find((result) => result.error)
  if (failed && failed.error) throw explain(failed.error, 'Saving the new order')
}

export async function applyPriorities(updates: OrderUpdate[]): Promise<void> {
  const results = await Promise.all(
    updates.map((update) =>
      supabase.from('channel_streams').update({ priority: update.value }).eq('id', update.id).select('id').single(),
    ),
  )
  const failed = results.find((result) => result.error)
  if (failed && failed.error) throw explain(failed.error, 'Saving the new priorities')
}

// ---------------------------------------------------------------------------
// Logo uploads (Supabase Storage, public bucket, admin-only writes)
// ---------------------------------------------------------------------------

export function checkLogoFile(file: File): string | null {
  if (!LOGO_EXTENSIONS[file.type]) return 'Logo must be a PNG, JPEG or WebP image (SVG is not allowed).'
  if (file.size > LOGO_MAX_BYTES) return 'Logo must be 1 MB or smaller.'
  return null
}

/** Uploads under a fresh random name so browsers and the app never cache an old image. */
export async function uploadLogo(file: File): Promise<string> {
  const problem = checkLogoFile(file)
  if (problem) throw new Error(problem)
  const path = `${crypto.randomUUID()}.${LOGO_EXTENSIONS[file.type]}`
  const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw explain(error, 'Uploading the logo')
  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

function logoObjectName(url: string | null): string | null {
  if (!url) return null
  const match = /\/storage\/v1\/object\/public\/channel-logos\/([A-Za-z0-9._-]+)$/.exec(url)
  return match ? match[1] : null
}

/** Best effort: removes a logo from our bucket. Never throws, because the catalogue write already succeeded. */
export async function removeLogoQuietly(url: string | null): Promise<void> {
  const name = logoObjectName(url)
  if (!name) return
  try {
    await supabase.storage.from(LOGO_BUCKET).remove([name])
  } catch {
    // ignore: an orphaned image is harmless and can be cleaned up later
  }
}
