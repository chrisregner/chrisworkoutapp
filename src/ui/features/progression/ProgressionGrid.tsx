import { Box, Group, ScrollArea, Text, UnstyledButton } from '@mantine/core'
import type { ResistanceConfig, SortDimension, SortEntry } from './SaveProgressionModal'

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: grid
// ─────────────────────────────────────────────────────────────────────────────

type GridRow = {
  configId: string
  sets: number
  resistanceLabel: string
}

type GridProps = {
  configs: ResistanceConfig[]
  setsValues: number[]
  repValues: number[]
  sortOrder: [SortEntry, SortEntry, SortEntry]
  selectedCells: string[]
  quantifierType: 'reps' | 'seconds'
  onToggleCell: (cellId: string) => void
  readOnly?: boolean
}

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

  function dimValue(row: GridRow, dim: SortDimension): number {
    if (dim === 'Resistance') return configs.findIndex(c => c.id === row.configId)
    if (dim === 'Sets') return row.sets
    return 0
  }

  rows.sort((a, b) => {
    for (const entry of sortOrder) {
      if (entry.dim === 'Reps') continue
      const va = dimValue(a, entry.dim)
      const vb = dimValue(b, entry.dim)
      if (va !== vb) return entry.dir === 'asc' ? va - vb : vb - va
    }
    return 0
  })

  return rows
}

function buildGridCols(repValues: number[], sortOrder: [SortEntry, SortEntry, SortEntry]): number[] {
  const repsEntry = sortOrder.find(e => e.dim === 'Reps')
  const sorted = repValues.slice().sort((a, b) => a - b)
  return repsEntry?.dir === 'desc' ? sorted.reverse() : sorted
}

export function ProgressionGrid({
  configs,
  setsValues,
  repValues,
  sortOrder,
  selectedCells,
  quantifierType,
  onToggleCell,
  readOnly,
}: GridProps) {
  const rows = buildGridRows(configs, setsValues, sortOrder)
  const cols = buildGridCols(repValues, sortOrder)

  if (rows.length === 0 || cols.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        Add sets, {quantifierType === 'reps' ? 'reps' : 'seconds'}, and resistance to see the grid.
      </Text>
    )
  }

  const cellOrder = new Map<string, number>()
  for (const [i, id] of selectedCells.entries()) {
    cellOrder.set(id, i + 1)
  }

  const cellW = 64
  const headerW = 140

  return (
    <ScrollArea type="auto">
      <Box style={{ minWidth: headerW + cols.length * cellW }}>
        <Group gap={0} wrap="nowrap" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
          <Box style={{ width: headerW, flexShrink: 0 }} />
          {cols.map(rep => (
            <Box
              key={rep}
              style={{ width: cellW, flexShrink: 0, textAlign: 'center', padding: '6px 2px' }}
            >
              <Text size="xs" fw={500}>{rep} {quantifierType === 'reps' ? 'reps' : 's'}</Text>
            </Box>
          ))}
        </Group>

        {rows.map(row => (
          <Group
            key={`${row.configId}|${row.sets}`}
            gap={0}
            wrap="nowrap"
            style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
          >
            <Box style={{ width: headerW, flexShrink: 0, padding: '6px 8px' }}>
              <Text size="xs" lineClamp={1}>{row.resistanceLabel} × {row.sets} sets</Text>
            </Box>
            {cols.map(rep => {
              const cellId = `${row.configId}|${row.sets}|${rep}`
              const stepNum = cellOrder.get(cellId)
              const selected = stepNum !== undefined
              const unitLabel = quantifierType === 'reps' ? 'reps' : 's'
              return (
                <UnstyledButton
                  key={rep}
                  aria-label={`${row.resistanceLabel}, ${row.sets} sets, ${rep} ${unitLabel}`}
                  aria-pressed={selected}
                  onClick={() => !readOnly && onToggleCell(cellId)}
                  style={{
                    width: cellW,
                    flexShrink: 0,
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: selected ? 'var(--mantine-color-blue-6)' : undefined,
                    borderLeft: '1px solid var(--mantine-color-default-border)',
                    borderRadius: 4,
                    cursor: readOnly ? 'default' : 'pointer',
                  }}
                >
                  {selected && (
                    <Text size="xs" fw={700} c="white">{stepNum}</Text>
                  )}
                </UnstyledButton>
              )
            })}
          </Group>
        ))}
      </Box>
    </ScrollArea>
  )
}
