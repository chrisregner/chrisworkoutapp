import {
  Badge,
  Button,
  Card,
  Collapse,
  Divider,
  Group,
  Stack,
  Table,
  Text,
  UnstyledButton,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconChevronDown, IconChevronUp, IconEdit, IconTrash } from '@tabler/icons-react'
import type { EquipmentDef } from '../../../domain'

export function EquipmentCard({
  equipment,
  onEdit,
  onDelete,
}: {
  equipment: EquipmentDef
  onEdit: (e: EquipmentDef) => void
  onDelete: (e: EquipmentDef) => void
}) {
  const [expanded, { toggle }] = useDisclosure(false)
  const sorted = [...equipment.pieces].sort((a, b) => (a.resistance as number) - (b.resistance as number))

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
