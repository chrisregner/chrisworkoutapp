import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Fieldset,
  Group,
  Modal,
  NumberInput,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core'
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconChevronUp,
  IconEdit,
  IconPlus,
  IconX,
} from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { ruleAccepts } from '../../../domain'
import type { EquipmentDef, ExerciseDef, ProgressionDef, VolumeSetInput } from '../../../domain'
import { useSaveProgression } from './useSaveProgression'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SortDimension = 'Resistance' | 'Sets' | 'Reps'
type SortEntry = { dim: SortDimension; dir: 'asc' | 'desc' }

type ResistanceConfig = {
  id: string
  label: string
  source: VolumeSetInput['resistanceSource']
}

type Props = {
  opened: boolean
  onClose: () => void
  exercise: ExerciseDef
  progression?: ProgressionDef
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const UNLOADED_CONFIG_ID = 'unloaded'

function newConfigId(): string {
  return Math.random().toString(36).slice(2)
}

function sourceKey(source: VolumeSetInput['resistanceSource']): string {
  // Ad-hoc entries have no pieceId; key on resistance value instead so identical
  // ad-hoc configurations collapse to one config.
  return JSON.stringify(
    source
      .slice()
      .sort((a, b) => {
        const ka = a.piece.pieceId ?? `adhoc:${a.piece.resistance}`
        const kb = b.piece.pieceId ?? `adhoc:${b.piece.resistance}`
        return ka.localeCompare(kb)
      })
      .map(r => ({
        id: r.piece.pieceId ?? `adhoc:${r.piece.resistance}`,
        qty: r.quantityUsed,
      })),
  )
}

function resistanceTotal(source: VolumeSetInput['resistanceSource']): number {
  return source.reduce((sum, r) => sum + r.piece.resistance * r.quantityUsed, 0)
}

function labelForSource(
  source: VolumeSetInput['resistanceSource'],
  equipment: EquipmentDef | null,
): string {
  if (source.length === 0) return 'Unloaded'
  const total = resistanceTotal(source)
  if (equipment) return `${total}${equipment.unit}`
  return `+${total}`
}

function deriveConfigsFromProgression(
  progression: ProgressionDef,
  equipment: EquipmentDef | null,
): ResistanceConfig[] {
  if (progression.body.kind !== 'linear') return []
  const seen = new Map<string, ResistanceConfig>()
  // For bodyweight, ensure the implicit "Bodyweight" config is always present
  // even if no saved volume set uses an empty source.
  if (!equipment) {
    const emptyKey = sourceKey([])
    seen.set(emptyKey, { id: UNLOADED_CONFIG_ID, label: 'Unloaded', source: [] })
  }
  for (const vs of progression.body.volumeSets) {
    const src: VolumeSetInput['resistanceSource'] = vs.resistanceSource.map(r => ({
      piece: {
        ...(r.piece.pieceId !== undefined ? { pieceId: r.piece.pieceId as string } : {}),
        resistance: r.piece.resistance as number,
        totalQuantity: r.piece.totalQuantity as number,
      },
      quantityUsed: r.quantityUsed as number,
    }))
    const key = sourceKey(src)
    if (!seen.has(key)) {
      const id = src.length === 0 ? UNLOADED_CONFIG_ID : newConfigId()
      seen.set(key, { id, label: labelForSource(src, equipment), source: src })
    }
  }
  return Array.from(seen.values())
}

function findConfigId(
  configs: ResistanceConfig[],
  source: VolumeSetInput['resistanceSource'],
): string | undefined {
  const key = sourceKey(source)
  return configs.find(c => sourceKey(c.source) === key)?.id
}

function deriveSelectedCells(
  progression: ProgressionDef,
  configs: ResistanceConfig[],
): string[] {
  if (progression.body.kind !== 'linear') return []
  return progression.body.volumeSets.map(vs => {
    const src: VolumeSetInput['resistanceSource'] = vs.resistanceSource.map(r => ({
      piece: {
        ...(r.piece.pieceId !== undefined ? { pieceId: r.piece.pieceId as string } : {}),
        resistance: r.piece.resistance as number,
        totalQuantity: r.piece.totalQuantity as number,
      },
      quantityUsed: r.quantityUsed as number,
    }))
    const configId = findConfigId(configs, src) ?? ''
    return `${configId}|${vs.sets as number}|${vs.quantifierValue as number}`
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: chip list with single + range add
// ─────────────────────────────────────────────────────────────────────────────

function ChipList({
  values,
  onAdd,
  onRemove,
  inputMin,
  inputStep,
  placeholder,
  validate,
  validationError,
  readOnly,
}: {
  values: number[]
  onAdd: (v: number) => void
  onRemove: (v: number) => void
  inputMin: number
  inputStep: number
  placeholder: string
  validate?: (v: number) => string | null
  validationError?: string | null
  readOnly?: boolean
}) {
  const [rangeMode, setRangeMode] = useState(false)
  const [draft, setDraft] = useState<number | string>('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [rangeMin, setRangeMin] = useState<number | string>('')
  const [rangeMax, setRangeMax] = useState<number | string>('')
  const [rangeStep, setRangeStep] = useState<number | string>(1)

  const error = validationError ?? localError

  function validateSingle(n: number): string | null {
    if (!Number.isInteger(n) || n < inputMin) return `Must be a whole number ≥ ${inputMin}`
    if (values.includes(n)) return 'Already added'
    return validate ? validate(n) : null
  }

  function handleAdd() {
    const n = Number(draft)
    if (!draft || isNaN(n)) { setLocalError(`Must be a whole number ≥ ${inputMin}`); return }
    const err = validateSingle(n)
    if (err) { setLocalError(err); return }
    setLocalError(null)
    onAdd(n)
    setDraft('')
  }

  function handleAddRange() {
    const mn = Number(rangeMin)
    const mx = Number(rangeMax)
    const st = Number(rangeStep)
    if (!rangeMin || !rangeMax || !rangeStep || isNaN(mn) || isNaN(mx) || isNaN(st) || st < 1 || mn > mx) {
      setLocalError('Invalid range: check min ≤ max and step ≥ 1')
      return
    }
    setLocalError(null)
    for (let v = mn; v <= mx; v += st) {
      const rounded = Math.round(v)
      if (values.includes(rounded)) continue
      if (validate && validate(rounded)) continue
      onAdd(rounded)
    }
    setRangeMin('')
    setRangeMax('')
    setRangeStep(1)
    setRangeMode(false)
  }

  return (
    <Stack gap="xs">
      <Group gap="xs" wrap="wrap">
        {values.map(v => (
          <Badge
            key={v}
            variant="light"
            rightSection={
              readOnly ? undefined : (
                <ActionIcon size="xs" variant="transparent" onClick={() => onRemove(v)} aria-label={`Remove ${v}`}>
                  <IconX size={10} />
                </ActionIcon>
              )
            }
          >
            {v}
          </Badge>
        ))}
      </Group>

      {!readOnly && !rangeMode && (
        <Group gap="xs" align="flex-end" wrap="nowrap">
          <NumberInput
            placeholder={placeholder}
            value={draft}
            onChange={v => { setDraft(v); setLocalError(null) }}
            min={inputMin}
            step={inputStep}
            allowDecimal={false}
            style={{ width: 100 }}
            error={error ?? undefined}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
          />
          <Button variant="light" size="xs" leftSection={<IconPlus size={14} />} onClick={handleAdd} mb={error ? 22 : 0}>
            Add
          </Button>
          <Button variant="subtle" size="xs" onClick={() => setRangeMode(true)} mb={error ? 22 : 0}>
            Range
          </Button>
        </Group>
      )}

      {!readOnly && rangeMode && (
        <Stack gap="xs" p="sm" style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 8 }}>
          <Text size="sm" fw={500}>Add range</Text>
          <Group gap="xs" wrap="wrap">
            <NumberInput
              label="Min"
              value={rangeMin}
              onChange={v => { setRangeMin(v); setLocalError(null) }}
              min={inputMin}
              allowDecimal={false}
              style={{ width: 80 }}
            />
            <NumberInput
              label="Max"
              value={rangeMax}
              onChange={v => { setRangeMax(v); setLocalError(null) }}
              min={inputMin}
              allowDecimal={false}
              style={{ width: 80 }}
            />
            <NumberInput
              label="Step"
              value={rangeStep}
              onChange={v => { setRangeStep(v); setLocalError(null) }}
              min={1}
              allowDecimal={false}
              style={{ width: 80 }}
            />
          </Group>
          {localError && <Text size="xs" c="red">{localError}</Text>}
          <Group gap="xs">
            <Button size="xs" onClick={handleAddRange}>Add Range</Button>
            <Button size="xs" variant="subtle" onClick={() => { setRangeMode(false); setLocalError(null) }}>Cancel</Button>
          </Group>
        </Stack>
      )}
    </Stack>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: sort priority control
// ─────────────────────────────────────────────────────────────────────────────

function SortPriorityControl({
  sortOrder,
  onChange,
  readOnly,
}: {
  sortOrder: [SortEntry, SortEntry, SortEntry]
  onChange: (order: [SortEntry, SortEntry, SortEntry]) => void
  readOnly?: boolean
}) {
  function move(idx: number, delta: -1 | 1) {
    const next: [SortEntry, SortEntry, SortEntry] = [...sortOrder]
    const target = idx + delta
    if (target < 0 || target > 2) return
    ;[next[idx], next[target]] = [next[target]!, next[idx]!]
    onChange(next)
  }

  function toggleDir(idx: number) {
    const next: [SortEntry, SortEntry, SortEntry] = [...sortOrder]
    next[idx] = { ...next[idx]!, dir: next[idx]!.dir === 'asc' ? 'desc' : 'asc' }
    onChange(next)
  }

  return (
    <Stack gap={4}>
      {sortOrder.map((entry, idx) => (
        <Group key={entry.dim} gap="xs" align="center" wrap="nowrap"
          style={{ padding: '6px 8px', borderRadius: 6, background: 'var(--mantine-color-default-hover)' }}
        >
          <Text size="sm" c="dimmed" w={20} ta="right">{idx + 1}.</Text>
          <Text size="sm" style={{ flex: 1 }}>{entry.dim}</Text>
          <ActionIcon
            size="sm"
            variant={readOnly ? 'transparent' : 'subtle'}
            disabled={readOnly}
            onClick={() => toggleDir(idx)}
            title={entry.dir === 'asc' ? 'Ascending (click to flip)' : 'Descending (click to flip)'}
          >
            {entry.dir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />}
          </ActionIcon>
          {!readOnly && (
            <>
              <ActionIcon size="sm" variant="subtle" onClick={() => move(idx, -1)} disabled={idx === 0}>
                <IconChevronUp size={14} />
              </ActionIcon>
              <ActionIcon size="sm" variant="subtle" onClick={() => move(idx, 1)} disabled={idx === 2}>
                <IconChevronDown size={14} />
              </ActionIcon>
            </>
          )}
        </Group>
      ))}
    </Stack>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: resistance section variants
// ─────────────────────────────────────────────────────────────────────────────

function NoEquipmentResistance({
  configs,
  onChange,
  readOnly,
}: {
  configs: ResistanceConfig[]
  onChange: (configs: ResistanceConfig[]) => void
  readOnly?: boolean
}) {
  // Implicit "Unloaded" config (empty source) is always present and not removable.
  // Additional configs are ad-hoc resistance entries (pieceId omitted — no parent piece).
  const weighted = configs.filter(c => c.source.length > 0)
  const values = weighted.map(c => c.source[0]!.piece.resistance)

  function handleAdd(v: number) {
    if (weighted.some(c => c.source[0]!.piece.resistance === v)) return
    onChange([
      ...configs,
      {
        id: newConfigId(),
        label: `+${v}`,
        source: [{ piece: { resistance: v, totalQuantity: 1 }, quantityUsed: 1 }],
      },
    ])
  }

  function handleRemove(v: number) {
    onChange(configs.filter(c => c.source.length === 0 || c.source[0]!.piece.resistance !== v))
  }

  return (
    <Stack gap="xs">
      <Group gap="xs" align="center">
        <Badge variant="filled">Unloaded</Badge>
        <Text size="xs" c="dimmed">+ optional resistance</Text>
      </Group>
      <ChipList
        values={values}
        onAdd={handleAdd}
        onRemove={handleRemove}
        inputMin={1}
        inputStep={1}
        placeholder="e.g. 10"
        readOnly={readOnly}
      />
    </Stack>
  )
}

function NonCombinableResistance({
  equipment,
  configs,
  onChange,
  readOnly,
}: {
  equipment: EquipmentDef
  configs: ResistanceConfig[]
  onChange: (configs: ResistanceConfig[]) => void
  readOnly?: boolean
}) {
  const checkedPieceIds = new Set(configs.map(c => c.source[0]?.piece.pieceId ?? ''))

  function toggle(piece: typeof equipment.pieces[number]) {
    if (readOnly) return
    const pieceId = piece.id as string
    if (checkedPieceIds.has(pieceId)) {
      onChange(configs.filter(c => c.source[0]?.piece.pieceId !== pieceId))
    } else {
      const id = newConfigId()
      const qty = piece.quantity as number
      const label = `${piece.resistance as number}${equipment.unit}${qty > 1 ? ` ×${qty}` : ''}`
      onChange([
        ...configs,
        {
          id,
          label,
          source: [{
            piece: { pieceId, resistance: piece.resistance as number, totalQuantity: qty },
            quantityUsed: qty,
          }],
        },
      ])
    }
  }

  return (
    <Group gap="xs" wrap="wrap">
      {equipment.pieces.map(piece => {
        const pieceId = piece.id as string
        const qty = piece.quantity as number
        const label = `${piece.resistance as number}${equipment.unit}${qty > 1 ? ` ×${qty}` : ''}`
        const selected = checkedPieceIds.has(pieceId)
        return (
          <Button
            key={pieceId}
            size="xs"
            variant={selected ? 'filled' : 'light'}
            onClick={() => toggle(piece)}
            disabled={readOnly && !selected}
            style={readOnly ? { cursor: 'default' } : undefined}
          >
            {label}
          </Button>
        )
      })}
    </Group>
  )
}

type CombinableResistanceProps = {
  equipment: EquipmentDef
  configs: ResistanceConfig[]
  onChange: (configs: ResistanceConfig[]) => void
  readOnly?: boolean
}

function CombinableResistance({ equipment, configs, onChange, readOnly }: CombinableResistanceProps) {
  type DraftQty = { pieceId: string; qty: number }
  const [draftOpen, setDraftOpen] = useState(false)
  const [draftQtys, setDraftQtys] = useState<DraftQty[]>([])
  const [draftError, setDraftError] = useState<string | null>(null)

  function openDraft() {
    setDraftQtys(equipment.pieces.map(p => ({ pieceId: p.id as string, qty: 0 })))
    setDraftError(null)
    setDraftOpen(true)
  }

  function cancelDraft() { setDraftError(null); setDraftOpen(false) }

  function draftTotal(): number {
    return draftQtys.reduce((sum, d) => {
      const piece = equipment.pieces.find(p => (p.id as string) === d.pieceId)
      return sum + (piece ? (piece.resistance as number) * d.qty : 0)
    }, 0)
  }

  function confirmDraft() {
    const source: VolumeSetInput['resistanceSource'] = draftQtys
      .filter(d => d.qty > 0)
      .map(d => {
        const piece = equipment.pieces.find(p => (p.id as string) === d.pieceId)!
        return {
          piece: {
            pieceId: d.pieceId,
            resistance: piece.resistance as number,
            totalQuantity: piece.quantity as number,
          },
          quantityUsed: d.qty,
        }
      })
    if (source.length === 0) return
    const key = sourceKey(source)
    if (configs.some(c => sourceKey(c.source) === key)) {
      setDraftError('Configuration already added')
      return
    }
    const total = resistanceTotal(source)
    const id = newConfigId()
    onChange([...configs, { id, label: `${total}${equipment.unit}`, source }])
    setDraftError(null)
    setDraftOpen(false)
  }

  function removeConfig(id: string) { onChange(configs.filter(c => c.id !== id)) }

  return (
    <Stack gap="sm">
      <Group gap="xs" wrap="wrap">
        {configs.map(c => (
          <Badge
            key={c.id}
            variant="light"
            rightSection={
              readOnly ? undefined : (
                <ActionIcon size="xs" variant="transparent" onClick={() => removeConfig(c.id)} aria-label={`Remove ${c.label}`}>
                  <IconX size={10} />
                </ActionIcon>
              )
            }
          >
            {c.label}
          </Badge>
        ))}
      </Group>

      {!readOnly && (draftOpen ? (
        <Stack gap="xs" p="sm" style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 8 }}>
          <Text size="sm" fw={500}>New configuration</Text>
          {equipment.pieces.map(piece => {
            const pieceId = piece.id as string
            const max = piece.quantity as number
            const d = draftQtys.find(d => d.pieceId === pieceId)
            return (
              <Group key={pieceId} justify="space-between" align="center">
                <Text size="sm">{piece.resistance as number}{equipment.unit}</Text>
                <NumberInput
                  value={d?.qty ?? 0}
                  min={0}
                  max={max}
                  step={1}
                  allowDecimal={false}
                  style={{ width: 90 }}
                  onChange={v => {
                    const n = Math.min(Number(v) || 0, max)
                    setDraftQtys(prev => prev.map(x => x.pieceId === pieceId ? { ...x, qty: n } : x))
                  }}
                />
              </Group>
            )
          })}
          <Text size="xs" c="dimmed">Total: {draftTotal()}{equipment.unit}</Text>
          {draftError && <Text size="xs" c="red">{draftError}</Text>}
          <Group gap="xs">
            <Button size="xs" onClick={confirmDraft} disabled={draftTotal() === 0}>Add</Button>
            <Button size="xs" variant="subtle" onClick={cancelDraft}>Cancel</Button>
          </Group>
        </Stack>
      ) : (
        <Button
          variant="light"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={openDraft}
          style={{ alignSelf: 'flex-start' }}
        >
          Add configuration
        </Button>
      ))}
    </Stack>
  )
}

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

function ProgressionGrid({
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
              return (
                <UnstyledButton
                  key={rep}
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

// ─────────────────────────────────────────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SORT: [SortEntry, SortEntry, SortEntry] = [
  { dim: 'Resistance', dir: 'asc' },
  { dim: 'Sets', dir: 'asc' },
  { dim: 'Reps', dir: 'asc' },
]

function buildInitialState(exercise: ExerciseDef, progression?: ProgressionDef) {
  if (progression && progression.body.kind === 'linear') {
    const configs = deriveConfigsFromProgression(progression, exercise.equipment)
    const selectedCells = deriveSelectedCells(progression, configs)
    const setsValues = [...new Set(progression.body.volumeSets.map(vs => vs.sets as number))].sort((a, b) => a - b)
    const repValues = [...new Set(progression.body.volumeSets.map(vs => vs.quantifierValue as number))].sort((a, b) => a - b)
    return { name: progression.name, setsValues, repValues, configs, selectedCells, sortOrder: DEFAULT_SORT }
  }

  let configs: ResistanceConfig[] = []
  if (exercise.equipment && !exercise.equipment.isCombinable) {
    configs = exercise.equipment.pieces.map(piece => {
      const id = newConfigId()
      const qty = piece.quantity as number
      const label = `${piece.resistance as number}${exercise.equipment!.unit}${qty > 1 ? ` ×${qty}` : ''}`
      return {
        id,
        label,
        source: [{
          piece: { pieceId: piece.id as string, resistance: piece.resistance as number, totalQuantity: qty },
          quantityUsed: qty,
        }],
      }
    })
  } else if (!exercise.equipment) {
    configs = [{ id: UNLOADED_CONFIG_ID, label: 'Unloaded', source: [] }]
  }

  return {
    name: '',
    setsValues: [] as number[],
    repValues: [] as number[],
    configs,
    selectedCells: [] as string[],
    sortOrder: DEFAULT_SORT,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main modal
// ─────────────────────────────────────────────────────────────────────────────

export function SaveProgressionModal({ opened, onClose, exercise, progression }: Props) {
  const [mode, setMode] = useState<'view' | 'edit'>(progression ? 'view' : 'edit')

  const [name, setName] = useState(() => buildInitialState(exercise, progression).name)
  const [setsValues, setSetsValues] = useState<number[]>(() => buildInitialState(exercise, progression).setsValues)
  const [repValues, setRepValues] = useState<number[]>(() => buildInitialState(exercise, progression).repValues)
  const [configs, setConfigs] = useState<ResistanceConfig[]>(() => buildInitialState(exercise, progression).configs)
  const [selectedCells, setSelectedCells] = useState<string[]>(() => buildInitialState(exercise, progression).selectedCells)
  const [sortOrder, setSortOrder] = useState<[SortEntry, SortEntry, SortEntry]>(() => buildInitialState(exercise, progression).sortOrder)

  const readOnly = mode === 'view'

  useEffect(() => {
    if (opened) {
      const fresh = buildInitialState(exercise, progression)
      setName(fresh.name)
      setSetsValues(fresh.setsValues)
      setRepValues(fresh.repValues)
      setConfigs(fresh.configs)
      setSelectedCells(fresh.selectedCells)
      setSortOrder(fresh.sortOrder)
      setMode(progression ? 'view' : 'edit')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened])

  useEffect(() => {
    const validConfigIds = new Set(configs.map(c => c.id))
    const validSets = new Set(setsValues)
    const validReps = new Set(repValues)
    setSelectedCells(prev =>
      prev.filter(cellId => {
        const [configId, sStr, rStr] = cellId.split('|')
        return (
          validConfigIds.has(configId ?? '') &&
          validSets.has(Number(sStr)) &&
          validReps.has(Number(rStr))
        )
      }),
    )
  }, [configs, setsValues, repValues])

  const { mutate, isPending, error } = useSaveProgression({ onSuccess: onClose })

  function handleToggleCell(cellId: string) {
    setSelectedCells(prev =>
      prev.includes(cellId) ? prev.filter(id => id !== cellId) : [...prev, cellId],
    )
  }

  function repValidate(v: number): string | null {
    if (!ruleAccepts(exercise.quantifierRule, v)) {
      const rule = exercise.quantifierRule
      if (rule.kind === 'min-max') return `Must be between ${rule.min} and ${rule.max}`
      return `Must be one of: ${rule.values.join(', ')}`
    }
    return null
  }

  function handleSubmit() {
    if (!name.trim() || selectedCells.length === 0) return
    const configMap = new Map(configs.map(c => [c.id, c]))
    const volumeSets: VolumeSetInput[] = selectedCells.map(cellId => {
      const [configId, sStr, rStr] = cellId.split('|')
      const config = configMap.get(configId ?? '')!
      return { sets: Number(sStr), quantifierValue: Number(rStr), resistanceSource: config.source }
    })
    mutate({
      name: name.trim(),
      exerciseId: exercise.id as string,
      body: { kind: 'linear', volumeSets },
      progressionId: progression ? progression.id as string : undefined,
    })
  }

  const canSave = name.trim().length > 0 && selectedCells.length > 0

  const title = progression
    ? mode === 'edit' ? 'Edit Progression' : 'Progression'
    : 'Add Progression'

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs" align="center">
          <Title order={4}>{title}</Title>
          {progression && mode === 'view' && (
            <ActionIcon variant="subtle" size="sm" onClick={() => setMode('edit')} title="Edit">
              <IconEdit size={16} />
            </ActionIcon>
          )}
        </Group>
      }
      fullScreen
      styles={{ body: { paddingBottom: 80 } }}
    >
      <Stack gap="md">
        {error && <Alert color="red">{error.message}</Alert>}

        <TextInput
          label="Name"
          placeholder="e.g. Linear A"
          value={name}
          onChange={e => setName(e.currentTarget.value)}
          readOnly={readOnly}
        />

        <Fieldset legend="Sets">
          <ChipList
            values={setsValues}
            onAdd={v => setSetsValues(prev => [...prev, v].sort((a, b) => a - b))}
            onRemove={v => setSetsValues(prev => prev.filter(s => s !== v))}
            inputMin={1}
            inputStep={1}
            placeholder="e.g. 3"
            readOnly={readOnly}
          />
        </Fieldset>

        <Fieldset legend={exercise.quantifierType === 'reps' ? 'Reps' : 'Seconds'}>
          <ChipList
            values={repValues}
            onAdd={v => setRepValues(prev => [...prev, v].sort((a, b) => a - b))}
            onRemove={v => setRepValues(prev => prev.filter(r => r !== v))}
            inputMin={1}
            inputStep={1}
            placeholder="e.g. 5"
            validate={repValidate}
            readOnly={readOnly}
          />
        </Fieldset>

        <Fieldset legend="Resistance">
          {!exercise.equipment && (
            <NoEquipmentResistance configs={configs} onChange={setConfigs} readOnly={readOnly} />
          )}
          {exercise.equipment && !exercise.equipment.isCombinable && (
            <NonCombinableResistance
              equipment={exercise.equipment}
              configs={configs}
              onChange={setConfigs}
              readOnly={readOnly}
            />
          )}
          {exercise.equipment && exercise.equipment.isCombinable && (
            <CombinableResistance
              equipment={exercise.equipment}
              configs={configs}
              onChange={setConfigs}
              readOnly={readOnly}
            />
          )}
        </Fieldset>

        <Fieldset legend="Row / column sort priority">
          <SortPriorityControl sortOrder={sortOrder} onChange={setSortOrder} readOnly={readOnly} />
        </Fieldset>

        <Divider label="Progression grid" labelPosition="left" />

        <ProgressionGrid
          configs={configs}
          setsValues={setsValues}
          repValues={repValues}
          sortOrder={sortOrder}
          selectedCells={selectedCells}
          quantifierType={exercise.quantifierType}
          onToggleCell={handleToggleCell}
          readOnly={readOnly}
        />

        {selectedCells.length > 0 && (
          <Text size="xs" c="dimmed">
            {selectedCells.length} step{selectedCells.length !== 1 ? 's' : ''} selected
          </Text>
        )}

        {mode === 'edit' && (
          <Group gap="xs">
            {progression && (
              <Button variant="subtle" onClick={() => setMode('view')} disabled={isPending}>
                Cancel
              </Button>
            )}
            <Button onClick={handleSubmit} loading={isPending} disabled={!canSave} style={{ flex: 1 }}>
              Save
            </Button>
          </Group>
        )}
      </Stack>
    </Modal>
  )
}
