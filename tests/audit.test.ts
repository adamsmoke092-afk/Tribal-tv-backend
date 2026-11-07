import test from 'node:test'
import assert from 'node:assert/strict'
import { describeChanges, shortId, showValue } from '../src/lib/audit.ts'

test('update shows only changed fields and hides timestamps', () => {
  const lines = describeChanges({
    action: 'UPDATE',
    old_data: { id: 'x', priority: 2, stream_url: 'https://a/b.m3u8', updated_at: '1' },
    new_data: { id: 'x', priority: 5, stream_url: 'https://a/b.m3u8', updated_at: '2' },
  })
  assert.deepEqual(lines, [{ key: 'priority', before: '2', after: '5' }])
})

test('insert lists new values, delete lists old values', () => {
  const inserted = describeChanges({ action: 'INSERT', old_data: null, new_data: { name: 'BBC', is_active: true, created_at: 'z' } })
  assert.deepEqual(inserted, [{ key: 'name', after: 'BBC' }, { key: 'is_active', after: 'true' }])
  const deleted = describeChanges({ action: 'DELETE', old_data: { name: 'BBC' }, new_data: null })
  assert.deepEqual(deleted, [{ key: 'name', before: 'BBC' }])
})

test('helpers', () => {
  assert.equal(showValue(null), '—')
  assert.equal(showValue('a'.repeat(200)).length, 118)
  assert.equal(shortId('0123456789abcdef'), '01234567…')
  assert.equal(shortId('abc'), 'abc')
})
