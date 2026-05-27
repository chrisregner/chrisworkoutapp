import { Badge, Button, Card, Group, Loader, Stack, Text, UnstyledButton } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconList, IconPlus } from '@tabler/icons-react'
import { useState } from 'react'
import { SaveProgressionModal } from '../progression/SaveProgressionModal'
import { useProgressionsByExercise } from '../progression/useProgressionsByExercise'
import type { ExerciseDef, ProgressionDef } from '../../../domain'

function stepCount(p: ProgressionDef): number {
  return p.body.volumeSets.length
}

export function ProgressionsSection({ exercise }: { exercise: ExerciseDef }) {
  const { data: progressions = [], isLoading } = useProgressionsByExercise(exercise.id as string)
  const [addOpen, { open: openAdd, close: closeAdd }] = useDisclosure(false)
  const [viewProgression, setViewProgression] = useState<ProgressionDef | null>(null)

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="center">
        <Text size="xs" c="dimmed" fw={500}>Progressions</Text>
        <Button
          variant="subtle"
          size="xs"
          leftSection={<IconPlus size={12} />}
          onClick={e => { e.stopPropagation(); openAdd() }}
        >
          Add
        </Button>
      </Group>

      {isLoading && <Loader size="xs" />}

      {!isLoading && progressions.length === 0 && (
        <Text size="xs" c="dimmed">None yet.</Text>
      )}

      {progressions.map(p => (
        <UnstyledButton
          key={p.id as string}
          onClick={e => { e.stopPropagation(); setViewProgression(p) }}
        >
          <Card withBorder radius="sm" p="xs">
            <Group gap="xs" align="center">
              <IconList size={14} style={{ flexShrink: 0 }} />
              <Stack gap={0} style={{ flex: 1 }}>
                <Text size="sm" fw={500}>{p.name}</Text>
                <Text size="xs" c="dimmed">{stepCount(p)} step{stepCount(p) !== 1 ? 's' : ''}</Text>
              </Stack>
              <Badge variant="outline" size="xs">{p.body.kind}</Badge>
            </Group>
          </Card>
        </UnstyledButton>
      ))}

      <SaveProgressionModal
        opened={addOpen}
        onClose={closeAdd}
        exercise={exercise}
      />

      {viewProgression && (
        <SaveProgressionModal
          opened={!!viewProgression}
          onClose={() => setViewProgression(null)}
          exercise={exercise}
          progression={viewProgression}
        />
      )}
    </Stack>
  )
}
