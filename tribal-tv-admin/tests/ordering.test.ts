import test from 'node:test'
import assert from 'node:assert/strict'
import { planMove, nextValue } from '../src/lib/ordering.ts'

const opts = { base: 10, step: 10 }

test('moving down swaps with the next item and renumbers only what changed', () => {
  const items = [
    { id: 'a', value: 10 },
    { id: 'b', value: 20 },
    { id: 'c', value: 30 },
  ]
  assert.deepEqual(planMove(items, 'a', 'down', opts), [
    { id: 'b', value: 10 },
    { id: 'a', value: 20 },
  ])
})

test('moving up at the top or down at the bottom does nothing', () => {
  const items = [{ id: 'a', value: 10 }, { id: 'b', value: 20 }]
  assert.deepEqual(planMove(items, 'a', 'up', opts), [])
  assert.deepEqual(planMove(items, 'b', 'down', opts), [])
  assert.deepEqual(planMove(items, 'zzz', 'down', opts), [])
})

test('tied values are resolved by input order and a move still changes the order', () => {
  const items = [
    { id: 'a', value: 0 },
    { id: 'b', value: 0 },
    { id: 'c', value: 0 },
  ]
  const updates = planMove(items, 'a', 'down', opts)
  const applied = new Map(items.map((i) => [i.id, i.value]))
  for (const u of updates) applied.set(u.id, u.value)
  const order = [...applied.entries()].sort((x, y) => x[1] - y[1]).map(([id]) => id)
  assert.deepEqual(order, ['b', 'a', 'c'])
  assert.equal(new Set(applied.values()).size, 3, 'values must be unique after a move')
})

test('stream priorities start at 0 and step by 1', () => {
  const items = [
    { id: 'p', value: 0 },
    { id: 'q', value: 1 },
    { id: 'r', value: 2 },
  ]
  assert.deepEqual(planMove(items, 'r', 'up', { base: 0, step: 1 }), [
    { id: 'r', value: 1 },
    { id: 'q', value: 2 },
  ])
})

test('visible subset: neighbour is chosen among visible rows only', () => {
  const items = [
    { id: 'a', value: 10 },
    { id: 'x', value: 20 }, // hidden by a filter
    { id: 'b', value: 30 },
  ]
  const updates = planMove(items, 'a', 'down', { ...opts, visibleIds: ['a', 'b'] })
  const applied = new Map(items.map((i) => [i.id, i.value]))
  for (const u of updates) applied.set(u.id, u.value)
  const order = [...applied.entries()].sort((p, q) => p[1] - q[1]).map(([id]) => id)
  assert.deepEqual(order, ['b', 'x', 'a'], 'hidden row keeps its slot; visible rows swap')
  assert.ok(applied.get('b')! < applied.get('a')!, 'a must now come after b')
})

test('nextValue', () => {
  assert.equal(nextValue([], 10, 10), 10)
  assert.equal(nextValue([10, 30, 20], 10, 10), 40)
  assert.equal(nextValue([], 0, 1), 0)
  assert.equal(nextValue([0, 1], 0, 1), 2)
})
