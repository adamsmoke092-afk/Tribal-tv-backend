import test from 'node:test'
import assert from 'node:assert/strict'
import {
  slugify,
  validateStreamUrl,
  validateReferer,
  validateOrigin,
  validateUserAgent,
  validateLogoUrl,
  validateCountry,
  validateLanguage,
  validateEpgId,
  validateSlug,
  validateStreamForm,
  validateChannelForm,
  validateCategoryForm,
  emptyToNull,
  parseIntStrict,
} from '../src/lib/validation.ts'

test('slugify produces database-valid slugs', () => {
  assert.equal(slugify('BBC News'), 'bbc-news')
  assert.equal(slugify('  Al Jazeera (English)  '), 'al-jazeera-english')
  assert.equal(slugify('Café Français!'), 'cafe-francais')
  assert.equal(slugify('---'), '')
  assert.equal(validateSlug(slugify('SuperSport 1 HD'), 96), null)
  const long = slugify('a '.repeat(200), 64)
  assert.ok(long.length <= 64 && !long.endsWith('-'))
})

test('slug rules', () => {
  assert.equal(validateSlug('bbc-news', 96), null)
  assert.notEqual(validateSlug('BBC', 96), null)
  assert.notEqual(validateSlug('bbc--news', 96), null)
  assert.notEqual(validateSlug('-bbc', 96), null)
  assert.notEqual(validateSlug('', 96), null)
  assert.notEqual(validateSlug('a'.repeat(65), 64), null)
})

test('stream URL: accepts http and https', () => {
  assert.equal(validateStreamUrl('https://example.com/live/a.m3u8'), null)
  assert.equal(validateStreamUrl('http://example.org/live/c.m3u8'), null)
})

test('stream URL: rejects credentials the same way the database does', () => {
  assert.notEqual(validateStreamUrl('https://example.com/x.m3u8?token=abc'), null)
  assert.notEqual(validateStreamUrl('https://example.com/x.m3u8?a=1&sig=abc'), null)
  assert.notEqual(validateStreamUrl('https://example.com/x.m3u8?API_KEY=abc'), null)
  assert.notEqual(validateStreamUrl('https://example.com/x.m3u8?x=1;password=abc'), null)
  assert.notEqual(validateStreamUrl('https://user:pw@example.com/x.m3u8'), null)
  assert.notEqual(validateStreamUrl('https://example.com/x.m3u8?refresh_token=1'), null)
  assert.notEqual(validateStreamUrl('https://example.com/x.m3u8?credential=1'), null)
  assert.notEqual(validateStreamUrl('https://example.com/x.m3u8?credentials=1'), null)
})

test('stream URL: does not over-block similar-looking harmless names', () => {
  assert.equal(validateStreamUrl('https://example.com/x.m3u8?author=bob'), null)
  assert.equal(validateStreamUrl('https://example.com/x.m3u8?signal=1&session=2'), null)
  assert.equal(validateStreamUrl('https://example.com/token/x.m3u8'), null) // path, not a query parameter (documented limit)
})

test('stream URL: structural problems', () => {
  assert.notEqual(validateStreamUrl(''), null)
  assert.notEqual(validateStreamUrl('ftp://example.com/x'), null)
  assert.notEqual(validateStreamUrl('rtmp://example.com/x'), null)
  assert.notEqual(validateStreamUrl('https://exa mple.com/x'), null)
  assert.notEqual(validateStreamUrl('https://example.com/' + 'a'.repeat(2100)), null)
})

test('headers', () => {
  assert.equal(validateUserAgent(''), null)
  assert.equal(validateUserAgent('TribalTV/1.0 (Android)'), null)
  assert.notEqual(validateUserAgent('A\r\nX: y'), null)
  assert.notEqual(validateUserAgent('a'.repeat(513)), null)

  assert.equal(validateReferer(''), null)
  assert.equal(validateReferer('https://example.com/'), null)
  assert.notEqual(validateReferer('https://example.com/?password=1'), null)
  assert.notEqual(validateReferer('example.com'), null)

  assert.equal(validateOrigin(''), null)
  assert.equal(validateOrigin('https://example.com'), null)
  assert.equal(validateOrigin('http://example.com:8080'), null)
  assert.notEqual(validateOrigin('https://example.com/path'), null)
  assert.notEqual(validateOrigin('https://user@example.com'), null)
})

test('channel field rules', () => {
  assert.equal(validateLogoUrl(''), null)
  assert.equal(validateLogoUrl('https://x.supabase.co/storage/v1/object/public/channel-logos/a.png'), null)
  assert.notEqual(validateLogoUrl('http://example.com/l.png'), null)
  assert.equal(validateCountry('GB'), null)
  assert.notEqual(validateCountry('gb'), null)
  assert.notEqual(validateCountry('GBR'), null)
  assert.equal(validateLanguage('en'), null)
  assert.equal(validateLanguage('fil'), null)
  assert.notEqual(validateLanguage('EN'), null)
  assert.equal(validateEpgId('BBCNews.uk'), null)
  assert.notEqual(validateEpgId('BBC News'), null)
})

test('stream form: valid form passes, bad values are reported per field', () => {
  const good = {
    stream_url: 'https://example.com/live/a.m3u8',
    stream_type: 'hls',
    priority: '0',
    user_agent: 'TribalTV/1.0',
    referer: 'https://example.com/',
    origin: 'https://example.com',
    is_active: true,
  }
  assert.deepEqual(validateStreamForm(good), {})

  const bad = validateStreamForm({
    ...good,
    stream_url: 'https://example.com/x.m3u8?token=1',
    stream_type: 'rtmp',
    priority: '-1',
    origin: 'https://example.com/path',
  })
  assert.deepEqual(Object.keys(bad).sort(), ['origin', 'priority', 'stream_type', 'stream_url'])
})

test('channel form and category form', () => {
  const channel = {
    name: 'BBC News', slug: 'bbc-news', category_id: 'abc', logo_url: '', country: 'GB',
    language: 'en', epg_id: '', sort_order: '10', is_active: true,
  }
  assert.deepEqual(validateChannelForm(channel), {})
  assert.ok('category_id' in validateChannelForm({ ...channel, category_id: '' }))
  assert.ok('sort_order' in validateChannelForm({ ...channel, sort_order: '1.5' }))

  const category = { name: 'News', slug: 'news', sort_order: '10', is_active: true }
  assert.deepEqual(validateCategoryForm(category), {})
  assert.ok('name' in validateCategoryForm({ ...category, name: '   ' }))
})

test('small helpers', () => {
  assert.equal(emptyToNull('  '), null)
  assert.equal(emptyToNull(' x '), 'x')
  assert.equal(parseIntStrict('12'), 12)
  assert.equal(parseIntStrict('-3'), -3)
  assert.equal(parseIntStrict('1.5'), null)
  assert.equal(parseIntStrict('abc'), null)
})
