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
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconChevronDown, IconChevronUp, IconEdit, IconPlus } from '@tabler/icons-react'
import { useState } from 'react'
import { useExerciseList } from './useExerciseList'
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
}: {
  exercise: ExerciseDef
  onEdit: (e: ExerciseDef) => void
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
          <Text size="sm" c="dimmed">
            Equipment: {exercise.equipment ? exercise.equipment.name : 'None'}
          </Text>
          {exercise.shouldCombineResistance && (
            <Text size="sm" c="dimmed">Combines resistance across pieces</Text>
          )}
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconEdit size={14} />}
            onClick={() => onEdit(exercise)}
            style={{ alignSelf: 'flex-start' }}
          >
            Edit
          </Button>
        </Stack>
      </Collapse>
    </Card>
  )
}

export function ExerciseListPage() {
  const { data: items = [], isLoading, error } = useExerciseList()
  const [addModalOpen, { open: openAdd, close: closeAdd }] = useDisclosure(false)
  const [editExercise, setEditExercise] = useState<ExerciseDef | null>(null)

  function handleEdit(exercise: ExerciseDef) {
    setEditExercise(exercise)
  }

  function handleEditClose() {
    setEditExercise(null)
  }

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
          <ExerciseCard key={e.id} exercise={e} onEdit={handleEdit} />
        ))}
      </Stack>

      <SaveExerciseModal opened={addModalOpen} onClose={closeAdd} />

      {editExercise && (
        <SaveExerciseModal
          opened={!!editExercise}
          onClose={handleEditClose}
          exercise={editExercise}
        />
      )}
    </Container>
  )
}
