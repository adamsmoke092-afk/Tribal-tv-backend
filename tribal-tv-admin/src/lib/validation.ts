// Pure validation helpers. These mirror the database constraints from the
// Phase 1 migration so mistakes are caught before a write is attempted. The
// database remains the final authority: these checks are for friendly errors only.
// This file must not import anything so it can be unit-tested directly in Node.

export type FieldErrors = Record<string, string>

export const STREAM_TYPES = ['hls', 'dash', 'progressive'] as const
export type StreamType = (typeof STREAM_TYPES)[number]

// Same parameter names as the database check constraints (case-insensitive).
// This is a guardrail, not a guarantee that every possible secret is detected.
const SECRET_PARAM =
  /[?&;](api[_-]?key|secret|client[_-]?secret|password|passwd|access[_-]?token|refresh[_-]?token|id[_-]?token|auth[_-]?token|token|jwt|signature|sig|auth|credentials?)=/i

const INT32_MAX = 2147483647
const INT32_MIN = -2147483648

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export function slugify(input: string, maxLength = 96): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '')
}

export function parseIntStrict(value: string): number | null {
  const trimmed = value.trim()
  if (!/^-?\d+$/.test(trimmed)) return null
  const parsed = Number(trimmed)
  return Number.isSafeInteger(parsed) ? parsed : null
}

export function validateSlug(value: string, maxLength: number): string | null {
  const slug = value.trim()
  if (slug === '') return 'A slug is required.'
  if (slug.length > maxLength) return `Slug must be ${maxLength} characters or fewer.`
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return 'Use lowercase letters, numbers and single hyphens only (e.g. bbc-news).'
  }
  return null
}

export function validateName(value: string, maxLength: number): string | null {
  const name = value.trim()
  if (name === '') return 'A name is required.'
  if (name.length > maxLength) return `Name must be ${maxLength} characters or fewer.`
  return null
}

export function validateInteger(value: string, label: string, min = INT32_MIN): string | null {
  const parsed = parseIntStrict(value)
  if (parsed === null) return `${label} must be a whole number.`
  if (parsed < min) return `${label} must be ${min} or higher.`
  if (parsed > INT32_MAX) return `${label} is too large.`
  return null
}

export function validateLogoUrl(value: string): string | null {
  const url = value.trim()
  if (url === '') return null
  if (url.length > 2048) return 'Logo URL is too long.'
  if (!/^https:\/\/\S+$/i.test(url)) return 'Logo URL must start with https:// and contain no spaces.'
  return null
}

export function validateCountry(value: string): string | null {
  const country = value.trim()
  if (country === '') return null
  return /^[A-Z]{2}$/.test(country) ? null : 'Use a two-letter country code in capitals (e.g. GB, ZA).'
}

export function validateLanguage(value: string): string | null {
  const language = value.trim()
  if (language === '') return null
  return /^[a-z]{2,3}$/.test(language) ? null : 'Use a two or three letter language code in lowercase (e.g. en, fr).'
}

export function validateEpgId(value: string): string | null {
  const epg = value.trim()
  if (epg === '') return null
  if (epg.length > 200) return 'EPG ID must be 200 characters or fewer.'
  if (/\s/.test(epg)) return 'EPG ID cannot contain spaces.'
  return null
}

function urlProblem(url: string, label: string): string | null {
  if (url.length > 2048) return `${label} is too long.`
  if (!/^https?:\/\/\S+$/i.test(url)) return `${label} must start with http:// or https:// and contain no spaces.`
  if (/^https?:\/\/[^/?#]*@/i.test(url)) return `${label} must not contain a username or password.`
  if (SECRET_PARAM.test(url)) {
    return `${label} has a parameter that looks like a credential (token, key, signature…). Credentials must not be stored in public stream details.`
  }
  return null
}

export function validateStreamUrl(value: string): string | null {
  const url = value.trim()
  if (url === '') return 'A stream URL is required.'
  return urlProblem(url, 'Stream URL')
}

export function validateUserAgent(value: string): string | null {
  const agent = value.trim()
  if (agent === '') return null
  if (agent.length > 512) return 'User-Agent must be 512 characters or fewer.'
  if (/[\u0000-\u001f\u007f]/.test(agent)) return 'User-Agent cannot contain control characters or line breaks.'
  return null
}

export function validateReferer(value: string): string | null {
  const referer = value.trim()
  if (referer === '') return null
  return urlProblem(referer, 'Referer')
}

export function validateOrigin(value: string): string | null {
  const origin = value.trim()
  if (origin === '') return null
  if (origin.length > 255) return 'Origin must be 255 characters or fewer.'
  if (!/^https?:\/\/[^/?#@\s]+$/i.test(origin)) {
    return 'Origin must look like https://example.com (scheme and host only, no path).'
  }
  return null
}

export interface CategoryForm {
  name: string
  slug: string
  sort_order: string
  is_active: boolean
}

export function validateCategoryForm(form: CategoryForm): FieldErrors {
  const errors: FieldErrors = {}
  const name = validateName(form.name, 100)
  if (name) errors.name = name
  const slug = validateSlug(form.slug, 64)
  if (slug) errors.slug = slug
  const order = validateInteger(form.sort_order, 'Display order')
  if (order) errors.sort_order = order
  return errors
}

export interface ChannelForm {
  name: string
  slug: string
  category_id: string
  logo_url: string
  country: string
  language: string
  epg_id: string
  sort_order: string
  is_active: boolean
}

export function validateChannelForm(form: ChannelForm): FieldErrors {
  const errors: FieldErrors = {}
  const name = validateName(form.name, 150)
  if (name) errors.name = name
  const slug = validateSlug(form.slug, 96)
  if (slug) errors.slug = slug
  if (form.category_id.trim() === '') errors.category_id = 'Choose a category.'
  const logo = validateLogoUrl(form.logo_url)
  if (logo) errors.logo_url = logo
  const country = validateCountry(form.country)
  if (country) errors.country = country
  const language = validateLanguage(form.language)
  if (language) errors.language = language
  const epg = validateEpgId(form.epg_id)
  if (epg) errors.epg_id = epg
  const order = validateInteger(form.sort_order, 'Display order')
  if (order) errors.sort_order = order
  return errors
}

export interface StreamForm {
  stream_url: string
  stream_type: string
  priority: string
  user_agent: string
  referer: string
  origin: string
  is_active: boolean
}

export function validateStreamForm(form: StreamForm): FieldErrors {
  const errors: FieldErrors = {}
  const url = validateStreamUrl(form.stream_url)
  if (url) errors.stream_url = url
  if (!(STREAM_TYPES as readonly string[]).includes(form.stream_type)) {
    errors.stream_type = 'Choose HLS, DASH or progressive.'
  }
  const priority = validateInteger(form.priority, 'Priority', 0)
  if (priority) errors.priority = priority
  const agent = validateUserAgent(form.user_agent)
  if (agent) errors.user_agent = agent
  const referer = validateReferer(form.referer)
  if (referer) errors.referer = referer
  const origin = validateOrigin(form.origin)
  if (origin) errors.origin = origin
  return errors
}
