import { eq } from 'drizzle-orm'
import type { Db, DbOrTx } from '../client'
import { progressionViewState } from '../schema'
import { progressionViewStateRowSchema, sortOrderSchema } from './validators'

export type SortColumn = 'resistance' | 'sets' | 'reps'
export type SortDirection = 'asc' | 'desc'
export type SortOrder = readonly { column: SortColumn; direction: SortDirection }[]

/**
 * Read the persisted sort order for a progression. Returns `null` when no
 * view-state row exists yet (the UI then falls back to its default order).
 *
 * Presentation state only: no domain smart constructor — `sortOrderSchema`
 * is the sole gate. Shape-only validation matches the rest of the persistence
 * layer's contract.
 */
export async function findSortOrder(db: Db, progressionId: string): Promise<SortOrder | null> {
  const rows = await db
    .select()
    .from(progressionViewState)
    .where(eq(progressionViewState.progressionDefId, progressionId))
    .limit(1)
  if (rows.length === 0) return null
  const row = progressionViewStateRowSchema.parse(rows[0]!)
  return row.sortOrder
}

/**
 * Upsert the sort order for a progression. Validates the supplied shape
 * before writing so callers get a typed failure on malformed input rather
 * than a DB error.
 */
export async function saveSortOrder(
  db: DbOrTx,
  progressionId: string,
  sortOrder: SortOrder,
): Promise<void> {
  const validated = sortOrderSchema.parse(sortOrder)
  await db
    .insert(progressionViewState)
    .values({
      progressionDefId: progressionId,
      sortOrder: validated,
    })
    .onConflictDoUpdate({
      target: progressionViewState.progressionDefId,
      set: { sortOrder: validated },
    })
}
