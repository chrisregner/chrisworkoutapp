import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useProgressionViewState } from '../../providers/AppServicesProvider'
import type { SortOrder } from '../../../persistence/repositories/progressionViewState.repo'
import { progressionQueries } from './progressionKeys'
import { invalidateProgressionViewStateAfterWrite } from './progressionInvalidations'
import { DEFAULT_SORT, type SortEntry } from './saveProgressionState'

// UI and persistence share the same shape (`{ column, direction }`, lowercase
// column names) so no translation is required. Sort order is presentation
// state; persistence is the single source of truth for its representation,
// and the UI just consumes the same shape.

type UiTuple = [SortEntry, SortEntry, SortEntry]

/**
 * Merge a persisted (possibly partial / empty) sort order with the UI default
 * so the result always carries all three columns in priority order. Missing
 * columns get appended in default order; unknown extras are dropped.
 */
function mergeWithDefault(persisted: SortOrder | null | undefined): UiTuple {
  if (!persisted || persisted.length === 0) return DEFAULT_SORT
  const mapped: SortEntry[] = persisted.map(p => ({ column: p.column, direction: p.direction }))
  const seen = new Set(mapped.map(e => e.column))
  const remaining = DEFAULT_SORT.filter(e => !seen.has(e.column))
  const merged = [...mapped, ...remaining].slice(0, 3) as UiTuple
  // Defensive: if the persisted shape was malformed and we ended up short,
  // fall back to the default.
  if (merged.length !== 3) return DEFAULT_SORT
  return merged
}

/**
 * Hook for reading/writing the persisted sort order of a progression's grid.
 *
 * When `progressionId` is null (a not-yet-saved progression), the hook returns
 * the default order and a no-op setter that updates only local state via the
 * caller — view-state can only be persisted once the progression has an id.
 */
export function useProgressionSortOrder(progressionId: string | null) {
  const repo = useProgressionViewState()
  const qc = useQueryClient()

  const query = useQuery({
    ...progressionQueries.viewState(repo, progressionId ?? '__unsaved__'),
    enabled: progressionId !== null,
  })

  const mutation = useMutation({
    mutationFn: async (next: UiTuple) => {
      if (!progressionId) return
      await repo.saveSortOrder(progressionId, next.slice())
    },
    onSuccess: () => {
      if (progressionId) invalidateProgressionViewStateAfterWrite(qc, progressionId)
    },
  })

  const sortOrder: UiTuple = mergeWithDefault(query.data)

  return {
    sortOrder,
    setSortOrder: (next: UiTuple) => mutation.mutate(next),
    isLoading: progressionId !== null && query.isLoading,
  }
}
