import {
  Alert,
  Badge,
  Button,
  Card,
  Collapse,
  Container,
  Divider,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconChevronDown, IconChevronUp, IconEdit, IconPlus, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { useExerciseList } from './useExerciseList'
import { useDeleteExercise } from './useDeleteExercise'
import { SaveExerciseModal } from './SaveExerciseModal'
import type { ExerciseDef, QuantifierRule } from '../../../domain'

function formatRule(rule: QuantifierRule, type: string): string {
  const unit = type === 'reps' ? 'reps' : 's'
  if (rule.kind === 'min-max') return `${rule.min}–${rule.max} ${unit}`
  return `${rule.values.join(', ')} ${unit}`
}

function ExerciseCard({
  exercise,
  onEdit,
  onDelete,
}: {
  exercise: ExerciseDef
  onEdit: (e: ExerciseDef) => void
  onDelete: (e: ExerciseDef) => void
}) {
  const [expanded, { toggle }] = useDisclosure(false)

  return (
    <Card withBorder radius="md" p={0}>
      <UnstyledButton onClick={toggle} style={{ width: '100%' }} p="md">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={2}>
            <Text fw={600}>{exercise.name}</Text>
            {exercise.description && (
              <Text size="sm" c="dimmed">{exercise.description}</Text>
            )}
            <Text size="sm" c="dimmed">
              {formatRule(exercise.quantifierRule, exercise.quantifierType)}
            </Text>
          </Stack>
          <Group gap="xs" wrap="nowrap" align="center">
            <Badge variant="light" size="sm">{exercise.quantifierType}</Badge>
            {expanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
          </Group>
        </Group>
      </UnstyledButton>
      <Collapse in={expanded}>
        <Divider />
        <Stack gap="xs" p="md">
          <Stack gap={4}>
            <Text size="xs" c="dimmed" fw={500}>Quantifier</Text>
            <Text size="sm">
              {formatRule(exercise.quantifierRule, exercise.quantifierType)}{' '}
              <Text span c="dimmed" size="sm">({exercise.quantifierType})</Text>
            </Text>
          </Stack>
          <Stack gap={4}>
            <Text size="xs" c="dimmed" fw={500}>Equipment</Text>
            {exercise.equipment ? (
              <Stack gap={2}>
                <Group gap="xs">
                  <Text size="sm">{exercise.equipment.name}</Text>
                  <Badge variant="light" size="xs">{exercise.equipment.unit}</Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  {exercise.equipment.pieces.length} piece{exercise.equipment.pieces.length !== 1 ? 's' : ''}
                </Text>
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">None</Text>
            )}
          </Stack>
          <Stack gap={4}>
            <Text size="xs" c="dimmed" fw={500}>Combine resistance</Text>
            <Text size="sm">{exercise.shouldCombineResistance ? 'Yes — adds piece resistances together' : 'No'}</Text>
          </Stack>
          <Group gap="xs">
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconEdit size={14} />}
              onClick={() => onEdit(exercise)}
            >
              Edit
            </Button>
            <Button
              variant="subtle"
              size="xs"
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={() => onDelete(exercise)}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Collapse>
    </Card>
  )
}

function DeleteExerciseModal({
  exercise,
  onClose,
}: {
  exercise: ExerciseDef | null
  onClose: () => void
}) {
  const { mutate, isPending, error } = useDeleteExercise({ onSuccess: onClose })

  return (
    <Modal
      opened={!!exercise}
      onClose={onClose}
      title="Delete exercise"
      size="sm"
    >
      {exercise && (
        <Stack>
          <Text>Delete <strong>{exercise.name}</strong>? All progressions for this exercise will also be deleted.</Text>
          {error && <Alert color="red">{error.message}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose} disabled={isPending}>Cancel</Button>
            <Button
              color="red"
              loading={isPending}
              onClick={() => mutate(exercise.id)}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}

export function ExerciseListPage() {
  const { data: items = [], isLoading, error } = useExerciseList()
  const [addModalOpen, { open: openAdd, close: closeAdd }] = useDisclosure(false)
  const [editExercise, setEditExercise] = useState<ExerciseDef | null>(null)
  const [deleteExercise, setDeleteExercise] = useState<ExerciseDef | null>(null)

  return (
    <Container size="sm" py="md">
      <Stack>
        <Group justify="space-between" align="center">
          <Title order={2}>Exercises</Title>
          <Button leftSection={<IconPlus size={16} />} onClick={openAdd} size="sm">
            Add
          </Button>
        </Group>

        {isLoading && <Loader mx="auto" />}
        {error && <Alert color="red">{error.message}</Alert>}

        {!isLoading && !error && items.length === 0 && (
          <Text c="dimmed" ta="center" mt="xl">
            No exercises yet. Add your first exercise.
          </Text>
        )}

        {items.map(e => (
          <ExerciseCard
            key={e.id}
            exercise={e}
            onEdit={setEditExercise}
            onDelete={setDeleteExercise}
          />
        ))}
      </Stack>

      <SaveExerciseModal opened={addModalOpen} onClose={closeAdd} />

      {editExercise && (
        <SaveExerciseModal
          opened={!!editExercise}
          onClose={() => setEditExercise(null)}
          exercise={editExercise}
        />
      )}

      <DeleteExerciseModal
        exercise={deleteExercise}
        onClose={() => setDeleteExercise(null)}
      />
    </Container>
  )
}
