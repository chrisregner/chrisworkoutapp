import { Alert, Container, List, Loader, Stack, Text, Title } from '@mantine/core'
import { useEquipmentList } from './useEquipmentList'

export function EquipmentListPage() {
  const { items, loading, error } = useEquipmentList()

  if (loading) return <Loader />
  if (error) return <Alert color="red">{error.message}</Alert>

  return (
    <Container py="md">
      <Stack>
        <Title order={2}>Equipment</Title>
        {items.length === 0 ? (
          <Text c="dimmed">No equipment yet.</Text>
        ) : (
          <List>
            {items.map(e => (
              <List.Item key={e.id}>
                {e.name} — {e.pieces.length} piece(s), {e.unit}
              </List.Item>
            ))}
          </List>
        )}
      </Stack>
    </Container>
  )
}
