import { ActionIcon, Group, Text } from '@mantine/core'
import { IconEdit, IconTrash } from '@tabler/icons-react'

type Props = {
  title: string
  showActions: boolean
  onEdit: () => void
  onDelete: () => void
}

export function SaveProgressionTitle({ title, showActions, onEdit, onDelete }: Props) {
  return (
    <Group gap="xs" align="center">
      <Text fw={700} size="lg">{title}</Text>
      {showActions && (
        <>
          <ActionIcon variant="subtle" size="sm" onClick={onEdit} title="Edit">
            <IconEdit size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            size="sm"
            color="red"
            onClick={onDelete}
            title="Delete"
            aria-label="Delete progression"
          >
            <IconTrash size={16} />
          </ActionIcon>
        </>
      )}
    </Group>
  )
}
