import { Alert, Button, Divider, Fieldset, Group, Modal, Stack, Text, TextInput } from '@mantine/core'
import { useState } from 'react'
import type { ExerciseDef, ProgressionDef } from '../../../domain'
import { ChipList } from './ChipList'
import { DeleteProgressionModal } from './DeleteProgressionModal'
import { ProgressionGrid } from './ProgressionGrid'
import { ResistanceFieldset } from './ResistanceFieldset'
import { SaveProgressionTitle } from './SaveProgressionTitle'
import { SortPriorityControl } from './SortPriorityControl'
import { useSaveProgression } from './useSaveProgression'
import { useSaveProgressionForm } from './useSaveProgressionForm'

type Props = {
  opened: boolean
  onClose: () => void
  exercise: ExerciseDef
  progression?: ProgressionDef
}

export function SaveProgressionModal({ opened, onClose, exercise, progression }: Props) {
  const form = useSaveProgressionForm({ opened, exercise, progression })
  const { mutate, isPending, error } = useSaveProgression({ onSuccess: onClose })
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const readOnly = form.mode === 'view'

  function handleSubmit() {
    if (!form.canSave) return
    mutate({
      name: form.name.trim(),
      exerciseId: exercise.id as string,
      body: { kind: 'linear', volumeSets: form.buildVolumeSets() },
      progressionId: progression ? progression.id as string : undefined,
    })
  }

  const title = progression
    ? form.mode === 'edit' ? 'Edit Progression' : 'Progression'
    : 'Add Progression'

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
            validate={form.repValidate}
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
          <SortPriorityControl sortOrder={form.sortOrder} onChange={form.setSortOrder} readOnly={readOnly} />
        </Fieldset>

        <Divider label="Progression grid" labelPosition="left" />

        <ProgressionGrid
          configs={form.configs}
          setsValues={form.setsValues}
          repValues={form.repValues}
          sortOrder={form.sortOrder}
          selectedCells={form.selectedCells}
          quantifierType={exercise.quantifierType}
          onToggleCell={form.toggleCell}
          readOnly={readOnly}
        />

        {form.selectedCells.length > 0 && (
          <Text size="xs" c="dimmed">
            {form.selectedCells.length} step{form.selectedCells.length !== 1 ? 's' : ''} selected
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
