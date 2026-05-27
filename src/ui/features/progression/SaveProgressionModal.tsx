import {
  ActionIcon,
  Alert,
  Button,
  Divider,
  Fieldset,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { IconEdit, IconTrash } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { ruleAccepts } from '../../../domain'
import type { EquipmentDef, ExerciseDef, ProgressionDef, VolumeSetInput } from '../../../domain'
import { ChipList } from './ChipList'
import { DeleteProgressionModal } from './DeleteProgressionModal'
import { ProgressionGrid } from './ProgressionGrid'
import {
  CombinableResistance,
  NoEquipmentResistance,
  NonCombinableResistance,
} from './ResistanceSection'
import { SortPriorityControl } from './SortPriorityControl'
import { useSaveProgression } from './useSaveProgression'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SortDimension = 'Resistance' | 'Sets' | 'Reps'
export type SortEntry = { dim: SortDimension; dir: 'asc' | 'desc' }

export type ResistanceConfig = {
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

export function newConfigId(): string {
  return Math.random().toString(36).slice(2)
}

export function sourceKey(source: VolumeSetInput['resistanceSource']): string {
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

export function resistanceTotal(source: VolumeSetInput['resistanceSource']): number {
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

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
          <Text fw={700} size="lg">{title}</Text>
          {progression && mode === 'view' && (
            <>
              <ActionIcon variant="subtle" size="sm" onClick={() => setMode('edit')} title="Edit">
                <IconEdit size={16} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                size="sm"
                color="red"
                onClick={() => setDeleteConfirmOpen(true)}
                title="Delete"
                aria-label="Delete progression"
              >
                <IconTrash size={16} />
              </ActionIcon>
            </>
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

      {progression && (
        <DeleteProgressionModal
          progression={deleteConfirmOpen ? progression : null}
          exerciseId={exercise.id as string}
          onClose={() => setDeleteConfirmOpen(false)}
          onDeleted={onClose}
        />
      )}
    </Modal>
  )
}
