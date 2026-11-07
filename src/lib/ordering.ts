// Pure reorder planning. No imports, so it can be unit-tested directly in Node.

export interface OrderItem {
  id: string
  value: number
}

export interface OrderUpdate {
  id: string
  value: number
}

export interface OrderOptions {
  /** First value assigned (0 for stream priority, step for display order). */
  base: number
  /** Gap between consecutive values. */
  step: number
  /** Restrict "neighbour" lookup to the rows currently visible (e.g. after filtering). */
  visibleIds?: string[]
}

/**
 * Moves one item a single position up or down and returns only the rows whose
 * stored value must change. Ties (equal values) are resolved by input order, and
 * the whole list is renumbered so a move always has a visible effect.
 */
export function planMove(
  items: OrderItem[],
  id: string,
  direction: 'up' | 'down',
  options: OrderOptions,
): OrderUpdate[] {
  const indexed = items.map((item, index) => ({ item, index }))
  indexed.sort((a, b) => a.item.value - b.item.value || a.index - b.index)
  const ids = indexed.map((entry) => entry.item.id)

  const visibleSet = options.visibleIds ? new Set(options.visibleIds) : null
  const visible = visibleSet ? ids.filter((candidate) => visibleSet.has(candidate)) : ids

  const position = visible.indexOf(id)
  if (position === -1) return []
  const neighbourPosition = direction === 'up' ? position - 1 : position + 1
  if (neighbourPosition < 0 || neighbourPosition >= visible.length) return []

  const neighbourId = visible[neighbourPosition]
  const a = ids.indexOf(id)
  const b = ids.indexOf(neighbourId)
  ids[a] = neighbourId
  ids[b] = id

  const current = new Map(items.map((item) => [item.id, item.value]))
  const updates: OrderUpdate[] = []
  ids.forEach((itemId, index) => {
    const value = options.base + index * options.step
    if (current.get(itemId) !== value) updates.push({ id: itemId, value })
  })
  return updates
}

/** Next free value after the current maximum (or `base` when the list is empty). */
export function nextValue(values: number[], base: number, step: number): number {
  if (values.length === 0) return base
  return Math.max(...values) + step
}
