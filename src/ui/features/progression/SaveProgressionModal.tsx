import { ActionIcon, Alert, Button, Divider, Fieldset, Group, Modal, Stack, Text, TextInput } from '@mantine/core'
import { useState } from 'react'
import type { ExerciseDef, ProgressionDef } from '../../../domain'
import { ChipList } from './ChipList'
import { DeleteProgressionModal } from './DeleteProgressionModal'
import { ProgressionGrid } from './ProgressionGrid'
import { ResistanceFieldset } from './ResistanceFieldset'
import { SaveProgressionTitle } from './SaveProgressionTitle'
import { SortPriorityControl } from './SortPriorityControl'
import { resistanceTotal, type ProgressionKind, type ResistanceConfig } from './saveProgressionState'
import { useProgressionSortOrder } from './useProgressionSortOrder'
import { useSaveProgression } from './useSaveProgression'
import { useSaveProgressionForm } from './useSaveProgressionForm'

type Props = {
  opened: boolean
  onClose: () => void
  exercise: ExerciseDef
  progression?: ProgressionDef
  kind?: ProgressionKind
}

function cellDisplayLabel(cellId: string, configs: ResistanceConfig[]): string {
  const [configId, sStr, rStr] = cellId.split('|')
  const label = configs.find(c => c.id === configId)?.label ?? '?'
  return `${label} ×${sStr}×${rStr}`
}

function cellVolume(cellId: string, configs: ResistanceConfig[]): number {
  const [configId, sStr, rStr] = cellId.split('|')
  const config = configs.find(c => c.id === configId)
  const resistance = config ? resistanceTotal(config.source) : 0
  const sets = Number(sStr)
  const reps = Number(rStr)
  return (resistance || 1) * sets * reps
}

function pct(part: number, whole: number): string {
  if (whole === 0) return '—'
  return `${Math.round((part / whole) * 100)}%`
}

function kindLabel(kind: ProgressionKind): string {
  return kind === 'heavyLight' ? 'Heavy/Light' : 'Linear'
}

export function SaveProgressionModal({ opened, onClose, exercise, progression, kind: kindProp }: Props) {
  const form = useSaveProgressionForm({ opened, exercise, progression, kind: kindProp })
  const { mutate, isPending, error } = useSaveProgression({ onSuccess: onClose })
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  // View-state (sort order) lives in a separate table; only saved progressions
  // can persist a sort. For unsaved progressions we fall back to the form's
  // local sortOrder state which is initialized to DEFAULT_SORT.
  const persistedSort = useProgressionSortOrder(progression ? (progression.id as string) : null)
  const sortOrder = progression ? persistedSort.sortOrder : form.sortOrder
  const setSortOrder = progression ? persistedSort.setSortOrder : form.setSortOrder

  const readOnly = form.mode === 'view'

  function handleSubmit() {
    if (!form.canSave) return
    mutate({
      name: form.name.trim(),
      exerciseId: exercise.id as string,
      body: form.buildBody(),
      progressionId: progression ? progression.id as string : undefined,
      // Sort order chosen during create is forwarded to the service so it lands
      // in progression_view_state atomically with the progression itself.
      // Updates manage sort separately via useProgressionSortOrder.
      initialSortOrder: progression ? undefined : form.sortOrder,
    })
  }

  const kindPrefix = form.kind === 'heavyLight' ? `${kindLabel(form.kind)} ` : ''
  const title = progression
    ? form.mode === 'edit' ? `Edit ${kindPrefix}Progression` : `${kindPrefix}Progression`
    : `Add ${kindPrefix}Progression`

  const stepCount = form.kind === 'linear' ? form.selectedCells.length : form.pairs.length

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <SaveProgressionTitle
          title={title}
          showActions={!!progression && form.mode === 'view'}
          onEdit={form.enterEdit}
          onDelete={() => setDeleteConfirmOpen(true)}
        />
      }
      fullScreen
      styles={{ body: { paddingBottom: 80 } }}
    >
      <Stack gap="md">
        {error && <Alert color="red">{error.message}</Alert>}

        <TextInput
          label="Name"
          placeholder="e.g. Linear A"
          value={form.name}
          onChange={e => form.setName(e.currentTarget.value)}
          readOnly={readOnly}
        />

        <Fieldset legend="Sets">
          <ChipList
            values={form.setsValues}
            onAdd={v => form.setSetsValues(prev => [...prev, v].sort((a, b) => a - b))}
            onRemove={v => form.setSetsValues(prev => prev.filter(s => s !== v))}
            inputMin={1}
            inputStep={1}
            placeholder="e.g. 3"
            readOnly={readOnly}
          />
        </Fieldset>

        <Fieldset legend={exercise.quantifierType === 'reps' ? 'Reps' : 'Seconds'}>
          <ChipList
            values={form.repValues}
            onAdd={v => form.setRepValues(prev => [...prev, v].sort((a, b) => a - b))}
            onRemove={v => form.setRepValues(prev => prev.filter(r => r !== v))}
            inputMin={1}
            inputStep={1}
            placeholder="e.g. 5"
            readOnly={readOnly}
          />
        </Fieldset>

        <ResistanceFieldset
          exercise={exercise}
          configs={form.configs}
          onChange={form.setConfigs}
          readOnly={readOnly}
        />

        <Fieldset legend="Row / column sort priority">
          <SortPriorityControl sortOrder={sortOrder} onChange={setSortOrder} readOnly={readOnly} />
        </Fieldset>

        <Divider label="Progression grid" labelPosition="left" />

        {form.kind === 'heavyLight' && (
          <Text size="xs" c="dimmed">
            Tap a cell for the heavy half, then a cell for the light half to form a step.
            Re-tap a pending heavy cell to cancel. Remove steps from the list below.
          </Text>
        )}

        {form.kind === 'linear' ? (
          <ProgressionGrid
            mode="linear"
            configs={form.configs}
            setsValues={form.setsValues}
            repValues={form.repValues}
            sortOrder={sortOrder}
            selectedCells={form.selectedCells}
            quantifierType={exercise.quantifierType}
            onToggleCell={form.toggleCell}
            readOnly={readOnly}
          />
        ) : (
          <ProgressionGrid
            mode="heavyLight"
            configs={form.configs}
            setsValues={form.setsValues}
            repValues={form.repValues}
            sortOrder={sortOrder}
            pairs={form.pairs}
            pendingHeavy={form.pendingHeavy}
            quantifierType={exercise.quantifierType}
            onToggleCell={form.toggleCell}
            readOnly={readOnly}
          />
        )}

        {form.kind === 'heavyLight' && form.pairs.length > 0 && (
          <Stack gap={4}>
            {form.pairs.map((pair, i) => {
              const hVol = cellVolume(pair.heavy, form.configs)
              const lVol = cellVolume(pair.light, form.configs)
              return (
              <Group key={i} gap="xs" wrap="nowrap">
                <Stack gap={0} style={{ flex: 1 }}>
                  <Text size="xs">
                    Step {i + 1}: H {cellDisplayLabel(pair.heavy, form.configs)} / L {cellDisplayLabel(pair.light, form.configs)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    H vol {hVol} ({pct(hVol, lVol)}) / L vol {lVol} ({pct(lVol, hVol)})
                  </Text>
                </Stack>
                {!readOnly && (
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="red"
                    onClick={() => form.removePair(i)}
                    aria-label={`Remove step ${i + 1}`}
                  >
                    ✕
                  </ActionIcon>
                )}
              </Group>
              )
            })}
          </Stack>
        )}

        {stepCount > 0 && (
          <Text size="xs" c="dimmed">
            {stepCount} step{stepCount !== 1 ? 's' : ''} selected
          </Text>
        )}

        {form.pendingHeavy && (
          <Text size="xs" c="red">
            Heavy half selected. Tap a cell to set the light half, or re-tap to cancel.
          </Text>
        )}

        {form.mode === 'edit' && (
          <Group gap="xs">
            {progression && (
              <Button variant="subtle" onClick={form.cancelEdit} disabled={isPending}>
                Cancel
              </Button>
            )}
            <Button onClick={handleSubmit} loading={isPending} disabled={!form.canSave} style={{ flex: 1 }}>
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
