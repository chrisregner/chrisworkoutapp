import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core'
import { useDeleteProgram } from './usePrograms'
import type { ProgramDef } from '../../../domain'

export function DeleteProgramModal({
  program,
  onClose,
}: {
  program: ProgramDef | null
  onClose: () => void
}) {
  const { mutate, isPending, error, reset } = useDeleteProgram({ onSuccess: onClose })

  function handleClose() {
    reset()
    onClose()
  }

  return (
    <Modal opened={!!program} onClose={handleClose} title="Delete program" size="sm">
      {program && (
        <Stack>
          <Text>
            Delete <strong>{program.name}</strong>? This cannot be undone.
          </Text>
          {error && <Alert color="red">{error.message}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button color="red" loading={isPending} onClick={() => mutate(program.id as string)}>
              Delete
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
