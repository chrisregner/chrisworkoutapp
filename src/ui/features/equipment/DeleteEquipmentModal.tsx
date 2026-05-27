import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core'
import { useDeleteEquipment } from './useDeleteEquipment'
import type { EquipmentDef } from '../../../domain'

export function DeleteEquipmentModal({
  equipment,
  onClose,
}: {
  equipment: EquipmentDef | null
  onClose: () => void
}) {
  const { mutate, isPending, error } = useDeleteEquipment({ onSuccess: onClose })

  return (
    <Modal
      opened={!!equipment}
      onClose={onClose}
      title="Delete equipment"
      size="sm"
    >
      {equipment && (
        <Stack>
          <Text>Delete <strong>{equipment.name}</strong>? This cannot be undone.</Text>
          {error && <Alert color="red">{error.message}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose} disabled={isPending}>Cancel</Button>
            <Button
              color="red"
              loading={isPending}
              onClick={() => mutate(equipment.id)}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
