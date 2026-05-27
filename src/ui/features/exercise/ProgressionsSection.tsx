import { Badge, Button, Card, Group, Loader, Menu, Stack, Text, UnstyledButton } from '@mantine/core'
import { IconChevronDown, IconList, IconPlus } from '@tabler/icons-react'
import { useState } from 'react'
import { SaveProgressionModal } from '../progression/SaveProgressionModal'
import type { ProgressionKind } from '../progression/saveProgressionState'
import { useProgressionsByExercise } from '../progression/useProgressionsByExercise'
import type { ExerciseDef, ProgressionDef } from '../../../domain'

function stepCount(p: ProgressionDef): number {
  return p.body.volumeSets.length
}

export function ProgressionsSection({ exercise }: { exercise: ExerciseDef }) {
  const { data: progressions = [], isLoading } = useProgressionsByExercise(exercise.id as string)
  const [addKind, setAddKind] = useState<ProgressionKind | null>(null)
  const [viewProgression, setViewProgression] = useState<ProgressionDef | null>(null)

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="center">
        <Text size="xs" c="dimmed" fw={500}>Progressions</Text>
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconPlus size={12} />}
              rightSection={<IconChevronDown size={12} />}
              onClick={e => e.stopPropagation()}
            >
              Add
            </Button>
          </Menu.Target>
          <Menu.Dropdown onClick={e => e.stopPropagation()}>
            <Menu.Item onClick={() => setAddKind('linear')}>Linear</Menu.Item>
            <Menu.Item onClick={() => setAddKind('heavyLight')}>Heavy/Light</Menu.Item>
          </Menu.Dropdown>
        </Menu>
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

      {addKind && (
        <SaveProgressionModal
          opened={!!addKind}
          onClose={() => setAddKind(null)}
          exercise={exercise}
          kind={addKind}
        />
      )}

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
