import { Box, Group, ScrollArea, Text, UnstyledButton } from '@mantine/core'
import { resistanceTotal, type ResistanceConfig, type SortDimension, type SortEntry } from './saveProgressionState'

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
              const stepNum = cellOrder.get(cellId)
              const selected = stepNum !== undefined
              const resistance = resistanceByConfig.get(row.configId) ?? 0
              const volume = (resistance || 1) * row.sets * rep
              return (
                <UnstyledButton
                  key={rep}
                  aria-label={`${row.resistanceLabel}, ${row.sets} sets, ${rep} ${unitLabel}, volume ${volume}`}
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
                    background: selected ? 'var(--mantine-color-blue-6)' : undefined,
                    borderLeft: '1px solid var(--mantine-color-default-border)',
                    borderRadius: 4,
                    cursor: readOnly ? 'default' : 'pointer',
                  }}
                >
                  {selected && (
                    <Text
                      size="xs"
                      fw={700}
                      c="white"
                      lh={1}
                      style={{ position: 'absolute', top: 4, left: 4 }}
                    >
                      {stepNum}
                    </Text>
                  )}
                  <Text size="xs" c={selected ? 'white' : 'dimmed'} lh={1}>
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
