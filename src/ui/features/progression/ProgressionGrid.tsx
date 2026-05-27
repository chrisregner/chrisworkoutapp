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

type CellRoles = {
  heavySteps: number[]
  lightSteps: number[]
  linearStep: number | null
  pending: boolean
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

function emptyRoles(): CellRoles {
  return { heavySteps: [], lightSteps: [], linearStep: null, pending: false }
}

function buildCellStates(props: GridProps): Map<string, CellRoles> {
  const states = new Map<string, CellRoles>()
  function get(cellId: string): CellRoles {
    if (!states.has(cellId)) states.set(cellId, emptyRoles())
    return states.get(cellId)!
  }
  if (props.mode === 'heavyLight') {
    props.pairs.forEach((p, i) => {
      const step = i + 1
      get(p.heavy).heavySteps.push(step)
      get(p.light).lightSteps.push(step)
    })
    if (props.pendingHeavy) get(props.pendingHeavy).pending = true
  } else {
    props.selectedCells.forEach((id, i) => { get(id).linearStep = i + 1 })
  }
  return states
}

function backgroundFor(roles: CellRoles): string | undefined {
  const hasHeavy = roles.heavySteps.length > 0
  const hasLight = roles.lightSteps.length > 0
  if (hasHeavy && hasLight) {
    return 'linear-gradient(135deg, var(--mantine-color-red-6) 0%, var(--mantine-color-red-6) 50%, var(--mantine-color-blue-6) 50%, var(--mantine-color-blue-6) 100%)'
  }
  if (hasHeavy) return 'var(--mantine-color-red-6)'
  if (hasLight || roles.linearStep !== null) return 'var(--mantine-color-blue-6)'
  return undefined
}

function ariaLabelFor(base: string, roles: CellRoles): string {
  const parts = [base]
  for (const step of roles.heavySteps) parts.push(`heavy step ${step}`)
  for (const step of roles.lightSteps) parts.push(`light step ${step}`)
  if (roles.pending) parts.push('pending heavy')
  return parts.join(', ')
}

function StepBadge({ roles }: { roles: CellRoles }) {
  const topLeft = roles.linearStep !== null ? (
    <Text size="xs" fw={700} c="white" lh={1} style={{ position: 'absolute', top: 4, left: 4 }}>
      {roles.linearStep}
    </Text>
  ) : roles.heavySteps.length > 0 ? (
    <Text size="xs" fw={700} c="white" lh={1} style={{ position: 'absolute', top: 4, left: 4, whiteSpace: 'pre-line' }}>
      {roles.heavySteps.map(s => `H${s}`).join('\n')}
    </Text>
  ) : roles.pending ? (
    <Text size="xs" fw={700} c="red" lh={1} style={{ position: 'absolute', top: 4, left: 4 }}>
      H?
    </Text>
  ) : null

  const bottomRight = roles.lightSteps.length > 0 ? (
    <Text size="xs" fw={700} c="white" lh={1} style={{ position: 'absolute', bottom: 4, right: 4, textAlign: 'right', whiteSpace: 'pre-line' }}>
      {roles.lightSteps.map(s => `L${s}`).join('\n')}
    </Text>
  ) : null

  return <>{topLeft}{bottomRight}</>
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
              const roles = cellStates.get(cellId) ?? emptyRoles()
              const selected = roles.heavySteps.length > 0 || roles.lightSteps.length > 0 || roles.linearStep !== null || roles.pending
              const resistance = resistanceByConfig.get(row.configId) ?? 0
              const volume = (resistance || 1) * row.sets * rep
              const baseLabel = `${row.resistanceLabel}, ${row.sets} sets, ${rep} ${unitLabel}, volume ${volume}`
              return (
                <UnstyledButton
                  key={rep}
                  aria-label={ariaLabelFor(baseLabel, roles)}
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
                    background: backgroundFor(roles),
                    borderLeft: '1px solid var(--mantine-color-default-border)',
                    outline: roles.pending ? '2px dashed var(--mantine-color-red-6)' : undefined,
                    outlineOffset: roles.pending ? -2 : undefined,
                    borderRadius: 4,
                    cursor: readOnly ? 'default' : 'pointer',
                  }}
                >
                  <StepBadge roles={roles} />
                  <Text size="xs" c={selected && !roles.pending ? 'white' : 'dimmed'} lh={1}>
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
