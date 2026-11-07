// Pure error translation. No imports, so it can be unit-tested directly in Node.

const CONSTRAINT_MESSAGES: Record<string, string> = {
  channel_streams_url_no_secrets: 'the stream URL contains a credential-like parameter such as token, key or signature',
  channel_streams_url_no_userinfo: 'the stream URL contains a username or password',
  channel_streams_url_format: 'the stream URL must start with http:// or https:// and contain no spaces',
  channel_streams_referer_check: 'the Referer is not valid or contains a credential-like parameter',
  channel_streams_origin_check: 'the Origin must be scheme and host only, for example https://example.com',
  channel_streams_user_agent_check: 'the User-Agent is empty or contains control characters',
  channel_streams_type_check: 'the stream type must be hls, dash or progressive',
  channel_streams_priority_check: 'the priority cannot be negative',
  channels_logo_url_format: 'the logo URL must start with https://',
  channels_country_format: 'the country must be two capital letters',
  channels_language_format: 'the language must be two or three lowercase letters',
  channels_epg_id_format: 'the EPG ID cannot contain spaces',
  channels_slug_format: 'the slug may only contain lowercase letters, numbers and single hyphens',
  channel_categories_slug_format: 'the slug may only contain lowercase letters, numbers and single hyphens',
}

function constraintLabel(message: string): string {
  const match = /constraint "([^"]+)"/.exec(message)
  if (!match) return 'a database rule was not met'
  return CONSTRAINT_MESSAGES[match[1]] ?? `rule ${match[1]} was not met`
}

/** Turns a Supabase/PostgREST/Storage error into a message an administrator can act on. */
export function explain(error: unknown, action: string): Error {
  const e = (typeof error === 'object' && error !== null ? error : {}) as { code?: string; message?: string }
  const message = e.message ?? ''
  if (e.code === '42501' || /row-level security|permission denied/i.test(message)) {
    return new Error(`${action} was refused. Your session may have expired, or this account is not an administrator.`)
  }
  if (e.code === '23505') {
    return new Error(`${action} failed: that value already exists (a duplicate slug, or the same stream URL on this channel).`)
  }
  if (e.code === '23503') {
    return new Error(`${action} failed: other records still depend on this one (for example a category that still has channels).`)
  }
  if (e.code === '23514') {
    return new Error(`${action} failed: ${constraintLabel(message)}.`)
  }
  if (/bucket not found/i.test(message)) {
    return new Error(`${action} failed: the channel-logos storage bucket does not exist yet. Apply the storage migration first.`)
  }
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return new Error(`${action} failed: network error. Check your connection and try again.`)
  }
  return new Error(message ? `${action} failed: ${message}` : `${action} failed.`)
}
