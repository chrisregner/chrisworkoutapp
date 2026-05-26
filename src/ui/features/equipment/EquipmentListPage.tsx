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
  Table,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconChevronDown, IconChevronUp, IconEdit, IconPlus } from '@tabler/icons-react'
import { useState } from 'react'
import { useEquipmentList } from './useEquipmentList'
import { AddEquipmentModal } from './AddEquipmentModal'
import type { EquipmentDef } from '../../../domain'

function EquipmentCard({
  equipment,
  onEdit,
}: {
  equipment: EquipmentDef
  onEdit: (e: EquipmentDef) => void
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
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconEdit size={14} />}
            onClick={() => onEdit(equipment)}
            style={{ alignSelf: 'flex-start' }}
          >
            Edit
          </Button>
        </Stack>
      </Collapse>
    </Card>
  )
}

export function EquipmentListPage() {
  const { data: items = [], isLoading, error } = useEquipmentList()
  const [addModalOpen, { open: openAdd, close: closeAdd }] = useDisclosure(false)
  const [editEquipment, setEditEquipment] = useState<EquipmentDef | null>(null)

  function handleEdit(equipment: EquipmentDef) {
    setEditEquipment(equipment)
  }

  function handleEditClose() {
    setEditEquipment(null)
  }

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
          <EquipmentCard key={e.id} equipment={e} onEdit={handleEdit} />
        ))}
      </Stack>

      <AddEquipmentModal opened={addModalOpen} onClose={closeAdd} />

      {editEquipment && (
        <AddEquipmentModal
          opened={!!editEquipment}
          onClose={handleEditClose}
          equipment={editEquipment}
        />
      )}
    </Container>
  )
}
