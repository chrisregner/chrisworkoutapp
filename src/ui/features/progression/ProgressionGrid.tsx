import { Box, Group, ScrollArea, Text, UnstyledButton } from '@mantine/core'
import {
  resistanceTotal,
  type HeavyLightPair,
  type ResistanceConfig,
  type SortColumn,
  type SortEntry,
} from './saveProgressionState'

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: grid
// ─────────────────────────────────────────────────────────────────────────────

type GridRow = {
  configId: string
  sets: number
  resistanceLabel: string
}

type LinearProps = {
  mode?: 'linear'
  selectedCells: string[]
}

type HeavyLightProps = {
  mode: 'heavyLight'
  pairs: HeavyLightPair[]
  pendingHeavy: string | null
}

type GridProps = {
  configs: ResistanceConfig[]
  setsValues: number[]
  repValues: number[]
  sortOrder: [SortEntry, SortEntry, SortEntry]
  quantifierType: 'reps' | 'seconds'
  onToggleCell: (cellId: string) => void
  readOnly?: boolean
} & (LinearProps | HeavyLightProps)

type CellState =
  | { kind: 'empty' }
  | { kind: 'linear'; step: number }
  | { kind: 'heavy'; step: number }
  | { kind: 'light'; step: number }
  | { kind: 'pending' }

function buildGridRows(
  configs: ResistanceConfig[],
  setsValues: number[],
  sortOrder: [SortEntry, SortEntry, SortEntry],
): GridRow[] {
  const rows: GridRow[] = []
  for (const config of configs) {
    for (const sets of setsValues) {
      rows.push({ configId: config.id, sets, resistanceLabel: config.label })
    }
  }

  const resistanceByConfigId = new Map<string, number>()
  for (const c of configs) resistanceByConfigId.set(c.id, resistanceTotal(c.source))

  function dimValue(row: GridRow, column: SortColumn): number {
    if (column === 'resistance') return resistanceByConfigId.get(row.configId) ?? 0
    if (column === 'sets') return row.sets
    return 0
  }

  rows.sort((a, b) => {
    for (const entry of sortOrder) {
      if (entry.column === 'reps') continue
      const va = dimValue(a, entry.column)
      const vb = dimValue(b, entry.column)
      if (va !== vb) return entry.direction === 'asc' ? va - vb : vb - va
    }
    return 0
  })

  return rows
}

function buildGridCols(repValues: number[], sortOrder: [SortEntry, SortEntry, SortEntry]): number[] {
  const repsEntry = sortOrder.find(e => e.column === 'reps')
  const sorted = repValues.slice().sort((a, b) => a - b)
  return repsEntry?.direction === 'desc' ? sorted.reverse() : sorted
}

function buildCellStates(props: GridProps): Map<string, CellState> {
  const states = new Map<string, CellState>()
  if (props.mode === 'heavyLight') {
    props.pairs.forEach((p, i) => {
      const step = i + 1
      states.set(p.heavy, { kind: 'heavy', step })
      states.set(p.light, { kind: 'light', step })
    })
    if (props.pendingHeavy && !states.has(props.pendingHeavy)) {
      states.set(props.pendingHeavy, { kind: 'pending' })
    }
  } else {
    const cells = props.selectedCells
    cells.forEach((id, i) => {
      states.set(id, { kind: 'linear', step: i + 1 })
    })
  }
  return states
}

function backgroundFor(state: CellState): string | undefined {
  if (state.kind === 'linear') return 'var(--mantine-color-blue-6)'
  if (state.kind === 'heavy') return 'var(--mantine-color-red-6)'
  if (state.kind === 'light') return 'var(--mantine-color-blue-6)'
  return undefined
}

function ariaLabelFor(base: string, state: CellState): string {
  if (state.kind === 'heavy') return `${base}, heavy step ${state.step}`
  if (state.kind === 'light') return `${base}, light step ${state.step}`
  if (state.kind === 'pending') return `${base}, pending heavy`
  return base
}

function StepBadge({ state }: { state: CellState }) {
  if (state.kind === 'linear') {
    return (
      <Text
        size="xs"
        fw={700}
        c="white"
        lh={1}
        style={{ position: 'absolute', top: 4, left: 4 }}
      >
        {state.step}
      </Text>
    )
  }
  if (state.kind === 'heavy') {
    return (
      <Text
        size="xs"
        fw={700}
        c="white"
        lh={1}
        style={{ position: 'absolute', top: 4, left: 4 }}
      >
        H{state.step}
      </Text>
    )
  }
  if (state.kind === 'light') {
    return (
      <Text
        size="xs"
        fw={700}
        c="white"
        lh={1}
        style={{ position: 'absolute', top: 4, left: 4 }}
      >
        L{state.step}
      </Text>
    )
  }
  if (state.kind === 'pending') {
    return (
      <Text
        size="xs"
        fw={700}
        c="red"
        lh={1}
        style={{ position: 'absolute', top: 4, left: 4 }}
      >
        H?
      </Text>
    )
  }
  return null
}

export function ProgressionGrid(props: GridProps) {
  const { configs, setsValues, repValues, sortOrder, quantifierType, onToggleCell, readOnly } = props
  const rows = buildGridRows(configs, setsValues, sortOrder)
  const cols = buildGridCols(repValues, sortOrder)

  if (rows.length === 0 || cols.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        Add sets, {quantifierType === 'reps' ? 'reps' : 'seconds'}, and resistance to see the grid.
      </Text>
    )
  }

  const cellStates = buildCellStates(props)

  const resistanceByConfig = new Map<string, number>()
  for (const c of configs) {
    resistanceByConfig.set(c.id, resistanceTotal(c.source))
  }

  const cellW = 44
  const cellH = 44
  const headerW = 64
  const unitLabel = quantifierType === 'reps' ? 'reps' : 's'
  const bleedX = 'var(--mantine-spacing-md)'

  return (
    <ScrollArea type="auto" style={{ marginInline: `calc(${bleedX} * -1)` }}>
      <Box style={{ minWidth: `calc(${headerW + cols.length * cellW}px + ${bleedX} * 2)`, paddingInline: bleedX }}>
        <Group gap={0} wrap="nowrap" align="flex-end" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
          <Box style={{ width: headerW, flexShrink: 0 }} />
          {cols.map(rep => (
            <Box
              key={rep}
              style={{ width: cellW, flexShrink: 0, textAlign: 'center', padding: '6px 2px' }}
            >
              <Text size="xs" fw={500} lh={1.15} style={{ whiteSpace: 'pre-line' }}>
                {`${rep}\n${unitLabel}`}
              </Text>
            </Box>
          ))}
        </Group>

        {rows.map((row, idx) => {
          const repeatResistance = idx > 0 && rows[idx - 1]!.configId === row.configId
          return (
          <Group
            key={`${row.configId}|${row.sets}`}
            gap={0}
            wrap="nowrap"
            style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
          >
            <Box style={{ width: headerW, flexShrink: 0, padding: '6px 6px' }}>
              <Text
                size="xs"
                lineClamp={1}
                lh={1.15}
                style={repeatResistance ? { visibility: 'hidden' } : undefined}
              >
                {row.resistanceLabel}
              </Text>
              <Text size="xs" c="dimmed" lineClamp={1} lh={1.15}>×{row.sets}</Text>
            </Box>
            {cols.map(rep => {
              const cellId = `${row.configId}|${row.sets}|${rep}`
              const state = cellStates.get(cellId) ?? { kind: 'empty' as const }
              const selected = state.kind !== 'empty'
              const resistance = resistanceByConfig.get(row.configId) ?? 0
              const volume = (resistance || 1) * row.sets * rep
              const baseLabel = `${row.resistanceLabel}, ${row.sets} sets, ${rep} ${unitLabel}, volume ${volume}`
              const pending = state.kind === 'pending'
              return (
                <UnstyledButton
                  key={rep}
                  aria-label={ariaLabelFor(baseLabel, state)}
                  aria-pressed={selected}
                  onClick={() => !readOnly && onToggleCell(cellId)}
                  style={{
                    position: 'relative',
                    width: cellW,
                    flexShrink: 0,
                    height: cellH,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: backgroundFor(state),
                    borderLeft: '1px solid var(--mantine-color-default-border)',
                    outline: pending ? '2px dashed var(--mantine-color-red-6)' : undefined,
                    outlineOffset: pending ? -2 : undefined,
                    borderRadius: 4,
                    cursor: readOnly ? 'default' : 'pointer',
                  }}
                >
                  <StepBadge state={state} />
                  <Text size="xs" c={selected && !pending ? 'white' : 'dimmed'} lh={1}>
                    {volume}
                  </Text>
                </UnstyledButton>
              )
            })}
          </Group>
          )
        })}
      </Box>
    </ScrollArea>
  )
}
