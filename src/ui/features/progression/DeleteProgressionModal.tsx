import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core'
import { useDeleteProgression } from './useDeleteProgression'
import type { ProgressionDef } from '../../../domain'

export function DeleteProgressionModal({
  progression,
  exerciseId,
  onClose,
  onDeleted,
}: {
  progression: ProgressionDef | null
  exerciseId: string
  onClose: () => void
  onDeleted?: () => void
}) {
  const { mutate, isPending, error } = useDeleteProgression(exerciseId, {
    onSuccess: () => {
      onClose()
      onDeleted?.()
    },
  })

  return (
    <Modal
      opened={!!progression}
      onClose={onClose}
      title="Delete progression"
      size="sm"
    >
      {progression && (
        <Stack>
          <Text>Delete <strong>{progression.name}</strong>?</Text>
          {error && <Alert color="red">{error.message}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose} disabled={isPending}>Cancel</Button>
            <Button
              color="red"
              loading={isPending}
              onClick={() => mutate(progression.id as string)}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
