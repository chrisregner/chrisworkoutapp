// ─────────────────────────────────────────────────────────────────────────────
// ProgressionGrid behavior inventory
//
// Empty state
// - when configs/setsValues/repValues are empty, displays an instructional
//   message for reps exercises
// - when quantifierType is 'seconds', the empty-state message says "seconds"
//
// Happy path (linear)
// - when given configs, sets and reps, renders one row per (config × sets)
//   and one column per rep, and column headers show the rep count with unit
// - when a cell id is in selectedCells, the cell displays its 1-based step
//   number (order of selection)
// - clicking a cell calls onToggleCell with the corresponding cell id
//
// Heavy/Light mode
// - when given pairs, each pair's heavy cell shows H{step}, light shows L{step}
// - when pendingHeavy is set, that cell's aria-label includes "pending heavy"
//
// Sort
// - reversing the Reps sort direction reverses the order of column headers
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest'
import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProgressionGrid } from '../ProgressionGrid'
import type { HeavyLightPair, ResistanceConfig, SortEntry } from '../saveProgressionState'
import type { VolumeSetInput } from '../../../../domain'

type LinearGridProps = {
  configs?: ResistanceConfig[]
  setsValues?: number[]
  repValues?: number[]
  sortOrder?: [SortEntry, SortEntry, SortEntry]
  selectedCells?: string[]
  quantifierType?: 'reps' | 'seconds'
  onToggleCell?: (cellId: string) => void
  readOnly?: boolean
}

function renderGrid(props: LinearGridProps = {}) {
  const defaultSort: [SortEntry, SortEntry, SortEntry] = [
    { column: 'resistance', direction: 'asc' },
    { column: 'sets', direction: 'asc' },
    { column: 'reps', direction: 'asc' },
  ]
  const onToggleCell = props.onToggleCell ?? vi.fn()
  const result = render(
    <MantineProvider>
      <ProgressionGrid
        mode="linear"
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

type HlGridProps = {
  configs?: ResistanceConfig[]
  setsValues?: number[]
  repValues?: number[]
  sortOrder?: [SortEntry, SortEntry, SortEntry]
  pairs?: HeavyLightPair[]
  pendingHeavy?: string | null
  quantifierType?: 'reps' | 'seconds'
  onToggleCell?: (cellId: string) => void
  readOnly?: boolean
}

function renderHlGrid(props: HlGridProps = {}) {
  const defaultSort: [SortEntry, SortEntry, SortEntry] = [
    { column: 'resistance', direction: 'asc' },
    { column: 'sets', direction: 'asc' },
    { column: 'reps', direction: 'asc' },
  ]
  const onToggleCell = props.onToggleCell ?? vi.fn()
  const result = render(
    <MantineProvider>
      <ProgressionGrid
        mode="heavyLight"
        configs={props.configs ?? []}
        setsValues={props.setsValues ?? []}
        repValues={props.repValues ?? []}
        sortOrder={props.sortOrder ?? defaultSort}
        pairs={props.pairs ?? []}
        pendingHeavy={props.pendingHeavy ?? null}
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

  it('renders H{step}/L{step} step labels on each pair in heavyLight mode', () => {
    const heavyCfg = sampleConfig('cfg-heavy', '20kg', 20)
    const lightCfg = sampleConfig('cfg-light', '10kg', 10)
    renderHlGrid({
      configs: [heavyCfg, lightCfg],
      setsValues: [3],
      repValues: [5, 10],
      pairs: [{ heavy: 'cfg-heavy|3|5', light: 'cfg-light|3|10' }],
    })

    expect(
      screen.getByRole('button', { name: /20kg, 3 sets, 5 reps,.*heavy step 1/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /10kg, 3 sets, 10 reps,.*light step 1/i }),
    ).toBeInTheDocument()
  })

  it('marks the pendingHeavy cell with a pending-heavy aria-label in heavyLight mode', () => {
    const cfg = sampleConfig('cfg-a', '10kg', 10)
    renderHlGrid({
      configs: [cfg],
      setsValues: [3],
      repValues: [5],
      pairs: [],
      pendingHeavy: 'cfg-a|3|5',
    })

    expect(
      screen.getByRole('button', { name: /10kg, 3 sets, 5 reps,.*pending heavy/i }),
    ).toBeInTheDocument()
  })

  it('reverses column header order when Reps sort direction is desc', () => {
    const configA = sampleConfig('cfg-a', '10kg', 10)
    const sort: [SortEntry, SortEntry, SortEntry] = [
      { column: 'resistance', direction: 'asc' },
      { column: 'sets', direction: 'asc' },
      { column: 'reps', direction: 'desc' },
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
