import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core'
import { useDeleteExercise } from './useDeleteExercise'
import type { ExerciseDef } from '../../../domain'

export function DeleteExerciseModal({
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
