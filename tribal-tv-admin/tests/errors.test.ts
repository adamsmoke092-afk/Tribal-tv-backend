import test from 'node:test'
import assert from 'node:assert/strict'
import { explain } from '../src/lib/errors.ts'

test('RLS / permission errors tell the admin what is wrong', () => {
  const rls = explain({ code: '42501', message: 'new row violates row-level security policy for table "channels"' }, 'Creating the channel')
  assert.match(rls.message, /refused/)
  assert.match(rls.message, /not an administrator|expired/)
  assert.match(explain({ message: 'permission denied for table admin_users' }, 'X').message, /refused/)
})

test('duplicate, foreign-key and check-constraint errors are translated', () => {
  assert.match(explain({ code: '23505', message: 'duplicate key' }, 'Adding the stream').message, /already exists/)
  assert.match(explain({ code: '23503', message: 'violates foreign key' }, 'Deleting the category').message, /still depend/)
  const secret = explain({ code: '23514', message: 'new row violates check constraint "channel_streams_url_no_secrets"' }, 'Adding the stream')
  assert.match(secret.message, /credential-like parameter/)
  const unknown = explain({ code: '23514', message: 'violates check constraint "some_new_rule"' }, 'Saving')
  assert.match(unknown.message, /some_new_rule/)
})

test('storage and network problems', () => {
  assert.match(explain({ message: 'Bucket not found' }, 'Uploading the logo').message, /storage migration/)
  assert.match(explain({ message: 'TypeError: Failed to fetch' }, 'Saving').message, /network error/)
})

test('unknown errors still say the action failed and never look like success', () => {
  const e = explain({ message: 'something odd' }, 'Saving the order')
  assert.ok(e instanceof Error)
  assert.match(e.message, /^Saving the order failed: something odd$/)
  assert.match(explain(null, 'Saving').message, /^Saving failed\.$/)
  assert.match(explain('weird', 'Saving').message, /^Saving failed\.$/)
})
