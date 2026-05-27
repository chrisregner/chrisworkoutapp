// ─────────────────────────────────────────────────────────────────────────────
// SortPriorityControl behavior inventory
//
// - clicking a row's direction toggle emits the same order with that row's
//   direction flipped (asc ↔ desc)
// - clicking the down chevron on row N swaps rows N and N+1
// - clicking the up chevron on row N swaps rows N and N-1
// - the up chevron on the first row and the down chevron on the last row are
//   disabled
// - in readOnly mode, no move chevrons render and the direction toggle is
//   disabled
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest'
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SortPriorityControl } from '../SortPriorityControl'
import type { SortEntry } from '../saveProgressionState'

const DEFAULT_SORT: [SortEntry, SortEntry, SortEntry] = [
  { column: 'resistance', direction: 'asc' },
  { column: 'sets', direction: 'asc' },
  { column: 'reps', direction: 'asc' },
]

function renderControl(
  sortOrder: [SortEntry, SortEntry, SortEntry] = DEFAULT_SORT,
  readOnly = false,
) {
  const onChange = vi.fn()
  const result = render(
    <MantineProvider>
      <SortPriorityControl sortOrder={sortOrder} onChange={onChange} readOnly={readOnly} />
    </MantineProvider>,
  )
  return { ...result, onChange, user: userEvent.setup() }
}

/** Find the row container by the column label it shows. */
function rowFor(label: string): HTMLElement {
  return screen.getByText(label).parentElement as HTMLElement
}

describe('SortPriorityControl', () => {
  it('clicking a row\'s direction toggle emits the order with that row flipped', async () => {
    const { user, onChange } = renderControl()
    const resistanceRow = rowFor('Resistance')
    const flip = resistanceRow.querySelector('button[title*="Ascending"]') as HTMLElement
    await user.click(flip)
    expect(onChange).toHaveBeenCalledWith([
      { column: 'resistance', direction: 'desc' },
      { column: 'sets', direction: 'asc' },
      { column: 'reps', direction: 'asc' },
    ])
  })

  it('clicking the down chevron on row 1 swaps it with row 2', async () => {
    const { user, onChange } = renderControl()
    const resistanceRow = rowFor('Resistance')
    // Chevron-down is the third action button in the row (after dir-toggle and
    // chevron-up).
    const actionBtns = resistanceRow.querySelectorAll('button')
    const downChevron = actionBtns[actionBtns.length - 1] as HTMLElement
    await user.click(downChevron)
    expect(onChange).toHaveBeenCalledWith([
      { column: 'sets', direction: 'asc' },
      { column: 'resistance', direction: 'asc' },
      { column: 'reps', direction: 'asc' },
    ])
  })

  it('clicking the up chevron on row 2 swaps it with row 1', async () => {
    const { user, onChange } = renderControl()
    const setsRow = rowFor('Sets')
    const actionBtns = setsRow.querySelectorAll('button')
    // Up chevron is the second action button (after dir-toggle).
    const upChevron = actionBtns[1] as HTMLElement
    await user.click(upChevron)
    expect(onChange).toHaveBeenCalledWith([
      { column: 'sets', direction: 'asc' },
      { column: 'resistance', direction: 'asc' },
      { column: 'reps', direction: 'asc' },
    ])
  })

  it('up chevron on the first row and down chevron on the last row are disabled', () => {
    renderControl()
    const firstRow = rowFor('Resistance')
    const firstUp = firstRow.querySelectorAll('button')[1] as HTMLButtonElement
    expect(firstUp).toBeDisabled()

    const lastRow = rowFor('Reps')
    const lastActions = lastRow.querySelectorAll('button')
    const lastDown = lastActions[lastActions.length - 1] as HTMLButtonElement
    expect(lastDown).toBeDisabled()
  })

  it('readOnly hides the move chevrons and disables the direction toggle', () => {
    renderControl(DEFAULT_SORT, true)
    const row = rowFor('Resistance')
    const btns = row.querySelectorAll('button')
    // Only the direction-toggle remains (no chevrons).
    expect(btns.length).toBe(1)
    expect(btns[0]).toBeDisabled()
  })
})
