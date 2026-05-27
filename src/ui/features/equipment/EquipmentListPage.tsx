import {
  Alert,
  Button,
  Container,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconPlus } from '@tabler/icons-react'
import { useState } from 'react'
import { useEquipmentList } from './useEquipmentList'
import { AddEquipmentModal } from './AddEquipmentModal'
import { EquipmentCard } from './EquipmentCard'
import { DeleteEquipmentModal } from './DeleteEquipmentModal'
import type { EquipmentDef } from '../../../domain'

export function EquipmentListPage() {
  const { data: items = [], isLoading, error } = useEquipmentList()
  const [addModalOpen, { open: openAdd, close: closeAdd }] = useDisclosure(false)
  const [editEquipment, setEditEquipment] = useState<EquipmentDef | null>(null)
  const [deleteEquipment, setDeleteEquipment] = useState<EquipmentDef | null>(null)

  return (
    <Container size="sm" py="md">
      <Stack>
        <Group justify="space-between" align="center">
          <Title order={2}>Equipment</Title>
          <Button leftSection={<IconPlus size={16} />} onClick={openAdd} size="sm">
            Add
          </Button>
        </Group>

        {isLoading && <Loader mx="auto" />}
        {error && <Alert color="red">{error.message}</Alert>}

        {!isLoading && !error && items.length === 0 && (
          <Text c="dimmed" ta="center" mt="xl">
            No equipment yet. Add your first piece.
          </Text>
        )}

        {items.map(e => (
          <EquipmentCard
            key={e.id}
            equipment={e}
            onEdit={setEditEquipment}
            onDelete={setDeleteEquipment}
          />
        ))}
      </Stack>

      <AddEquipmentModal opened={addModalOpen} onClose={closeAdd} />

      {editEquipment && (
        <AddEquipmentModal
          opened={!!editEquipment}
          onClose={() => setEditEquipment(null)}
          equipment={editEquipment}
        />
      )}

      <DeleteEquipmentModal
        equipment={deleteEquipment}
        onClose={() => setDeleteEquipment(null)}
      />
    </Container>
  )
}
