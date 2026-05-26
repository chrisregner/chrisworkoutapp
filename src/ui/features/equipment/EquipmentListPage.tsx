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
  Table,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconChevronDown, IconChevronUp, IconEdit, IconPlus, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { useEquipmentList } from './useEquipmentList'
import { useDeleteEquipment } from './useDeleteEquipment'
import { AddEquipmentModal } from './AddEquipmentModal'
import type { EquipmentDef } from '../../../domain'

function EquipmentCard({
  equipment,
  onEdit,
  onDelete,
}: {
  equipment: EquipmentDef
  onEdit: (e: EquipmentDef) => void
  onDelete: (e: EquipmentDef) => void
}) {
  const [expanded, { toggle }] = useDisclosure(false)
  const sorted = [...equipment.pieces].sort((a, b) => a.position - b.position)

  return (
    <Card withBorder radius="md" p={0}>
      <UnstyledButton onClick={toggle} style={{ width: '100%' }} p="md">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={2}>
            <Text fw={600}>{equipment.name}</Text>
            {equipment.description && (
              <Text size="sm" c="dimmed">{equipment.description}</Text>
            )}
            <Text size="sm" c="dimmed">
              {equipment.pieces.length} piece{equipment.pieces.length !== 1 ? 's' : ''}
              {equipment.isCombinable ? ' · combinable' : ''}
            </Text>
          </Stack>
          <Group gap="xs" wrap="nowrap" align="center">
            <Badge variant="light" size="sm">{equipment.unit}</Badge>
            {expanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
          </Group>
        </Group>
      </UnstyledButton>
      <Collapse in={expanded}>
        <Divider />
        <Stack gap="xs" p="md">
          <Group gap="xs">
            <Text size="xs" c="dimmed" fw={500}>Combinable:</Text>
            <Text size="sm">{equipment.isCombinable ? 'Yes' : 'No'}</Text>
          </Group>
          <Table withRowBorders={false} verticalSpacing={4}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>
                  <Text size="xs" c="dimmed" fw={500}>Resistance ({equipment.unit})</Text>
                </Table.Th>
                <Table.Th>
                  <Text size="xs" c="dimmed" fw={500}>Qty</Text>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sorted.map(p => (
                <Table.Tr key={p.id}>
                  <Table.Td><Text size="sm">{p.resistance}</Text></Table.Td>
                  <Table.Td><Text size="sm">{p.quantity}</Text></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Group gap="xs">
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconEdit size={14} />}
              onClick={() => onEdit(equipment)}
            >
              Edit
            </Button>
            <Button
              variant="subtle"
              size="xs"
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={() => onDelete(equipment)}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Collapse>
    </Card>
  )
}

function DeleteEquipmentModal({
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
