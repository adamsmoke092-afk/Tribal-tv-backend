import type { StreamType } from './validation'

export interface Category {
  id: string
  slug: string
  name: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Channel {
  id: string
  slug: string
  name: string
  category_id: string
  logo_url: string | null
  country: string | null
  language: string | null
  epg_id: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Stream {
  id: string
  channel_id: string
  stream_url: string
  stream_type: StreamType
  priority: number
  user_agent: string | null
  referer: string | null
  origin: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AuditEvent {
  id: number
  occurred_at: string
  actor_id: string | null
  actor_role: string | null
  table_name: string
  record_id: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
}

export interface CatalogueStats {
  categories: number
  activeChannels: number
  inactiveChannels: number
  streams: number
  activeStreams: number
  catalogueVersion: number | null
  catalogueUpdatedAt: string | null
}

export type CategoryInput = Pick<Category, 'name' | 'slug' | 'sort_order' | 'is_active'>

export type ChannelInput = Pick<
  Channel,
  'name' | 'slug' | 'category_id' | 'logo_url' | 'country' | 'language' | 'epg_id' | 'sort_order' | 'is_active'
>

export type StreamInput = Pick<
  Stream,
  'stream_url' | 'stream_type' | 'priority' | 'user_agent' | 'referer' | 'origin' | 'is_active'
>
