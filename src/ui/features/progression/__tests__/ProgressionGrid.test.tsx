// ─────────────────────────────────────────────────────────────────────────────
// ProgressionGrid behavior inventory
//
// Empty state
// - when configs/setsValues/repValues are empty, displays an instructional
//   message for reps exercises
// - when quantifierType is 'seconds', the empty-state message says "seconds"
//
// Happy path
// - when given configs, sets and reps, renders one row per (config × sets)
//   and one column per rep, and column headers show the rep count with unit
// - when a cell id is in selectedCells, the cell displays its 1-based step
//   number (order of selection)
// - clicking a cell calls onToggleCell with the corresponding cell id
//
// Sort
// - reversing the Reps sort direction reverses the order of column headers
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest'
import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProgressionGrid } from '../ProgressionGrid'
import type { ResistanceConfig, SortEntry } from '../saveProgressionState'
import type { VolumeSetInput } from '../../../../domain'

function renderGrid(props: Partial<Parameters<typeof ProgressionGrid>[0]> = {}) {
  const defaultSort: [SortEntry, SortEntry, SortEntry] = [
    { dim: 'Resistance', dir: 'asc' },
    { dim: 'Sets', dir: 'asc' },
    { dim: 'Reps', dir: 'asc' },
  ]
  const onToggleCell = props.onToggleCell ?? vi.fn()
  const result = render(
    <MantineProvider>
      <ProgressionGrid
        configs={props.configs ?? []}
        setsValues={props.setsValues ?? []}
        repValues={props.repValues ?? []}
        sortOrder={props.sortOrder ?? defaultSort}
        selectedCells={props.selectedCells ?? []}
        quantifierType={props.quantifierType ?? 'reps'}
        onToggleCell={onToggleCell}
        readOnly={props.readOnly}
      />
    </MantineProvider>,
  )
  return { ...result, onToggleCell, user: userEvent.setup() }
}

const sampleConfig = (id: string, label: string, resistance: number): ResistanceConfig => ({
  id,
  label,
  source: [
    {
      piece: { resistance, totalQuantity: 1 },
      quantityUsed: 1,
    } satisfies VolumeSetInput['resistanceSource'][number],
  ],
})

describe('ProgressionGrid', () => {
  it('displays instructional empty state when no rows or cols (reps)', () => {
    renderGrid({ quantifierType: 'reps' })
    expect(
      screen.getByText(/add sets, reps, and resistance to see the grid/i),
    ).toBeInTheDocument()
  })

  it("uses 'seconds' wording in the empty state when quantifierType is seconds", () => {
    renderGrid({ quantifierType: 'seconds' })
    expect(
      screen.getByText(/add sets, seconds, and resistance to see the grid/i),
    ).toBeInTheDocument()
  })

  it('renders one row per (config × sets) with column headers per rep', () => {
    const configA = sampleConfig('cfg-a', '10kg', 10)
    const configB = sampleConfig('cfg-b', '20kg', 20)
    renderGrid({
      configs: [configA, configB],
      setsValues: [3, 5],
      repValues: [5, 8],
    })

    // Headers: "5 reps", "8 reps"
    expect(screen.getByText('5 reps')).toBeInTheDocument()
    expect(screen.getByText('8 reps')).toBeInTheDocument()

    // Resistance label appears once per row (visually grouped via visibility-hidden on repeats).
    expect(screen.getAllByText('10kg')).toHaveLength(2)
    expect(screen.getAllByText('20kg')).toHaveLength(2)
    // Sets shown in dedicated mini-column per row.
    expect(screen.getAllByText('×3')).toHaveLength(2)
    expect(screen.getAllByText('×5')).toHaveLength(2)
  })

  it('shows the 1-based step number on each selected cell in selection order', () => {
    const configA = sampleConfig('cfg-a', '10kg', 10)
    renderGrid({
      configs: [configA],
      setsValues: [3],
      repValues: [5, 8],
      // First selection: 8-rep cell. Second selection: 5-rep cell.
      selectedCells: ['cfg-a|3|8', 'cfg-a|3|5'],
    })

    // Two step numbers visible: "1" on the 8-rep cell, "2" on the 5-rep cell.
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('calls onToggleCell with the cell id when a cell is clicked', async () => {
    const configA = sampleConfig('cfg-a', '10kg', 10)
    const onToggleCell = vi.fn()
    const { user } = renderGrid({
      configs: [configA],
      setsValues: [3],
      repValues: [5],
      onToggleCell,
    })

    // Only one cell button in the grid besides the header.
    const buttons = screen.getAllByRole('button')
    // Find the cell — the only button without text inside a header row.
    // Simpler: there's exactly one row + one column, so exactly one cell button.
    const cellButton = buttons[buttons.length - 1]!
    await user.click(cellButton)
    expect(onToggleCell).toHaveBeenCalledWith('cfg-a|3|5')
  })

  it('reverses column header order when Reps sort direction is desc', () => {
    const configA = sampleConfig('cfg-a', '10kg', 10)
    const sort: [SortEntry, SortEntry, SortEntry] = [
      { dim: 'Resistance', dir: 'asc' },
      { dim: 'Sets', dir: 'asc' },
      { dim: 'Reps', dir: 'desc' },
    ]
    renderGrid({
      configs: [configA],
      setsValues: [3],
      repValues: [5, 8],
      sortOrder: sort,
    })

    const fiveReps = screen.getByText('5 reps')
    const eightReps = screen.getByText('8 reps')
    // 8 should appear before 5 in the document.
    expect(
      eightReps.compareDocumentPosition(fiveReps) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    // Sanity within scope:
    expect(within(document.body).getAllByText(/reps/i).length).toBeGreaterThanOrEqual(2)
  })
})
